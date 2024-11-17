import { IBaseQuoteParams, IQuote, IQuoteParams } from "./@types/index.js";
import {
  ChangeNowAggregator,
  IceCreamAggregator,
  NitroAggregator,
  OneInchAggregator,
  OpenOceanAggregator,
  SymbiosisAggregator,
  UnizenAggregator,
  KyberSwap,
  LifiAggregator,
  ButterNetworkAggregator,
  SquidRouterAggregator,
} from "./aggregators/index.js";
import aggregatorFactory, { AggregatorFactory } from "./aggregator.factory.js";
import { AGGREGATORS } from "./enums/aggregator.enum.js";
import Quote from "./utils/quote.js";
import { ethers } from "ethers";
import { IRelayerTxData } from "./@types/relayer.type.js";
import RelayerFactory from "./relayer.js";

export class TradeManager {
  aggregatorFactory: AggregatorFactory;

  constructor() {
    this.aggregatorFactory = aggregatorFactory;
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
    // this.aggregatorFactory.register(
    //   AGGREGATORS.CHANGE_NOW,
    //   new ChangeNowAggregator()
    // );

    this.aggregatorFactory.register(
      AGGREGATORS.ICECREAM_SWAP,
      new IceCreamAggregator()
    );
    this.aggregatorFactory.register(AGGREGATORS.KYBER_SWAP, new KyberSwap());
    this.aggregatorFactory.register(AGGREGATORS.LIFI, new LifiAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.BUTTER_NETWORK,
      new ButterNetworkAggregator()
    );
    this.aggregatorFactory.register(
      AGGREGATORS.SQUID_ROUTER,
      new SquidRouterAggregator()
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
      excludeSwap: params.excludeSwap,
      excludeBridge: params?.excludeBridge,
    };

    function handleQuote(quote: Quote) {
      if (quote) params.onNewQuote(quote);
    }

    const handleLastQuote = (isLastQuote: boolean) => {
      params.onLastQuote(isLastQuote);
    };

    await this.aggregatorFactory.getQuotes(
      quoteParams,
      handleQuote,
      handleLastQuote
    );
  }

  async triggerTransaction(
    provider: ethers.providers.Web3Provider,
    relayerTxData: IRelayerTxData
  ) {
    const relayerFactory = new RelayerFactory(provider);
    return await relayerFactory.triggerContract(relayerTxData);
  }
}
