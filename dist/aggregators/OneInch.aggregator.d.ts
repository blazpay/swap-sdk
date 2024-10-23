import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
export default class OneInchAggregator extends Base {
    BASE_URL: string;
    tradeFee: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: IRestQuoteProps): Promise<any>;
    get1InchSpender(chainId: number): Promise<any>;
}
