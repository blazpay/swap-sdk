import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuote, IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl, isRelayerDeployed } from "../utils/constants.js";
import { getConfig } from "../utils/config.js";

// RAVN (docs.ravn.exchange) races ~20 venues (RFQ, intents, solvers, DEX
// aggregators) behind one quote → execute → status API. Reached through
// bz-backend's /defi/ravn proxy so RAVN_API_KEY stays server-side.
//
// Every RAVN route still runs through BlazpayRelayer, which is msg.sender to
// the venue. Which venues survive that was MEASURED, not read off the docs:
// scripts/ravn-relayer-probe.mjs eth_calls each venue's transaction from the
// Base relayer. The exclusions below come from that run.

const RAVN_NATIVE_EVM = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const RAVN_NATIVE_SOL = "So11111111111111111111111111111111111111112";
const RAVN_NATIVE_BTC = "native";

// Our Network ids for the two non-EVM chains RAVN serves, and RAVN's ids.
const SOLANA_ID = 102;
const BITCOIN_ID = 20000000000001;
const RAVN_SOLANA = -2;
const RAVN_BITCOIN = -1;

// GET /chains, EVM part (2026-10-22). A source chain also needs a relayer.
const RAVN_EVM_CHAINS: ReadonlySet<number> = new Set([
  1, 10, 56, 130, 137, 143, 324, 480, 999, 4217, 4663, 5042, 8453, 42161,
  43114, 59144,
]);

// Venues that can never run through the relayer:
// - cow, 0x_gasless: SIGNATURE only, the venue pulls from the user directly,
//   so the swap would skip the relayer (and its fee and route check).
// - bebop: RFQ settlement, returned no route in the probe, so it is unproven.
// - flytrade: its transaction reverts when the relayer is msg.sender.
// - thorchain: refunds go to the on-chain sender, which is the relayer.
// - houdini: private swaps only; we never ask for one.
const EXCLUDED_VENUES = ["cow", "0x_gasless", "bebop", "flytrade", "thorchain", "houdini"];

// Venues that are fine for some inputs only, so they are skipped per quote
// rather than excluded (excluding also removes RAVN routes that hop through
// them):
// - relay answers an ERC-20 input with a gasless SIGNATURE (permit).
// - a native-coin DEPOSIT sent by a contract is an internal transfer, and
//   RAVN documents only NEAR Intents as crediting those.
const SKIP_FOR_ERC20_INPUT: ReadonlySet<string> = new Set(["relay"]);
const NATIVE_DEPOSIT_OK: ReadonlySet<string> = new Set(["near_intents"]);
const DEPOSIT_VENUES: ReadonlySet<string> = new Set(["near_intents", "chainflip", "rift", "houdini"]);

// RAVN's default race is 6 s; the quote stream waits for its slowest provider.
const QUOTE_TIMEOUT_MS = 4000;

// RAVN error codes after which a fresh quote, not a retry, is the fix.
const REQUOTE_CODES: ReadonlySet<string> = new Set([
  "QUOTE_EXPIRED",
  "QUOTE_INVALID",
  "QUOTE_NOT_EXECUTABLE",
]);

interface RavnQuoteRequest {
  inputChainId: number;
  outputChainId: number;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  userAddress: string;
  destinationAddress: string;
  refundAddress: string;
  excludeVenues: string[];
  timeoutMs: number;
  slippageBps?: number;
}

interface RavnVenue {
  id: string;
  name: string;
}

// One route RAVN offered: the winner or one of its alternatives.
interface RavnCandidate {
  quoteToken: string;
  venue: RavnVenue;
  hops: RavnVenue[];
  expectedOutputAmount: bigint;
  // What the route guarantees; a re-quote must still meet it.
  minimumOutput: bigint;
  estimatedTimeSeconds?: number;
}

interface RavnQuoteSummary {
  candidates: RavnCandidate[];
  inputUsd: number;
  outputUsd: number;
  gasUsd: number;
  primaryExpected: bigint;
}

