import { IQuote, IQuoteParams } from "./@types/index.js";
import { NitroAggregator, OneInchAggregator } from "./aggregators/index.js";

export class TradeManager {
  oneInchAggregator: OneInchAggregator;
  nitroAggregator: NitroAggregator;

  constructor() {
    this.oneInchAggregator = new OneInchAggregator();
    this.nitroAggregator = new NitroAggregator();
  }

  async handleQuote(quote: IQuote) {
    console.log("log:: get quotes", quote);
  }

  async getQuotes(params: IQuoteParams) {
    this.oneInchAggregator
      .getQuotes(params)
      .then((quote: IQuote) => this.handleQuote(quote));
    this.nitroAggregator
      .getQuotes(params)
      .then((quote: IQuote) => this.handleQuote(quote));
  }
}

const polygon = {
  aggregators: [],
  _id: "6661b31ae7b1b8a8812d92df",
  chainType: "EVM",
  coin: "MATIC",
  id: 137,
  key: "pol",
  logoURI:
    "https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/chains/polygon.svg",
  mainnet: true,
  metamask: {
    chainId: "0x89",
    blockExplorerUrls: [
      "https://polygonscan.com/",
      "https://explorer-mainnet.maticvigil.com/",
    ],
    chainName: "Matic(Polygon) Mainnet",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    rpcUrls: [
      "https://polygon-rpc.com/",
      "https://rpc-mainnet.maticvigil.com/",
    ],
  },
  multicallAddress: "0xcA11bde05977b3631167028862bE2a173976CA11",
  name: "Polygon",
  nativeToken: {
    address: "0x0000000000000000000000000000000000000000",
    chainId: 137,
    symbol: "MATIC",
    decimals: 18,
    name: "MATIC",
    coinKey: "MATIC",
    logoURI:
      "https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png",
    priceUSD: "0.7166",
  },
  tokenlistUrl:
    "https://unpkg.com/quickswap-default-token-list@1.0.71/build/quickswap-default.tokenlist.json",
  Exchanges: [],
};

const params: IQuoteParams = {
  amount: 50000000,
  fromChain: polygon,
  toChain: polygon,
  fromToken: {
    _id: "6661baafa45f636f6aa75084",
    address: "0x0000000000000000000000000000000000000000",
    chainId: 137,
    symbol: "MATIC",
    decimals: 18,
    name: "MATIC",
    coinKey: "MATIC",
    priceUSD: "912",
    logoURI:
      "https://static.debank.com/image/matic_token/logo_url/matic/6f5a6b6f0732a7a235131bd7804d357c.png",
    changellySymbol: "MATICPOLYGON",
    transacCryptoId: "66b7bd56b015cf0fb22e846f",
    coingeckoId: "polygon-ecosystem-token",
    balance: "0",
    usdBalance: "0",
  },
  toToken: {
    _id: "6661baafa45f636f6aa75086",
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    chainId: 137,
    symbol: "USDT",
    decimals: 6,
    name: "USDT",
    coinKey: "USDT",
    logoURI:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png",
    transacCryptoId: "66b7bd54b015cf0fb22e8431",
    balance: "0",
    usdBalance: "0",
    priceUSD: "437",
  },
};

// const trade = new TradeManager();

// trade.getQuotes(params);
