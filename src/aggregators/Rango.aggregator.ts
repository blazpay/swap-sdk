import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { getConfig } from "../utils/config.js";

// Rango uses CHAIN_NAME.SYMBOL for native tokens and CHAIN_NAME--address for ERC-20.
// ChainId → Rango blockchain name.
const RANGO_CHAINS: Record<number, string> = {
  1:        "ETH",
  10:       "OPTIMISM",
  25:       "CRONOS",
  56:       "BSC",
  100:      "GNOSIS",
  130:      "UNICHAIN",
  137:      "POLYGON",
  146:      "SONIC",
  204:      "OPBNB",
  250:      "FANTOM",
  324:      "ZKSYNC",
  480:      "WORLDCHAIN",
  1101:     "POLYGON_ZKEVM",
  1284:     "MOONBEAM",
  1329:     "SEI",
  1868:     "SONEIUM",
  2020:     "RONIN",
  2741:     "ABSTRACT",
  5000:     "MANTLE",
  8453:     "BASE",
  33139:    "APECHAIN",
  34443:    "MODE",
  42161:    "ARBITRUM",
  42220:    "CELO",
  43111:    "HEMI",
  43114:    "AVAX_CCHAIN",
  59144:    "LINEA",
  80094:    "BERACHAIN",
  81457:    "BLAST",
  534352:   "SCROLL",
};

// Rango public demo key (rate-limited). Override via configure({ rangoApiKey })
// in production.
const DEMO_KEY = "c6381a79-2817-4602-83bf-6a641a409e32";
const BASE_URL = "https://api.rango.exchange/basic";

export default class RangoAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.RANGO;
  }

  private apiKey(): string {
    return getConfig().rangoApiKey || DEMO_KEY;
  }

  private chainName(chainId: number): string {
    const name = RANGO_CHAINS[chainId];
    if (!name) throw new Error(`Rango: chain ${chainId} not supported`);
    return name;
  }

  // Formats a token as Rango's asset string.
  // Native tokens: "CHAIN.SYMBOL" (e.g., "BSC.BNB")
  // ERC-20:        "CHAIN--address" (e.g., "POLYGON--0x2791bca1...")
  private rangoAsset(chainId: number, address: string, symbol: string): string {
    const chain = this.chainName(chainId);
    if (this.isNativeAddresss(address)) {
      return `${chain}.${symbol}`;
    }
    return `${chain}--${address.toLowerCase()}`;
  }

  private buildQuery(params: IQuoteParams): Record<string, any> {
    return {
      from: this.rangoAsset(params.fromChain.id, params.fromToken.address, params.fromToken.symbol),
      to:   this.rangoAsset(params.toChain.id,   params.toToken.address,   params.toToken.symbol),
      amount: ethers.parseUnits(String(params.amount), params.fromToken.decimals).toString(),
      fromAddress: params.srcWalletAddress,
      toAddress:   params.dstWalletAddress || params.srcWalletAddress,
      slippage: params.slippage ?? 1,
      disableEstimate: true,
    };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    const query = this.buildQuery(params);

    const data = await apiCall({
      method: "GET",
      url: `${BASE_URL}/swap`,
      params: { ...query, apiKey: this.apiKey() },
    });

    if (data?.resultType === "NO_ROUTE" || data?.resultType === "INPUT_LIMIT_ISSUE") {
      throw new Error(`Rango: ${data.resultType}`);
    }
    if (!data?.route?.outputAmount || !data?.tx?.txTo) {
      throw new Error("Rango: no route found");
    }

    const swapAmount = ethers.formatUnits(data.route.outputAmount, params.toToken.decimals);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.RANGO,
      route: data.route.swapper?.title || "Rango",
      amount: Number(swapAmount),
      usdAmount: Number(data.route.outputAmountUsd ?? 0),
      networkFee: 0,
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 1,
      allowanceTo: data.tx.approveTo || data.tx.txTo,
      timeEstimate: data.route.estimatedTimeInSeconds ? Number(data.route.estimatedTimeInSeconds) : undefined,
    };

    return new Quote(data, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain:   { id: params.toChain.id,   name: params.toChain.name.toLowerCase() },
      slippageTolerance: params.slippage ?? 1,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: { ...query, requestId: data.requestId },
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    const q = restProps.quotePayload;

    // Re-fetch /swap to get fresh calldata. Pass requestId if we have it to
    // hint Rango toward the same route.
    const fresh = await apiCall({
      method: "GET",
      url: `${BASE_URL}/swap`,
      params: { ...q, apiKey: this.apiKey() },
    });

    const tx = fresh?.tx;
    if (!tx?.txTo || !tx?.txData) {
      throw new Error("Rango: re-quote returned no transaction");
    }

    return {
      tx: {
        to:       tx.txTo,
        data:     tx.txData,
        value:    tx.value ?? "0",
        from:     restProps.srcWalletAddress,
        gasLimit: tx.gasLimit ? Number(tx.gasLimit) : undefined,
      },
      spender: tx.approveTo || tx.txTo,
    };
  }

  async getTxStatus(_chainId: number, hash: string): Promise<any> {
    try {
      const q = { txId: hash, apiKey: this.apiKey() } as Record<string, any>;
      // requestId is unknown at status-check time; omit — Rango can still
      // look up by txId alone.
      const res = await apiCall({
        method: "GET",
        url: `${BASE_URL}/status`,
        params: q,
      });

      const s = (res?.status || "").toLowerCase();
      const status =
        s === "success" ? "success" :
        s === "failed"  ? "failed"  :
        s === "running" || s === "pending" ? "pending" :
        "not_found";

      const destinationTxHash =
        res?.bridgeData?.destTxHash ||
        res?.explorerUrl?.find((u: any) => u.description?.toLowerCase().includes("dest"))?.url;

      return { status, hash, destinationTxHash, raw: res };
    } catch {
      return { status: "not_found", hash };
    }
  }
}
