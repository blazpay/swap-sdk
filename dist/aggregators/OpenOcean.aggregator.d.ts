import { IQuoteParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
import { IRestQuoteProps } from "../@types/quote.type.js";
export default class OpenOceanAggregator extends Base {
    BASE_URL: string;
    slippage: number;
    constructor();
    getBaseUrl(type: string, chain: number): string;
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
    }>;
}
