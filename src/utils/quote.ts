import { AggregatorFactory } from "../agreegator.factory.js";

export default class Quote {
  aggregatorFactory: AggregatorFactory;
  data: any;

  constructor(data: any) {
    this.data = data;
  }

  getMeta() {
    return {
      id: this.data?.id,
      provider: "providerA",
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
