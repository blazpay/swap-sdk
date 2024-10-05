import { IQuoteParams, IQuote } from "../@types/index.js";
import { Base } from "./index.js";
export default class OneInchAggregator extends Base {
    BASE_URL: string;
    tradeFee: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<IQuote>;
    get1InchSepender(chainId: number): Promise<any>;
}
