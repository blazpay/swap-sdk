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

export interface IQuote {
  source: string;
  route: string;
  amount: number;
  usdAmount: number;
  networkFee: number;
  platformFee: number;
  priceImpact: number;
  slippage: number;

  swap: VoidFunction;
}

export interface IBaseQuoteParams extends IQuoteParams {
  onNewQuote: (quote: IQuote) => Promise<void>;
}
