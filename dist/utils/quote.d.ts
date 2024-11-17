import { IQuote, IRestQuoteProps } from "../@types/index.js";
export default class Quote {
    data: any;
    meta: IQuote;
    restProps: IRestQuoteProps;
    constructor(data: any, meta: IQuote, restProps: IRestQuoteProps);
    getMeta(): IQuote;
    getTransactionData(): Promise<any>;
    toJSON(): any;
}