// What the quote stores for the build step (Quote.restProps.quotePayload).
interface RavnQuotePayload {
  request: RavnQuoteRequest;
  chosen: { quoteToken: string; venueId: string; minimumOutput: string };
  isNativeIn: boolean;
  inputTokenAddress: string;
}

type RavnExecution =
  | {
      kind: "transaction";
      quoteToken: string;
      statusRef?: string;
      swapId?: string;
      to: string;
      data: string;
      value: string;
      chainId: number;
      spender?: string;
    }
  | {
      kind: "deposit";
      quoteToken: string;
      statusRef: string;
      swapId?: string;
      address: string;
      amount: string;
      chainId: number;
    };

// ── boundary parsing ─────────────────────────────────────────────────────
// RAVN responses are unknown until checked here; nothing past these helpers
// reads raw JSON.

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

function field(x: unknown, key: string): unknown {
  return isRecord(x) ? x[key] : undefined;
}

function str(x: unknown, what: string): string {
  if (typeof x !== "string" || x.length === 0) {
    throw new Error(`RAVN: missing ${what}`);
  }
  return x;
}

const optStr = (x: unknown): string | undefined =>
  typeof x === "string" && x.length > 0 ? x : undefined;

const optNum = (x: unknown): number | undefined => {
  const n = typeof x === "string" ? Number(x) : x;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};

function parseVenue(x: unknown): RavnVenue {
  return { id: str(field(x, "id"), "venue.id"), name: str(field(x, "name"), "venue.name") };
}

function parseHops(x: unknown): RavnVenue[] {
  return Array.isArray(x) ? x.map(parseVenue) : [];
}

// The floor RAVN itself holds a re-priced quote to (see /quote expiresAt).
function minimumOf(entry: unknown, expected: bigint): bigint {
  const slippage = field(entry, "slippage");
  const guaranteed = optStr(field(slippage, "guaranteedMin"));
  if (guaranteed) return BigInt(guaranteed);
  if (field(slippage, "isFirm") === true) return expected;
  const bps = optNum(field(slippage, "bps")) ?? 0;
  return (expected * BigInt(10_000 - Math.round(bps))) / 10_000n;
}

function parseCandidate(entry: unknown): RavnCandidate | null {
  // A preview priced without our addresses, a route RAVN would never pick,
  // or one with no minimum output (Rift) is not offered to the user.
  if (field(entry, "executable") === false) return null;
  if (field(entry, "pickable") === false) return null;
  if (field(field(entry, "slippage"), "noMinimum") === true) return null;
  const expected = BigInt(
    str(field(entry, "expectedOutputAmount") ?? field(entry, "outputAmount"), "expectedOutputAmount"),
  );
  if (expected <= 0n) return null;
  return {
    quoteToken: str(field(entry, "quoteToken"), "quoteToken"),
    venue: parseVenue(field(entry, "venue")),
    hops: parseHops(field(entry, "hops")),
    expectedOutputAmount: expected,
    minimumOutput: minimumOf(entry, expected),
    estimatedTimeSeconds: optNum(field(entry, "estimatedTimeSeconds")),
  };
}

function parseQuote(body: unknown): RavnQuoteSummary {
  const data = field(body, "data");
  const primary = parseCandidate(data);
  const alternatives = field(data, "alternatives");
  const rest = Array.isArray(alternatives) ? alternatives.map(parseCandidate) : [];
  // RAVN already orders alternatives by what the user nets; keep its order.
  const candidates = [primary, ...rest].filter((c): c is RavnCandidate => c !== null);
  return {
    candidates,
    inputUsd: optNum(field(data, "inputUsd")) ?? 0,
    outputUsd: optNum(field(data, "outputUsd")) ?? 0,
    gasUsd: optNum(field(field(data, "gas"), "usd")) ?? 0,
    primaryExpected: primary?.expectedOutputAmount ?? 0n,
  };
}

