import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

const ACROSS_NATIVE = "0x0000000000000000000000000000000000000000";

export default class AcrossAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.ACROSS;
    this.BASE_URL = baseUrl + "/across";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? ACROSS_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    // Across is a bridge protocol. Same-chain requests are rejected by their
    // routing engine ("No bridge routes found for X -> X").
    if (params.fromChain.id === params.toChain.id) {
      throw new Error("Across supports cross-chain bridging only");
    }

    const query: Record<string, any> = {
      tradeType: "exactInput",
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      inputToken: this.resolveTokenAddress(params.fromToken.address),
      outputToken: this.resolveTokenAddress(params.toToken.address),
      originChainId: params.fromChain.id,
      destinationChainId: params.toChain.id,
      depositor: params.srcWalletAddress,
      recipient: params.dstWalletAddress || params.srcWalletAddress,
      slippage: params.slippage != null ? params.slippage / 100 : "auto",
    };

    const data = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/quote`,
      params: query,
    });

    const tx = data?.swapTx;
    const outputAmount = data?.expectedOutputAmount ?? data?.minOutputAmount;
    if (!tx?.to || !tx?.data || !outputAmount) {
      throw new Error("Across: no route found");
    }

    const swapAmount = ethers.formatUnits(
      outputAmount,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.ACROSS,
      route: "Across",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: tx.to,
      timeEstimate: data?.expectedFillTime ? Number(data.expectedFillTime) : undefined,
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

    const tx = fresh?.swapTx;
    if (!tx?.to || !tx?.data) {
      throw new Error("Across: re-quote produced no transaction");
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

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    try {
      const res = await apiCall({
        method: "GET",
        url: `${this.BASE_URL}/status`,
        params: { originChainId: chainId, depositTxHash: hash },
      });
      const s = (res?.status || res?.fillStatus || "").toLowerCase();
      const status =
        s === "filled" || s === "success"
          ? "success"
          : s === "expired" || s === "refunded" || s === "failed"
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
