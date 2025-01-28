import { ethers } from "ethers";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import { v4 as uuidv4 } from "uuid";
import { routers } from "../utils/constants.js";

export default class KyberSwap extends Base {
  name: string;
  BASE_URL: string;
  BRIDGE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.KYBER_SWAP;
    this.BASE_URL = "https://aggregator-api.kyberswap.com";
    this.BRIDGE_URL = "https://apiplus.squidrouter.com "
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const fromTokenAdd =
      params.fromToken.address === "0x0000000000000000000000000000000000000000"
        ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        : params.fromToken.address;
    const toTokenAdd =
      params.toToken.address === "0x0000000000000000000000000000000000000000"
        ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
        : params.toToken.address;

    let query: any;
    let meta: any;
    let data: any;

    if (params.type === "SWAP") {
      query = {
        tokenIn: fromTokenAdd,
        tokenOut: toTokenAdd,
        amountIn: ethers.utils
          .parseUnits(String(params.amount), params.fromToken.decimals)
          .toString(),
        gasInclude: true,
        feeReceiver: "0x5222d5467DC61aFc2EfA95Ef76dCDe411e6e1D35",
        feeAmount: 1,
        isInBps: true,
        chargeFeeBy: "currency_out",
        source: "blazpay",
      };

      const res = await apiCall({
        method: "GET",
        url:
          this.BASE_URL +
          `/${params.fromChain.name?.toLowerCase()}/api/v1/routes`,
        params: query,
        headers: { "X-Client-Id": "blazpay" },
      });

      data = await res?.data;

      const swapAmount = ethers.utils
        .formatUnits(data?.routeSummary?.amountOut, params.toToken.decimals)
        .toString();

      meta = {
        id: uuidv4(),
        aggregator: AGGREGATORS.KYBER_SWAP,
        route: "KyberSwap",
        amount: Number(Number(swapAmount).toFixed(4)),
        usdAmount: data?.routeSummary?.amountOutUsd,
        networkFee: Number(data?.routeSummary?.gasUsd)?.toFixed(6),
        platformFee: `${(
          (Number(Number(swapAmount).toFixed(4)) *
            Number(data?.routeSummary?.extraFee?.feeAmount)) /
          100
        ).toFixed(6)} ${params.toToken?.symbol}`,
        priceImpact: 0,
        slippage: params.slippage || 0.5,
        allowanceTo: data?.routerAddress,
        // minAmount: 
      };
    }
    else {
      query = {
        fromChain: params.fromChain.id,
        fromToken: fromTokenAdd,
        fromAmount: ethers.utils
          .parseUnits(String(params.amount), params.fromToken.decimals)
          .toString(),
        toChain: params.toChain.id,
        toToken: params.toToken.address,
        fromAddress: params.srcWalletAddress,
        toAddress: params.dstWalletAddress,
        slippage: 1.00, //1%
        enableForecall: true,
        quoteOnly: false
      };
      const res = await apiCall({
        method: "POST",
        url: this.BRIDGE_URL,
        params: query,
        headers: {
          // "x-integrator-id": integratorId,
          "Content-Type": "application/json",
        },
      });

      data = await res?.route;
      const swapAmount = ethers.utils
        .formatUnits(data?.estimate?.toAmount, params.toToken.decimals)
        .toString();

      meta = {
        id: uuidv4(),
        aggregator: AGGREGATORS.KYBER_SWAP,
        route: "squid",
        amount: Number(Number(swapAmount).toFixed(4)),
        usdAmount: 0,
        networkFee: Number(data?.estimate?.feeCosts[0]?.amountUSD)?.toFixed(6),
        platformFee: Number(data?.estimate?.gasCosts[0]?.amountUSD)?.toFixed(6),
        priceImpact: 0,
        slippage: params.slippage || 0.5,
        allowanceTo: data?.transactionRequest?.targetAddress,
        data: data?.transactionRequest
      };
    }

    const quote = new Quote(data, meta, {
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
    restProps: IRestQuoteProps,
    meta: any
  ): Promise<{ tx: any; spender: string }> {
    console.log(restProps,"type in this", meta, data)
    if (restProps.fromChain?.id !== restProps.toChain?.id) {
      const tx = {
        data: meta?.data?.data,
        from: restProps.srcWalletAddress,
        to: meta?.data?.targetAddress,
        value: meta?.data?.value,
        gasLimit: Number(meta?.data?.gasLimit),
      };
      return {
        tx,
        spender: meta?.data?.targetAddress,
      };
    }
    const payload = {
      routeSummary: data?.routeSummary,
      sender: restProps.srcWalletAddress,
      recipient: restProps?.dstWalletAddress || restProps.srcWalletAddress,
      slippageTolerance: 50,
      source: "blazpay",
    };

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL + `/${restProps.fromChain.name}/api/v1/route/build`,
      data: JSON.stringify(payload),
      headers: { "X-Client-Id": "blazpay", "Content-Type": "application/json" },
    });

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
      tx,
      spender: data?.routerAddress,
    };
  }

  // async getTxStatus(chainId: number, hash: string): Promise < any > {
  //   const res = await apiCall({
  //     method: "GET",
  //     url: `${routers['lifi']}?txHash=${hash}`,
  //   });
  //   return {
  //     status: res?.status === 'PENDING' ? 'pending' : res?.status === 'DONE' ? 'success' : res?.status === 'FAILED' ? "failed" : "not found",
  //     hash
  //   }
  // }

}

