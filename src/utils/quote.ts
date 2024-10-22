import { IQuote, IRestQuoteProps } from "../@types/index.js";
import aggregatorFactory, { AggregatorFactory } from "../aggregator.factory.js";

export default class Quote {
  data: any;
  meta: IQuote;
  restProps: IRestQuoteProps;

  constructor(data: any, meta: IQuote, restProps: IRestQuoteProps) {
    this.data = data;
    this.meta = meta;
    this.restProps = restProps;
  }

  getMeta() {
    return { id: "random_id", ...this.meta };
  }

  async getTransactionData() {
    const aggregator = aggregatorFactory.getAggregator(this.meta.aggregator);

    return await aggregator.getTransactionData(this.restProps);
  }

  toJSON() {
    return this.data;
  }
}
