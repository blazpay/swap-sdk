import { BigNumber, ethers } from "ethers";
import { IQuote, IQuoteParams, SwapParams } from "../@types/aggregator.type.js";
import { Base } from "./index.js";
import { apiCall } from "../utils/axios.js";
import { getContractAddressByChainId } from "../utils/constants.js";

export default class UnizenAggregator extends Base {
  BASE_URL: string;
  slippage: number;
  constructor() {
    super();
    this.BASE_URL = "https://api-v2.blazpay.com/api/defi/unizen";
    this.slippage = 0.05;
  }

  async getQuotes(params: IQuoteParams): Promise<IQuote> {
    this.setSenderAddress(params.srcWalletAddress);
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

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL + "/quotes",
      data: payload,
    });

    const data = res?.data;

    const swap = async ({ provider }: SwapParams) => {
      const signer = provider.getSigner();

      const spender = await this.getSpender(params.fromChain.id);

      await this.setAllowance(
        params.fromToken.address,
        spender,
        provider,
        params.fromChain.id,
        BigNumber.from(
          ethers.utils
            .parseUnits(String(params.amount), params.fromToken.decimals)
            .toString()
        ),
        "Utizen"
      );
      const payload: any = {
        transactionData: data?.transactionData,
        nativeValue: data?.nativeValue,
        account: params?.srcWalletAddress,
        toChainId: params.toChain.id,
        fromChainId: params.fromChain.id,
        type: params.type,
      };

      if (params.type === "SWAP") {
        payload.tradeType = data?.tradeType;
      }

      const res = await apiCall({
        method: "POST",
        url: this.BASE_URL + "/swap",
        data: payload,
      });

      const txData = res?.data;

      const contractAddress = getContractAddressByChainId(params.fromChain.id);

      const tx = await signer.sendTransaction({
        from: params.srcWalletAddress,
        to: contractAddress,
        gasLimit: txData?.estimateGas,
        data: txData?.data,
        gasPrice: txData?.gasPrice,
        value: txData?.nativeValue,
      });

      await tx.wait();

      return tx;
    };

    const swapAmount = ethers.utils
      .formatUnits(data?.toTokenAmount, data?.tokenTo?.decimals)
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
  async getSpender(chainId: number) {
    try {
      const data = await apiCall({
        url: this.BASE_URL + "/spender",
        method: "POST",
        data: {
          chain: chainId,
        },
      });
      return data.data;
    } catch (error) {
      console.log(error, "error");
      throw error;
    }
  }
}
