import { IQuote, IQuoteParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
export default class UnizenAggregator extends Base {
    BASE_URL: string;
    slippage: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<IQuote>;
}
