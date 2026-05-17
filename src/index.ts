import { IBaseQuoteParams, IQuote, IQuoteParams } from './@types/index.js';
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
  NordsternAggregator,
  OdosAggregator,
  RelayAggregator,
  SushiswapAggregator,
  AcrossAggregator,
  NearOneClickAggregator,
  GasZipAggregator,
  RhinoFiAggregator,
  OKXAggregator,
} from './aggregators/index.js';
import aggregatorFactory, { AggregatorFactory } from './aggregator.factory.js';
import { AGGREGATORS } from './enums/aggregator.enum.js';
import Quote from './utils/quote.js';
import { ethers } from 'ethers';
import { IRelayerRawTxData, IRelayerTxData } from './@types/relayer.type.js';
import RelayerFactory from './relayer.js';
import { relayerAddresses } from './utils/constants.js';
import { IQueryStatus } from './utils/types.js';
import KimaSwapAggregator from './aggregators/Kima.aggregator.js';
import { configure } from './utils/config.js';

export class TradeManager {
  aggregatorFactory: AggregatorFactory;

  constructor() {
    this.aggregatorFactory = aggregatorFactory;
    this.aggregatorFactory.register(
      AGGREGATORS.ONE_INCH,
      new OneInchAggregator(),
    );
    // Router Protocol Nitro: mainnet pathfinder hostnames retired
    // (api-beta.pathfinder.routerprotocol.com → NXDOMAIN). Re-enable
    // when Router publishes a working production URL.
    // this.aggregatorFactory.register(AGGREGATORS.NITRO, new NitroAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.SYMBIOSIS,
      new SymbiosisAggregator(),
    );
    this.aggregatorFactory.register(
      AGGREGATORS.OPEN_OCEAN,
      new OpenOceanAggregator(),
    );
    this.aggregatorFactory.register(AGGREGATORS.UNIZEN, new UnizenAggregator());
    // this.aggregatorFactory.register(
    //   AGGREGATORS.CHANGE_NOW,
    //   new ChangeNowAggregator()
    // );

    // IceCreamSwap: aggregator.icecreamswap.com returns 404 — endpoint
    // appears to have been removed. Re-enable when a current URL is
    // published.
    // this.aggregatorFactory.register(
    //   AGGREGATORS.ICECREAM_SWAP,
    //   new IceCreamAggregator(),
    // );
    this.aggregatorFactory.register(AGGREGATORS.KYBER_SWAP, new KyberSwap());
    this.aggregatorFactory.register(AGGREGATORS.LIFI, new LifiAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.BUTTER_NETWORK,
      new ButterNetworkAggregator(),
    );
    this.aggregatorFactory.register(
      AGGREGATORS.SQUID_ROUTER,
      new SquidRouterAggregator(),
    );
    // Kima: kima.blazpay.com origin is currently down (Cloudflare 520).
    // Re-enable when the Kima backend is restored.
    // this.aggregatorFactory.register(AGGREGATORS.KIMA, new KimaSwapAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.NORDSTERN,
      new NordsternAggregator(),
    );
    this.aggregatorFactory.register(AGGREGATORS.ODOS, new OdosAggregator());
    this.aggregatorFactory.register(AGGREGATORS.RELAY, new RelayAggregator());
    this.aggregatorFactory.register(
      AGGREGATORS.SUSHISWAP,
      new SushiswapAggregator(),
    );
    this.aggregatorFactory.register(
      AGGREGATORS.ACROSS,
      new AcrossAggregator(),
    );
    this.aggregatorFactory.register(
      AGGREGATORS.NEAR_1CLICK,
      new NearOneClickAggregator(),
    );
    this.aggregatorFactory.register(
      AGGREGATORS.GAS_ZIP,
      new GasZipAggregator(),
    );
    this.aggregatorFactory.register(
      AGGREGATORS.RHINO_FI,
      new RhinoFiAggregator(),
    );
    this.aggregatorFactory.register(AGGREGATORS.OKX, new OKXAggregator());
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
      handleLastQuote,
    );
  }

  async sortQuotes(
    provider: ethers.BrowserProvider,
    relayerTxs: IRelayerTxData[],
  ) {
    const relayerFactory = new RelayerFactory(provider);
    return await relayerFactory.sortQuotes(relayerTxs);
  }

  async getTransactionStatus(queries: IQueryStatus[]): Promise<any> {
    return await this.aggregatorFactory.getStatus(queries);
  }

  async simulateTx(
    provider: ethers.BrowserProvider,
    relayerTxData: IRelayerTxData,
  ) {
    const relayerFactory = new RelayerFactory(provider);
    return await relayerFactory.simulateTransaction(relayerTxData);
  }

  async triggerTransaction(
    provider: ethers.BrowserProvider,
    relayerTxData: IRelayerTxData,
  ) {
    const relayerFactory = new RelayerFactory(provider);
    return await relayerFactory.triggerContract(relayerTxData);
  }

  sendSignTxDataRaw(relayerTxData: IRelayerRawTxData) {
    const relayerFactory = new RelayerFactory();
    return relayerFactory.getMetaTransactionByteData(relayerTxData);
  }
}

export { relayerAddresses };
export { configure };
