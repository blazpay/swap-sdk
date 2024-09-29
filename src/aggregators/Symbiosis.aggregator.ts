import { IQuote, IQuoteParams } from "../@types/index.js";
import { Base } from "./index.js";

export default class Symbiosis extends Base {
  BASE_URL: string;
  slippage: number;
  constructor() {
    super();

    this.BASE_URL = "https://api.symbiosis.finance/crosschain";
    this.slippage = 1;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    async function swap() {}

    const swapAmount = "021";

    return {
      source: "Symbiosis",
      route: "Symbiosis",
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
