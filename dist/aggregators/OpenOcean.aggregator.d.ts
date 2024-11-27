import { IQuoteParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
import { IRestQuoteProps } from "../@types/quote.type.js";
export default class OpenOceanAggregator extends Base {
    name: string;
    BASE_URL: string;
    slippage: number;
    bridgeUrl: string;
    constructor();
    getBaseUrl(type: string, chain: number): string;
    getQuotes(params: IQuoteParams): Promise<Quote | Quote[]>;
    getTransactionData(data: any, restProps: IRestQuoteProps, meta: any): Promise<{
        tx: any;
        spender: string;
    }>;
    getTxStatus(chainId: number, hash: string): Promise<any>;
}
