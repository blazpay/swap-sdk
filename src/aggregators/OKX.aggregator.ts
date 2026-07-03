import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl, relayerAddresses } from "../utils/constants.js";

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
    // OKX binds the returned tx calldata to userWalletAddress — internally it
    // emits transferFrom(userWalletAddress, okxRouter, amount). We execute
    // through BlazpayRelayer, which pulls tokens user→relayer, approves the
    // OKX router, then calls it. The on-chain pull is therefore from the
    // RELAYER (the new owner of the tokens + the approved caller), not from
    // the end user. Bind the calldata accordingly. The output still goes to
    // the user via swapReceiverAddress.
    const relayer = relayerAddresses(params.fromChain.id);
    return {
      chainIndex: String(params.fromChain.id),
      fromTokenAddress: this.resolveTokenAddress(params.fromToken.address),
      toTokenAddress: this.resolveTokenAddress(params.toToken.address),
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      slippagePercent: String(params.slippage ?? 1),
      userWalletAddress: relayer,
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
    const tokenAddr = this.resolveTokenAddress(params.fromToken.address);
    const isNativeInput = tokenAddr === OKX_NATIVE;

    // /swap returns routerResult + tx in one call; we use the same shape
    // for both quote and getTransactionData so we don't have to re-quote.
    // For ERC20-input swaps we also need OKX's DexProxy address — the
    // contract that actually pulls tokens via transferFrom — which is
    // *different* from tx.to (the DexRouter). Approving tx.to leaves the
    // proxy without allowance and the swap reverts with SafeERC20:
    // low-level call failed.
    const swapPromise = apiCall({
      method: "GET",
      url: `${this.BASE_URL}/swap`,
      params: query,
    });
    const approvePromise = isNativeInput
      ? Promise.resolve(null)
      : apiCall({
          method: "GET",
          url: `${this.BASE_URL}/approve-transaction`,
          params: {
            chainIndex: query.chainIndex,
            tokenContractAddress: tokenAddr,
            approveAmount: query.amount,
          },
        }).catch(() => null);

    const [data, approveData] = await Promise.all([swapPromise, approvePromise]);

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

    const dexProxy: string | undefined =
      approveData?.data?.[0]?.dexContractAddress;
    if (!isNativeInput && !dexProxy) {
      throw new Error("OKX: no approve target returned");
    }

    const swapAmount = ethers.formatUnits(outRaw, params.toToken.decimals);

    // OKX returns estimateGasFee in source-chain native (wei). We don't
    // have a USD oracle here; report 0 and let the FE wallet show actual
    // gas at submit time.
    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.OKX,
      route: "OKX",
      amount: Number(swapAmount),
      usdAmount: Number(router?.toTokenAmountUsd ?? 0),
      networkFee: 0,
      platformFee: 0,
      priceImpact: Number(router?.priceImpactPercent ?? 0),
      slippage: params.slippage ?? 1,
      // For ERC20 input, allowance must go to OKX's DexProxy (the contract
      // that calls transferFrom inside the swap), not to tx.to (DexRouter).
      // For native input, no allowance is needed — leave as tx.to.
      allowanceTo: dexProxy || tx.to,
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
      // Stash for getTransactionData so we don't have to refetch
      // /approve-transaction at broadcast time.
      okxDexProxy: dexProxy,
      okxIsNativeInput: isNativeInput,
    } as any);
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
    const dexProxy = (restProps as any)?.okxDexProxy as string | undefined;
    const isNativeInput = (restProps as any)?.okxIsNativeInput === true;
    // spender = the address the relayer forceApproves before calling tx.to.
    // For ERC20 input this MUST be OKX's DexProxy (the puller); for native
    // input no approval is needed but we keep tx.to for shape consistency.
    return {
      tx: {
        data: tx.data,
        from: restProps.srcWalletAddress,
        to: tx.to,
        value: tx.value ?? "0",
        gasLimit: tx.gas ? Number(tx.gas) : undefined,
      },
      spender: isNativeInput ? tx.to : (dexProxy || tx.to),
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
