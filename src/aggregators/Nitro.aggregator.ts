import { IQuote, IQuoteParams } from "../@types/index.js";

export default class NitroAggregator {
  BASE_URL: string;

  constructor() {
    this.BASE_URL = "https://api-beta.pathfinder.routerprotocol.com/api";
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    async function swap() {}

    const swapAmount = "021";

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
