import { ethers } from "ethers";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import { v4 as uuidv4 } from "uuid";

export default class KyberSwap extends Base {
  BASE_URL: string;

  constructor() {
    super();
    this.BASE_URL = "https://aggregator-api.kyberswap.com";
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const fromTokenAdd =
      params.fromToken.address === "0x0000000000000000000000000000000000000000"
        ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        : params.fromToken.address;
    const toTokenAdd =
      params.toToken.address === "0x0000000000000000000000000000000000000000"
        ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        : params.toToken.address;

    const query = {
      tokenIn: fromTokenAdd,
      tokenOut: toTokenAdd,
      amountIn: ethers.utils
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

    const data = await res?.data;

    const swapAmount = ethers.utils
      .formatUnits(data?.routeSummary?.amountOut, params.toToken.decimals)
      .toString();

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.KYBER_SWAP,
      route: "KyberSwap",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: data?.routeSummary?.amountOutUsd,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage || 0.5,
      allowanceTo: data?.routerAddress,
    };

    const quote = new Quote(data, meta, {
      fromChain: {
        id: params.fromChain.id,
        name: params.fromChain.name.toLowerCase(),
      },
      toChain: {
        id: params.toChain.id,
        name: params.toChain.name.toLowerCase(),
      },
      slippageTolerance: (params.slippage || 0.5) * 100,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: query,
    });

    return quote;
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const payload = {
      routeSummary: data?.routeSummary,
      sender: restProps.srcWalletAddress,
      recipient: restProps.dstWalletAddress,
      slippageTolerance: 50,
      source: "blazpay",
    };

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL + `/${restProps.fromChain.name}/api/v1/route/build`,
      data: JSON.stringify(payload),
      headers: { "X-Client-Id": "blazpay", "Content-Type": "application/json" },
    });

    const txData = res?.data;

    const tx = {
      data: txData?.data,
      from: restProps.srcWalletAddress,
      to: txData?.routerAddress,
      value: txData?.amountIn,
    };

    return {
      tx,
      spender: data?.routerAddress,
    };
  }
}
