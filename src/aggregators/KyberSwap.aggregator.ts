import { ethers } from "ethers";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import { v4 as uuidv4 } from "uuid";

const KYBER_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default class KyberSwap extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.KYBER_SWAP;
    this.BASE_URL = "https://aggregator-api.kyberswap.com";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? KYBER_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("KyberSwap supports single-chain swaps only");
    }

    const tokenIn = this.resolveTokenAddress(params.fromToken.address);
    const tokenOut = this.resolveTokenAddress(params.toToken.address);

    const query = {
      tokenIn,
      tokenOut,
      amountIn: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      gasInclude: true,
      feeReceiver: "0x5222d5467DC61aFc2EfA95Ef76dCDe411e6e1D35",
      feeAmount: 1,
      isInBps: true,
      chargeFeeBy: "currency_out",
      source: "blazpay",
    };

    const res = await apiCall({
      method: "GET",
      url:
        this.BASE_URL +
        `/${params.fromChain.name?.toLowerCase()}/api/v1/routes`,
      params: query,
      headers: { "X-Client-Id": "blazpay" },
    });

    const data = res?.data;

    if (!data?.routeSummary?.amountOut || !data?.routerAddress) {
      throw new Error("KyberSwap: no route found");
    }

    const swapAmount = ethers
      .formatUnits(data.routeSummary.amountOut, params.toToken.decimals)
      .toString();

    // Convert the partner fee (a fraction of output, in output-token units)
    // into USD using the output amount-USD ratio that KyberSwap returns
    // alongside the route. Keep platformFee as a USD-number string so
    // numeric consumers (Number(...) / sums) work.
    const outAmount = Number(swapAmount);
    const outUsd = Number(data?.routeSummary?.amountOutUsd ?? 0);
    const usdPerOutToken = outAmount > 0 ? outUsd / outAmount : 0;
    const platformFeeOutToken =
      (outAmount * Number(data?.routeSummary?.extraFee?.feeAmount ?? 0)) / 10000;
    const platformFeeUsd = platformFeeOutToken * usdPerOutToken;

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.KYBER_SWAP,
      route: "KyberSwap",
      amount: Number(swapAmount),
      usdAmount: outUsd,
      networkFee: Number(data?.routeSummary?.gasUsd ?? 0).toFixed(6),
      platformFee: platformFeeUsd.toFixed(6),
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: data.routerAddress,
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
      slippageTolerance: (params.slippage ?? 0.5) * 100,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: query,
    });
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const slippageBps = Math.min(
      Math.max(Math.round((restProps.slippageTolerance ?? 50)), 0),
      2000
    );

    const payload = {
      routeSummary: data?.routeSummary,
      sender: restProps.srcWalletAddress,
      recipient: restProps?.dstWalletAddress || restProps.srcWalletAddress,
      slippageTolerance: slippageBps,
      source: "blazpay",
    };

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL + `/${restProps.fromChain.name}/api/v1/route/build`,
      data: JSON.stringify(payload),
      headers: { "X-Client-Id": "blazpay", "Content-Type": "application/json" },
    });

    const txData = res?.data;

    if (!txData?.data || !txData?.routerAddress) {
      throw new Error("KyberSwap: build returned no transaction");
    }

    const isNativeIn = this.isNativeAddresss(restProps.quotePayload.tokenIn);

    const tx = {
      data: txData.data,
      from: restProps.srcWalletAddress,
      to: txData.routerAddress,
      value: isNativeIn
        ? txData.transactionValue ?? txData.amountIn
        : "0",
      gasLimit: txData?.gas ? Number(txData.gas) : undefined,
    };

    return {
      tx,
      spender: txData.routerAddress,
    };
  }
}
