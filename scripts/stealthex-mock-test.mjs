#!/usr/bin/env node
// StealthEX integration test against a MOCK of its v4 API.
//
// Without a StealthEX key nothing can be measured live, so this runs the
// real pieces (built swap-sdk, bz-backend's controllers/defi/stealthex.js
// proxy) against a mock that answers with the shapes in StealthEX's own
// OpenAPI spec (api.stealthex.io/docs/openapi.json). It proves our code
// does what it claims, including refusing every tampered exchange. It does
// NOT prove StealthEX's real network codes or field values: run
// scripts/stealthex-verify.mjs with a key for that.
//
//   npm run build && node scripts/stealthex-mock-test.mjs

import http from "node:http";
import { ethers } from "ethers";

const BACKEND = new URL("../../bz-backend/", import.meta.url);
const MOCK_PORT = 5078;
const PROXY_PORT = 5079;
process.env.STEALTHEX_API_URL = `http://localhost:${MOCK_PORT}/v4`;
process.env.STEALTHEX_API_KEY = "sx_test_key";
process.env.STEALTHEX_CACHE_MS = "0"; // the mock changes between checks

const USER = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
const DEPOSIT = "0x1111111111111111111111111111111111111111";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const BTC_DEST = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const SOL_DEST = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const EVM_RE = "^(0x)[0-9A-Fa-f]{40}$";

// ── mock StealthEX v4 ────────────────────────────────────────────────────
let mode = "honest";
const seen = [];
const cur = (symbol, network, name, extra = {}) => ({
  symbol, network, legacy_symbol: symbol, name, rates: ["fixed", "floating"], features: [],
  icon_url: "", precision: null, extra_id: null, address_regex: EVM_RE, extra_id_regex: null,
  contract_address: null, warnings: { deposit: [], withdrawal: [] }, ...extra,
});
const TOKENS_ETH = () => [
  cur("dai", "eth", "Dai", { contract_address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" }),
  cur("usdc", "eth", "USD Coin", {
    contract_address: USDC,
    warnings: { deposit: mode === "warning" ? ["send only ERC-20"] : [], withdrawal: [] },
  }),
  ...(mode === "ambiguous" ? [cur("usdc2", "eth", "USD Coin copy", { contract_address: USDC })] : []),
];
const NATIVE = {
  "eth/mainnet": () => cur("eth", "mainnet", mode === "namesake" ? "Ethereum Classic" : "Ethereum"),
  "btc/mainnet": () => cur("btc", "mainnet", "Bitcoin", { address_regex: "^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,80}$" }),
  "sol/mainnet": () => cur("sol", "mainnet", "Solana", { address_regex: "^[1-9A-HJ-NP-Za-km-z]{32,44}$" }),
};

function exchangeFor(req) {
  const fixed = req.rate === "fixed";
  const ex = {
    id: "sx_mock_1", status: "waiting", rate: req.rate,
    deposit: {
      symbol: req.route.from.symbol, network: req.route.from.network, amount: 0,
      expected_amount: req.amount, address: DEPOSIT, extra_id: null, tx_hash: null,
      address_explorer_url: `https://etherscan.io/address/${DEPOSIT}`, tx_explorer_url: null,
    },
    withdrawal: {
      symbol: req.route.to.symbol, network: req.route.to.network, amount: 0, expected_amount: 1,
      address: req.address, extra_id: null, tx_hash: null, address_explorer_url: null, tx_explorer_url: null,
    },
    refund_address: req.refund_address ?? null, refund_extra_id: null,
    created_at: new Date().toISOString(), finished_at: null,
    expires_at: fixed ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
  };
  const tamper = {
    payout: () => { ex.withdrawal.address = "0x2222222222222222222222222222222222222222"; },
    refund: () => { ex.refund_address = "0x3333333333333333333333333333333333333333"; },
    network: () => { ex.deposit.network = "bsc"; },
    memo: () => { ex.deposit.extra_id = "12345"; },
    explorer: () => { ex.deposit.address_explorer_url = `https://basescan.org/address/${DEPOSIT}`; },
    amount: () => { ex.deposit.expected_amount = req.amount * 1.01; },
    status: () => { ex.status = "confirming"; },
    expiring: () => { ex.expires_at = new Date(Date.now() + 30_000).toISOString(); },
    tokenAsDeposit: () => { ex.deposit.address = USDC; ex.deposit.address_explorer_url = `https://etherscan.io/address/${USDC}`; },
    btcDeposit: () => { ex.deposit.address = BTC_DEST; ex.deposit.address_explorer_url = `https://etherscan.io/address/${BTC_DEST}`; },
    noLink: () => { ex.deposit.address_explorer_url = null; },
  }[mode];
  if (tamper) tamper();
  return ex;
}

const mock = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const json = body ? JSON.parse(body) : undefined;
    seen.push({ method: req.method, path: url.pathname, headers: req.headers, body: json });
    const send = (code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.headers.authorization !== "Bearer sx_test_key") return send(401, { err: { kind: "Auth", details: "bad key" } });
    const p = url.pathname;
    if (req.method === "GET" && p === "/v4/currencies") {
      const all = url.searchParams.get("network") === "eth" ? TOKENS_ETH() : [];
      const off = Number(url.searchParams.get("offset") || 0), lim = Number(url.searchParams.get("limit") || 50);
      return send(200, all.slice(off, off + lim));
    }
    const m = p.match(/^\/v4\/currencies\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && m) {
      const f = NATIVE[`${m[1]}/${m[2]}`];
      return f ? send(200, f()) : send(404, { err: { kind: "NotFound", details: "currency" } });
    }
    if (req.method === "POST" && p === "/v4/rates/range") return send(200, { min_amount: 0.01, max_amount: null });
    if (req.method === "POST" && p === "/v4/rates/estimated-amount") {
      const out = json.amount * 0.03;
      return send(200, json.rate === "fixed"
        ? { estimated_amount: out, rate: { id: "rate_1", valid_until: new Date(Date.now() + 10 * 60_000).toISOString() } }
        : { estimated_amount: out });
    }
    if (req.method === "POST" && p === "/v4/exchanges") return send(201, exchangeFor(json));
    if (req.method === "GET" && p === "/v4/exchanges/sx_mock_1") {
      const s = mode === "refunded" ? "refunded" : "finished";
      return send(200, { ...exchangeFor({ rate: "fixed", amount: 1, route: { from: { symbol: "eth", network: "mainnet" }, to: { symbol: "btc", network: "mainnet" } }, address: BTC_DEST }), status: s, withdrawal: { tx_hash: "btc_payout_tx" } });
    }
    if (req.method === "PATCH" && p === "/v4/exchanges/sx_mock_1") return send(200, { id: "sx_mock_1", deposit: { tx_hash: json.tx_hash } });
    send(404, { err: { kind: "NotFound", details: p } });
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, r));

