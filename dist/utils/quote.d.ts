import { IQuote, IRestQuoteProps } from "../@types/index.js";
export default class Quote {
    data: any;
    meta: IQuote;
    restProps: IRestQuoteProps;
    constructor(data: any, meta: IQuote, restProps: IRestQuoteProps);
    getMeta(): {
        id: string;
        aggregator: string;
        route: string;
        amount: number;
        usdAmount: number;
        networkFee: number;
        platformFee: number;
        priceImpact: number;
        slippage: number;
    };
    getTransactionData(): Promise<any>;
    toJSON(): any;
}
