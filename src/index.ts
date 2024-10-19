import { IBaseQuoteParams, IQuote, IQuoteParams } from "./@types/index.js";
import {
  ChangeNowAggregator,
  NitroAggregator,
  OneInchAggregator,
  OpenOceanAggregator,
  SymbiosisAggregator,
  UnizenAggregator,
} from "./aggregators/index.js";
import { AGGREGATORS } from "./enums/aggregator.enum.js";

class AggregatorFactory {
  private aggregators: Map<string, any>;

  constructor() {
    this.aggregators = new Map();
  }

  register(name: string, aggregator: any) {
    this.aggregators.set(name, aggregator);
  }

  getAggregator(name: string) {
    this.aggregators.get(name);
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

export class TradeManager {
  aggregatorFactory: AggregatorFactory;

  constructor() {
    this.aggregatorFactory = new AggregatorFactory();
    this.aggregatorFactory.register(
      AGGREGATORS.ONE_INCH,
      new OneInchAggregator()
    );
    this.aggregatorFactory.register(AGGREGATORS.NITRO, new NitroAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.SYMBIOSIS,
      new SymbiosisAggregator()
    );
    this.aggregatorFactory.register(
      AGGREGATORS.OPEN_OCEAN,
      new OpenOceanAggregator()
    );
    this.aggregatorFactory.register(AGGREGATORS.UNIZEN, new UnizenAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.CHANGE_NOW,
      new ChangeNowAggregator()
    );
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
      params.onNewQuote(quote);
    }

    this.aggregatorFactory.getQuotes(quoteParams, handleQuote);
  }
}