// ── real bz-backend proxy controller ─────────────────────────────────────
const { default: express } = await import(new URL("node_modules/express/index.js", BACKEND).href);
const sx = await import(new URL("controllers/defi/stealthex.js", BACKEND).href);
const app = express();
app.use(express.json());
app.get("/api/defi/stealthex/currencies", sx.stealthexCurrencies);
app.get("/api/defi/stealthex/currencies/:symbol/:network", sx.stealthexCurrency);
app.post("/api/defi/stealthex/range", sx.stealthexRange);
app.post("/api/defi/stealthex/estimate", sx.stealthexEstimate);
app.post("/api/defi/stealthex/exchanges", sx.stealthexCreate);
app.get("/api/defi/stealthex/exchanges/:id", sx.stealthexExchange);
app.patch("/api/defi/stealthex/exchanges/:id", sx.stealthexSetTxHash);
const proxy = await new Promise((r) => { const s = app.listen(PROXY_PORT, () => r(s)); });

// ── built swap-sdk ───────────────────────────────────────────────────────
const { TradeManager, configure } = await import("../dist/index.js");
const { default: Quote } = await import("../dist/utils/quote.js");
const { RelayerFactory } = await import("../dist/relayer.js");
configure({ baseApiUrl: `http://localhost:${PROXY_PORT}/api/defi`, stealthexEnabled: true });
const sxAgg = new TradeManager().aggregatorFactory.getAggregator("stealthex");

