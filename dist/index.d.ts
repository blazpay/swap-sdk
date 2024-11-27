import { IBaseQuoteParams } from "./@types/index.js";
import { AggregatorFactory } from "./aggregator.factory.js";
import { ethers } from "ethers";
import { IRelayerRawTxData, IRelayerTxData } from "./@types/relayer.type.js";
import { relayerAddresses } from './utils/constants.js';
import { IQueryStatus } from "./utils/types.js";
export declare class TradeManager {
    aggregatorFactory: AggregatorFactory;
    constructor();
    getQuotes(params: IBaseQuoteParams): Promise<void>;
    getTxStatus(queries: IQueryStatus[]): Promise<any>;
    triggerTransaction(provider: ethers.providers.Web3Provider, relayerTxData: IRelayerTxData): Promise<any>;
    sendSignTxDataRaw(relayerTxData: IRelayerRawTxData): {
        approvalData: string | undefined;
        executeData: string;
        value: ethers.BigNumber;
        to: string;
    };
}
export { relayerAddresses };
