import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";

const DEBRIDGE_NATIVE = "0x0000000000000000000000000000000000000000";
const BASE_URL = "https://api.dln.trade/v1.0";

export default class DeBridgeAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.DEBRIDGE;
  }

  private resolveToken(address: string): string {
    return this.isNativeAddresss(address) ? DEBRIDGE_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    return params.fromChain.id !== params.toChain.id
      ? this.getCrossChainQuote(params)
      : this.getSameChainQuote(params);
  }

  private async getCrossChainQuote(params: IQuoteParams): Promise<Quote> {
    const recipient = params.dstWalletAddress || params.srcWalletAddress;

    const query: Record<string, any> = {
      srcChainId:                   params.fromChain.id,
      srcChainTokenIn:              this.resolveToken(params.fromToken.address),
      srcChainTokenInAmount:        ethers.parseUnits(String(params.amount), params.fromToken.decimals).toString(),
      dstChainId:                   params.toChain.id,
      dstChainTokenOut:             this.resolveToken(params.toToken.address),
      dstChainTokenOutRecipient:    recipient,
      srcChainOrderAuthorityAddress: params.srcWalletAddress,
      dstChainOrderAuthorityAddress: recipient,
      prependOperatingExpenses:     true,
      affiliateFeePercent:          0,
    };

    const data = await apiCall({
      method: "GET",
      url: `${BASE_URL}/dln/order/create-tx`,
      params: query,
    });

    const dstAmount = data?.estimation?.dstChainTokenOut?.amount;
    if (!dstAmount) throw new Error("deBridge: no cross-chain route found");

    const swapAmount = ethers.formatUnits(dstAmount, params.toToken.decimals);
    const tx = data?.tx;

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.DEBRIDGE,
      route: "deBridge",
      amount: Number(swapAmount),
      usdAmount: Number(data?.estimation?.dstChainTokenOut?.approximateUsdValue ?? 0),
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 1,
      allowanceTo: tx?.to || tx?.allowanceTarget,
      timeEstimate: data?.order?.approximateFulfillmentDelay
        ? Number(data.order.approximateFulfillmentDelay) * 60
        : undefined,
    };

    return new Quote(data, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain:   { id: params.toChain.id,   name: params.toChain.name.toLowerCase() },
      slippageTolerance: params.slippage ?? 1,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: query,
    });
  }

  private async getSameChainQuote(params: IQuoteParams): Promise<Quote> {
    const query: Record<string, any> = {
      chainId:          params.fromChain.id,
      tokenIn:          this.resolveToken(params.fromToken.address),
      tokenInAmount:    ethers.parseUnits(String(params.amount), params.fromToken.decimals).toString(),
      tokenOut:         this.resolveToken(params.toToken.address),
      tokenOutRecipient: params.dstWalletAddress || params.srcWalletAddress,
      senderAddress:    params.srcWalletAddress,
      slippage:         "auto",
      _sameChain:       true,
    };

    const data = await apiCall({
      method: "GET",
      url: `${BASE_URL}/chain/transaction`,
      params: { ...query, _sameChain: undefined },
    });

    const outAmount = data?.tokenOut?.amount;
    const tx = data?.tx;
    if (!outAmount || !tx?.to) throw new Error("deBridge: no same-chain route found");

    const swapAmount = ethers.formatUnits(outAmount, params.toToken.decimals);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.DEBRIDGE,
      route: "deBridge",
      amount: Number(swapAmount),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 1,
      allowanceTo: tx.to,
    };

    return new Quote(data, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain:   { id: params.toChain.id,   name: params.toChain.name.toLowerCase() },
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
    const isSameChain = restProps.quotePayload?._sameChain === true;
    const { _sameChain: _omit, ...apiParams } = restProps.quotePayload ?? {};

    if (isSameChain) {
      const fresh = await apiCall({
        method: "GET",
        url: `${BASE_URL}/chain/transaction`,
        params: apiParams,
      });
      const tx = fresh?.tx;
      if (!tx?.to || !tx?.data) throw new Error("deBridge: same-chain tx missing");
      return {
        tx: { to: tx.to, data: tx.data, value: tx.value ?? "0", from: restProps.srcWalletAddress },
        spender: tx.to,
      };
    }

    const fresh = await apiCall({
      method: "GET",
      url: `${BASE_URL}/dln/order/create-tx`,
      params: apiParams,
    });
    const tx = fresh?.tx;
    if (!tx?.to || !tx?.data) throw new Error("deBridge: cross-chain tx missing");
    return {
      tx: { to: tx.to, data: tx.data, value: tx.value ?? "0", from: restProps.srcWalletAddress },
      spender: tx.to,
    };
  }

  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    try {
      const idsRes = await apiCall({
        method: "GET",
        url: `${BASE_URL}/dln/tx/${hash}/order-ids`,
      });
      const orderId = idsRes?.orderIds?.[0];
      if (!orderId) return { status: "pending", hash };

      const statusRes = await apiCall({
        method: "GET",
        url: `${BASE_URL}/dln/order/${orderId}/status`,
      });

      const s: string = statusRes?.status || "";
      const status =
        s === "Fulfilled" || s === "ClaimedUnlock"       ? "success" :
        s === "OrderCancelled" || s === "ClaimedOrderCancel" ? "failed" :
        s === "None"                                      ? "not_found" :
                                                            "pending";

      return { status, hash, orderId, raw: statusRes };
    } catch {
      return { status: "not_found", hash };
    }
  }
}
