import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

// Near 1Click identifies tokens by an opaque `assetId` (nep141 / nep245 strings).
// We can't derive it from chainId + tokenAddress directly — we look it up from
// the GET /v0/tokens registry, keyed by (blockchain shortcode, contract address).
const NEAR_CHAIN_MAP: Record<number, string> = {
  1: "eth",
  10: "op",
  56: "bsc",
  137: "pol",
  8453: "base",
  42161: "arb",
  43114: "avax",
  534352: "scroll",
};

interface NearToken {
  blockchain: string;
  symbol: string;
  assetId: string;
  contractAddress: string | null;
  decimals: number;
}

let tokensCache: NearToken[] | null = null;
let tokensCacheLoadedAt = 0;
const TOKENS_TTL_MS = 5 * 60 * 1000;

async function loadTokens(baseApiUrl: string): Promise<NearToken[]> {
  const now = Date.now();
  if (tokensCache && now - tokensCacheLoadedAt < TOKENS_TTL_MS) {
    return tokensCache;
  }
  const data = await apiCall({
    method: "GET",
    url: `${baseApiUrl}/tokens`,
  });
  if (!Array.isArray(data)) {
    throw new Error("Near: unexpected /tokens response");
  }
  tokensCache = data as NearToken[];
  tokensCacheLoadedAt = now;
  return tokensCache;
}

export default class NearOneClickAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.NEAR_1CLICK;
    this.BASE_URL = baseUrl + "/near-1click";
  }

  private resolveAssetId(
    tokens: NearToken[],
    chainId: number,
    tokenAddress: string
  ): string | null {
    const shortCode = NEAR_CHAIN_MAP[chainId];
    if (!shortCode) return null;

    const isNative = this.isNativeAddresss(tokenAddress);
    const candidates = tokens.filter((t) => t.blockchain === shortCode);

    if (isNative) {
      const native = candidates.find((t) => t.contractAddress == null);
      return native?.assetId ?? null;
    }

    const lower = tokenAddress.toLowerCase();
    const match = candidates.find(
      (t) => (t.contractAddress ?? "").toLowerCase() === lower
    );
    return match?.assetId ?? null;
  }

  private buildPayload(
    params: IQuoteParams,
    originAsset: string,
    destinationAsset: string,
    dry: boolean
  ): Record<string, any> {
    const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return {
      originAsset,
      destinationAsset,
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      swapType: "EXACT_INPUT",
      slippageTolerance: Math.round((params.slippage ?? 0.5) * 100), // bps
      refundTo: params.srcWalletAddress,
      refundType: "ORIGIN_CHAIN",
      recipient: params.dstWalletAddress || params.srcWalletAddress,
      recipientType: "DESTINATION_CHAIN",
      deadline,
      depositType: "ORIGIN_CHAIN",
      dry,
    };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const tokens = await loadTokens(this.BASE_URL);

    const originAsset = this.resolveAssetId(
      tokens,
      params.fromChain.id,
      params.fromToken.address
    );
    const destinationAsset = this.resolveAssetId(
      tokens,
      params.toChain.id,
      params.toToken.address
    );

    if (!originAsset || !destinationAsset) {
      throw new Error("Near 1Click: token pair not supported");
    }

    const payload = this.buildPayload(
      params,
      originAsset,
      destinationAsset,
      /* dry */ true
    );

    const res = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: payload,
    });

    const quoteRes = res?.quote;
    if (!quoteRes?.amountOut) {
      throw new Error("Near 1Click: no route found");
    }

    const swapAmount = ethers.formatUnits(
      quoteRes.amountOut,
      params.toToken.decimals
    );

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.NEAR_1CLICK,
      route: "Near Intents",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: Number(quoteRes.amountOutUsd ?? 0),
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: "",
      timeEstimate: quoteRes?.timeEstimate ? Number(quoteRes.timeEstimate) : undefined,
      // re-quote payload for refresh; we'll replace `dry` with false at build time.
    };

    return new Quote(res, meta, {
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
      quotePayload: payload,
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Re-quote with dry=false to materialize a real depositAddress.
    // The Near intents network monitors that address for incoming funds and
    // executes the swap upon receipt — so the "tx" we hand to the BlazpayRelayer
    // is just a plain transfer to depositAddress with empty calldata.
    const payload = {
      ...restProps.quotePayload,
      dry: false,
      // refresh the deadline window
      deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const res = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/quote`,
      data: payload,
    });

    const depositAddress = res?.quote?.depositAddress;
    const amountIn = res?.quote?.amountIn ?? payload.amount;
    if (!depositAddress) {
      throw new Error("Near 1Click: no depositAddress in quote");
    }

    // Determine whether the input asset is the chain's native token by
    // looking up the origin assetId in the token registry — a Near asset
    // whose contractAddress is null represents the native coin.
    const tokens = await loadTokens(this.BASE_URL);
    const originRecord = tokens.find((t) => t.assetId === payload.originAsset);
    const isNativeIn = originRecord?.contractAddress == null;

    return {
      tx: {
        // BlazpayRelayer transfers funds to `recipient` (= depositAddress)
        // and then skips the targetContract.call because data.length == 0.
        to: depositAddress,
        data: "0x",
        value: isNativeIn ? String(amountIn) : "0",
        from: restProps.srcWalletAddress,
      },
      spender: depositAddress,
    };
  }

  // For Near 1Click the FE must pass the depositAddress (returned from
  // getTransactionData) as `hash` — that's what /v0/status is keyed by, not
  // the on-chain source-tx hash.
  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    try {
      const res = await apiCall({
        method: "GET",
        url: `${this.BASE_URL}/status`,
        params: { depositAddress: hash },
      });
      const s = (res?.status || "").toUpperCase();
      const status =
        s === "SUCCESS"
          ? "success"
          : s === "FAILED" || s === "REFUNDED" || s === "INCOMPLETE_DEPOSIT"
          ? "failed"
          : s
          ? "pending"
          : "not_found";
      return { status, hash, raw: res };
    } catch (_) {
      return { status: "not_found", hash };
    }
  }
}
