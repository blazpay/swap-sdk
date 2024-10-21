import { IQuote } from "../@types/index.js";
import aggregatorFactory, { AggregatorFactory } from "../aggregator.factory.js";

export default class Quote {
  aggregatorFactory: AggregatorFactory;
  data: any;
  meta: IQuote;

  constructor(data: any, meta: IQuote) {
    this.data = data;
    this.meta = meta;
    this.aggregatorFactory = aggregatorFactory;
  }

  getMeta() {
    return this.meta;
  }

  getTransactionData() {
    const aggregator = this.aggregatorFactory.getAggregator(this.data.provider);

    return aggregator.getTransactionData(this.data);
  }

  toJSON() {
    return this.data;
  }
}
