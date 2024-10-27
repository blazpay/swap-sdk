import { IQuoteParams } from "./@types/aggregator.type.js";
import Quote from "./utils/quote.js";

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
    for (const aggregator of this.aggregators.values()) {
      try {
        const quote = await aggregator.getQuotes(params);
        cb(quote);
        onLastQuote(false);
      } catch (error) {
        console.error(`Error from ${aggregator.constructor.name}:`, error);
      }
    }

    onLastQuote(true);
  }
}

const aggregatorFactory = new AggregatorFactory();

export default aggregatorFactory;
