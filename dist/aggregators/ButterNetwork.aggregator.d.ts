import { IQuoteParams } from "../@types/index.js";
import Quote from "../utils/quote.js";
import { Base } from "./index.js";
export default class ButterNetworkAggregator extends Base {
    BASE_URL: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote[]>;
}
