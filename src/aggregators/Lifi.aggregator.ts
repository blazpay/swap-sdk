import { ethers } from "ethers";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import Base from "./base.aggregator.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import { v4 as uuidv4 } from "uuid";

export default class LifiAggregator extends Base {
  BASE_URL: string;
  constructor() {
    super();
    this.BASE_URL = "https://li.quest/v1/quote";
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const query = {
      fromChain: params.fromChain.id,
      toChain: params.toChain.id,
      fromToken: params.fromToken.address,
      toToken: params.toToken.address,
      fromAmount: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      fromAddress: params.srcWalletAddress,
    };

    const data = await apiCall({
      method: "GET",
      url: this.BASE_URL,
      params: query,
    });

    const swapAmount = ethers.utils.formatUnits(
      data?.estimate?.toAmount,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.LIFI,
      route: data?.tool || "Lifi",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: data?.action?.slippage || params.slippage || 0.5,
      allowanceTo: data?.transactionRequest?.to,
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
      slippageTolerance: params.slippage ?? 0.5,
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
    const tx = {
      from: data?.transactionRequest?.from,
      to: data?.transactionRequest?.to,
      value: data?.transactionRequest?.value,
      data: data?.transactionRequest?.data,
      gasPrice: data?.transactionRequest?.gasPrice,
      gasLimit: data?.transactionRequest?.gasLimit,
    };

    return {
      tx,
      spender: data?.transactionRequest?.to,
    };
  }
}