function parseExecution(body: unknown): RavnExecution {
  const data = field(body, "data");
  const type = field(data, "executionType");
  const quoteToken = str(field(data, "quoteToken"), "execution quoteToken");
  const statusRef = optStr(field(data, "statusRef"));
  const swapId = optStr(field(data, "swapId"));

  // A fee RAVN collects beside the swap needs a second wallet transaction,
  // which the relayer flow cannot send. Our key sets no fee, so this only
  // trips if someone sets one on the RAVN key: refuse rather than underpay.
  if (field(data, "fee") !== undefined && field(data, "fee") !== null) {
    throw new Error("RAVN: execution asks for a fee payment beside the swap; set the RAVN key's fee to 0");
  }

  if (type === "TRANSACTION") {
    if (field(data, "submit") !== undefined) {
      throw new Error("RAVN: transaction must be submitted through RAVN; not supported");
    }
    const tx = field(data, "transaction");
    return {
      kind: "transaction",
      quoteToken,
      statusRef,
      swapId,
      to: str(field(tx, "to"), "transaction.to"),
      data: str(field(tx, "data"), "transaction.data"),
      value: optStr(field(tx, "value")) ?? "0",
      chainId: optNum(field(tx, "chainId")) ?? NaN,
      spender: optStr(field(field(data, "approval"), "spender")),
    };
  }
  if (type === "DEPOSIT") {
    const deposit = field(data, "deposit");
    return {
      kind: "deposit",
      quoteToken,
      statusRef: str(statusRef, "deposit statusRef"),
      swapId,
      address: str(field(deposit, "address"), "deposit.address"),
      amount: str(field(deposit, "amount"), "deposit.amount"),
      chainId: optNum(field(deposit, "chainId")) ?? NaN,
    };
  }
  throw new Error(`RAVN: execution type ${String(type)} cannot run through the relayer`);
}

// quotePayload makes a round trip through Redis as JSON.
function parsePayload(x: unknown): RavnQuotePayload {
  const request = field(x, "request");
  const chosen = field(x, "chosen");
  const isNativeIn = field(x, "isNativeIn");
  const excludeVenues = field(request, "excludeVenues");
  const slippageBps = optNum(field(request, "slippageBps"));
  if (typeof isNativeIn !== "boolean") throw new Error("RAVN: stored quote lacks isNativeIn");
  return {
    request: {
      inputChainId: optNum(field(request, "inputChainId")) ?? NaN,
      outputChainId: optNum(field(request, "outputChainId")) ?? NaN,
      inputToken: str(field(request, "inputToken"), "stored inputToken"),
      outputToken: str(field(request, "outputToken"), "stored outputToken"),
      inputAmount: str(field(request, "inputAmount"), "stored inputAmount"),
      userAddress: str(field(request, "userAddress"), "stored userAddress"),
      destinationAddress: str(field(request, "destinationAddress"), "stored destinationAddress"),
      refundAddress: str(field(request, "refundAddress"), "stored refundAddress"),
      excludeVenues: Array.isArray(excludeVenues) ? excludeVenues.map((v) => str(v, "stored venue")) : EXCLUDED_VENUES,
      timeoutMs: optNum(field(request, "timeoutMs")) ?? QUOTE_TIMEOUT_MS,
      ...(slippageBps !== undefined ? { slippageBps } : {}),
    },
    chosen: {
      quoteToken: str(field(chosen, "quoteToken"), "stored quoteToken"),
      venueId: str(field(chosen, "venueId"), "stored venueId"),
      minimumOutput: str(field(chosen, "minimumOutput"), "stored minimumOutput"),
    },
    isNativeIn,
    inputTokenAddress: str(field(x, "inputTokenAddress"), "stored inputTokenAddress"),
  };
}

function ravnErrorCode(error: unknown): string | undefined {
  return optStr(field(field(field(field(error, "response"), "data"), "error"), "code"));
}

// ── status tracking key ──────────────────────────────────────────────────
// /status needs the execute-time quoteToken plus a ref: the statusRef when
// /execute gave one, else the hash of the source transaction. The first two
// are known at build time (persisted as the record's txTrackUrl), the hash
// only after broadcast, so the key is assembled from both by this one
// function, used by the FE tracker, the history page and the backend cron.

interface RavnTrack {
  q: string;
  r?: string;
  h?: string;
}

