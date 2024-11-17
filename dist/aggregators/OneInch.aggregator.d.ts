import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
export default class OneInchAggregator extends Base {
    name: string;
    BASE_URL: string;
    tradeFee: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(_: any, data: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
    }>;
    get1InchSpender(chainId: number): Promise<any>;
}
