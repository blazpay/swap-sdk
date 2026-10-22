import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuote, IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js";
import { getConfig } from "../utils/config.js";

// StealthEX (api.stealthex.io/docs) is a CUSTODIAL instant exchange: we
// create an exchange, the user sends the input to its deposit address, and
// StealthEX swaps and pays out. That changes what "safe" means:
//
// - The deposit is a plain transfer from the user's own wallet (the Houdini
//   path), never through BlazpayRelayer: an exchange may not credit coin a
//   contract moves. metaData.isDirectTransfer makes the relayer refuse it.
// - Tokens are identified by contract address inside a network we have
//   verified, never by ticker, and a native coin by an explicit entry. A
//   wrong network would take the deposit on another chain.
// - Every created exchange is checked field by field before the user signs
//   (validateExchange). Anything unexpected throws; nothing is sent.
//
// The API key lives in bz-backend's /defi/stealthex proxy (CORS blocks
// browsers anyway). Quoting is off until the backend sets stealthexEnabled.

type AddressKind = "evm" | "btc" | "sol";

interface ChainEntry {
  kind: AddressKind;
  // StealthEX's network code for tokens on this chain; absent = no tokens.
  tokenNetwork?: string;
  // The chain's native coin as StealthEX names it ("mainnet" is its code
  // for any chain's base coin).
  native?: { symbol: string; network: string; name: string };
  // Where StealthEX may link a deposit address on this chain. A deposit
  // address linked anywhere else is refused.
  explorerPrefixes: string[];
}

// ONLY verified entries. The v4 network codes are not published without a
// key: the old spec shows ERC-20 on Ethereum as network "eth", and v4 says a
// chain's base coin is network "mainnet". Add a chain only after
// scripts/stealthex-verify.mjs confirms it against the live currency list.
const CHAINS: Readonly<Record<number, ChainEntry>> = {
  1: {
    kind: "evm",
    tokenNetwork: "eth",
    native: { symbol: "eth", network: "mainnet", name: "Ethereum" },
    explorerPrefixes: ["https://etherscan.io/address/", "https://blockchair.com/ethereum/address/"],
  },
  // Destination only: no wallet here signs on these chains.
  20000000000001: {
    kind: "btc",
    native: { symbol: "btc", network: "mainnet", name: "Bitcoin" },
    explorerPrefixes: [],
  },
  102: {
    kind: "sol",
    native: { symbol: "sol", network: "mainnet", name: "Solana" },
    explorerPrefixes: [],
  },
};

const ADDRESS_FORMAT: Readonly<Record<AddressKind, (a: string) => boolean>> = {
  evm: (a) => ethers.isAddress(a) && a.toLowerCase() !== ethers.ZeroAddress,
  btc: (a) => /^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a),
  sol: (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a),
};

// A fixed rate must outlive the wallet prompt and the deposit's confirmation.
const FIXED_RATE_MARGIN_MS = 2 * 60 * 1000;
const REQUOTE_BEFORE_EXPIRY_MS = 30 * 1000;

type Rate = "fixed" | "floating";

interface SxCurrency {
  symbol: string;
  network: string;
  name: string;
  rates: Rate[];
  contractAddress: string | null;
  extraId: string | null;
  addressRegex: string | null;
  depositWarnings: number;
}

interface Side {
  symbol: string;
  network: string;
  kind: AddressKind;
  addressRegex: string | null;
}

// What the quote stores for the build step (Quote.restProps.quotePayload).
interface SxQuotePayload {
  from: Side;
  to: Side;
  rate: Rate;
  rateId: string | null;
  rateValidUntil: string | null;
  amount: number;
  amountBase: string;
  shownAmount: number;
  isNativeIn: boolean;
  fromTokenAddress: string;
  fromDecimals: number;
  sourceChainId: number;
}

// ── boundary parsing ─────────────────────────────────────────────────────

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const field = (x: unknown, key: string): unknown => (isRecord(x) ? x[key] : undefined);

function str(x: unknown, what: string): string {
  if (typeof x !== "string" || x.length === 0) throw new Error(`StealthEX: missing ${what}`);
  return x;
}

const optStr = (x: unknown): string | null => (typeof x === "string" && x.length > 0 ? x : null);

function num(x: unknown, what: string): number {
  const n = typeof x === "string" ? Number(x) : x;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`StealthEX: missing ${what}`);
  return n;
}

const isRate = (x: unknown): x is Rate => x === "fixed" || x === "floating";

