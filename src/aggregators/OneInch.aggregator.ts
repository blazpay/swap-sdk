import { ethers } from "ethers";
import { IOneInchParams, IQuote } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";

const addressZero = "0x0000000000000000000000000000000000000000";
const addressZero1Inch = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export default class OneInchAggregator extends Base {
  BASE_URL: string;
  tradeFee: number;

  constructor() {
    super();
    this.BASE_URL = "https://api-v2.blazpay.com/api/defi/1inch";
    this.tradeFee = 0;
  }

  async getQuotes(params: IOneInchParams): Promise<IQuote> {
    const query = {
      src:
        params.fromToken.address === addressZero
          ? addressZero1Inch
          : params.fromToken.address,
      dst:
        params.toToken.address === addressZero
          ? addressZero1Inch
          : params.toToken.address,
      amount: (ethers as any).utils
        .parseUnits(params.amount, params.fromToken.decimals)
        .toString(),
      fee: this.tradeFee,
      includeTokensInfo: true,
      includeProtocols: true,
      includeGas: true,
    };

    const quote = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: { path: `/swap/v6.0/${params.fromChain.id}/quote`, query },
    });

    const swapAmount = (ethers as any).utils.formatUnits(
      quote?.dstAmount,
      quote?.dstToken?.decimals
    );

    async function swap() {}

    return {
      source: "One Inch",
      route: "One Inch",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: 0,
      swap,
    };
  }
}
