import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";

const SUSHI_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default class SushiswapAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.SUSHISWAP;
    this.BASE_URL = "https://api.sushi.com";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? SUSHI_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("Sushiswap supports single-chain swaps only");
    }

    const query: Record<string, any> = {
      tokenIn: this.resolveTokenAddress(params.fromToken.address),
      tokenOut: this.resolveTokenAddress(params.toToken.address),
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      maxSlippage: (params.slippage ?? 0.5) / 100, // decimal: 0.005 = 0.5%
      sender: params.srcWalletAddress,
    };

    const data = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/swap/v7/${params.fromChain.id}`,
      params: query,
    });

    if (
      data?.status !== "Success" ||
      !data?.tx?.to ||
      !data?.assumedAmountOut
    ) {
      throw new Error(
        `Sushiswap: no route found${data?.status ? ` (status=${data.status})` : ""}`
      );
    }

    const swapAmount = ethers.formatUnits(
      data.assumedAmountOut,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.SUSHISWAP,
      route: "Sushiswap",
      amount: Number(swapAmount),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: Number(data?.priceImpact ?? 0),
      slippage: params.slippage ?? 0.5,
      allowanceTo: data.tx.to,
    };

    return new Quote(data, meta, {
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
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Sushi's quote already includes tx. Re-fetch for freshness.
    const fresh = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/swap/v7/${restProps.fromChain.id}`,
      params: restProps.quotePayload,
    });

    if (fresh?.status !== "Success" || !fresh?.tx?.to || !fresh?.tx?.data) {
      throw new Error(
        `Sushiswap: re-quote returned no transaction${
          fresh?.status ? ` (status=${fresh.status})` : ""
        }`
      );
    }

    return {
      tx: {
        data: fresh.tx.data,
        from: restProps.srcWalletAddress,
        to: fresh.tx.to,
        value: fresh.tx.value ?? "0",
      },
      spender: fresh.tx.to,
    };
  }
}
