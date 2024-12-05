import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
export default class SymbiosisAggregator extends Base {
    name: string;
    BASE_URL: string;
    slippage: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
        metaData?: any;
    }>;
    getTxStatus(chainId: number, hash: string): Promise<any>;
}