function parseTrack(raw: string): RavnTrack | null {
  try {
    const x: unknown = JSON.parse(raw);
    const q = optStr(field(x, "q"));
    if (!q) return null;
    return { q, r: optStr(field(x, "r")), h: optStr(field(x, "h")) };
  } catch {
    return null;
  }
}

const encodeTrack = (track: RavnTrack): string => JSON.stringify(track);

/**
 * The status key for a RAVN swap: the txTrackUrl saved from
 * getTransactionData's metaData.trackUrl, plus the source tx hash.
 */
export function ravnTrackingKey({ trackUrl, txHash }: { trackUrl: string; txHash?: string }): string | null {
  const track = parseTrack(trackUrl);
  if (!track) return null;
  return encodeTrack({ ...track, h: txHash ?? track.h });
}

// ── amounts ──────────────────────────────────────────────────────────────

// IQuoteParams.amount is a JS number; String(1e-7) is "1e-7", which
// parseUnits rejects. Expand it, then cut to the token's decimals.
function toBaseUnits(amount: number, decimals: number): string {
  const plain = amount.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  const [whole, frac = ""] = plain.split(".");
  return ethers.parseUnits(`${whole}.${frac.slice(0, decimals) || "0"}`, decimals).toString();
}

// ── aggregator ───────────────────────────────────────────────────────────

