import { IQuoteParams } from "../@types/index.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import { Base } from "./index.js";

//TODO:
export default class ButterNetworkAggregator extends Base {
  BASE_URL: string;
  constructor() {
    super();
    this.BASE_URL = "https://bs-router-v3.chainservice.io/routeAndSwap";
  }

  async getQuotes(params: IQuoteParams) {
    const query = {
      fromChainId: params.fromChain.id,
      toChainId: params.toChain.id,
      tokenInAddress: params.fromToken.address,
      tokenOutAddress: params.fromToken.address,
      amount: params.amount.toString(),
      type: "exactIn",
      entrance: "Blazpay",
      slippage: 2000,
      from: params.srcWalletAddress,
      receiver: params.fromChain.id,
    };

    const res = await apiCall({
      method: "GET",
      url: this.BASE_URL,
      params: query,
    });

    const data = res.data;

    const quotes: Quote[] = data?.map((quote: any) => {
      return {
        // aggregator: AGGREGATORS.BUTTER_NETWORK,
        route: quote?.route?.srcChain?.route[0]?.dexName || "Butter",
        amount: Number(
          parseFloat(quote?.route.dstChain?.totalAmountOut)
        ).toFixed(4),
        usdAmount: 0,
        networkFee: 0,
        platformFee: quote?.route?.bridgeFee?.amount || 0,
        priceImpact: quote?.route.srcChain?.route[0]?.priceImpact || 0,
        slippage: 1,
      };
    });

    return quotes;
  }
}
