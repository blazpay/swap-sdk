import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import Quote from "../utils/quote.js";
import { Base } from "./index.js";
export default class ButterNetworkAggregator extends Base {
    BASE_URL: string;
    name: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote[]>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
    }>;
}
