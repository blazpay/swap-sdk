import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import { baseUrl } from "../utils/constants.js";

const addressZero = "0x0000000000000000000000000000000000000000";
const addressZero1Inch = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export default class OneInchAggregator extends Base {
  name: string;
  BASE_URL: string;
  tradeFee: number;

  constructor() {
    super();
    this.name = AGGREGATORS.ONE_INCH;
    this.BASE_URL = baseUrl + "/1inch";
    this.tradeFee = 0;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const query = {
      src:
        params.fromToken.address === addressZero
          ? addressZero1Inch
          : params.fromToken.address,
      dst:
        params.toToken.address === addressZero
          ? addressZero1Inch
          : params.toToken.address,
      amount: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      fee: this.tradeFee,
      includeTokensInfo: true,
      includeProtocols: true,
      includeGas: true,
    };

    this.setSenderAddress(params.srcWalletAddress);

    const response = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: { path: `/swap/v6.0/${params.fromChain.id}/quote`, query },
    });

    const swapAmount = ethers.utils.formatUnits(
      response?.dstAmount,
      response?.dstToken?.decimals
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));
    let allowanceTo = await this.get1InchSpender(params.fromChain.id);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.ONE_INCH,
      route: "One Inch",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: 0,
      allowanceTo,
    };

    const quote = new Quote(response, meta, {
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      fromChain: {
        id: params.fromChain.id,
        name: params.fromChain.name.toLowerCase(),
      },
      toChain: {
        id: params.toChain.id,
        name: params.toChain.name.toLowerCase(),
      },
      slippageTolerance: params.slippage ?? 0.5,
      quotePayload: query,
    });

    return quote;
  }

  async getTransactionData(
    _: any,
    data: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const res = await apiCall({
      url: this.BASE_URL,
      method: "POST",
      data: {
        query: {
          ...data?.quotePayload,
          includeTokensInfo: true,
          includeProtocols: true,
          includeGas: true,
          from: data.srcWalletAddress,
          slippage: data.slippageTolerance,
          receiver: data.dstWalletAddress || data.srcWalletAddress,
        },
        path: `/swap/v6.0/${data.fromChain.id}/swap`,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 1200));

    return {
      tx: res?.tx,
      spender: await this.get1InchSpender(data.fromChain.id),
    };
  }

  async get1InchSpender(chainId: number) {
    try {
      const data = await apiCall({
        url: this.BASE_URL + "/getspender",
        method: "POST",
        data: {
          chain: chainId,
        },
      });
      return data.spender;
    } catch (error) {
      throw error;
    }
  }
}
