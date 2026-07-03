import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import {
  IQuote,
  IQuoteParams,
  IRestQuoteProps,
  SwapParams,
} from "../@types/index.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import { routers } from "../utils/constants.js";

export default class SymbiosisAggregator extends Base {
  name: string;
  BASE_URL: string;
  slippage: number;
  constructor() {
    super();
    this.name = AGGREGATORS.SYMBIOSIS;
    this.BASE_URL = "https://api.symbiosis.finance/crosschain/v1/swap";
    this.slippage = 1;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const payload = {
      tokenAmountIn: {
        address: params?.fromToken.address,
        symbol: params?.fromToken.symbol,
        amount: ethers
          .parseUnits(String(params.amount), params.fromToken.decimals)
          .toString(),
        chainId: Number(params?.fromChain.id),
        decimals: params?.fromToken.decimals,
      },
      tokenOut: {
        chainId: Number(params?.toChain.id),
        address: params?.toToken.address,
        symbol: params?.toToken.symbol,
        decimals: params?.toToken.decimals,
      },
      from: params?.srcWalletAddress,
      to: params?.dstWalletAddress || params.srcWalletAddress,
      slippage: 300,
    };

    const data = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: payload,
    });

    const swapAmount = ethers
      .formatUnits(data?.tokenAmountOut?.amount ?? 0, data?.tokenAmountOut?.decimals ?? 18)
      .toString();

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.SYMBIOSIS,
      route: "Symbiosis",
      amount: Number(swapAmount),
      usdAmount: 0,
      networkFee: 0,
      platformFee: data?.fee?.amount ? `${Number(data?.fee?.amount) / Math.pow(10, data?.fee?.decimals)} ${data?.fee?.symbol}` : 0,
      priceImpact: Number(data?.priceImpact || 0),
      slippage: this.slippage,
      allowanceTo: data?.approveTo,
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
      slippageTolerance: this.slippage || 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: payload,
    });

    return quote;
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string, metaData?: any }> {
    if(restProps.fromChain.id === 728126428) {
      return {
        tx: {
          contractAddress: data?.tx?.to,
          data: data?.tx?.data,
          feeLimit: data?.tx?.feeLimit,
          from: data?.tx?.from,
          functionSelector: data?.tx?.functionSelector
        },
        spender: data?.approveTo,
        metaData: data
      }
    }
    return {
      tx: data?.tx,
      spender: data?.approveTo,
    };
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    const res = await apiCall({
      method: "GET",
      url: `${routers['symbiosis']}${chainId}/${hash}`,
    });
    return {
      status: res?.status === 1 ? 'pending' : res?.status === 0 ? 'success' : res?.status === 2 ? 'stucked' : res?.status === 3 ? "failed" : "not found",
      hash
    }
  }
}
