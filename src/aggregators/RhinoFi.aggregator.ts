import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

/**
 * RhinoFi bridge + swap aggregator.
 *
 * Three-step flow:
 *   1. POST /bridge/quote/bridge-swap/user   → quoteId + sizing
 *   2. POST /bridge/quote/commit/{quoteId}   → commitmentId
 *   3. GET  /bridge/swap/calldata/{commitmentId} → tx (to/data/value)
 *
 * Chain identifiers are symbolic names like "ETHEREUM", "POLYGON_POS".
 * Tokens are symbols ("USDC", "ETH"). Resolved from the IQuoteParams
 * metadata.
 *
 * Docs: https://docs.rhino.fi/api-reference/
 */
const CHAIN_ID_TO_RHINO_NAME: Record<number, string> = {
  1: "ETHEREUM",
  10: "OPTIMISM",
  56: "BINANCE",
  100: "GNOSIS",
  137: "POLYGON_POS",
  324: "ZKSYNC",
  1101: "POLYGON_ZKEVM",
  5000: "MANTLE",
  8453: "BASE",
  34443: "MODE",
  42161: "ARBITRUM",
  43114: "AVALANCHE",
  59144: "LINEA",
  81457: "BLAST",
  534352: "SCROLL",
};

export default class RhinoFiAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.RHINO_FI;
    this.BASE_URL = baseUrl + "/rhino";
  }

  private chainName(chainId: number): string | null {
    return CHAIN_ID_TO_RHINO_NAME[chainId] ?? null;
  }

  private tokenSymbol(token: { symbol?: string; address?: string }): string {
    return (token?.symbol || "").toUpperCase();
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const chainIn = this.chainName(params.fromChain.id);
    const chainOut = this.chainName(params.toChain.id);
    if (!chainIn || !chainOut) {
      throw new Error("RhinoFi: unsupported chain");
    }
    if (params.fromChain.id === params.toChain.id) {
      throw new Error("RhinoFi is cross-chain only");
    }

    const tokenIn = this.tokenSymbol(params.fromToken);
    const tokenOut = this.tokenSymbol(params.toToken);
    if (!tokenIn || !tokenOut) {
      throw new Error("RhinoFi: token symbol required");
    }

    // Body for POST /bridge/quote/bridge-swap/user
    const payload: Record<string, any> = {
      chainIn,
      chainOut,
      amount: String(params.amount),
      mode: "pay",
      tokenIn,
      tokenOut,
      depositor: params.srcWalletAddress,
      recipient: params.dstWalletAddress || params.srcWalletAddress,
    };

    const data = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: payload,
    });

    const receiveAmount =
      data?.receiveAmount ??
      data?.quote?.receiveAmount ??
      data?.amountOut;
    const quoteId = data?.quoteId || data?.quote?.quoteId || data?.id;
    if (!receiveAmount || !quoteId) {
      throw new Error("RhinoFi: no route found");
    }

    const swapAmount = ethers.formatUnits(
      String(receiveAmount),
      params.toToken.decimals
    );

    const fees = data?.fees || data?.quote?.fees || {};
    const networkFeeUsd = Number(fees?.gas?.amountUsd ?? fees?.gasUsd ?? 0);
    const platformFeeUsd = Number(fees?.bridge?.amountUsd ?? fees?.feeUsd ?? 0);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.RHINO_FI,
      route: "RhinoFi",
      amount: Number(swapAmount),
      usdAmount: Number(data?.receiveUsd ?? data?.quote?.receiveUsd ?? 0),
      networkFee: networkFeeUsd.toFixed(6),
      platformFee: platformFeeUsd.toFixed(6),
      priceImpact: Number(data?.priceImpact ?? data?.quote?.priceImpact ?? 0),
      slippage: params.slippage ?? 0.5,
      allowanceTo: "",
      timeEstimate:
        data?.estimatedTimeMs
          ? Math.round(Number(data.estimatedTimeMs) / 1000)
          : data?.estimatedTimeSec
          ? Number(data.estimatedTimeSec)
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
      slippageTolerance: params.slippage ?? 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: { ...payload, quoteId },
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const quoteId = restProps.quotePayload?.quoteId;
    if (!quoteId) throw new Error("RhinoFi: missing quoteId");

    // Step 2 — commit the quote.
    const commitResp = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/commit/${quoteId}`,
      data: {},
    });
    const commitmentId =
      commitResp?.commitmentId ||
      commitResp?.id ||
      commitResp?.commitment?.id;
    if (!commitmentId) {
      throw new Error("RhinoFi: commit returned no commitmentId");
    }

    // Step 3 — fetch the actual on-chain transaction.
    const callResp = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/calldata/${commitmentId}`,
    });
    const tx =
      callResp?.transaction ||
      callResp?.tx ||
      callResp?.payTransaction ||
      callResp;
    if (!tx?.to || !tx?.data) {
      throw new Error("RhinoFi: calldata response missing tx");
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
    // RhinoFi exposes a per-deposit status endpoint only for the SDA
    // (Smart Deposit Address) flow. For calldata-based bridges the
    // source tx hash is the canonical id; once it lands, the
    // destination fill is asynchronous and can be looked up via
    // /sda/deposit-addresses/:depositAddress/:depositChain when the
    // depositAddress is available. Without one, we surface "pending".
    const depositChain = this.chainName(chainId);
    if (!depositChain || !hash) return { status: "pending", hash };
    try {
      const res = await apiCall({
        method: "GET",
        url: `${this.BASE_URL}/deposit-addresses/${hash}/${depositChain}`,
      });
      const s = (res?.status || res?.state || "").toLowerCase();
      const status =
        s === "fulfilled" || s === "completed" || s === "success"
          ? "success"
          : s === "failed" || s === "expired" || s === "refunded"
          ? "failed"
          : s
          ? "pending"
          : "pending";
      const destinationTxHash =
        res?.fulfillmentTxHash ||
        res?.destinationTxHash ||
        res?.outboundTxHash;
      return { status, hash, destinationTxHash, raw: res };
    } catch (_) {
      return { status: "pending", hash };
    }
  }
}
