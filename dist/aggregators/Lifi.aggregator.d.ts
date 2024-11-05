import { IQuoteParams } from "../@types/index.js";
import Base from "./base.aggregator.js";
import Quote from "../utils/quote.js";
export default class LifiAggregator extends Base {
    BASE_URL: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(): Promise<void>;
}
