#!/usr/bin/env node
// Checks Stealthex.aggregator.ts's CHAINS table against the LIVE StealthEX
// API and proposes entries for more chains. Read-only: it never creates an
// exchange. Run it before turning StealthEX on, and before adding a chain.
//
//   STEALTHEX_API_KEY=... node scripts/stealthex-verify.mjs
//
//   STEALTHEX_API_KEY=... node scripts/stealthex-verify.mjs --exchange <evm refund addr> <btc payout addr>
//     also creates ONE unfunded ETH->BTC exchange (it simply expires) and runs
//     the SDK's real validateExchange on StealthEX's actual answer, so the
//     explorer-link and field checks are tested against reality. Needs
//     `npm run build` first.
//
// The key is read from the environment and never printed.

const KEY = process.env.STEALTHEX_API_KEY;
if (!KEY) {
  console.error("Set STEALTHEX_API_KEY");
  process.exit(2);
}
const API = "https://api.stealthex.io/v4";
const headers = { Authorization: `Bearer ${KEY}`, "content-type": "application/json" };

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} ${res.status} ${await res.text()}`);
  return res.json();
}
async function post(path, body) {
  const res = await fetch(`${API}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// Canonical stablecoin contracts per chain: whichever StealthEX network
// lists these addresses is that chain's token network.
const KNOWN = {
  1: { USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  10: { USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  56: { USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", USDT: "0x55d398326f99059fF775485246999027B3197955" },
  137: { USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  8453: { USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  42161: { USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
  43114: { USDC: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  59144: { USDC: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
};
// What Stealthex.aggregator.ts assumes, read from the built SDK so the
// check and the code cannot drift apart.
const { STEALTHEX_CHAINS, validateExchange } = await import("../dist/aggregators/Stealthex.aggregator.js");
const ASSUMED = { tokenNetwork: {}, native: {} };
for (const [id, c] of Object.entries(STEALTHEX_CHAINS)) {
  if (c.tokenNetwork) ASSUMED.tokenNetwork[id] = c.tokenNetwork;
  if (c.native) ASSUMED.native[`${c.native.symbol}/${c.native.network}`] = c.native.name;
}
for (const id of Object.keys(ASSUMED.tokenNetwork)) {
  if (!KNOWN[id]) { console.log(`FAIL chain ${id} has a tokenNetwork but no known contract to check it with`); process.exitCode = 1; }
}

let bad = 0;
const ok = (cond, msg) => { console.log(`${cond ? "OK  " : "FAIL"} ${msg}`); if (!cond) bad += 1; };

console.log("networks:", (await get("/currencies/networks")).join(", "), "\n");

for (const [key, name] of Object.entries(ASSUMED.native)) {
  const [symbol, network] = key.split("/");
  const c = await get(`/currencies/${symbol}/${network}`).catch((e) => ({ error: e.message }));
  ok(c.name === name && c.contract_address === null,
    `native ${key}: name "${c.name}", contract ${c.contract_address}, rates ${c.rates}, deposit warnings ${JSON.stringify(c.warnings?.deposit)}`);
}

const all = [];
for (let offset = 0; offset < 20 * 250; offset += 250) {
  const page = await get(`/currencies?limit=250&offset=${offset}`);
  all.push(...page);
  if (page.length < 250) break;
}
console.log(`\n${all.length} currencies listed\n`);

for (const [chainId, tokens] of Object.entries(KNOWN)) {
  const networks = new Set();
  for (const [sym, addr] of Object.entries(tokens)) {
    const hits = all.filter((c) => c.contract_address?.toLowerCase() === addr.toLowerCase());
    hits.forEach((h) => networks.add(h.network));
    console.log(`chain ${chainId} ${sym}: ${hits.map((h) => `${h.symbol}/${h.network}`).join(", ") || "not listed"}`);
  }
  const assumed = ASSUMED.tokenNetwork[chainId];
  if (assumed) ok(networks.size === 1 && networks.has(assumed), `chain ${chainId} tokenNetwork "${assumed}" (found: ${[...networks].join(", ") || "none"})`);
  else if (networks.size === 1) console.log(`  -> proposal: chain ${chainId} tokenNetwork "${[...networks][0]}" (confirm its native coin and explorer before adding)`);
}

console.log("\nnative-looking coins off 'mainnet' (L2 natives; confirm by hand):");
for (const c of all.filter((c) => c.contract_address === null && ["eth", "bnb", "pol", "matic", "avax"].includes(c.symbol) && c.network !== "mainnet")) {
  console.log(`  ${c.symbol}/${c.network} "${c.name}" regex ${c.address_regex}`);
}

const route = { from: { symbol: "eth", network: "mainnet" }, to: { symbol: "btc", network: "mainnet" } };
for (const rate of ["fixed", "floating"]) {
  const range = await post("/rates/range", { route, estimation: "direct", rate });
  const est = await post("/rates/estimated-amount", { route, amount: 0.1, estimation: "direct", rate });
  console.log(`\nETH->BTC ${rate}: range ${JSON.stringify(range.body)}, 0.1 ETH -> ${JSON.stringify(est.body)}`);
}

const ex = process.argv.indexOf("--exchange");
if (ex !== -1) {
  // One unfunded exchange per source chain (never funded, it expires): the
  // native coin where listed, and the chain's USDC (or USDT), each into BTC.
  // The SDK's real validateExchange must accept every one.
  const [refund, payout] = process.argv.slice(ex + 1, ex + 3);
  const cases = [];
  for (const [id, c] of Object.entries(STEALTHEX_CHAINS)) {
    if (c.kind !== "evm") continue;
    if (c.native) cases.push({ id: Number(id), symbol: c.native.symbol, network: c.native.network, token: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", decimals: 18 });
    const [, addr] = Object.entries(KNOWN[id] ?? {})[0] ?? [];
    const cur = addr && all.find((x) => x.network === c.tokenNetwork && x.contract_address?.toLowerCase() === addr.toLowerCase());
    if (cur) cases.push({ id: Number(id), symbol: cur.symbol, network: cur.network, token: addr, decimals: 6 });
  }
  for (const k of cases) {
    const isNative = k.token.startsWith("0xeeee");
    const amount = isNative ? (k.symbol === "bnb" ? 1 : 0.2) : 300;
    const created = await post("/exchanges", {
      route: { from: { symbol: k.symbol, network: k.network }, to: { symbol: "btc", network: "mainnet" } },
      amount, estimation: "direct", rate: "floating", address: payout, refund_address: refund,
    });
    const label = `chain ${k.id} ${k.symbol}/${k.network}`;
    if (created.status >= 300) { ok(false, `${label}: create failed ${JSON.stringify(created.body)}`); continue; }
    try {
      const r = validateExchange(created.body, {
        payload: {
          from: { symbol: k.symbol, network: k.network, kind: "evm", addressRegex: null },
          to: { symbol: "btc", network: "mainnet", kind: "btc", addressRegex: null },
          rate: "floating", rateId: null, rateValidUntil: null, amount, amountBase: "0", shownAmount: 0,
          isNativeIn: isNative, fromTokenAddress: k.token, fromDecimals: k.decimals, sourceChainId: k.id,
        },
        recipient: payout,
        refund,
      });
      ok(true, `${label}: validateExchange accepts a real exchange (id ${r.id}, link ${created.body.deposit.address_explorer_url})`);
    } catch (e) {
      ok(false, `${label}: validateExchange refused a real exchange: ${e.message}`);
    }
  }
}

console.log(bad ? `\n${bad} assumption(s) FAILED: fix CHAINS before enabling` : "\nall assumptions hold");
process.exit(bad ? 1 : 0);
