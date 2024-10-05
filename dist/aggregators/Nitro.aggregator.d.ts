import { IQuote, IQuoteParams } from "../@types/index.js";
import Base from "./base.aggregator.js";
export default class NitroAggregator extends Base {
    BASE_URL: string;
    nitroPartnerId: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<IQuote>;
}
