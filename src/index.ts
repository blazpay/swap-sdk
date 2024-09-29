import { IBaseQuoteParams, IQuote, IQuoteParams } from "./@types/index.js";
import { NitroAggregator, OneInchAggregator } from "./aggregators/index.js";

export class TradeManager {
  oneInchAggregator: OneInchAggregator;
  nitroAggregator: NitroAggregator;

  constructor() {
    this.oneInchAggregator = new OneInchAggregator();
    this.nitroAggregator = new NitroAggregator();
  }

  async getQuotes(params: IBaseQuoteParams) {
    const quoteParams: IQuoteParams = {
      fromChain: params.fromChain,
      toChain: params.toChain,
      fromToken: params.fromToken,
      toToken: params.toToken,
      amount: params.amount,
      type: params.type,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params?.dstWalletAddress,
    };

    function handleQuote(quote: IQuote) {
      console.log("log:: get quotes", quote);

      params.onNewQuote(quote);
    }

    if (params.type === "SWAP") {
      this.oneInchAggregator
        .getQuotes(quoteParams)
        .then((quote: IQuote) => handleQuote(quote))
        .catch((error) => console.error("error: 1inch ", error));
    }

    this.nitroAggregator
      .getQuotes(quoteParams)
      .then((quote: IQuote) => handleQuote(quote))
      .catch((error) => console.error("error: nitro ", error));
  }
}
