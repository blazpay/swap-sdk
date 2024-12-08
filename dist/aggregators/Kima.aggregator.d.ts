import { IQuoteParams, IRestQuoteProps } from '../@types/index.js';
import Quote from '../utils/quote.js';
import Base from './base.aggregator.js';
import { ChainNameKima } from '../utils/constants.js';
export default class KimaSwapAggregator extends Base {
    name: string;
    BASE_URL: string;
    FEE_URL: string;
    solSpender: string;
    trxSpender: string;
    evmSpender: string;
    constructor();
    getQuotes(params: IQuoteParams): Promise<Quote>;
    getTransactionData(data: any, restProps: IRestQuoteProps): Promise<{
        tx: any;
        spender: string;
        metaData: any;
    }>;
    calcServiceFee(sourceChain: ChainNameKima, targetChain: ChainNameKima): Promise<number>;
    getServiceFee(chain: ChainNameKima): Promise<number>;
    getTxStatus(chainId: number, hash: string): Promise<any>;
}
