import { IQuoteParams } from "../@types/index.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
export default class SquidRouterAggregator extends Base {
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
}