const chain = (id, name) => ({ id, name });
const tok = (address, decimals, symbol) => ({ address, decimals, symbol, priceUSD: "0" });
const ETH1 = chain(1, "Ethereum"), BTC = chain(20000000000001, "Bitcoin"), SOL = chain(102, "Solana");
const ethToBtc = { fromChain: ETH1, toChain: BTC, fromToken: tok("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", 18, "ETH"), toToken: tok("bitcoin", 8, "BTC"), amount: 0.5, srcWalletAddress: USER, dstWalletAddress: BTC_DEST, type: "BRIDGE" };
const usdcToSol = { fromChain: ETH1, toChain: SOL, fromToken: tok(USDC, 6, "USDC"), toToken: tok("So11111111111111111111111111111111111111112", 9, "SOL"), amount: 250, srcWalletAddress: USER, dstWalletAddress: SOL_DEST, type: "BRIDGE" };
const roundTrip = (q) => new Quote(JSON.parse(JSON.stringify(q.data)), q.meta, { ...JSON.parse(JSON.stringify(q.restProps)), clientContext: { ip: "203.0.113.42", userAgent: "Mozilla/5.0 test", acceptLanguage: "en-US" } });

const rows = [];
const check = (name, pass, detail = "") => rows.push({ check: name, pass, detail: String(detail).slice(0, 90) });
async function mustThrow(name, fn, re) {
  try { await fn(); check(name, false, "did not throw"); }
  catch (e) { check(name, re.test(e.message), e.message); }
}

// 1. honest ETH -> BTC, fixed rate
mode = "honest";
const q1 = await sxAgg.getQuotes(ethToBtc);
check("ETH->BTC quotes fixed rate", q1.meta.route === "StealthEX (fixed rate)" && q1.meta.amount === 0.015, `${q1.meta.route} ${q1.meta.amount}`);
check("no relayer fee shown", q1.meta.blazpayFeePercent === 0);
seen.length = 0;
const b1 = await roundTrip(q1).getTransactionData();
check("native deposit is a plain transfer of the exact amount", b1.tx.to === DEPOSIT && b1.tx.data === "0x" && b1.tx.value === ethers.parseEther("0.5").toString(), JSON.stringify(b1.tx));
check("build marked isDirectTransfer, spender empty", b1.metaData.isDirectTransfer === true && b1.spender === "");
const create = seen.find((s) => s.path === "/v4/exchanges");
check("exchange asks payout to recipient, refund to sender, with rate_id", create.body.address === BTC_DEST && create.body.refund_address === USER && create.body.rate_id === "rate_1");
check("proxy sends key and the user's ip/ua/lang", create.headers.authorization === "Bearer sx_test_key" && create.headers["x-forwarded-for"] === "203.0.113.42" && create.headers["user-agent"] === "Mozilla/5.0 test" && create.headers["accept-language"] === "en-US", create.headers["x-forwarded-for"]);

// 2. honest USDC (by contract) -> SOL
const q2 = await sxAgg.getQuotes(usdcToSol);
const b2 = await roundTrip(q2).getTransactionData();
const [to, amt] = new ethers.Interface(["function transfer(address,uint256)"]).decodeFunctionData("transfer", b2.tx.data);
check("ERC-20 deposit = USDC.transfer(deposit, 250e6)", b2.tx.to === USDC && to === DEPOSIT && amt === 250_000_000n && b2.tx.value === "0");

// 3. every tampered exchange is refused
const tampered = {
  payout: /payout address/, refund: /refund address/, network: /deposit currency/, memo: /memo/,
  explorer: /another chain's explorer/, amount: /expects/, status: /status is confirming/, expiring: /expires too soon/,
  tokenAsDeposit: /token contract/, btcDeposit: /wrong format/,
};
for (const [m, re] of Object.entries(tampered)) {
  mode = "honest";
  const q = await sxAgg.getQuotes(m === "tokenAsDeposit" ? usdcToSol : ethToBtc);
  mode = m;
  await mustThrow(`refuse tampered exchange: ${m}`, () => roundTrip(q).getTransactionData(), re);
}

// 3b. no explorer link at all is fine (StealthEX sends none for some tokens)
{
  mode = "honest";
  const q = await sxAgg.getQuotes(ethToBtc);
  mode = "noLink";
  try { await roundTrip(q).getTransactionData(); check("exchange without an explorer link is accepted", true); }
  catch (e) { check("exchange without an explorer link is accepted", false, e.message); }
}

