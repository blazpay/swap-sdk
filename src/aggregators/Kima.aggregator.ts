import { ethers } from 'ethers';
import { IQuote, IQuoteParams, IRestQuoteProps } from '../@types/index.js';
import { apiCall } from '../utils/axios.js';
import Quote from '../utils/quote.js';
import Base from './base.aggregator.js';
import { AGGREGATORS } from '../enums/aggregator.enum.js';
import { v4 as uuidv4 } from 'uuid';
import { ChainNameKima, routers } from '../utils/constants.js';
import axios from 'axios';

export const ChainMap: any = {
  '42161': 'ARB',
  '43114': 'AVX',
  '8453': 'BASE',
  '56': 'BSC',
  '80094': 'BERA',
  CC: 'CC',
  '1': 'ETH',
  '10': 'OPT',
  '137': 'POL',
  SOL: 'SOL',
  '728126428': 'TRX',
};

export default class KimaSwapAggregator extends Base {
  name: string;
  BASE_URL: string;
  constructor() {
    super();
    this.name = AGGREGATORS.KIMA;
    this.BASE_URL = process.env.KIMA_BACKEND_URL || 'https://kima.blazpay.com';
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const payload = {
      originChain: ChainMap[params.fromChain.id],
      originSymbol: params.fromToken.symbol,
      originAddress: params.srcWalletAddress,
      targetChain: ChainMap[params.toChain.id],
      targetSymbol: params.toToken.symbol,
      targetAddress: params.dstWalletAddress || params.srcWalletAddress,
      amount: String(params.amount),
    };

    const res = await axios.post(`${this.BASE_URL}/trade/quote`, payload);
    const data = res.data;

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.KIMA,
      route: 'Kima',
      amount: data.amount,
      usdAmount: 0,
      networkFee: 0,
      platformFee: `${Number(data.fee)?.toFixed(6)} ${params?.toToken?.symbol}`,
      priceImpact: 0,
      slippage: data.slippage,
      allowanceTo: data.poolAddress,
      allowanceAmount: data.allowanceAmount,
      signingMessage: data.signingMessage,
    };

    const quote = new Quote({}, meta, {
      fromChain: {
        id: params.fromChain.id,
        name: params.fromChain.name.toLowerCase(),
      },
      toChain: {
        id: params.toChain.id,
        name: params.toChain.name.toLowerCase(),
      },
      slippageTolerance: (params.slippage || 0.5) * 100,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: data.submitData,
    });

    return quote;
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps,
    meta: IQuote
  ): Promise<{ tx: any; spender: string; metaData: any }> {
    const submitPayload = restProps.quotePayload;

    const res = await axios.post(
      `${this.BASE_URL}/trade/submit`,
      submitPayload
    );

    return {
      tx: null,
      spender: meta.allowanceTo,
      metaData: {
        txId: res.data.txId,
        txHash: res.data.txHash,
      },
    };
  }

  async getTxStatus(hash: string, type?: string): Promise<any> {
    const res = await axios.post(`${this.BASE_URL}/trade/status/${hash}`, {
      params: { type },
    });

    const txData = res.data;

    return {
      ...txData,
      hash,
      status:
        txData?.txstatus === 'Completed'
          ? 'success'
          : txData?.txstatus === 'FailedToPull'
          ? 'failed'
          : 'pending',
    };
  }
}
