import { IBaseQuoteParams, IQuote, IQuoteParams } from "./@types/index.js";
import {
  ChangeNowAggregator,
  NitroAggregator,
  OneInchAggregator,
  OpenOceanAggregator,
  SymbiosisAggregator,
  UnizenAggregator,
} from "./aggregators/index.js";

export class TradeManager {
  oneInchAggregator: OneInchAggregator;
  nitroAggregator: NitroAggregator;
  symbiosisAggregator: SymbiosisAggregator;
  openOceanAggregator: OpenOceanAggregator;
  unizenAggregator: UnizenAggregator;
  changeNowAggregator: ChangeNowAggregator;

  constructor() {
    this.oneInchAggregator = new OneInchAggregator();
    this.nitroAggregator = new NitroAggregator();
    this.symbiosisAggregator = new SymbiosisAggregator();
    this.openOceanAggregator = new OpenOceanAggregator();
    this.unizenAggregator = new UnizenAggregator();
    this.changeNowAggregator = new ChangeNowAggregator();
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

    this.symbiosisAggregator
      .getQuotes(quoteParams)
      .then((quote: IQuote) => handleQuote(quote))
      .catch((error) => console.error("error: symbiosis ", error));
    this.openOceanAggregator
      .getQuotes(quoteParams)
      .then((quote: IQuote) => handleQuote(quote))
      .catch((error) => console.error("error: open-ocean ", error));
    this.unizenAggregator
      .getQuotes(quoteParams)
      .then((quote: IQuote) => handleQuote(quote))
      .catch((error) => console.error("error: unizen ", error));
    this.changeNowAggregator
      .getQuotes(quoteParams)
      .then((quote: IQuote) => handleQuote(quote))
      .catch((error) => console.error("error: change_now ", error));
  }
}
