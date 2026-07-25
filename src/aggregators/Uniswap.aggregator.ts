import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl, addressZero } from "../utils/constants.js";

/**
 * Uniswap (Trading API, CLASSIC routing) — single-chain swap.
 *
 * Purpose: same-chain swaps on chains whose Uniswap pools no other
 * integrated aggregator indexes. Currently gated to Robinhood Chain (4663),
 * where Uniswap is effectively the only on-chain liquidity source.
 *
 * Routes through bz-backend's /defi/uniswap/* proxy so the Uniswap Trading
 * API key stays server-side (x-api-key header, injected by the proxy).
 *
 * PHASE 1 — native-input only (ETH -> token). BlazpayRelayer's native path
 * just forwards msg.value into the Universal Router call, and the Uniswap
 * swap credits `swapper` (= the user) directly, so no token custody or
 * approval passes through the relayer. ERC20-input swaps need Uniswap's
 * Permit2 flow, which the relayer's single `approve(spender)+call` model
 * can't satisfy in one meta-tx — deferred to a later phase.
 *
 * Docs: https://uniswap.org/api / trade-api.gateway.uniswap.org
 */
const UNISWAP_CHAINS = new Set<number>([4663]); // Robinhood
// Uniswap Trading API represents native ETH as the zero address.
const UNISWAP_NATIVE = "0x0000000000000000000000000000000000000000";

export default class UniswapAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.UNISWAP;
    this.BASE_URL = baseUrl + "/uniswap";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? UNISWAP_NATIVE : address;
  }

  private buildQuoteBody(params: IQuoteParams): Record<string, any> {
    // swapper = the user (output recipient). We execute through the relayer,
    // which for native input forwards msg.value to the Universal Router; the
    // router credits `swapper`, so output lands on the user. msg.sender (the
    // relayer) need not be the swapper because native input needs no pull.
    const user = params.dstWalletAddress || params.srcWalletAddress;
    return {
      type: "EXACT_INPUT",
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      tokenInChainId: params.fromChain.id,
      tokenOutChainId: params.toChain.id,
      tokenIn: this.resolveTokenAddress(params.fromToken.address),
      tokenOut: this.resolveTokenAddress(params.toToken.address),
      swapper: user,
      routing: "CLASSIC",
    };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("Uniswap: single-chain swap only");
    }
    if (!UNISWAP_CHAINS.has(params.fromChain.id)) {
      throw new Error(`Uniswap: chain ${params.fromChain.id} not enabled`);
    }
    if (!this.isNativeAddresss(params.fromToken.address)) {
      // Phase 1: native-input only (ERC20 input pending Permit2 support).
      throw new Error("Uniswap: native-input swaps only");
    }

    const body = this.buildQuoteBody(params);
    const res = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: body,
    });

    const q = res?.quote;
    const outRaw = q?.output?.amount;
    if (!outRaw) {
      throw new Error("Uniswap: no route");
    }

    const swapAmount = ethers.formatUnits(outRaw, params.toToken.decimals);
    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.UNISWAP,
      route: "Uniswap",
      amount: Number(swapAmount),
      usdAmount: Number(q?.output?.amountUSD ?? 0),
      networkFee: Number(q?.gasFeeUSD ?? 0),
      platformFee: 0,
      priceImpact: Number(q?.priceImpact ?? 0),
      slippage: params.slippage ?? 1,
      // Native input needs no approval target.
      allowanceTo: addressZero,
      timeEstimate: undefined,
    };

    return new Quote(res, meta, {
      fromChain: {
        id: params.fromChain.id,
        name: params.fromChain.name.toLowerCase(),
      },
      toChain: {
        id: params.toChain.id,
        name: params.toChain.name.toLowerCase(),
      },
      slippageTolerance: params.slippage ?? 1,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: body,
    } as any);
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Uniswap quotes expire fast — re-quote fresh, then build the swap tx.
    const fresh = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: (restProps as any).quotePayload,
    });
    if (!fresh?.quote) {
      throw new Error("Uniswap: re-quote produced no route");
    }

    const swapRes = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/swap`,
      // simulateTransaction:false — the swapper (user) may not hold the input
      // at build time (the relayer supplies the ETH), so a Uniswap-side
      // simulation would spuriously fail. We validate via the relayer's own
      // staticCall path instead.
      data: { quote: fresh.quote, simulateTransaction: false },
    });

    const tx = swapRes?.swap;
    if (!tx?.to || !tx?.data) {
      throw new Error("Uniswap: swap build produced no transaction");
    }

    return {
      tx: {
        data: tx.data,
        from: restProps.srcWalletAddress,
        to: tx.to, // Universal Router
        value: tx.value ?? "0",
        gasLimit: tx.gasLimit ? Number(tx.gasLimit) : undefined,
      },
      // Native input → no ERC20 approval; keep tx.to for shape consistency.
      spender: tx.to,
    };
  }

  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    // Single-chain swap — confirmed by the source-chain receipt; the SDK
    // falls back to RPC receipt polling.
    return { status: "pending", hash };
  }
}
