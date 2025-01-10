import { IQuoteParams, IRestQuoteProps, SwapParams } from "../@types/index.js";
import { v4 as uuidv4 } from "uuid";
import { BigNumber, ethers } from "ethers";
// import { apiCall } from "../utils/axios.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import axios from "axios";
import { routers } from "../utils/constants.js";
import { TronWeb } from 'tronweb'

const addressZero = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export default class NitroAggregator extends Base {
  name: string;
  BASE_URL: string;
  nitroPartnerId: number;

  constructor() {
    super();
    this.name = AGGREGATORS.NITRO;
    this.BASE_URL = "https://api-beta.pathfinder.routerprotocol.com/api";
    this.nitroPartnerId = 60;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const body = {
      fromTokenAddress:
        params.fromToken.address === ethers.constants.AddressZero
          ? addressZero
          : params.fromToken.address,
      toTokenAddress:
        params.toToken.address === ethers.constants.AddressZero
          ? addressZero
          : params.toToken.address,
      amount: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),

      fromTokenChainId: params.fromChain.id !== 102? params.fromChain.id : 'solana',
      toTokenChainId: params.toChain.id !== 102? params.toChain.id : 'solana',
      partnerId: this.nitroPartnerId,
    };

    const data = await apiCall({
      method: "GET",
      url: this.BASE_URL + "/v2/quote",
      params: body,
    });

    const platformFee = data?.bridgeFee?.amount
      ?
      `${Number(ethers.utils.formatUnits(data.bridgeFee.amount)).toFixed(4)} ${data?.bridgeFee?.symbol}`
      : 0;

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.NITRO,
      route: "nitro",
      amount: Number(
        Number(
          ethers.utils.formatUnits(
            data.destination.tokenAmount,
            data.destination.asset.decimals
          )
        ).toFixed(4)
      ),
      usdAmount: 0,
      networkFee: 0,
      platformFee,
      priceImpact: data.source.priceImpact,
      slippage: data.slippageTolerance,
      allowanceTo: data?.allowanceTo,
      minAmount: data?.source?.stableReserveAmount
    };

    const quote = new Quote(data, meta, {
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
      quotePayload: body,
    });

    return quote;
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string, metaData?: any }> {

    if(restProps.fromChain.id === 728126428) 
      restProps.srcWalletAddress = "0x" + TronWeb.address.toHex(restProps.srcWalletAddress).substring(2)
    if(restProps.toChain.id === 728126428 && restProps.dstWalletAddress)
      restProps.dstWalletAddress = "0x" + TronWeb.address.toHex(restProps.dstWalletAddress).substring(2)

    const res = await apiCall({
      url: this.BASE_URL + "/v2/transaction",
      method: "POST",
      data: {
        ...data,
        slippageTolerance: restProps.slippageTolerance,
        senderAddress: restProps.srcWalletAddress,
        receiverAddress: restProps.dstWalletAddress,
      },
      timeout: 20000,
    });

    return {
      tx: res?.txn,
      spender: data?.allowanceTo,
      metaData: res
    };
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    const res = await apiCall({
      method: "GET",
      url: `${routers['nitro']}?srcTxHash=${hash}`,
    });
    return {
      status: res?.status === 'completed' ? 'success' : res?.status === 'pending' ? 'pending' : 'failed',
      hash
    }
  }
}

async function apiCall(params: any) {
  try {
    const response = await axios(params);
    return response.data;
  } catch (error: any) {
    throw new Error(error);
  }
}