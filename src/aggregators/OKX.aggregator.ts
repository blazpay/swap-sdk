import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

/**
 * OKX OnchainOS DEX aggregator.
 *
 * Single-chain swap only (their cross-chain product lives at a different
 * API path and isn't wired here).
 *
 * Routes through bz-backend's /defi/okx/* proxy because the OKX V5 auth
 * scheme requires an HMAC over (timestamp + method + path + body) keyed
 * with a secret that must stay server-side.
 *
 * Docs: https://web3.okx.com/onchainos/dev-docs/trade/dex-swap
 */
const OKX_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default class OKXAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.OKX;
    this.BASE_URL = baseUrl + "/okx";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? OKX_NATIVE : address;
  }

  private buildParams(params: IQuoteParams): Record<string, any> {
    return {
      chainIndex: String(params.fromChain.id),
      fromTokenAddress: this.resolveTokenAddress(params.fromToken.address),
      toTokenAddress: this.resolveTokenAddress(params.toToken.address),
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      slippagePercent: String(params.slippage ?? 1),
      userWalletAddress: params.srcWalletAddress,
      swapReceiverAddress:
        params.dstWalletAddress || params.srcWalletAddress,
      swapMode: "exactIn",
    };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("OKX: single-chain swap only");
    }

    const query = this.buildParams(params);

    // /swap returns routerResult + tx in one call; we use the same shape
    // for both quote and getTransactionData so we don't have to re-quote.
    const data = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/swap`,
      params: query,
    });

    if (data?.code && String(data.code) !== "0") {
      throw new Error(`OKX: ${data?.msg || data?.message || "no route"}`);
    }

    const item = data?.data?.[0];
    const router = item?.routerResult;
    const tx = item?.tx;
    const outRaw = router?.toTokenAmount;
    if (!tx?.to || !tx?.data || !outRaw) {
      throw new Error("OKX: no route found");
    }

    const swapAmount = ethers.formatUnits(outRaw, params.toToken.decimals);

    // OKX returns estimateGasFee in source-chain native (wei). We don't
    // have a USD oracle here; report 0 and let the FE wallet show actual
    // gas at submit time.
    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.OKX,
      route: "OKX",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: Number(router?.toTokenAmountUsd ?? 0),
      networkFee: 0,
      platformFee: 0,
      priceImpact: Number(router?.priceImpactPercent ?? 0),
      slippage: params.slippage ?? 1,
      allowanceTo: tx.to,
      timeEstimate: undefined,
    };

    return new Quote(data, meta, {
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
      quotePayload: query,
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // OKX quotes go stale fast — refetch /swap right before broadcast.
    const fresh = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/swap`,
      params: restProps.quotePayload,
    });
    const tx = fresh?.data?.[0]?.tx;
    if (!tx?.to || !tx?.data) {
      throw new Error("OKX: re-quote produced no transaction");
    }
    return {
      tx: {
        data: tx.data,
        from: restProps.srcWalletAddress,
        to: tx.to,
        value: tx.value ?? "0",
        gasLimit: tx.gas ? Number(tx.gas) : undefined,
      },
      spender: tx.to,
    };
  }

  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    // OKX's aggregator endpoint doesn't ship a separate per-tx status
    // API — single-chain swaps are confirmed by the source-chain receipt
    // and the FE polls the proxy's relayer/RPC for that. Return "pending"
    // here so the SDK falls back to RPC receipt polling.
    return { status: "pending", hash };
  }
}
