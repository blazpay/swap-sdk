import { BigNumber, ethers } from "ethers";
import { IQuoteParams, IQuote, SwapParams } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { Base } from "./index.js";
import Quote from "../utils/quote.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";

const addressZero = "0x0000000000000000000000000000000000000000";
const addressZero1Inch = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export default class OneInchAggregator extends Base {
  BASE_URL: string;
  tradeFee: number;

  constructor() {
    super();
    this.BASE_URL = "https://api-v2.blazpay.com/api/defi/1inch";
    this.tradeFee = 0;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const query = {
      src:
        params.fromToken.address === addressZero
          ? addressZero1Inch
          : params.fromToken.address,
      dst:
        params.toToken.address === addressZero
          ? addressZero1Inch
          : params.toToken.address,
      amount: ethers.utils
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      fee: this.tradeFee,
      includeTokensInfo: true,
      includeProtocols: true,
      includeGas: true,
    };

    this.setSenderAddress(params.srcWalletAddress);

    const response = await apiCall({
      method: "POST",
      url: this.BASE_URL,
      data: { path: `/swap/v6.0/${params.fromChain.id}/quote`, query },
    });

    const swapAmount = ethers.utils.formatUnits(
      response?.dstAmount,
      response?.dstToken?.decimals
    );

    const swap = async ({
      provider,
      receiver,
      slippageTolerance = 0.5,
    }: SwapParams) => {
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const spender = await this.get1InchSpender(Number(params.fromChain.id));

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
        "1inch"
      );
      const res = await apiCall({
        url: this.BASE_URL,
        method: "POST",
        data: {
          query: {
            ...query,
            includeTokensInfo: true,
            includeProtocols: true,
            includeGas: true,
            from: walletAddress,
            slippage: slippageTolerance,
            receiver: receiver || walletAddress,
          },
          path: `/swap/v6.0/${params.fromChain.id}/swap`,
        },
      });

      const txdata = res.tx;

      const tx = await signer.sendTransaction({
        gasLimit: 500000,
        data: txdata.data,
        from: txdata.from,
        to: txdata.to,
        gasPrice: txdata.gasPrice,
        value: txdata.value,
      });

      await tx.wait();

      return tx;
    };

    const meta = {
      aggregator: AGGREGATORS.ONE_INCH,
      route: "One Inch",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: 0,
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: 0,
      swap,
    };

    const quote = new Quote(response, meta);

  quote.getMeta().id;

    return quote;
  }

  async getTransactionData(data:any) {

     const res = await apiCall({
       url: this.BASE_URL,
       method: "POST",
       data: {
         query: {
           ...query,
           includeTokensInfo: true,
           includeProtocols: true,
           includeGas: true,
           from: walletAddress,
           slippage: slippageTolerance,
           receiver: receiver || walletAddress,
         },
         path: `/swap/v6.0/${params.fromChain.id}/swap`,
       },
     });
  }

  async get1InchSpender(chainId: number) {
    try {
      const data = await apiCall({
        url: this.BASE_URL + "/getspender",
        method: "POST",
        data: {
          chain: chainId,
        },
      });
      return data.spender;
    } catch (error) {
      console.log(error, "error");
      throw error;
    }
  }
}

const s = new OneInchAggregator();
