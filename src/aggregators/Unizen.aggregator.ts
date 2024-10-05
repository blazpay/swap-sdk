import { BigNumber, ethers } from "ethers";
import { IQuote, IQuoteParams, SwapParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";

export default class UnizenAggregator extends Base {
  BASE_URL: string;
  slippage: number;
  constructor() {
    super();
    this.BASE_URL = "http://localhost:5000/utizen-quote";
    this.slippage = 0.05;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    const payload = {
      fromTokenAddress: params.fromToken.address,
      toTokenAddress: params.toToken.address,
      amount: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      sender: params.srcWalletAddress,
      slippage: this.slippage,
      fromChainId: params.fromChain.id,
      type: params.type,
      destinationChainId: params.toChain.id,
    };

    const data = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: payload,
    });

    const swap = async ({ provider }: SwapParams) => {
      const payload: any = {
        transactionData: data?.transactionData,
        nativeValue: data?.nativeValue,
        account: params?.srcWalletAddress,
        toChainId: params.toChain.id,
        type: params.type,
      };

      if (params.type === "SWAP") {
        payload.tradeType = data?.tradeType;
      }

      //call swap api

      await this.setAllowance(
        params.fromToken.address,
        data?.approveTo,
        provider,
        params.fromChain.id,
        BigNumber.from(
          ethers.utils
            .parseUnits(String(params.amount), params.fromToken.decimals)
            .toString()
        ),
        "Utizen"
      );
    };

    const swapAmount = ethers.utils
      .formatUnits(data?.tokenAmountOut?.amount, data?.tokenAmountOut?.decimals)
      .toString();

    return {
      source: "Unizen",
      route: "Unizen",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: this.slippage,
      swap,
    };
  }
}
