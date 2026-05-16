import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

// Squid v2 uses a single sentinel for native: the 0xEee... mixed-case address.
const SQUID_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default class SquidRouterAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.SQUID_ROUTER;
    // bz-backend proxies the v2 endpoint and holds the x-integrator-id.
    this.BASE_URL = baseUrl + "/squidrouter";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? SQUID_NATIVE : address;
  }

  private buildPayload(params: IQuoteParams): Record<string, any> {
    // Squid v2 requires chain IDs as STRINGS, not numbers.
    return {
      fromAddress: params.srcWalletAddress,
      fromChain: String(params.fromChain.id),
      fromToken: this.resolveTokenAddress(params.fromToken.address),
      fromAmount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      toChain: String(params.toChain.id),
      toToken: this.resolveTokenAddress(params.toToken.address),
      toAddress: params.dstWalletAddress || params.srcWalletAddress,
      slippage: params.slippage ?? 1,
      enableForecall: true,
      quoteOnly: false,
      receiveGasOnDestination: false,
    };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const payload = this.buildPayload(params);

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: payload,
    });

    const route = res?.data?.route ?? res?.route;
    const estimate = route?.estimate;
    const tx = route?.transactionRequest;

    if (!tx?.target || !estimate?.toAmount) {
      throw new Error("Squid Router: no route found");
    }

    const swapAmount = ethers.formatUnits(
      estimate.toAmount,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.SQUID_ROUTER,
      route: "Squid",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: Number(estimate?.toAmountUSD ?? 0),
      networkFee: Number(estimate?.gasCosts?.[0]?.amountUSD ?? 0).toFixed(6),
      platformFee: Number(estimate?.feeCosts?.[0]?.amountUSD ?? 0).toFixed(6),
      priceImpact: Number(estimate?.aggregatePriceImpact ?? 0),
      slippage: payload.slippage,
      allowanceTo: tx.target,
      timeEstimate: estimate?.estimatedRouteDuration ? Number(estimate.estimatedRouteDuration) : undefined,
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
      slippageTolerance: payload.slippage,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: payload,
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Squid quotes expire quickly — re-request to get fresh calldata.
    const fresh = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: restProps.quotePayload,
    });

    const tx = fresh?.data?.route?.transactionRequest ?? fresh?.route?.transactionRequest;
    if (!tx?.target || !tx?.data) {
      throw new Error("Squid Router: re-quote returned no transaction");
    }

    return {
      tx: {
        to: tx.target,
        data: tx.data,
        value: tx.value ?? "0",
        from: restProps.srcWalletAddress,
        gasLimit: tx.gasLimit ? Number(tx.gasLimit) : undefined,
      },
      spender: tx.target,
    };
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    try {
      // Squid v2 status (public direct call). Requires transactionId
      // (= source tx hash) and fromChainId. quoteId / requestId optional but
      // recommended for Coral V2 — we omit since the caller may not have it.
      const res = await apiCall({
        method: "GET",
        url: "https://v2.api.squidrouter.com/v2/status",
        params: { transactionId: hash, fromChainId: chainId },
        headers: {
          "x-integrator-id": "blazpay-db534a27-fefd-4504-b5bd-a7e6407bd656",
        },
      });
      const s = (res?.status || res?.squidTransactionStatus || "").toLowerCase();
      const status =
        s === "success" || s === "destination_executed"
          ? "success"
          : s === "needs_gas" || s === "partial_success" || s === "failed"
          ? "failed"
          : s
          ? "pending"
          : "not_found";
      return { status, hash, raw: res };
    } catch (_) {
      return { status: "not_found", hash };
    }
  }
}
