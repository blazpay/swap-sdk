import { providers } from "ethers";
import { IChain, IToken } from "./index.js";
import Quote from "../utils/quote.js";

export interface IQuoteParams {
  fromChain: IChain;
  toChain: IChain;
  fromToken: IToken;
  toToken: IToken;
  amount: number;
  slippage?: number;
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
  id?: string;
  aggregator: string;
  route: string;
  amount: number;
  usdAmount: number;
  networkFee: number;
  platformFee: number;
  priceImpact: number;
  slippage: number;
}

export interface IBaseQuoteParams extends IQuoteParams {
  onNewQuote: (quote: Quote) => Promise<void>;
  onLastQuote: (isLastQuote: boolean) => boolean;
}
