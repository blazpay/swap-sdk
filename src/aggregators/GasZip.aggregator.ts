import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

/**
 * Gas.zip — native-token refuel bridge.
 *
 * One-direction: native on source chain → native on destination chain(s).
 * Cannot handle ERC20 in or out. We early-return when the request isn't
 * a pure native→native bridge so the UI doesn't list us for unsupported
 * pairs.
 *
 * Docs: https://dev.gas.zip/gas/api/overview
 */
export default class GasZipAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.GAS_ZIP;
    this.BASE_URL = baseUrl + "/gas-zip";
  }

  private firstQuote(data: any): any | null {
    const quotes = Array.isArray(data?.quotes) ? data.quotes : null;
    if (quotes && quotes.length) return quotes[0];
    // Some responses inline a single quote at the top level.
    if (data?.tx?.to && data?.tx?.value) return data;
    return null;
  }

  private firstExpectedReceived(quote: any, destChainId: number): any | null {
    const list =
      quote?.expectedReceived ||
      quote?.expectedDeposits ||
      quote?.expected ||
      [];
    if (!Array.isArray(list) || !list.length) return null;
    const match = list.find((r: any) => Number(r?.chain) === destChainId);
    return match || list[0];
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (!this.isNativeAddresss(params.fromToken.address)) {
      throw new Error("Gas.zip supports native source token only");
    }
    if (!this.isNativeAddresss(params.toToken.address)) {
      throw new Error("Gas.zip supports native destination token only");
    }
    if (params.fromChain.id === params.toChain.id) {
      throw new Error("Gas.zip is cross-chain only");
    }

    const amount = ethers
      .parseUnits(String(params.amount), params.fromToken.decimals)
      .toString();
    const recipient = params.dstWalletAddress || params.srcWalletAddress;

    const query = {
      inboundChainId: params.fromChain.id,
      amount,
      recipient,
      to: String(params.toChain.id),
      from: params.srcWalletAddress,
    };

    const data = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/quote`,
      params: query,
    });

    const quote = this.firstQuote(data);
    const tx = quote?.tx || quote;
    if (!tx?.to || !tx?.value) {
      throw new Error("Gas.zip: no route found");
    }

    const received = this.firstExpectedReceived(quote, params.toChain.id);
    const outRawAmount = received?.amount ?? received?.convertedAmount ?? "0";

    const swapAmount = ethers.formatUnits(outRawAmount, params.toToken.decimals);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.GAS_ZIP,
      route: "Gas.zip",
      amount: Number(swapAmount),
      usdAmount: Number(quote?.expectedUsd ?? 0),
      networkFee: 0,
      platformFee: Number(quote?.fee ?? 0),
      priceImpact: 0,
      slippage: 0,
      allowanceTo: tx.to,
      timeEstimate:
        typeof quote?.estimatedTime === "number"
          ? quote.estimatedTime
          : undefined,
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
      slippageTolerance: 0,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: query,
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const fresh = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/quote`,
      params: restProps.quotePayload,
    });
    const quote = this.firstQuote(fresh);
    const tx = quote?.tx || quote;
    if (!tx?.to || !tx?.value) {
      throw new Error("Gas.zip: re-quote produced no transaction");
    }
    return {
      tx: {
        data: tx.data || "0x",
        from: restProps.srcWalletAddress,
        to: tx.to,
        value: String(tx.value),
        gasLimit: tx.gas ? Number(tx.gas) : undefined,
      },
      spender: tx.to,
    };
  }

  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    try {
      const res = await apiCall({
        method: "GET",
        url: `${this.BASE_URL}/status`,
        params: { txHash: hash },
      });
      const s = (res?.status || res?.state || "").toLowerCase();
      const status =
        s === "completed" || s === "success" || s === "filled"
          ? "success"
          : s === "failed" || s === "expired" || s === "refunded"
          ? "failed"
          : s
          ? "pending"
          : "not_found";
      const destinationTxHash =
        res?.outboundTxHash ||
        res?.fillTxHash ||
        res?.destinationTxHash ||
        res?.txOut?.hash;
      return { status, hash, destinationTxHash, raw: res };
    } catch (_) {
      return { status: "not_found", hash };
    }
  }
}