function parseCurrency(x: unknown): SxCurrency {
  const rates = field(x, "rates");
  const warnings = field(field(x, "warnings"), "deposit");
  return {
    symbol: str(field(x, "symbol"), "currency.symbol"),
    network: str(field(x, "network"), "currency.network"),
    name: optStr(field(x, "name")) ?? "",
    rates: Array.isArray(rates) ? rates.filter(isRate) : [],
    contractAddress: optStr(field(x, "contract_address")),
    extraId: optStr(field(x, "extra_id")),
    addressRegex: optStr(field(x, "address_regex")),
    depositWarnings: Array.isArray(warnings) ? warnings.length : 0,
  };
}

function parseSide(x: unknown): Side {
  const kind = field(x, "kind");
  if (kind !== "evm" && kind !== "btc" && kind !== "sol") throw new Error("StealthEX: stored quote has a bad side");
  return {
    symbol: str(field(x, "symbol"), "stored symbol"),
    network: str(field(x, "network"), "stored network"),
    kind,
    addressRegex: optStr(field(x, "addressRegex")),
  };
}

// quotePayload makes a round trip through Redis as JSON.
function parsePayload(x: unknown): SxQuotePayload {
  const rate = field(x, "rate");
  const isNativeIn = field(x, "isNativeIn");
  if (!isRate(rate) || typeof isNativeIn !== "boolean") throw new Error("StealthEX: stored quote is malformed");
  return {
    from: parseSide(field(x, "from")),
    to: parseSide(field(x, "to")),
    rate,
    rateId: optStr(field(x, "rateId")),
    rateValidUntil: optStr(field(x, "rateValidUntil")),
    amount: num(field(x, "amount"), "stored amount"),
    amountBase: str(field(x, "amountBase"), "stored amountBase"),
    shownAmount: num(field(x, "shownAmount"), "stored shownAmount"),
    isNativeIn,
    fromTokenAddress: str(field(x, "fromTokenAddress"), "stored fromTokenAddress"),
    fromDecimals: num(field(x, "fromDecimals"), "stored fromDecimals"),
    sourceChainId: num(field(x, "sourceChainId"), "stored sourceChainId"),
  };
}

// ── checks ───────────────────────────────────────────────────────────────

function addressOk(address: string, kind: AddressKind, regex: string | null): boolean {
  if (!ADDRESS_FORMAT[kind](address)) return false;
  if (!regex) return true;
  try {
    return new RegExp(regex).test(address);
  } catch {
    return false;
  }
}

const sameAddress = (a: string, b: string, kind: AddressKind): boolean =>
  kind === "evm" ? a.toLowerCase() === b.toLowerCase() : a === b;

const sameCode = (a: unknown, b: string): boolean => typeof a === "string" && a.toLowerCase() === b.toLowerCase();

interface Expected {
  payload: SxQuotePayload;
  recipient: string;
  refund: string;
}

/**
 * The last point before funds move. Returns the deposit address only if the
 * exchange StealthEX created is exactly the one we asked for.
 */
export function validateExchange(ex: unknown, { payload, recipient, refund }: Expected): { id: string; depositAddress: string } {
  const fail = (why: string): never => {
    throw new Error(`StealthEX: refusing exchange, ${why}`);
  };
  const id = str(field(ex, "id"), "exchange id");
  const deposit = field(ex, "deposit");
  const withdrawal = field(ex, "withdrawal");

  if (field(ex, "status") !== "waiting") fail(`status is ${String(field(ex, "status"))}, not waiting`);
  if (field(ex, "rate") !== payload.rate) fail(`rate is ${String(field(ex, "rate"))}, asked ${payload.rate}`);

  if (!sameCode(field(deposit, "symbol"), payload.from.symbol) || !sameCode(field(deposit, "network"), payload.from.network)) {
    fail("deposit currency differs from the quote");
  }
  if (!sameCode(field(withdrawal, "symbol"), payload.to.symbol) || !sameCode(field(withdrawal, "network"), payload.to.network)) {
    fail("payout currency differs from the quote");
  }

  const payout = optStr(field(withdrawal, "address"));
  if (!payout || !sameAddress(payout, recipient, payload.to.kind)) fail("payout address differs from the recipient");
  const refundAddress = optStr(field(ex, "refund_address"));
  if (!refundAddress || !sameAddress(refundAddress, refund, payload.from.kind)) fail("refund address is not the sender");

  if (optStr(field(deposit, "extra_id")) !== null) fail("deposit needs a memo, which a wallet transfer cannot carry");

  const depositAddress = str(field(deposit, "address"), "deposit address");
  if (!addressOk(depositAddress, payload.from.kind, payload.from.addressRegex)) fail("deposit address has the wrong format");
  if (depositAddress.toLowerCase() === payload.fromTokenAddress.toLowerCase()) fail("deposit address is the token contract");

  const chain = CHAINS[payload.sourceChainId];
  const explorer = optStr(field(deposit, "address_explorer_url"))?.toLowerCase() ?? "";
  const onChain = chain?.explorerPrefixes.some((p) => explorer.startsWith(p.toLowerCase())) ?? false;
  if (!onChain || !explorer.includes(depositAddress.toLowerCase())) {
    fail(`deposit address is not shown on chain ${payload.sourceChainId}'s explorer (${explorer || "no link"})`);
  }

  const expected = num(field(deposit, "expected_amount"), "deposit expected_amount");
  if (Math.abs(expected - payload.amount) > payload.amount * 1e-9) {
    fail(`it expects ${expected}, the user is sending ${payload.amount}`);
  }

  if (payload.rate === "fixed") {
    const expiresAt = Date.parse(optStr(field(ex, "expires_at")) ?? "");
    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() < FIXED_RATE_MARGIN_MS) fail("fixed rate expires too soon");
  }
  return { id, depositAddress };
}

