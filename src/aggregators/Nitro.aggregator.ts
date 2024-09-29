import { IQuote, IQuoteParams } from "../@types/index.js";
import { ethers, formatUnits, parseUnits } from "ethers";
import { apiCall } from "../utils/axios.js";

const addressZero = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export default class NitroAggregator {
  BASE_URL: string;
  nitroPartnerId: number;

  constructor() {
    this.BASE_URL = "https://api-beta.pathfinder.routerprotocol.com/api";
    this.nitroPartnerId = 60;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    const body = {
      fromTokenAddress:
        params.fromToken.address === ethers.ZeroAddress
          ? addressZero
          : params.fromToken.address,
      toTokenAddress:
        params.toToken.address === ethers.ZeroAddress
          ? addressZero
          : params.toToken.address,
      amount: parseUnits(
        String(params.amount),
        params.fromToken.decimals
      ).toString(),

      fromTokenChainId: params.fromChain.id,
      toTokenChainId: params.toChain.id === 102 ? 900 : params.toChain.id,
      partnerId: this.nitroPartnerId,
    };

    const data = await apiCall({
      method: "GET",
      url: this.BASE_URL + "/v2/quote",
      params: body,
      timeout: 20000,
    });

    async function swap() {}

    const swapAmount = "021";

    const platformFee = data.bridgeFee.amount
      ? Number(Number(formatUnits(data.bridgeFee.amount)).toFixed(4))
      : 0;

    return {
      source: "nitro",
      route: "nitro",
      amount: Number(
        Number(
          formatUnits(
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
      swap,
    };
  }
}
