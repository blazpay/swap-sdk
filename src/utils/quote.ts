export default class Quote {
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

  getTransactionData() {}
}
