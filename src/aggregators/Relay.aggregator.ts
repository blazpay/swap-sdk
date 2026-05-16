import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

const RELAY_NATIVE = "0x0000000000000000000000000000000000000000";

export default class RelayAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.RELAY;
    // Routes through bz-backend's /defi/relay proxy so the optional
    // RELAY_API_KEY stays server-side (Relay imposes higher rate limits
    // for keyed requests).
    this.BASE_URL = baseUrl + "/relay";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? RELAY_NATIVE : address;
  }

  private buildPayload(params: IQuoteParams): Record<string, any> {
    return {
      user: params.srcWalletAddress,
      recipient: params.dstWalletAddress || params.srcWalletAddress,
      originChainId: params.fromChain.id,
      destinationChainId: params.toChain.id,
      originCurrency: this.resolveTokenAddress(params.fromToken.address),
      destinationCurrency: this.resolveTokenAddress(params.toToken.address),
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      tradeType: "EXACT_INPUT",
      slippageTolerance: Math.round((params.slippage ?? 0.5) * 100), // bps
      referrer: "blazpay",
    };
  }

  private firstTxFromSteps(steps: any[]): any | null {
    if (!Array.isArray(steps)) return null;
    for (const step of steps) {
      if (step?.kind !== "transaction") continue;
      const items = step?.items ?? [];
      for (const it of items) {
        if (it?.data?.to && it?.data?.data) return it.data;
      }
    }
    return null;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const payload = this.buildPayload(params);

    const data = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: payload,
    });

    const tx = this.firstTxFromSteps(data?.steps);
    const currencyOut = data?.details?.currencyOut ?? {};
    const outAmountRaw = currencyOut?.amount ?? "0";

    if (!tx || outAmountRaw === "0") {
      throw new Error("Relay: no route found");
    }

    const swapAmount = ethers.formatUnits(
      outAmountRaw,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.RELAY,
      route: "Relay",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: Number(currencyOut?.amountUsd ?? 0),
      networkFee: Number(data?.fees?.gas?.amountUsd ?? 0).toFixed(6),
      platformFee: Number(data?.fees?.relayerService?.amountUsd ?? 0).toFixed(
        6
      ),
      priceImpact: Number(data?.details?.totalImpact?.percent ?? 0),
      slippage: params.slippage ?? 0.5,
      allowanceTo: tx.to,
      timeEstimate: data?.details?.timeEstimate ? Number(data.details.timeEstimate) : undefined,
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
      slippageTolerance: params.slippage ?? 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: payload,
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Quotes embed the tx, but the deposit/swap step's calldata can go
    // stale quickly — re-quote with the original payload to get a fresh
    // transaction.
    const fresh = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: restProps.quotePayload,
    });

    const txData = this.firstTxFromSteps(fresh?.steps);
    if (!txData?.to || !txData?.data) {
      throw new Error("Relay: re-quote produced no transaction");
    }

    return {
      tx: {
        data: txData.data,
        from: restProps.srcWalletAddress,
        to: txData.to,
        value: txData.value ?? "0",
        gasLimit: txData.gas ? Number(txData.gas) : undefined,
      },
      spender: txData.to,
    };
  }

  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    try {
      const res = await apiCall({
        method: "GET",
        url: `${this.BASE_URL}/status`,
        params: { requestId: hash },
      });
      const s = (res?.status || "").toLowerCase();
      const status =
        s === "success" || s === "completed" || s === "done"
          ? "success"
          : s === "failed" || s === "refunded" || s === "expired"
          ? "failed"
          : s
          ? "pending"
          : "not_found";
      const destinationTxHash =
        res?.outTxs?.[0]?.hash ||
        res?.outTxs?.[0]?.txHash ||
        res?.destinationTxHash;
      return { status, hash, destinationTxHash, raw: res };
    } catch (_) {
      return { status: "not_found", hash };
    }
  }
}
