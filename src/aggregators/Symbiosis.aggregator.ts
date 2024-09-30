import { formatUnits, parseUnits } from "ethers";
import { IQuote, IQuoteParams } from "../@types/index.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";

export default class SymbiosisAggregator extends Base {
  BASE_URL: string;
  slippage: number;
  constructor() {
    super();

    this.BASE_URL = "https://api.symbiosis.finance/crosschain/v1/swap";
    this.slippage = 1;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    const amount = parseUnits(
      String(params.amount),
      params.fromToken.decimals
    ).toString();

    const payload = {
      tokenAmountIn: {
        address: params?.fromToken.address,
        symbol: params?.fromToken.symbol,
        amount,
        chainId: Number(params?.fromChain.id),
        decimals: params?.fromToken.decimals,
      },
      tokenOut: {
        chainId: Number(params?.toChain.id),
        address: params?.toToken.address,
        symbol: params?.toToken.symbol,
        decimals: params?.toToken.decimals,
      },
      from: params?.srcWalletAddress,
      to: params?.dstWalletAddress
        ? params.dstWalletAddress
        : params.srcWalletAddress,
      slippage: 300,
    };

    const data = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: payload,
    });

    async function swap() {}

    const swapAmount = formatUnits(
      data?.tokenAmountOut?.amount,
      data?.tokenAmountOut?.decimals
    ).toString();

    return {
      source: "Symbiosis",
      route: "Symbiosis",
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
