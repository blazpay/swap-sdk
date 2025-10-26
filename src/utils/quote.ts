import { IQuote, IRestQuoteProps } from '../@types/index.js';
import aggregatorFactory, { AggregatorFactory } from '../aggregator.factory.js';

//data = quote response
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
    return this.meta;
  }

  async getTransactionData() {
    const aggregator = aggregatorFactory.getAggregator(this.meta.aggregator);

    return await aggregator.getTransactionData(
      this.data,
      this.restProps,
      this.meta
    );
  }

  toJSON() {
    return this.data;
  }
}
