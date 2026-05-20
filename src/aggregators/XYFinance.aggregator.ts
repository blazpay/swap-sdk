import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";

const XY_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const BASE_URL = "https://aggregator-api.xy.finance/v1";

export default class XYFinanceAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.XY_FINANCE;
  }

  private resolveToken(address: string): string {
    return this.isNativeAddresss(address) ? XY_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const query: Record<string, any> = {
      srcChainId:           params.fromChain.id,
      srcQuoteTokenAddress: this.resolveToken(params.fromToken.address),
      srcQuoteTokenAmount:  ethers.parseUnits(String(params.amount), params.fromToken.decimals).toString(),
      dstChainId:           params.toChain.id,
      dstQuoteTokenAddress: this.resolveToken(params.toToken.address),
      slippage:             params.slippage ?? 1,
    };

    const data = await apiCall({
      method: "GET",
      url: `${BASE_URL}/quote`,
      params: query,
    });

    if (!data?.success || !data?.routes?.length) {
      throw new Error("XY Finance: no route found");
    }

    const route = data.routes[0];
    const dstAmount = route?.dstQuoteTokenAmount;
    if (!dstAmount) throw new Error("XY Finance: no output amount");

    const swapAmount = ethers.formatUnits(dstAmount, params.toToken.decimals);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.XY_FINANCE,
      route: route.bridgeDescription?.provider || "XY Finance",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 1,
      allowanceTo: route.contractAddress,
    };

    // Store route-specific fields needed by buildTx — XY Finance requires
    // bridge/swap provider names extracted from the quote response.
    const xyMeta: Record<string, any> = {};
    if (route.bridgeDescription) {
      xyMeta.bridgeProvider        = route.bridgeDescription.provider;
      xyMeta.srcBridgeTokenAddress = route.bridgeDescription.srcBridgeTokenAddress;
      xyMeta.dstBridgeTokenAddress = route.bridgeDescription.dstBridgeTokenAddress;
    }
    if (route.srcSwapDescription) xyMeta.srcSwapProvider = route.srcSwapDescription.provider;
    if (route.dstSwapDescription) xyMeta.dstSwapProvider = route.dstSwapDescription.provider;

    return new Quote(data, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain:   { id: params.toChain.id,   name: params.toChain.name.toLowerCase() },
      slippageTolerance: params.slippage ?? 1,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: { ...query, ...xyMeta },
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const p = restProps.quotePayload;
    const recipient = restProps.dstWalletAddress || restProps.srcWalletAddress;

    const buildParams: Record<string, any> = {
      srcChainId:           p.srcChainId,
      srcQuoteTokenAddress: p.srcQuoteTokenAddress,
      srcQuoteTokenAmount:  p.srcQuoteTokenAmount,
      dstChainId:           p.dstChainId,
      dstQuoteTokenAddress: p.dstQuoteTokenAddress,
      slippage:             p.slippage,
      receiver:             recipient,
    };

    if (p.bridgeProvider) {
      buildParams.bridgeProvider        = p.bridgeProvider;
      buildParams.srcBridgeTokenAddress = p.srcBridgeTokenAddress;
      buildParams.dstBridgeTokenAddress = p.dstBridgeTokenAddress;
    }
    if (p.srcSwapProvider) buildParams.srcSwapProvider = p.srcSwapProvider;
    if (p.dstSwapProvider) buildParams.dstSwapProvider = p.dstSwapProvider;

    const fresh = await apiCall({
      method: "GET",
      url: `${BASE_URL}/buildTx`,
      params: buildParams,
    });

    if (!fresh?.success || !fresh?.tx) {
      throw new Error("XY Finance: failed to build transaction");
    }

    return {
      tx: {
        to:    fresh.tx.to,
        data:  fresh.tx.data,
        value: fresh.tx.value ?? "0",
        from:  restProps.srcWalletAddress,
      },
      spender: fresh.tx.to,
    };
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    try {
      const res = await apiCall({
        method: "GET",
        url: `${BASE_URL}/crossChainStatus`,
        params: { srcChainId: chainId, srcTxHash: hash },
      });

      if (!res?.success) return { status: "not_found", hash };

      const s = (res.status || "").toLowerCase();
      const status =
        s === "done"      ? "success" :
        s === "refunded"  ? "failed"  :
        s === "not found" ? "not_found" : "pending";

      return { status, hash, destinationTxHash: res.tx || undefined, raw: res };
    } catch {
      return { status: "not_found", hash };
    }
  }
}
