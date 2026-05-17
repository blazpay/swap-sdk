import { BrowserProvider } from "ethers";
import { IChain, IToken } from "./index.js";
import Quote from "../utils/quote.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";

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
  excludeSwap?: AGGREGATORS[];
  excludeBridge?: AGGREGATORS[];
}

export interface SwapParams {
  provider: BrowserProvider;
  receiver?: string;
  slippageTolerance?: number;
}

export interface IQuote {
  id: string;
  aggregator: string;
  route: string;
  amount: number;
  usdAmount: number;
  // Sum of gas costs (source-chain gas + Axelar/IBC gas for bridges)
  // in USD. Aggregators that don't surface a USD value will report 0.
  networkFee: number | string;
  // Sum of aggregator/relayer/bridge protocol fees in USD.
  platformFee: number | string;
  // BlazpayRelayer's percent fee. 0.001 = 0.1%. Populated when a route
  // executes through the relayer (cross-chain providers); pure-DEX
  // single-chain swaps surface this from on-chain at execute time.
  blazpayFeePercent?: number;
  // BlazpayRelayer fee expressed as a USD value of the input amount.
  blazpayFeeUsd?: number;
  priceImpact: number;
  slippage: number;
  allowanceTo: string;
  // Estimated swap/bridge completion time in seconds. Optional —
  // single-chain swaps and providers that don't expose an estimate omit it.
  timeEstimate?: number;
}

export interface IBaseQuoteParams extends IQuoteParams {
  onNewQuote: (quote: Quote) => Promise<void>;
  onLastQuote: (isLastQuote: boolean) => boolean;
}

export interface ITxnRes {
  tx: any;
  spender: string;
}
