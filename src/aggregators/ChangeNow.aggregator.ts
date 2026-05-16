import { ethers } from "ethers";
import { IQuoteParams, SwapParams } from "../@types/aggregator.type.js";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";
import { baseUrl } from "../utils/constants.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";

export default class ChangeNowAggregator extends Base {
  name: string;
  BASE_URL: string;
  constructor() {
    super();
    this.name = AGGREGATORS.CHANGE_NOW;
    this.BASE_URL = baseUrl + "/change-now";
  }

  async getQuotes(params: IQuoteParams) {
    let fromCurrency =
      params.fromToken.symbol.toLowerCase() === "pol"
        ? "matic"
        : params.fromToken.symbol.toLowerCase();
    let toCurrency =
      params.toToken.symbol.toLowerCase() === "pol"
        ? "matic"
        : params.toToken.symbol.toLowerCase();

    let fromNetwork =
      params.fromChain.name.toLowerCase() === "polygon"
        ? "matic"
        : params.fromChain.name.toLowerCase();
    let toNetwork =
      params.toChain.name.toLowerCase() === "polygon"
        ? "matic"
        : params.toChain.name.toLowerCase();

    const query = {
      fromCurrency,
      toCurrency,
      fromNetwork,
      toNetwork,
      // flow: "",
      // type: "",
      fromAmount: params.amount,
    };

    const res = await apiCall({
      url: this.BASE_URL + "/quotes",
      method: "POST",
      data: query,
    });

    const value = {
      fromCurrency,
      toCurrency,
      fromNetwork,
      toNetwork,
      fromAmount: String(params.amount),
      address: params.srcWalletAddress,
      flow: "standard",
      type: "direct",
      rateId: res?.data?.rateId || "",
    };

    const swap = async ({ provider }: SwapParams) => {
      const signer = await provider.getSigner();

      const data = await apiCall({
        url: this.BASE_URL + "/swap",
        method: "POST",
        data: value,
      });

      const tx = await signer.sendTransaction({
        to: data?.data?.payinAddress,
        value: ethers.parseEther(params.amount.toString()),
        gasLimit: 60,
      });

      await tx.wait();

      return tx;
    };

    return {
      source: "Change Now",
      route: "Change Now",
      amount: res?.data?.toAmount,
      usdAmount: 0,
      networkFee: res?.data?.depositFee,
      platformFee: 0,
      priceImpact: 0,
      slippage: 0,
      swap,
    };
  }
}
