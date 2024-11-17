import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import Base from "./base.aggregator.js";
import Quote from "../utils/quote.js";
export default class LifiAggregator extends Base {
    BASE_URL: string;
    name: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
    }>;
}
