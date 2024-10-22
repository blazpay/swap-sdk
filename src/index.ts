import { IBaseQuoteParams, IQuote, IQuoteParams } from "./@types/index.js";
import {
  ChangeNowAggregator,
  NitroAggregator,
  OneInchAggregator,
  OpenOceanAggregator,
  SymbiosisAggregator,
  UnizenAggregator,
} from "./aggregators/index.js";
import aggregatorFactory, { AggregatorFactory } from "./aggregator.factory.js";
import { AGGREGATORS } from "./enums/aggregator.enum.js";
import Quote from "./utils/quote.js";

export class TradeManager {
  aggregatorFactory: AggregatorFactory;

  constructor() {
    this.aggregatorFactory = aggregatorFactory;

    this.aggregatorFactory.register(
      AGGREGATORS.ONE_INCH,
      new OneInchAggregator()
    );
    // this.aggregatorFactory.register(AGGREGATORS.NITRO, new NitroAggregator());
    // this.aggregatorFactory.register(
    //   AGGREGATORS.SYMBIOSIS,
    //   new SymbiosisAggregator()
    // );
    // this.aggregatorFactory.register(
    //   AGGREGATORS.OPEN_OCEAN,
    //   new OpenOceanAggregator()
    // );
    // this.aggregatorFactory.register(AGGREGATORS.UNIZEN, new UnizenAggregator());
    // this.aggregatorFactory.register(
    //   AGGREGATORS.CHANGE_NOW,
    //   new ChangeNowAggregator()
    // );
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

    function handleQuote(quote: Quote) {
      params.onNewQuote(quote);
    }

    this.aggregatorFactory.getQuotes(quoteParams, handleQuote);
  }
}
