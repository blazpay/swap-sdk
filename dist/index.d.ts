import { IBaseQuoteParams } from "./@types/index.js";
import { AggregatorFactory } from "./aggregator.factory.js";
export declare class TradeManager {
  aggregatorFactory: AggregatorFactory;
  isLastQuote: boolean;
  constructor();
  getQuotes(params: IBaseQuoteParams): Promise<void>;
}
