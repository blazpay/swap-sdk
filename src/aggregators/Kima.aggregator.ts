import { ethers } from 'ethers';
import { IQuoteParams, IRestQuoteProps } from '../@types/index.js';
import { apiCall } from '../utils/axios.js';
import Quote from '../utils/quote.js';
import Base from './base.aggregator.js';
import { AGGREGATORS } from '../enums/aggregator.enum.js';
import { v4 as uuidv4 } from 'uuid';
import { ChainNameKima, routers } from '../utils/constants.js';
import axios from 'axios';

export default class KimaSwapAggregator extends Base {
  name: string;
  BASE_URL: string;
  FEE_URL: string;
  solSpender: string;
  trxSpender: string;
  evmSpender: string;

  constructor() {
    super();
    this.name = AGGREGATORS.KIMA;
    this.BASE_URL = 'https://kima.blazpay.com';
    this.FEE_URL = 'https://fee.kima.finance/fee/';
    this.solSpender = 'E1ARyS9m5ZWSxhQbmrdVg2oycktRSHqzDRKkZZgrfr9A';
    this.trxSpender = '0x948627f5c0352f320b284a2a9dbb92933866995d';
    this.evmSpender = '0x948627f5c0352f320b284a2a9dbb92933866995d';
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {

    if(!(params?.fromToken.symbol === "USDT" || params?.fromToken.symbol === "USDC") || !(params?.toToken?.symbol === "USDT" || params?.toToken?.symbol === "USDC"))
      throw new Error("Invalid tokens")
    if(params?.type !== "BRIDGE")
      throw new Error("kima not supported.")
    const platformFee = 0;
    // await this.getServiceFee(
    //   ChainNameKima[params.toChain.name as keyof typeof ChainNameKima]
    // )
    let networkFee = 0;
    // platformFee !== 0 &&
    // (await this.getServiceFee(
    //   ChainNameKima[params.fromChain.name as keyof typeof ChainNameKima]
    // ));

    const query = {
      tokenIn: params.fromToken.address,
      tokenOut: params.toToken.address,
      amountIn: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
    };

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.KIMA,
      route: 'Kima',
      amount: Number((params?.amount - platformFee).toFixed(6)),
      usdAmount: 0,
      networkFee: `${Number(networkFee)?.toFixed(6)} ${
        params?.fromToken?.symbol
      }`,
      platformFee: `${Number(platformFee)?.toFixed(6)} ${
        params?.toToken?.symbol
      }`,
      priceImpact: 0,
      slippage: params.slippage || 0.5,
      allowanceTo:
      params?.fromChain?.name === 'SOL'
          ? this.solSpender
          : params?.fromChain?.name === 'TRX'
          ? this.trxSpender
          : this.evmSpender,
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
      quotePayload: query,
    });

    return quote;
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string; metaData: any }> {
    const payload = {
      routeSummary: data?.routeSummary,
      sender: restProps.srcWalletAddress,
      recipient: restProps?.dstWalletAddress || restProps.srcWalletAddress,
      slippageTolerance: 50,
      source: 'blazpay',
    };

    const body = {
      originAddress: restProps?.quotePayload?.tokenIn,
      originChain: 'POL',
      targetAddress: restProps?.quotePayload?.tokenOut,
      targetChain: 'ARB',
      originSymbol: 'USDT',
      targetSymbol: 'USDT',
      amount: restProps?.quotePayload?.amountIn,
      fee: 0.01,
      htlcCreationHash: '',
      htlcCreationVout: 0,
      htlcExpirationTimestamp: '0',
      htlcVersion: '',
      senderPubKey: '',
    };

    const res = await apiCall({
      method: 'POST',
      url: this.BASE_URL + '/auth',
      headers: {
        'Content-Type': 'application/json',
      },
      data: body,
      withCredentials: true,
    });

    let resBridge;
    try {
      resBridge = await apiCall({
        method: 'POST',
        url: this.BASE_URL + '/submit',
        headers: {
          'Content-Type': 'application/json',
        },
        data: body,
        withCredentials: true,
      });
    } catch (error) {
      console.log('🚀 ~ KimaSwapAggregator ~ error:', error);
    }

    const txData = res?.data;
    const tx = {
      data: txData?.data,
      from: restProps.srcWalletAddress,
      to: txData?.routerAddress,
      value: this.isNativeAddresss(restProps.quotePayload.tokenOut)
        ? 0
        : txData?.amountIn,
      gasLimit: Number(txData?.gas),
    };

    return {
      tx: res.headers,
      spender: data?.routerAddress,
      metaData: resBridge,
    };
  }

  async calcServiceFee(
    sourceChain: ChainNameKima,
    targetChain: ChainNameKima
  ): Promise<number> {
    if (targetChain === ChainNameKima.btc) {
      return 0;
    }

    const [sourceFee, targetFee] = await Promise.all([
      this.getServiceFee(sourceChain),
      this.getServiceFee(targetChain),
    ]);

    const fee = sourceFee + targetFee;
    return fee;
  }

  async getServiceFee(chain: ChainNameKima): Promise<number> {
    const result = await fetch(`${this.FEE_URL}${chain}`).then((res) =>
      res.json()
    );

    const { fee } = result as { fee: string };
    const [amount] = fee.split('-');

    return +amount;
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    var data = {
      query:
        'query TransactionDetailsKima($kimaTxHash: String) { transaction_data(where: { kimahash: { _eq: $kimaTxHash } }, limit: 1) { failreason pullfailcount pullhash releasefailcount releasehash txstatus amount creator originaddress originchain originsymbol targetsymbol targetaddress targetchain tx_id kimahash } }',
      variables: {
        kimaTxHash: `${hash}`,
      },
    };
    const { transaction_data: txData } = await apiCall({
      method: 'POST',
      url: routers['kima'],
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(data),
    });
    return {
      status:
        txData?.txstatus === 'Completed'
          ? 'success'
          : txData?.txstatus === 'FailedToPull'
          ? 'failed'
          : 'pending',
      hash,
    };
  }
}
