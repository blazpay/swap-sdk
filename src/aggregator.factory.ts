import { IQuote, IQuoteParams } from "./@types/aggregator.type.js";

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

  async getQuotes(params: IQuoteParams, cb: (quote: IQuote) => void) {
    for (const aggregator of this.aggregators.values()) {
      try {
        const quote = await aggregator.getQuotes(params);
        cb(quote);
      } catch (error) {
        console.error(`Error from ${aggregator.constructor.name}:`, error);
      }
    }
  }
}

const aggregatorFactory = new AggregatorFactory();

export default aggregatorFactory;
