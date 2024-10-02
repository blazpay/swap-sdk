import { BigNumber, ethers } from "ethers";
import { IQuote, IQuoteParams, SwapParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";

export default class OpenOceanAggregator extends Base {
  BASE_URL: string;
  slippage: number;
  constructor() {
    super();
    this.BASE_URL = "";
    this.slippage = 0.5;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    const query = {
      chain: params.fromChain.id,
      inTokenAddress: params.fromToken.address,
      outTokenAddress: params.toToken.address,
      amount: Number(params.amount),
      slippage: 0.5,
      gasPrice: (await this.getGasPrice(params.fromChain.id))?.standard,
      account: params.srcWalletAddress,
    };

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      params: query,
    });

    const data = res?.data?.data;

    const swap = async ({ provider }: SwapParams) => {
      const signer = await provider.getSigner();

      await this.setAllowance(
        params.fromToken.address,
        data?.to,
        provider,
        params.fromChain.id,
        BigNumber.from(
          ethers.utils
            .parseUnits(String(params.amount), params.fromToken.decimals)
            .toString()
        ),
        "openocean"
      );

      const tx = await signer.sendTransaction({
        data: data?.data,
        from: data?.from,
        to: data?.to,
        gasLimit: data?.estimatedGas,
        gasPrice: data?.gasPrice * 3,
        value: data?.value ? data?.value : data?.inAmount,
      });

      await tx.wait();

      return tx;
    };

    const swapAmount = ethers.utils
      .formatUnits(data?.tokenAmountOut?.amount, data?.tokenAmountOut?.decimals)
      .toString();

    return {
      source: "OpenOcean",
      route: "OpenOcean",
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
