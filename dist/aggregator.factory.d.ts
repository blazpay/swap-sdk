import { IQuoteParams } from "./@types/aggregator.type.js";
import Quote from "./utils/quote.js";
export declare class AggregatorFactory {
    private aggregators;
    constructor();
    register(name: string, aggregator: any): void;
    getAggregator(name: string): any;
    getQuotes(params: IQuoteParams, cb: (quote: Quote) => void, onLastQuote: (isLastQuote: boolean) => void): Promise<void>;
}
declare const aggregatorFactory: AggregatorFactory;
export default aggregatorFactory;
