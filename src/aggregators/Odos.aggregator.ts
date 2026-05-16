import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

const ODOS_NATIVE = "0x0000000000000000000000000000000000000000";

export default class OdosAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.ODOS;
    this.BASE_URL = baseUrl + "/odos";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? ODOS_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("Odos supports single-chain swaps only");
    }

    const inputTokenAddress = this.resolveTokenAddress(
      params.fromToken.address
    );
    const outputTokenAddress = this.resolveTokenAddress(
      params.toToken.address
    );

    const body = {
      chainId: params.fromChain.id,
      inputTokens: [
        {
          tokenAddress: inputTokenAddress,
          amount: ethers
            .parseUnits(String(params.amount), params.fromToken.decimals)
            .toString(),
        },
      ],
      outputTokens: [
        {
          tokenAddress: outputTokenAddress,
          proportion: 1,
        },
      ],
      userAddr: params.srcWalletAddress,
      slippageLimitPercent: params.slippage ?? 0.3,
      compact: true,
      referralCode: 0,
      disableRFQs: false,
    };

    const data = await apiCall({
      method: "POST",
      url: this.BASE_URL + "/quote",
      data: body,
    });

    if (!data?.pathId || !data?.outAmounts?.[0]) {
      throw new Error("Odos: no route found");
    }

    const swapAmount = ethers.formatUnits(
      data.outAmounts[0],
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.ODOS,
      route: "Odos",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: Number(data?.outValues?.[0] ?? 0),
      networkFee: Number(data?.gasEstimateValue ?? 0).toFixed(6),
      platformFee: Number(data?.partnerFeePercent ?? 0),
      priceImpact: Number(data?.priceImpact ?? data?.percentDiff ?? 0),
      slippage: params.slippage ?? 0.3,
      allowanceTo: "",
      pathId: data.pathId,
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
      slippageTolerance: params.slippage ?? 0.3,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: body,
    });
  }

  async getTransactionData(
    data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Odos pathIds expire after ~60s — the cached one from the original
    // quote will almost always be stale by the time the user clicks
    // simulate/swap. Re-quote to get a fresh pathId, then assemble.
    const fresh = await apiCall({
      method: "POST",
      url: this.BASE_URL + "/quote",
      data: restProps.quotePayload,
    });

    if (!fresh?.pathId) {
      throw new Error("Odos: re-quote returned no pathId");
    }

    const res = await apiCall({
      method: "POST",
      url: this.BASE_URL + "/assemble",
      data: {
        userAddr: restProps.srcWalletAddress,
        pathId: fresh.pathId,
        simulate: false,
        receiver:
          restProps.dstWalletAddress || restProps.srcWalletAddress,
      },
    });

    const t = res?.transaction;
    if (!t?.to || !t?.data) {
      throw new Error("Odos: assemble returned no transaction");
    }

    const tx = {
      data: t.data,
      from: restProps.srcWalletAddress,
      to: t.to,
      value: t.value ?? "0",
      gasLimit: t.gas ? Number(t.gas) : undefined,
    };

    return {
      tx,
      spender: t.to,
    };
  }
}
