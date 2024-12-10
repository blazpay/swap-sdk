import { ethers } from "ethers";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import Base from "./base.aggregator.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import { v4 as uuidv4 } from "uuid";
import { routers } from "../utils/constants.js";

export default class LifiAggregator extends Base {
  BASE_URL: string;
  name: string;
  constructor() {
    super();
    this.name = AGGREGATORS.LIFI;
    this.BASE_URL = "https://li.quest/v1/quote";
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    console.log()
    const query = {
      fromChain: params.fromChain.id !== 102? params.fromChain.id : 'SOL',
      toChain: params.toChain.id !== 102? params.toChain.id : 'SOL',
      fromToken: params.fromToken.address,
      toToken: params.toToken.address,
      fromAmount: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      fromAddress: params.srcWalletAddress,
      toAddress: params?.dstWalletAddress || params.srcWalletAddress
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
      networkFee: data?.estimate?.gasCosts[0]?.amountUSD || 0,
      platformFee: data?.estimate?.feeCosts?.length > 0 ? `${Number(
        ethers.utils.formatUnits(
          data?.estimate?.feeCosts[0]?.amount?.toString(), Number(data?.estimate?.feeCosts[0]?.token?.decimals))?.toString()
      )?.toFixed(6)} ${data?.estimate?.feeCosts[0]?.token?.symbol}` : 0,
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
  ): Promise<{ tx: any; spender: string, metaData: any }> {
    const tx = {
      from: data?.transactionRequest?.from,
      to: data?.transactionRequest?.to,
      value: data?.transactionRequest?.value,
      data: data?.transactionRequest?.data,
      gasPrice: data?.transactionRequest?.gasPrice,
      gasLimit: data?.transactionRequest?.gasLimit * 2,
    };

    return {
      tx,
      spender: data?.transactionRequest?.to,
      metaData: data
    };
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    const res = await apiCall({
      method: "GET",
      url: `${routers['lifi']}?txHash=${hash}`,
    });
    console.log(res?.status, "lifi tx status");
    return {
      status: res?.status === 'PENDING' ? 'pending' : res?.status === 'DONE' ? 'success' : res?.status === 'FAILED' ? "failed" : "not found",
      hash
    }
  }
}
