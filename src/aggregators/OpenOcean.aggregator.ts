import { BigNumber, ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuote, IQuoteParams, SwapParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import { IRestQuoteProps } from "../@types/quote.type.js";
import { routers } from "../utils/constants.js";

export default class OpenOceanAggregator extends Base {
  name: string;
  BASE_URL: string;
  slippage: number;
  bridgeUrl: string;
  swapUrl: string;
  constructor() {
    super();
    this.name = AGGREGATORS.OPEN_OCEAN;
    this.BASE_URL = "";
    this.slippage = 0.5;
    this.bridgeUrl = "https://open-api.openocean.finance/cross_chain/v1/cross";
    this.swapUrl= "https://open-api.openocean.finance/v3/"
  }

  getBaseUrl(type: string, chain: number | string) {
    if (type === "SWAP")
      return `${this.swapUrl}${chain}/swap_quote`;
    else return this.bridgeUrl + `/quoteByOO`;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote | Quote[]> {
    this.setSenderAddress(params.srcWalletAddress);
    let query: any = {};

    if (params.type === "SWAP") {
      query = {
        chain: params.fromChain.id,
        inTokenAddress: params.fromToken.address,
        outTokenAddress: params.toToken.address,
        amount: Number(params.amount),
        slippage: 0.5,
        gasPrice: (await this.getGasPrice(params.fromChain.id))?.standard || 60,
        account: params?.dstWalletAddress || params.srcWalletAddress,
        referrer: "0x5222d5467DC61aFc2EfA95Ef76dCDe411e6e1D35",
        referrerFee: 0.01,
        sender: params.srcWalletAddress
      };
    } else {
      query = {
        fromChainId: params.fromChain.id !== 102? params.fromChain.id : 'solana',
        toChainId: params.toChain.id !== 102? params.toChain.id : 'solana',
        fromSymbol: params?.fromToken.symbol,
        toSymbol: params?.toToken.symbol,
        amount: ethers.utils
          .parseUnits(String(params.amount), params.fromToken.decimals)
          .toString(),
        referrer: "0x5222d5467DC61aFc2EfA95Ef76dCDe411e6e1D35",
        referrerFee: 0.01,
      };
    }

    const res = await apiCall({
      method: "GET",
      url: this.getBaseUrl(params.type, params.fromChain.id !== 102? params.fromChain.id : 'solana'),
      params: query,
      headers: {
        apikey: "v1KMZyXotXue4HiQEO3O60qj7iP3SP2j",
        "Content-Type": "application/json",
      },
    });

    const data = res?.data;

    if (params.type === "SWAP") {
      const swapAmount = data?.outAmount/Math.pow(10, data?.outToken?.decimals)
      
      const meta = {
        id: uuidv4(),
        aggregator: AGGREGATORS.OPEN_OCEAN,
        route: "OpenOcean",
        amount: Number(Number(swapAmount).toFixed(4)),
        usdAmount: data?.outToken?.usd,
        networkFee: `${Number(ethers.utils.formatEther((Number(data?.estimatedGas) * Number(data?.gasPrice || query?.gasPrice)).toString()))?.toFixed(6)} NATIVE`,
        platformFee: 0,
        priceImpact: data?.price_impact?.replace("%", ""),
        slippage: this.slippage,
        allowanceTo: data?.to,
      };

      const quote = new Quote(data, meta, {
        srcWalletAddress: params.srcWalletAddress,
        dstWalletAddress: params.dstWalletAddress,
        fromChain: {
          id: params.fromChain.id,
          name: params.fromChain.name.toLowerCase(),
        },
        toChain: {
          id: params.toChain.id,
          name: params.toChain.name.toLowerCase(),
        },
        slippageTolerance: params.slippage ?? 0.5,
        quotePayload: query,
      });
      return quote;
    } else {
      const quotes: Quote[] = data?.routes
        ?.filter((route: any) => route !== null)
        .map((route: any) => {
          const swapAmount = ethers.utils
            .formatUnits(
              route.bridgeRoute?.outputAmount,
              route.bridgeRoute?.toAsset?.decimals
            )
            .toString();

          const meta = {
            id: uuidv4(),
            aggregator: AGGREGATORS.OPEN_OCEAN,
            route: route?.bridgeRoute?.bridgeInfo?.code,
            amount: Number(Number(swapAmount).toFixed(4)),
            usdAmount: 0,
            networkFee:
              Number(route?.fees?.gasLimit[0]?.value)?.toFixed(6) || 0,
            platformFee: route?.fees?.bridgeFee?.amount
              ? `${Number(
                  ethers.utils.formatUnits(
                    route?.fees?.bridgeFee?.amount,
                    route?.fees?.bridgeFee?.decimals
                  )
                )?.toFixed(6)} ${route?.fees?.bridgeFee?.symbol}`
              : 0,
            priceImpact: data?.price_impact?.replace("%", "") || 0,
            slippage: this.slippage,
            allowanceTo: route?.allowanceTarget,
            routeObj: route,
          };

          return new Quote(data, meta, {
            srcWalletAddress: params.srcWalletAddress,
            dstWalletAddress: params.dstWalletAddress,
            fromChain: {
              id: params.fromChain.id,
              name: params.fromChain.name.toLowerCase(),
            },
            toChain: {
              id: params.toChain.id,
              name: params.toChain.name.toLowerCase(),
            },
            slippageTolerance: params.slippage ?? 0.5,
            quotePayload: query,
          });
        });

      return quotes;
    }
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps,
    meta: any
  ): Promise<{ tx: any; spender: string }> {
    if (data?.fromChainId === data?.toChainId){
      return {
        tx: {
          data: data?.data,
          from: data?.from,
          to: data?.to,
          gasLimit: data?.estimatedGas,
          gasPrice: data?.gasPrice * 3,
          value: data?.value ? data?.value : data?.inAmount,
        },
        spender: data?.to,
      };
    }
    else {
      const res = await apiCall({
        method: "POST",
        url: `${this.bridgeUrl}/${meta?.route}/swap`,
        data: {
          route: meta?.routeObj,
          plat: meta?.route,
          account: restProps?.srcWalletAddress,
        },
        headers: {
          apikey: "v1KMZyXotXue4HiQEO3O60qj7iP3SP2j",
          "Content-Type": "application/json",
        },
      });

      return {
        tx: res?.data,
        spender: meta?.allowanceTo,
      };
    }
  }

  async getTxStatus(chainId: number, hash: string): Promise<any> {
    const res = await apiCall({
      method: "GET",
      url: `${routers['open_ocean']}?hash=${hash}&chainId=${chainId}`,
    });
    return {
      status: res?.data?.status === 3? 'pending' : res?.data?.status === 5 ? 'success' : 'failed',
      hash
    }
  }
}
