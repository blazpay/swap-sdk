import { IChain, IToken } from "./index.js";

export interface IOneInchParams {
  fromChain: IChain;
  toChain: IChain;
  fromToken: IToken;
  toToken: IToken;
  amount: number;
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
