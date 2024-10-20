import aggregatorFactory, { AggregatorFactory } from "../agreegator.factory.js";

export default class Quote {
  aggregatorFactory: AggregatorFactory;
  data: any;

  constructor(data: any) {
    this.data = data;
    this.aggregatorFactory = aggregatorFactory;
  }

  getMeta() {
    return {
      id: this.data?.id,
      provider: this.data.provider,
      fromAmount: "",
      toAmount: "",
      slippage: "",
    };
  }

  getTransactionData() {
    const aggregator = this.aggregatorFactory.getAggregator(this.data.provider);

    return aggregator.getTransactionData(this.data);
  }

  toJSON() {
    return this.data;
  }
}
