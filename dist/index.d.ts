import { IBaseQuoteParams } from "./@types/index.js";
import { AggregatorFactory } from "./aggregator.factory.js";
import { ethers } from "ethers";
import { IRelayerTxData } from "./@types/relayer.type.js";
export declare class TradeManager {
  aggregatorFactory: AggregatorFactory;
  constructor();
  getQuotes(params: IBaseQuoteParams): Promise<void>;
  triggerTransaction(
    provider: ethers.providers.Web3Provider,
    relayerTxData: IRelayerTxData
  ): Promise<any>;
}
