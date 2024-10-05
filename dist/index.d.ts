import { IBaseQuoteParams } from "./@types/index.js";
import { NitroAggregator, OneInchAggregator, OpenOceanAggregator, SymbiosisAggregator, UnizenAggregator } from "./aggregators/index.js";
export declare class TradeManager {
    oneInchAggregator: OneInchAggregator;
    nitroAggregator: NitroAggregator;
    symbiosisAggregator: SymbiosisAggregator;
    openOceanAggregator: OpenOceanAggregator;
    unizenAggregator: UnizenAggregator;
    constructor();
    getQuotes(params: IBaseQuoteParams): Promise<void>;
}
