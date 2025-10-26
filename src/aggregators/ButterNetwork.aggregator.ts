import { IQuoteParams, IRestQuoteProps } from '../@types/index.js';
import { AGGREGATORS } from '../enums/aggregator.enum.js';
import { apiCall } from '../utils/axios.js';
import { routers } from '../utils/constants.js';
import Quote from '../utils/quote.js';
import { Base } from './index.js';
import { v4 as uuidv4 } from 'uuid';

//TODO:
export default class ButterNetworkAggregator extends Base {
  BASE_URL: string;
  name: string;
  constructor() {
    super();
    this.name = AGGREGATORS.BUTTER_NETWORK;
    this.BASE_URL = 'https://bs-router-v3.chainservice.io';
  }

  async getQuotes(params: IQuoteParams): Promise<Quote[]> {
    const query = {
      fromChainId: params.fromChain.id,
      toChainId: params.toChain.id,
      tokenInAddress: params.fromToken.address,
      tokenOutAddress: params.toToken.address,
      amount: params.amount.toString(),
      type: 'exactIn',
      entrance: 'blazpay',
      affiliate: 'blazpay:20',
      slippage: params.slippage || 2000,
      from: params.srcWalletAddress,
      receiver: params?.dstWalletAddress || params.srcWalletAddress,
    };

    const res = await apiCall({
      method: 'GET',
      url: this.BASE_URL + '/route',
      params: query,
    });

    if (res.errno != 0) {
      throw new Error(
        res.message || 'Error fetching quotes from Butter Network'
      );
    }

    const data = res.data;

    const quotes: Quote[] = data?.map((quote: any) => {
      Object.assign(quote, { slippage: query.slippage });

      const meta = {
        id: uuidv4(),
        aggregator: AGGREGATORS.BUTTER_NETWORK,
        route: quote?.srcChain?.route[0]?.dexName || 'Butter',
        amount: Number(
          Number(parseFloat(quote?.srcChain?.totalAmountOut)).toFixed(4)
        ),
        usdAmount: Number(
          Number(parseFloat(quote?.srcChain?.totalAmountOutUSD)).toFixed(4)
        ),
        networkFee: Number(quote?.gasFee?.inUSD).toFixed(6),
        platformFee: 0,
        priceImpact: quote?.srcChain?.route[0]?.priceImpact || 0,
        slippage: 1,
        allowanceTo: quote?.contract,
        minAmount: Number(quote?.minAmountOut?.amount | 0).toFixed(4),
      };

      return new Quote(quote, meta, {
        fromChain: {
          id: params.fromChain.id,
          name: params.fromChain.name.toLowerCase(),
        },
        toChain: {
          id: params.toChain.id,
          name: params.toChain.name.toLowerCase(),
        },
        slippageTolerance: params.slippage ?? 0.5,
        srcWalletAddress: params.srcWalletAddress,
        dstWalletAddress: params.dstWalletAddress,
        quotePayload: query,
      });
    });

    return quotes;
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps,
    meta: any
  ): Promise<{ tx: any; spender: string }> {
    const query = {
      hash: data.hash,
      slippage: data.slippage,
      from: restProps.srcWalletAddress,
      receiver: restProps?.dstWalletAddress || restProps.srcWalletAddress,
    };

    const res = await apiCall({
      method: 'GET',
      url: this.BASE_URL + '/swap',
      params: query,
    });

    if (res.errno != 0) {
      throw new Error(
        res.message || 'Error fetching transaction data from Butter Network'
      );
    }

    const txData = res.data[0];

    const tx = {
      data: txData?.data,
      to: txData?.to,
      value: txData?.value,
      chainId: txData?.chainId,
    };

    return {
      tx,
      spender: txData?.to,
    };
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    const res = await apiCall({
      method: 'GET',
      url: `${routers['butter_network']}?hash=${hash}`,
    });
    return {
      status:
        res?.data?.status === 0
          ? 'pending'
          : res?.data?.status === 1
          ? 'success'
          : 'failed',
      hash,
    };
  }
}
