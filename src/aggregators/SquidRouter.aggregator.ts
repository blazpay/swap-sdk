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

    // Sum every entry — Squid often splits gas (BSC tx + Axelar) and
    // fees (relayer + protocol) across multiple array items. Showing
    // only [0] under-reports.
    const sumUsd = (arr: any) =>
      Array.isArray(arr)
        ? arr.reduce((s, x) => s + (Number(x?.amountUSD) || 0), 0)
        : 0;

    const fromAmountUsd = Number(estimate?.fromAmountUSD ?? 0);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.SQUID_ROUTER,
      route: "Squid",
      amount: Number(swapAmount),
      usdAmount: Number(estimate?.toAmountUSD ?? 0),
      networkFee: sumUsd(estimate?.gasCosts).toFixed(6),
      platformFee: sumUsd(estimate?.feeCosts).toFixed(6),
      blazpayFeePercent: 0.001,
      blazpayFeeUsd: fromAmountUsd * 0.001,
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
      // Route through bz-backend proxy. Direct browser calls to Squid's
      // /v2/status are blocked by CORS because the required
      // `x-integrator-id` header triggers a preflight Squid rejects for
      // browser origins.
      const res = await apiCall({
        method: "GET",
        url: `${this.BASE_URL}/status`,
        params: { transactionId: hash, fromChainId: chainId },
      });
      const s = (res?.status || res?.squidTransactionStatus || "").toLowerCase();
      const status =
        s === "success" ||
        s === "destination_executed" ||
        s === "partial_success" // tokens delivered; only downstream call failed
          ? "success"
          : s === "needs_gas" || s === "partial_needs_gas" || s === "failed"
          ? "failed"
          : s
          ? "pending"
          : "not_found";
      const destinationTxHash =
        res?.toChain?.transactionId ||
        res?.toChain?.callsStatus?.transactionHash ||
        res?.destinationTxHash;
      return { status, hash, destinationTxHash, raw: res };
    } catch (_) {
      return { status: "not_found", hash };
    }
  }
}
