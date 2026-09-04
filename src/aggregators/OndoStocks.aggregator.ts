import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";

/**
 * Ondo Stocks — ISSUER PRIMARY MARKET for tokenized US equities.
 *
 * Every other aggregator here routes through pools. This one mints and
 * redeems against the issuer at NAV: no price impact regardless of size, and
 * it can fill a token that has no pool at all. That makes it complementary to
 * the DEX providers rather than a competitor — on a $200 order KyberSwap
 * usually wins on gas, and on a $200k order Ondo wins on slippage. Both land
 * in the same SSE stream and the best quote is picked the usual way.
 *
 * Scope, deliberately narrow:
 *  - single chain only (primary market has no cross-chain leg),
 *  - exactly one side is an Ondo equity token (symbol suffix `on`),
 *  - the other side is an accepted settlement stablecoin.
 * Anything else throws immediately, so this provider costs the quote stream
 * nothing on the ~99% of pairs it cannot serve.
 *
 * ⚠️ UNVERIFIED WIRE FORMAT. Ondo gates API access behind onboarding, so the
 * three request/response mappings below are written from the public docs and
 * have NOT been run against the live API. They are all collected in this file
 * on purpose. Before enabling in production, check each against
 * https://docs.ondo.finance/openapi.json:
 *   1. POST /v1/quote       -> { outputAmount, price, fee, expiresAt }
 *   2. POST /v1/attestation  -> { to, data, value, spender }
 *   3. GET  /v1/status       -> { status: 'pending'|'settled'|'failed' }
 * Until ONDO_API_KEY is set the backend proxy returns 503 and TradeManager
 * never registers this aggregator, so nothing here can affect live quoting.
 */

/** Settlement assets Ondo accepts for mint/redeem. */
const SETTLEMENT_SYMBOLS = new Set(["USDC", "USDT", "USDC.E", "USD+", "USDY"]);

/** Chains where Ondo Stocks are issued: Ethereum, BNB Chain, Solana. */
const SUPPORTED_CHAINS = new Set([1, 56, 102]);

interface OndoSide {
  equity: { address: string; symbol: string; decimals: number };
  settlement: { address: string; symbol: string; decimals: number };
  /** 'mint' buys the equity with stablecoin; 'redeem' sells it back. */
  direction: "mint" | "redeem";
}

export default class OndoStocksAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.ONDO_STOCKS;
  }

  /** An Ondo equity token is an uppercase ticker with a lowercase `on` suffix. */
  private isOndoEquity(token: { symbol?: string }): boolean {
    return /^[A-Z0-9.]{1,8}on$/.test(String(token?.symbol || ""));
  }

  private isSettlement(token: { symbol?: string }): boolean {
    return SETTLEMENT_SYMBOLS.has(String(token?.symbol || "").toUpperCase());
  }

  /**
   * Decide whether this pair is a primary-market order and which way round.
   * Returns null when Ondo cannot serve it.
   */
  private resolveSide(params: IQuoteParams): OndoSide | null {
    const { fromToken, toToken } = params;

    if (this.isOndoEquity(toToken) && this.isSettlement(fromToken)) {
      return { equity: toToken, settlement: fromToken, direction: "mint" };
    }
    if (this.isOndoEquity(fromToken) && this.isSettlement(toToken)) {
      return { equity: fromToken, settlement: toToken, direction: "redeem" };
    }
    return null;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("Ondo Stocks: primary market is single-chain only");
    }
    if (!SUPPORTED_CHAINS.has(params.fromChain.id)) {
      throw new Error(
        `Ondo Stocks: chain ${params.fromChain.id} is not an issuance chain`
      );
    }

    const side = this.resolveSide(params);
    if (!side) {
      throw new Error(
        "Ondo Stocks: pair is not a stablecoin/tokenized-equity primary-market order"
      );
    }

    const sellToken = side.direction === "mint" ? side.settlement : side.equity;

    const payload = {
      // ASSUMPTION (1) — verify field names against the OpenAPI spec.
      chainId: params.fromChain.id,
      side: side.direction,
      token: side.equity.address,
      settlementToken: side.settlement.address,
      amount: ethers
        .parseUnits(String(params.amount), sellToken.decimals)
        .toString(),
      account: params.srcWalletAddress,
    };

    const data = await apiCall({
      method: "POST",
      url: `${baseUrl}/ondo`,
      data: { path: "/v1/quote", method: "POST", body: payload },
    });

    const rawOut = data?.outputAmount ?? data?.output_amount;
    if (!rawOut || rawOut === "0") {
      throw new Error("Ondo Stocks: no quote returned");
    }

    const buyToken = side.direction === "mint" ? side.equity : side.settlement;
    const toAmount = ethers.formatUnits(rawOut, buyToken.decimals);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.ONDO_STOCKS,
      // Names the mechanism, not just the brand — a user comparing this
      // against a DEX row should see why it has no price impact.
      route: side.direction === "mint" ? "Ondo (issuer mint)" : "Ondo (issuer redeem)",
      amount: Number(toAmount),
      usdAmount: Number(data?.usdValue ?? 0),
      networkFee: 0,
      platformFee: Number(data?.fee ?? 0),
      // Minting at NAV against the issuer has no pool to move.
      priceImpact: 0,
      slippage: params.slippage ?? 0,
      allowanceTo: data?.spender ?? "",
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
      slippageTolerance: params.slippage ?? 0,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: payload,
    });
  }

  async getTransactionData(
    _data: any,
    restProps: IRestQuoteProps
  ): Promise<{ tx: any; spender: string }> {
    // Re-attest rather than reusing the quote: an issuer quote carries an
    // expiry, and the cached Redis entry lives for 5 minutes, so the stored
    // one may already be stale by the time the user signs.
    const fresh = await apiCall({
      method: "POST",
      url: `${baseUrl}/ondo`,
      data: {
        path: "/v1/attestation", // ASSUMPTION (2)
        method: "POST",
        body: restProps.quotePayload,
      },
    });

    if (!fresh?.to || !fresh?.data) {
      throw new Error("Ondo Stocks: attestation did not return a transaction");
    }

    return {
      tx: {
        to: fresh.to,
        data: fresh.data,
        from: restProps.srcWalletAddress,
        value: fresh.value ?? "0",
      },
      // The relayer forwards funds here before calling `to`, so a missing
      // spender must not silently become the zero address.
      spender: fresh.spender ?? fresh.to,
    };
  }

  async getTxStatus(
    chainId: number,
    hash: string
  ): Promise<{ status: "pending" | "success" | "failed"; hash: string }> {
    try {
      const res = await apiCall({
        method: "POST",
        url: `${baseUrl}/ondo`,
        data: {
          path: "/v1/status", // ASSUMPTION (3)
          method: "GET",
          query: { chainId, txHash: hash },
        },
      });

      const raw = String(res?.status || "").toLowerCase();
      if (raw === "settled" || raw === "success" || raw === "complete") {
        return { status: "success", hash };
      }
      if (raw === "failed" || raw === "rejected" || raw === "cancelled") {
        return { status: "failed", hash };
      }
      return { status: "pending", hash };
    } catch {
      // An unreachable status endpoint is not a failed trade — the FE polls
      // again, and reporting 'failed' here would wrongly alarm the user.
      return { status: "pending", hash };
    }
  }
}