export default class RavnAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.RAVN;
  }

  // Read at call time so configure({ baseApiUrl }) takes effect.
  private get BASE_URL(): string {
    return `${getConfig().baseApiUrl ?? baseUrl}/ravn`;
  }

  private toRavnChain(id: number): number {
    if (id === SOLANA_ID) return RAVN_SOLANA;
    if (id === BITCOIN_ID) return RAVN_BITCOIN;
    if (RAVN_EVM_CHAINS.has(id)) return id;
    throw new Error(`RAVN: chain ${id} not served`);
  }

  private toRavnToken(ravnChain: number, address: string): string {
    if (ravnChain === RAVN_BITCOIN) return RAVN_NATIVE_BTC;
    if (ravnChain === RAVN_SOLANA) {
      return this.isNativeAddresss(address) || address === "11111111111111111111111111111111"
        ? RAVN_NATIVE_SOL
        : address;
    }
    if (!this.isNativeAddresss(address)) return address;
    // Arc's native coin and its USDC token are one balance; RAVN lists only
    // the token (0x3600…), which our Arc token records already use.
    if (ravnChain === 5042) throw new Error("RAVN: quote Arc USDC by its token address");
    return RAVN_NATIVE_EVM;
  }

  private isRelayable(c: RavnCandidate, isNativeIn: boolean): boolean {
    if (!isNativeIn && SKIP_FOR_ERC20_INPUT.has(c.venue.id)) return false;
    if (isNativeIn && DEPOSIT_VENUES.has(c.venue.id) && !NATIVE_DEPOSIT_OK.has(c.venue.id)) return false;
    return true;
  }

  private async quote(request: RavnQuoteRequest): Promise<RavnQuoteSummary> {
    const body: unknown = await apiCall({ method: "POST", url: `${this.BASE_URL}/quote`, data: { ...request } });
    return parseQuote(body);
  }

  private routeLabel(c: RavnCandidate): string {
    const path = c.hops.length > 0 ? c.hops.map((h) => h.name).join(" → ") : c.venue.name;
    return `RAVN · ${path}`;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    // The relayer runs on EVM chains only, so the source must be one of them.
    if (!isRelayerDeployed(params.fromChain.id) || !RAVN_EVM_CHAINS.has(params.fromChain.id)) {
      throw new Error(`RAVN: no relayer route from chain ${params.fromChain.id}`);
    }
    const outputChainId = this.toRavnChain(params.toChain.id);
    const isNativeIn = this.isNativeAddresss(params.fromToken.address);

    // A Solana or Bitcoin payout needs an address on that chain; never let
    // it default to the sender's EVM address.
    const nonEvmOut = outputChainId < 0;
    if (nonEvmOut && !params.dstWalletAddress) {
      throw new Error("RAVN: a Solana or Bitcoin destination needs a recipient address");
    }

    const request: RavnQuoteRequest = {
      inputChainId: params.fromChain.id,
      outputChainId,
      inputToken: this.toRavnToken(params.fromChain.id, params.fromToken.address),
      outputToken: this.toRavnToken(outputChainId, params.toToken.address),
      inputAmount: toBaseUnits(params.amount, params.fromToken.decimals),
      // The user's own wallet, not the relayer: venues that refund to the
      // depositor named in calldata (Across) then refund the user.
      userAddress: params.srcWalletAddress,
      destinationAddress: params.dstWalletAddress || params.srcWalletAddress,
      refundAddress: params.srcWalletAddress,
      excludeVenues: EXCLUDED_VENUES,
      timeoutMs: QUOTE_TIMEOUT_MS,
      ...(params.slippage !== undefined ? { slippageBps: Math.round(params.slippage * 100) } : {}),
    };

    const summary = await this.quote(request);
    const chosen = summary.candidates.find((c) => this.isRelayable(c, isNativeIn));
    if (!chosen) throw new Error("RAVN: no route that runs through the relayer");

    const outAmount = ethers.formatUnits(chosen.expectedOutputAmount, params.toToken.decimals);
    // outputUsd is the primary route's; scale it for an alternative.
    const outputUsd =
      summary.primaryExpected > 0n
        ? (summary.outputUsd * Number(chosen.expectedOutputAmount)) / Number(summary.primaryExpected)
        : 0;
    const priceImpact =
      summary.inputUsd > 0 && outputUsd > 0
        ? Number((((outputUsd - summary.inputUsd) / summary.inputUsd) * 100).toFixed(2))
        : 0;

    const meta: IQuote = {
      id: uuidv4(),
      aggregator: AGGREGATORS.RAVN,
      route: this.routeLabel(chosen),
      amount: Number(outAmount),
      usdAmount: outputUsd,
      networkFee: summary.gasUsd.toFixed(6),
      platformFee: 0,
      priceImpact,
      slippage: params.slippage ?? 0.5,
      // The real spender is only known at /execute; the user approves the
      // relayer either way.
      allowanceTo: "",
      timeEstimate: chosen.estimatedTimeSeconds !== undefined ? Math.round(chosen.estimatedTimeSeconds) : undefined,
    };

    const quotePayload: RavnQuotePayload = {
      request,
      chosen: {
        quoteToken: chosen.quoteToken,
        venueId: chosen.venue.id,
        minimumOutput: chosen.minimumOutput.toString(),
      },
      isNativeIn,
      inputTokenAddress: params.fromToken.address,
    };

    return new Quote({ venue: chosen.venue, hops: chosen.hops }, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain: { id: params.toChain.id, name: params.toChain.name.toLowerCase() },
      slippageTolerance: params.slippage ?? 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload,
    });
  }

  private async execute(quoteToken: string, idempotencyKey?: string): Promise<RavnExecution> {
    const body: unknown = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/execute`,
      data: { quoteToken },
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    });
    return parseExecution(body);
  }

  // Builds once from the stored quote. If RAVN no longer holds it, quotes
  // again and builds the best relayable route, but only if that route still
  // guarantees the minimum the user was shown.
  private async executeOrRequote(payload: RavnQuotePayload, quoteId?: string): Promise<RavnExecution> {
    try {
      // The same key on a retry returns RAVN's first answer instead of
      // opening a second deposit address.
      return await this.execute(payload.chosen.quoteToken, quoteId);
    } catch (error) {
      const code = ravnErrorCode(error);
      if (!code || !REQUOTE_CODES.has(code)) throw error;
    }
    const summary = await this.quote(payload.request);
    const fresh = summary.candidates.find((c) => this.isRelayable(c, payload.isNativeIn));
    if (!fresh) throw new Error("RAVN: quote expired and no relayable route is left");
    if (fresh.expectedOutputAmount < BigInt(payload.chosen.minimumOutput)) {
      throw new Error("RAVN: price moved below the quoted minimum; refresh the quote");
    }
    return await this.execute(fresh.quoteToken);
  }

  async getTransactionData(
    _data: unknown,
    restProps: IRestQuoteProps,
    meta?: IQuote,
  ): Promise<{ tx: { to: string; data: string; value: string; from: string }; spender: string; metaData: Record<string, string> }> {
    const payload = parsePayload(restProps.quotePayload);
    const exec = await this.executeOrRequote(payload, meta?.id);
    const sourceChain = restProps.fromChain.id;
    const amount = payload.request.inputAmount;

    const metaData: Record<string, string> = {
      trackUrl: encodeTrack({ q: exec.quoteToken, r: exec.statusRef }),
      ...(exec.swapId ? { ravnSwapId: exec.swapId } : {}),
    };

    if (exec.kind === "transaction") {
      if (exec.chainId !== sourceChain) {
        throw new Error(`RAVN: transaction is for chain ${exec.chainId}, expected ${sourceChain}`);
      }
      if (!payload.isNativeIn && BigInt(exec.value) !== 0n) {
        throw new Error("RAVN: ERC-20 swap asks for a native value");
      }
      return {
        tx: { to: exec.to, data: exec.data, value: exec.value, from: restProps.srcWalletAddress },
        // RAVN omits approval when the user already approved the venue
        // directly; the router is then the usual spender. A wrong guess
        // reverts in the relayer simulation before anything is sent.
        spender: exec.spender ?? exec.to,
        metaData,
      };
    }

    // DEPOSIT: the relayer pushes the input to RAVN's deposit address, the
    // same way as Near 1Click (see NearOneClick.aggregator.ts).
    if (exec.chainId !== sourceChain) {
      throw new Error(`RAVN: deposit is on chain ${exec.chainId}, expected ${sourceChain}`);
    }
    if (exec.amount !== amount) {
      throw new Error(`RAVN: deposit amount ${exec.amount} differs from input ${amount}`);
    }
    // Not `depositAddress`: the pages treat that key as Near 1Click's tracker.
    metaData.ravnDepositAddress = exec.address;

    if (payload.isNativeIn) {
      if (!NATIVE_DEPOSIT_OK.has(payload.chosen.venueId)) {
        throw new Error(`RAVN: native deposit to ${payload.chosen.venueId} is not credited when a contract sends it`);
      }
      // The relayer forwards value only when data is non-empty; an EOA
      // deposit address ignores the byte.
      return {
        tx: { to: exec.address, data: "0x00", value: exec.amount, from: restProps.srcWalletAddress },
        spender: exec.address,
        metaData,
      };
    }

    const transfer = new ethers.Interface([
      "function transfer(address to, uint256 amount) returns (bool)",
    ]).encodeFunctionData("transfer", [exec.address, exec.amount]);
    return {
      tx: { to: payload.inputTokenAddress, data: transfer, value: "0", from: restProps.srcWalletAddress },
      spender: exec.address,
      metaData,
    };
  }

  // `hash` is the key built by ravnTrackingKey().
  async getTxStatus(
    _chainId: number,
    hash: string,
  ): Promise<{ status: "pending" | "success" | "failed" | "not_found"; hash: string; destinationTxHash?: string; raw?: unknown }> {
    const track = parseTrack(hash);
    const ref = track?.r ?? track?.h;
    if (!track || !ref) return { status: "not_found", hash };
    try {
      const body: unknown = await apiCall({
        method: "POST",
        url: `${this.BASE_URL}/status`,
        data: { quoteToken: track.q, ref },
      });
      const data = field(body, "data");
      const s = optStr(field(data, "status"));
      // expired is not final: a refund is on its way.
      const status =
        s === "success"
          ? "success"
          : s === "failed" || s === "refunded"
          ? "failed"
          : s === "pending" || s === "processing" || s === "expired"
          ? "pending"
          : "not_found";
      return { status, hash, destinationTxHash: optStr(field(data, "txHash")), raw: data };
    } catch {
      return { status: "not_found", hash };
    }
  }
}
