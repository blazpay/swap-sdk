import { IQuoteParams } from "./@types/aggregator.type.js";
import { AGGREGATORS } from "./enums/aggregator.enum.js";
import Quote from "./utils/quote.js";
import { IQueryStatus } from "./utils/types.js";

export class AggregatorFactory {
  private aggregators: Map<string, any>;

  constructor() {
    this.aggregators = new Map();
  }

  register(name: string, aggregator: any) {
    this.aggregators.set(name, aggregator);
  }

  getAggregator(name: string) {
    return this.aggregators.get(name);
  }

  async getQuotes(
    params: IQuoteParams,
    cb: (quote: Quote) => void,
    onLastQuote: (isLastQuote: boolean) => void
  ) {
    const promises = Array.from(this.aggregators.values())
      .filter((agg) =>
        params.type === "SWAP"
          ? !params.excludeSwap?.includes(agg.name)
          : !params.excludeBridge?.includes(agg.name)
      )
      .map(async (aggregator) => {
        try {
          const quote = await aggregator.getQuotes(params);
          cb(quote);
        } catch (error: any) {
          if (error?.request?.data) {
            console.error(
              `Error from ${aggregator.constructor.name}:`,
              error?.request?.data
            );
          } else if (error?.response?.data) {
            console.error(
              `Error from ${aggregator.constructor.name}:`,
              error?.response?.data
            );
          } else {
            console.error(`Error from ${aggregator.constructor.name}:`, error);
          }
        }
      });

    await Promise.all(promises);
    onLastQuote(true);
  }
  

  async getStatus(queryStatusParam: IQueryStatus[]): Promise<any> {
    const res = await Promise.all(queryStatusParam?.map((value: IQueryStatus) => {
      const aggregator = this.getAggregator(value?.provider)
      return aggregator.getTxStatus(value.chainId, value.hash);
    }))
    console.log("🚀 ~ AggregatorFactory ~ res ~ res:", res)
    return res;
  }
}

const aggregatorFactory = new AggregatorFactory();

export default aggregatorFactory;
