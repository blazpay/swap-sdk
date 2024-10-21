import { providers } from "ethers";
import { IChain, IToken } from "./index.js";

export interface IQuoteParams {
  fromChain: IChain;
  toChain: IChain;
  fromToken: IToken;
  toToken: IToken;
  amount: number;
  srcWalletAddress: string;
  dstWalletAddress?: string;
  type: "SWAP" | "BRIDGE";
}

export interface SwapParams {
  provider: providers.Web3Provider;
  receiver?: string;
  slippageTolerance?: number;
}

export interface IQuote {
  source: string;
  route: string;
  amount: number;
  usdAmount: number;
  networkFee: number;
  platformFee: number;
  priceImpact: number;
  slippage: number;

  swap?: (params: SwapParams) => void;
}

export interface IBaseQuoteParams extends IQuoteParams {
  onNewQuote: (quote: IQuote) => Promise<void>;
}