// 4. quote-side refusals
mode = "honest";
await mustThrow("refuse same-chain / swap page", () => sxAgg.getQuotes({ ...ethToBtc, toChain: ETH1, type: "SWAP" }), /cross-chain only/);
await mustThrow("refuse unverified source chain (Avalanche)", () => sxAgg.getQuotes({ ...ethToBtc, fromChain: chain(43114, "Avalanche") }), /source chain 43114/);
await mustThrow("refuse native coin StealthEX does not list (ETH on Base)", () => sxAgg.getQuotes({ ...ethToBtc, fromChain: chain(8453, "Base") }), /no native coin entry for chain 8453/);
await mustThrow("refuse SPL token payout (not verified)", () => sxAgg.getQuotes({ ...usdcToSol, toToken: tok("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 6, "USDC") }), /tokens on chain 102/);
await mustThrow("refuse BTC payout without recipient", () => sxAgg.getQuotes({ ...ethToBtc, dstWalletAddress: undefined }), /needs a recipient/);
await mustThrow("refuse EVM recipient for BTC payout", () => sxAgg.getQuotes({ ...ethToBtc, dstWalletAddress: USER }), /recipient address is not valid/);
await mustThrow("refuse below minimum", () => sxAgg.getQuotes({ ...ethToBtc, amount: 0.001 }), /outside/);
mode = "namesake";
await mustThrow("refuse native namesake (eth/mainnet not Ethereum)", () => sxAgg.getQuotes({ ...ethToBtc, amount: 0.51 }), /expected Ethereum/);
mode = "ambiguous";
await mustThrow("refuse token listed twice", () => sxAgg.getQuotes({ ...usdcToSol, amount: 251 }), /2 listings/);
mode = "warning";
await mustThrow("refuse token with deposit warnings", () => sxAgg.getQuotes({ ...usdcToSol, amount: 252 }), /deposit warnings/);
mode = "honest";
configure({ stealthexEnabled: false });
await mustThrow("off unless enabled", () => sxAgg.getQuotes(ethToBtc), /not enabled/);
configure({ stealthexEnabled: true });

// 5. a query-param override of the stored amount cannot desync the deposit
{
  const q = roundTrip(await sxAgg.getQuotes(ethToBtc));
  Object.assign(q.restProps.quotePayload, { amount: "5" }); // what swap.js does with ?amount=5
  await mustThrow("refuse amount override from query", () => q.getTransactionData(), /amounts disagree/);
}

// 6. the relayer refuses direct-transfer builds (Houdini and StealthEX) at
// every entry point; without the flag each fails later for its own reason
// (no provider here), which shows it is the guard that refused.
{
  const GUARD = /cannot run through BlazpayRelayer/;
  const rf = new RelayerFactory();
  const raw = { ...b1, amount: 1n, token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", isNative: true, userAddress: USER, decimals: 18, chainId: 8453 };
  for (const fn of ["simulateTransaction", "triggerContract", "getMetaTransactionByteData"]) {
    await mustThrow(`relayer.${fn} refuses isDirectTransfer`, async () => rf[fn](raw), GUARD);
    let other = "no error";
    try { await rf[fn]({ ...raw, metaData: {} }); } catch (e) { other = e.message; }
    check(`control: ${fn} without the flag passes the guard`, !GUARD.test(other), other);
  }
}

// 7. status and tx-hash report
{
  const st = await sxAgg.getTxStatus(1, "sx_mock_1");
  check("finished -> success with payout hash", st.status === "success" && st.destinationTxHash === "btc_payout_tx", JSON.stringify(st).slice(0, 80));
  mode = "refunded";
  check("refunded -> failed", (await sxAgg.getTxStatus(1, "sx_mock_1")).status === "failed");
  mode = "honest";
  await sxAgg.reportDepositTx("sx_mock_1", "0x" + "ab".repeat(32));
  check("tx hash reported", seen.some((s) => s.method === "PATCH" && s.body?.tx_hash === "0x" + "ab".repeat(32)));
  const bad = await fetch(`http://localhost:${PROXY_PORT}/api/defi/stealthex/exchanges/sx_mock_1`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx_hash: "nope" }) });
  check("proxy rejects malformed tx hash", bad.status === 400);
}

console.table(rows);
const failed = rows.filter((r) => !r.pass);
console.log(failed.length ? `FAILED ${failed.length}/${rows.length}` : `ALL ${rows.length} PASS`);
mock.close(); proxy.close();
process.exit(failed.length ? 1 : 0);
