import { ethers } from "ethers";
import { IQuoteParams, SwapParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
export default class ChangeNowAggregator extends Base {
    name: string;
    BASE_URL: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<{
        source: string;
        route: string;
        amount: any;
        usdAmount: number;
        networkFee: any;
        platformFee: number;
        priceImpact: number;
        slippage: number;
        swap: ({ provider }: SwapParams) => Promise<ethers.providers.TransactionResponse>;
    }>;
}
