import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
export default class KyberSwap extends Base {
    BASE_URL: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
    }>;
}
