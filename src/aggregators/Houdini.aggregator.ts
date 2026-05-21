import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { getConfig } from "../utils/config.js";

const BASE_URL = "https://api-partner.houdiniswap.com/v2";

// Houdini order status codes
// -2: cancelled, -1: failed, 0: initializing, 1: new, 2: waiting,
//  3: confirming, 4: exchanging, 5: sending, 6: success, 7: refunded, 8: stale
const isSuccess = (s: number) => s === 6;
const isFailed  = (s: number) => s === -1 || s === -2 || s === 7;

export default class HoudiniAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.HOUDINI;
  }

  private apiKey(): string {
    return getConfig().houdiniApiKey || "";
  }

  private headers(): Record<string, string> {
    return { Authorization: this.apiKey() };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const apiKey = this.apiKey();
    if (!apiKey) throw new Error("Houdini: houdiniApiKey not configured");

    const queryParams: Record<string, any> = {
      amount: params.amount,
      fromChain: String(params.fromChain.id),
      toChain: String(params.toChain.id),
      "types[]": "private",
      senderAddress: params.srcWalletAddress,
      receiverAddress: params.dstWalletAddress || params.srcWalletAddress,
      sort: "amountOut",
      sortOrder: "desc",
    };

    // Omit token address for native tokens — Houdini identifies them by chain alone
    if (!this.isNativeAddresss(params.fromToken.address)) {
      queryParams.fromTokenAddress = params.fromToken.address;
    }
    if (!this.isNativeAddresss(params.toToken.address)) {
      queryParams.toTokenAddress = params.toToken.address;
    }

    const res = await apiCall({
      method: "GET",
      url: `${BASE_URL}/quotes/byChainAddress`,
      params: queryParams,
      headers: this.headers(),
    });

    const quotes = res?.quotes;
    if (!Array.isArray(quotes) || quotes.length === 0) {
      throw new Error("Houdini: no private quotes available for this pair");
    }

    const best = quotes[0];
    const amountOut = Number(best.netAmountOut ?? best.amountOut ?? 0);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.HOUDINI,
      route: best.swapName || "Houdini Private",
      amount: Number(amountOut.toFixed(6)),
      usdAmount: Number(best.amountOutUsd ?? 0),
      networkFee: Number(best.gasUsd ?? 0),
      platformFee: Number(best.feeUsd ?? 0),
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: "",
      timeEstimate: best.duration ? Number(best.duration) * 60 : undefined,
    };

    return new Quote(res, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name },
      toChain:   { id: params.toChain.id,   name: params.toChain.name },
      slippageTolerance: params.slippage ?? 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: {
        quoteId: best.quoteId,
        fromTokenAddress: params.fromToken.address,
        fromDecimals: params.fromToken.decimals,
        isNativeToken: this.isNativeAddresss(params.fromToken.address),
        inputAmount: params.amount,
      },
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps,
  ): Promise<{ tx: any; spender: string; metaData?: any }> {
    const {
      quoteId,
      fromTokenAddress,
      fromDecimals,
      isNativeToken,
      inputAmount,
    } = restProps.quotePayload ?? {};

    const receiver = restProps.dstWalletAddress || restProps.srcWalletAddress;

    const order = await apiCall({
      method: "POST",
      url: `${BASE_URL}/exchanges`,
      data: {
        quoteId,
        addressTo: receiver,
        addressFrom: restProps.srcWalletAddress,
      },
      headers: this.headers(),
    });

    if (!order) throw new Error("Houdini: empty response from exchange creation");

    // Deposit address may be at different paths depending on API version
    const depositAddress: string =
      order?.inToken?.depositAddress ||
      order?.depositAddress ||
      order?.payinAddress;
    if (!depositAddress) {
      throw new Error("Houdini: exchange created but no deposit address returned");
    }

    const houdiniId: string = order.houdiniId || order.id;
    // inAmount is in display units (e.g., "0.5" ETH); fall back to user input
    const amountDisplay: string = (order.inAmount ?? inputAmount ?? 0).toString();

    let tx: any;
    if (isNativeToken) {
      const amountWei = ethers.parseUnits(amountDisplay, 18);
      tx = {
        to:    depositAddress,
        data:  "0x",
        value: amountWei.toString(),
        from:  restProps.srcWalletAddress,
      };
    } else {
      // ERC-20: direct transfer to deposit address (no router approval needed)
      const iface = new ethers.Interface([
        "function transfer(address to, uint256 amount) returns (bool)",
      ]);
      const amountWei = ethers.parseUnits(amountDisplay, fromDecimals ?? 18);
      tx = {
        to:    fromTokenAddress,
        data:  iface.encodeFunctionData("transfer", [depositAddress, amountWei]),
        value: "0",
        from:  restProps.srcWalletAddress,
      };
    }

    return {
      tx,
      spender: "",   // no BlazpayRelayer approval needed
      metaData: {
        depositAddress,
        houdiniId,
        isDirectTransfer: true,
        isNative: isNativeToken,
        amountIn: amountDisplay,
      },
    };
  }

  // hash here is the houdiniId stored during getTransactionData
  async getTxStatus(_chainId: number, houdiniId: string): Promise<any> {
    try {
      const res = await apiCall({
        method: "GET",
        url: `${BASE_URL}/orders/${houdiniId}`,
        headers: this.headers(),
      });

      const s: number = res?.status;
      const status =
        isSuccess(s) ? "success" :
        isFailed(s)  ? "failed"  :
        "pending";

      return { status, hash: houdiniId, raw: res };
    } catch {
      return { status: "not_found", hash: houdiniId };
    }
  }
}
