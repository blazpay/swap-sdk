import { formatUnits } from "ethers";
import { IQuote, IQuoteParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";

export default class OpenOceanAggregator extends Base {
  slippage: number;
  constructor() {
    super();
    this.slippage = 0.5;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    const data: any = {};

    async function swap() {}

    const swapAmount = formatUnits(
      data?.tokenAmountOut?.amount,
      data?.tokenAmountOut?.decimals
    ).toString();

    return {
      source: "OpenOcean",
      route: "OpenOcean",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: this.slippage,
      swap,
    };
  }
}
