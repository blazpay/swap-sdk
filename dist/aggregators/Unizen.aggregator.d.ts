import { IQuoteParams, ITxnRes } from "../@types/index.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
import { IRestQuoteProps } from "../@types/quote.type.js";
export default class UnizenAggregator extends Base {
    name: string;
    BASE_URL: string;
    slippage: number;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<ITxnRes>;
    getSpender(chainId: number): Promise<any>;
}
