import { IQuote, IQuoteParams } from "../@types/index.js";
import { Base } from "./index.js";
export default class SymbiosisAggregator extends Base {
    BASE_URL: string;
    slippage: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<IQuote>;
}