// IQuoteParams.amount is a JS number; expand exponents, cut to decimals.
function toBaseUnits(amount: number, decimals: number): string {
  const plain = amount.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  const [whole, frac = ""] = plain.split(".");
  return ethers.parseUnits(`${whole}.${frac.slice(0, decimals) || "0"}`, decimals).toString();
}

// ── aggregator ───────────────────────────────────────────────────────────

export default class StealthexAggregator extends Base {
  name: string;

  constructor() {
    super();
    this.name = AGGREGATORS.STEALTHEX;
  }

  private get BASE_URL(): string {
    return `${getConfig().baseApiUrl ?? baseUrl}/stealthex`;
  }

  // How our token records spell each chain's native coin. Anything else on
  // Bitcoin or Solana is a token (an SPL mint), never the native coin.
  private isNativeOn(kind: AddressKind, tokenAddress: string): boolean {
    if (kind === "evm") return this.isNativeAddresss(tokenAddress);
    if (kind === "btc") return tokenAddress === "bitcoin" || this.isNativeAddresss(tokenAddress);
    return (
      tokenAddress === "So11111111111111111111111111111111111111112" ||
      tokenAddress === "11111111111111111111111111111111" ||
      this.isNativeAddresss(tokenAddress)
    );
  }

  private async currency(chainId: number, tokenAddress: string): Promise<SxCurrency> {
    const chain = CHAINS[chainId];
    if (!chain) throw new Error(`StealthEX: chain ${chainId} is not verified`);

    if (this.isNativeOn(chain.kind, tokenAddress)) {
      if (!chain.native) throw new Error(`StealthEX: no native coin entry for chain ${chainId}`);
      const { symbol, network, name } = chain.native;
      const c = parseCurrency(await apiCall({ method: "GET", url: `${this.BASE_URL}/currencies/${symbol}/${network}` }));
      // Identity check: the base coin of the chain we mean, not a namesake.
      if (c.contractAddress !== null || c.name.toLowerCase() !== name.toLowerCase()) {
        throw new Error(`StealthEX: ${symbol}/${network} is "${c.name}", expected ${name}`);
      }
      return c;
    }

    if (!chain.tokenNetwork) throw new Error(`StealthEX: tokens on chain ${chainId} are not verified`);
    const list: unknown = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/currencies`,
      params: { network: chain.tokenNetwork },
    });
    const matches = (Array.isArray(list) ? list.map(parseCurrency) : []).filter(
      (c) =>
        sameCode(c.network, chain.tokenNetwork ?? "") &&
        c.contractAddress !== null &&
        c.contractAddress.toLowerCase() === tokenAddress.toLowerCase(),
    );
    if (matches.length !== 1) {
      throw new Error(`StealthEX: ${matches.length} listings for ${tokenAddress} on ${chain.tokenNetwork}`);
    }
    return matches[0];
  }

  private async estimate(
    from: Side,
    to: Side,
    amount: number,
    rate: Rate,
  ): Promise<{ amountOut: number; rateId: string | null; validUntil: string | null }> {
    const route = { from: { symbol: from.symbol, network: from.network }, to: { symbol: to.symbol, network: to.network } };
    const range: unknown = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/range`,
      data: { route, estimation: "direct", rate },
    });
    const min = num(field(range, "min_amount"), "min_amount");
    const maxRaw = field(range, "max_amount");
    const max = maxRaw === null || maxRaw === undefined ? Infinity : num(maxRaw, "max_amount");
    // Below the minimum StealthEX does not swap, and a refund costs fees.
    if (amount < min || amount > max) throw new Error(`StealthEX: amount outside ${min}..${max}`);

    const est: unknown = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/estimate`,
      data: { route, amount, estimation: "direct", rate },
    });
    const amountOut = num(field(est, "estimated_amount"), "estimated_amount");
    if (amountOut <= 0) throw new Error("StealthEX: no output");
    const r = field(est, "rate");
    const rateId = optStr(field(r, "id"));
    if (rate === "fixed" && !rateId) throw new Error("StealthEX: fixed estimate without a rate id");
    return { amountOut, rateId, validUntil: optStr(field(r, "valid_until")) };
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (!getConfig().stealthexEnabled) throw new Error("StealthEX: not enabled");
    // Bridge page only: it is the one caller that sends a direct transfer.
    if (params.type !== "BRIDGE" || params.fromChain.id === params.toChain.id) {
      throw new Error("StealthEX: cross-chain only");
    }
    const source = CHAINS[params.fromChain.id];
    const dest = CHAINS[params.toChain.id];
    if (!source || source.kind !== "evm") throw new Error(`StealthEX: source chain ${params.fromChain.id} not supported`);
    if (!dest) throw new Error(`StealthEX: destination chain ${params.toChain.id} not supported`);

    const recipient = params.dstWalletAddress || params.srcWalletAddress;
    if (dest.kind !== "evm" && !params.dstWalletAddress) {
      throw new Error("StealthEX: a non-EVM destination needs a recipient address");
    }

    const [fromC, toC] = await Promise.all([
      this.currency(params.fromChain.id, params.fromToken.address),
      this.currency(params.toChain.id, params.toToken.address),
    ]);
    // A currency StealthEX flags at deposit, or one that wants a memo, is
    // not something a one-click wallet transfer can handle.
    if (fromC.depositWarnings > 0) throw new Error(`StealthEX: deposit warnings on ${fromC.symbol}/${fromC.network}`);
    if (fromC.extraId !== null) throw new Error(`StealthEX: ${fromC.symbol}/${fromC.network} deposits need a memo`);

    const from: Side = { symbol: fromC.symbol, network: fromC.network, kind: source.kind, addressRegex: fromC.addressRegex };
    const to: Side = { symbol: toC.symbol, network: toC.network, kind: dest.kind, addressRegex: toC.addressRegex };
    if (!addressOk(recipient, to.kind, to.addressRegex)) throw new Error("StealthEX: recipient address is not valid for the payout chain");
    if (!addressOk(params.srcWalletAddress, from.kind, from.addressRegex)) throw new Error("StealthEX: sender cannot be the refund address");

    // A fixed rate guarantees what the user is shown; floating is a guess.
    const rates: Rate[] = (["fixed", "floating"] as const).filter(
      (r) => fromC.rates.includes(r) && toC.rates.includes(r),
    );
    let picked: { rate: Rate; amountOut: number; rateId: string | null; validUntil: string | null } | null = null;
    for (const rate of rates) {
      try {
        picked = { rate, ...(await this.estimate(from, to, params.amount, rate)) };
        break;
      } catch (error) {
        if (rate === rates[rates.length - 1]) throw error;
      }
    }
    if (!picked) throw new Error("StealthEX: no rate type available for this pair");

    const amountOut = Number(picked.amountOut.toFixed(params.toToken.decimals));
    const meta: IQuote = {
      id: uuidv4(),
      aggregator: AGGREGATORS.STEALTHEX,
      route: picked.rate === "fixed" ? "StealthEX (fixed rate)" : "StealthEX (floating rate)",
      amount: amountOut,
      usdAmount: amountOut * Number(params.toToken.priceUSD ?? 0),
      networkFee: 0,
      platformFee: 0,
      // Not relayed: no Blazpay relayer fee on this route.
      blazpayFeePercent: 0,
      blazpayFeeUsd: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: "",
    };

    const quotePayload: SxQuotePayload = {
      from,
      to,
      rate: picked.rate,
      rateId: picked.rateId,
      rateValidUntil: picked.validUntil,
      amount: params.amount,
      amountBase: toBaseUnits(params.amount, params.fromToken.decimals),
      shownAmount: amountOut,
      isNativeIn: this.isNativeAddresss(params.fromToken.address),
      fromTokenAddress: params.fromToken.address,
      fromDecimals: params.fromToken.decimals,
      sourceChainId: params.fromChain.id,
    };

    return new Quote({ from, to, rate: picked.rate }, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain: { id: params.toChain.id, name: params.toChain.name.toLowerCase() },
      slippageTolerance: params.slippage ?? 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload,
      type: "BRIDGE",
    });
  }

  async getTransactionData(
    _data: unknown,
    restProps: IRestQuoteProps,
  ): Promise<{ tx: { to: string; data: string; value: string; from: string }; spender: string; metaData: Record<string, string | boolean> }> {
    const payload = parsePayload(restProps.quotePayload);
    const recipient = restProps.dstWalletAddress || restProps.srcWalletAddress;
    const refund = restProps.srcWalletAddress;
    if (restProps.fromChain.id !== payload.sourceChainId) throw new Error("StealthEX: source chain changed");
    // The amount StealthEX expects and the amount the wallet sends must be
    // the same number (the swap build merges query params into the payload).
    if (toBaseUnits(payload.amount, payload.fromDecimals) !== payload.amountBase) {
      throw new Error("StealthEX: stored amounts disagree");
    }

    // A fixed rate about to lapse is re-estimated, and kept only if it still
    // pays what the user was shown, less their slippage.
    let { rateId } = payload;
    const validUntil = Date.parse(payload.rateValidUntil ?? "");
    if (payload.rate === "fixed" && (!Number.isFinite(validUntil) || validUntil - Date.now() < REQUOTE_BEFORE_EXPIRY_MS)) {
      const fresh = await this.estimate(payload.from, payload.to, payload.amount, "fixed");
      const floor = payload.shownAmount * (1 - (restProps.slippageTolerance ?? 0.5) / 100);
      if (fresh.amountOut < floor) throw new Error("StealthEX: rate moved below the quoted amount; refresh the quote");
      rateId = fresh.rateId;
    }

    const client = restProps.clientContext;
    const exchange: unknown = await apiCall({
      method: "POST",
      url: `${this.BASE_URL}/exchanges`,
      headers: {
        ...(client?.ip ? { "x-sx-client-ip": client.ip } : {}),
        ...(client?.userAgent ? { "x-sx-client-ua": client.userAgent } : {}),
        ...(client?.acceptLanguage ? { "x-sx-client-lang": client.acceptLanguage } : {}),
      },
      data: {
        route: {
          from: { symbol: payload.from.symbol, network: payload.from.network },
          to: { symbol: payload.to.symbol, network: payload.to.network },
        },
        amount: payload.amount,
        estimation: "direct",
        rate: payload.rate,
        ...(payload.rate === "fixed" && rateId ? { rate_id: rateId } : {}),
        address: recipient,
        refund_address: refund,
      },
    });
    const { id, depositAddress } = validateExchange(exchange, { payload, recipient, refund });

    const tx = payload.isNativeIn
      ? { to: depositAddress, data: "0x", value: payload.amountBase, from: refund }
      : {
          to: payload.fromTokenAddress,
          data: new ethers.Interface(["function transfer(address to, uint256 amount) returns (bool)"]).encodeFunctionData(
            "transfer",
            [depositAddress, payload.amountBase],
          ),
          value: "0",
          from: refund,
        };

    return {
      tx,
      spender: "",
      metaData: {
        // Not `depositAddress`: the pages treat that key as Near's tracker.
        stealthexId: id,
        stealthexDepositAddress: depositAddress,
        isDirectTransfer: true,
        isNative: payload.isNativeIn,
      },
    };
  }

  // `hash` is the StealthEX exchange id (metaData.stealthexId).
  async getTxStatus(
    _chainId: number,
    hash: string,
  ): Promise<{ status: "pending" | "success" | "failed" | "not_found"; hash: string; destinationTxHash?: string; raw?: unknown }> {
    try {
      const ex: unknown = await apiCall({ method: "GET", url: `${this.BASE_URL}/exchanges/${encodeURIComponent(hash)}` });
      const s = field(ex, "status");
      const status =
        s === "finished"
          ? "success"
          : s === "failed" || s === "refunded" || s === "expired"
          ? "failed"
          : typeof s === "string"
          ? "pending"
          : "not_found";
      return { status, hash, destinationTxHash: optStr(field(field(ex, "withdrawal"), "tx_hash")) ?? undefined, raw: ex };
    } catch {
      return { status: "not_found", hash };
    }
  }

  // Tells StealthEX which transaction paid the deposit, so it matches it
  // sooner. Best effort: the exchange completes without it.
  async reportDepositTx(id: string, txHash: string): Promise<void> {
    await apiCall({
      method: "PATCH",
      url: `${this.BASE_URL}/exchanges/${encodeURIComponent(id)}`,
      data: { tx_hash: txHash },
    });
  }
}
