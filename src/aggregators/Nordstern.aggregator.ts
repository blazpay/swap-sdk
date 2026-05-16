import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";

const NORDSTERN_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default class NordsternAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.NORDSTERN;
    this.BASE_URL = "https://api.nordstern.finance";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? NORDSTERN_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("Nordstern supports single-chain swaps only");
    }

    const src = this.resolveTokenAddress(params.fromToken.address);
    const dst = this.resolveTokenAddress(params.toToken.address);

    const query: Record<string, any> = {
      src,
      dst,
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      from: params.srcWalletAddress,
      slippage: params.slippage ?? 0.5,
    };

    const data = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/aggregator/${params.fromChain.id}`,
      params: query,
    });

    if (!data?.tx?.to || !data?.toAmount || data.toAmount === "0") {
      throw new Error("Nordstern: no route found");
    }

    const toAmount = ethers.formatUnits(
      data.toAmount,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.NORDSTERN,
      route: "Nordstern",
      amount: Number(Number(toAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: data?.tx?.to,
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
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Quote response already contains tx. Re-fetch to get a fresh route
    // (Nordstern doesn't document a separate /build endpoint).
    const fresh = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/aggregator/${restProps.fromChain.id}`,
      params: restProps.quotePayload,
    });

    const tx = {
      data: fresh?.tx?.data,
      from: restProps.srcWalletAddress,
      to: fresh?.tx?.to,
      value: fresh?.tx?.value ?? "0",
    };

    return {
      tx,
      spender: fresh?.tx?.to,
    };
  }
}
