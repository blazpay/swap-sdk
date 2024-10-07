import { IBaseQuoteParams } from "./@types/index.js";
import { ChangeNowAggregator, NitroAggregator, OneInchAggregator, OpenOceanAggregator, SymbiosisAggregator, UnizenAggregator } from "./aggregators/index.js";
export declare class TradeManager {
    oneInchAggregator: OneInchAggregator;
    nitroAggregator: NitroAggregator;
    symbiosisAggregator: SymbiosisAggregator;
    openOceanAggregator: OpenOceanAggregator;
    unizenAggregator: UnizenAggregator;
    changeNowAggregator: ChangeNowAggregator;
    constructor();
    getQuotes(params: IBaseQuoteParams): Promise<void>;
}
