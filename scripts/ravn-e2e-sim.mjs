#!/usr/bin/env node
// End-to-end check of the RAVN aggregator through the real relayer path.
//
// For each pair: the built SDK quotes through the bz-backend RAVN proxy,
// the quote round-trips through JSON (as it does through Redis), the SDK
// builds the transaction, and the result is eth_called as
// BlazpayRelayer.executeMetaTransactionSwap on Base mainnet, signed by a
// throwaway key that a state override installs as the relayer's signer
// (storage slot 5). The user gets funds and the allowance via overrides.
// Nothing is broadcast and no real key is used.
//
//   (in bz-backend) node <proxy that mounts controllers/defi/ravn.js on :5077>
//   node scripts/ravn-e2e-sim.mjs [http://localhost:5077/api/defi]
//   node scripts/ravn-e2e-sim.mjs --controls   # things that must FAIL, and why

import { ethers } from "ethers";
import { TradeManager, configure, ravnTrackingKey } from "../dist/index.js";
import Quote from "../dist/utils/quote.js";
import { relayerAbi } from "../dist/utils/jsons/relayerAbi.js";

const CONTROLS = process.argv.includes("--controls");
const API = process.argv.slice(2).find((a) => a.startsWith("http")) || "http://localhost:5077/api/defi";
configure({ baseApiUrl: API });

const RPC = process.env.BASE_RPC || "https://mainnet.base.org";
const RELAYER = "0xb8Bd470f3C2610F83025D049085A64f1C7b78F14";
const SIGNER_SLOT = "0x5";
const USER = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // balances slot 9, allowed slot 10
const ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const BTC_DEST = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const SOL_DEST = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

const chain = (id, name) => ({ id, name });
const tok = (address, decimals, symbol) => ({ address, decimals, symbol, priceUSD: "0" });
const BASE = chain(8453, "Base");
const PAIRS = [
  { name: "swap Base USDC->ETH", from: BASE, to: BASE, fromToken: tok(USDC, 6, "USDC"), toToken: tok(ETH, 18, "ETH"), amount: 100 },
  { name: "swap Base ETH->USDC", from: BASE, to: BASE, fromToken: tok(ETH, 18, "ETH"), toToken: tok(USDC, 6, "USDC"), amount: 0.04 },
  { name: "bridge Base USDC->Arb USDC", from: BASE, to: chain(42161, "Arbitrum"), fromToken: tok(USDC, 6, "USDC"), toToken: tok("0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6, "USDC"), amount: 100 },
  { name: "bridge Base ETH->Arb ETH", from: BASE, to: chain(42161, "Arbitrum"), fromToken: tok(ETH, 18, "ETH"), toToken: tok(ETH, 18, "ETH"), amount: 0.04 },
  { name: "bridge Base USDC->BTC", from: BASE, to: chain(20000000000001, "Bitcoin"), fromToken: tok(USDC, 6, "USDC"), toToken: tok("bitcoin", 8, "BTC"), amount: 500, dst: BTC_DEST },
  { name: "bridge Base ETH->BTC", from: BASE, to: chain(20000000000001, "Bitcoin"), fromToken: tok(ETH, 18, "ETH"), toToken: tok("bitcoin", 8, "BTC"), amount: 0.2, dst: BTC_DEST },
  { name: "bridge Base USDC->Sol USDC", from: BASE, to: chain(102, "Solana"), fromToken: tok(USDC, 6, "USDC"), toToken: tok("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", 6, "USDC"), amount: 100, dst: SOL_DEST },
];

const provider = new ethers.JsonRpcProvider(RPC, 8453, { staticNetwork: true });
const relayer = new ethers.Contract(RELAYER, relayerAbi, provider);
const testSigner = ethers.Wallet.createRandom();
const coder = ethers.AbiCoder.defaultAbiCoder();
const mapSlot = (k, s) => ethers.keccak256(coder.encode(["address", "uint256"], [k, s]));
const allowSlot = (o, sp, s) => ethers.keccak256(coder.encode(["address", "bytes32"], [sp, mapSlot(o, s)]));
const word = (n) => ethers.zeroPadValue(ethers.toBeHex(n), 32);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tm = new TradeManager();
const ravn = tm.aggregatorFactory.getAggregator("ravn");

async function relayerSim({ tx, spender }, { token, amountWei, isNative }, { installSigner = true } = {}) {
  const [inPercentFee, feeAmount, nonce] = await Promise.all([
    relayer.inPercentFee(), relayer.feeAmount(), relayer.nonces(USER),
  ]);
  const value = BigInt(tx.value ?? 0);
  const metaTx = {
    targetContract: tx.to, data: tx.data, amount: amountWei, token, isNative,
    recipient: spender, nativeValue: value, nonce,
    deadline: BigInt(Math.round(Date.now() / 1000 + 100)),
  };
  const sig = await testSigner.signTypedData(
    { name: "BlazpayRelayer", version: "1", chainId: 8453, verifyingContract: RELAYER },
    { MetaTransaction: [
      { name: "targetContract", type: "address" }, { name: "data", type: "bytes" },
      { name: "amount", type: "uint256" }, { name: "token", type: "address" },
      { name: "isNative", type: "bool" }, { name: "recipient", type: "address" },
      { name: "nativeValue", type: "uint256" }, { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ] },
    metaTx,
  );
  // relayer.ts: native pays value + fee; ERC-20 fee is pulled on top of amount.
  const fee = isNative ? feeAmount + (inPercentFee * value) / 10000n : (amountWei * inPercentFee) / 10000n;
  const txValue = isNative ? value + fee : 0n;
  const override = {
    [RELAYER]: installSigner ? { stateDiff: { [word(BigInt(SIGNER_SLOT))]: word(BigInt(testSigner.address)) } } : {},
    [USER]: { balance: ethers.toBeHex(txValue + 10n ** 18n) },
  };
  if (!isNative) {
    override[USDC] = { stateDiff: {
      [mapSlot(USER, 9)]: word(amountWei + fee),
      [allowSlot(USER, RELAYER, 10)]: word(amountWei + fee),
    } };
  }
  const data = relayer.interface.encodeFunctionData("executeMetaTransactionSwap", [metaTx, sig]);
  const res = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ from: USER, to: RELAYER, data, value: ethers.toBeHex(txValue) }, "latest", override] }),
  });
  const json = await res.json();
  return json.error ? `REVERT ${json.error.message}${json.error.data ? " " + json.error.data.slice(0, 74) : ""}` : "ok";
}

// Same rehydration bz-backend does from Redis.
const roundTrip = (q) => new Quote(JSON.parse(JSON.stringify(q.data)), q.meta, JSON.parse(JSON.stringify(q.restProps)));

async function ravnRaw(path, body) {
  const res = await fetch(`${API}/ravn${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return (await res.json()).data;
}

async function expectThrow(name, fn, pattern) {
  try {
    const r = await fn();
    return { control: name, result: `DID NOT THROW (${JSON.stringify(r).slice(0, 60)})`, pass: false };
  } catch (e) {
    const msg = String(e?.message ?? e);
    return { control: name, result: msg.slice(0, 90), pass: pattern.test(msg) };
  }
}

if (CONTROLS) {
  const rows = [];
  const usdcEth = PAIRS[0];
  const q = await ravn.getQuotes({ fromChain: BASE, toChain: BASE, fromToken: usdcEth.fromToken, toToken: usdcEth.toToken, amount: 100, srcWalletAddress: USER, type: "SWAP" });
  await sleep(2200);
  const built = await roundTrip(q).getTransactionData();
  const base = { token: USDC, isNative: false, amountWei: 100_000_000n };
  rows.push({ control: "same build, real path", result: await relayerSim(built, base), pass: null });
  const noSigner = await relayerSim(built, base, { installSigner: false });
  rows.push({ control: "signer not installed", result: noSigner, pass: /Invalid signature/.test(noSigner) });
  const cut = await relayerSim({ ...built, tx: { ...built.tx, data: built.tx.data.slice(0, 10) } }, base);
  rows.push({ control: "calldata cut to selector", result: cut, pass: cut.startsWith("REVERT") });
  const lowFunds = await relayerSim(built, { ...base, amountWei: 1n });
  rows.push({ control: "relayer pulls 1 wei, swap wants 100 USDC", result: lowFunds, pass: lowFunds.startsWith("REVERT") });

  // Re-quote path: a token RAVN cannot read is QUOTE_INVALID -> fresh quote.
  const stale = roundTrip(q);
  stale.restProps.quotePayload.chosen.quoteToken = "rq_not_a_real_token";
  await sleep(2200);
  try {
    const rebuilt = await stale.getTransactionData();
    rows.push({ control: "stale quoteToken re-quotes", result: await relayerSim(rebuilt, base), pass: true });
  } catch (e) {
    rows.push({ control: "stale quoteToken re-quotes", result: String(e?.message).slice(0, 90), pass: false });
  }
  const greedy = roundTrip(q);
  greedy.restProps.quotePayload.chosen.quoteToken = "rq_not_a_real_token";
  greedy.restProps.quotePayload.chosen.minimumOutput = (10n ** 30n).toString();
  await sleep(2200);
  rows.push(await expectThrow("re-quote below shown minimum", () => greedy.getTransactionData(), /price moved/));

  // Deposit branch with native input: NEAR is allowed, anything else is not.
  await sleep(2200);
  const nearQ = await ravnRaw("/quote", {
    inputChainId: 8453, outputChainId: 42161, inputToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    outputToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", inputAmount: "40000000000000000",
    userAddress: USER, destinationAddress: USER, refundAddress: USER, onlyVenues: ["near_intents"],
  });
  const nearPayload = (venueId, inputAmount = "40000000000000000") => ({
    request: { inputChainId: 8453, outputChainId: 42161, inputToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      outputToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", inputAmount, userAddress: USER,
      destinationAddress: USER, refundAddress: USER, excludeVenues: [], timeoutMs: 4000 },
    chosen: { quoteToken: nearQ.quoteToken, venueId, minimumOutput: "0" },
    isNativeIn: true, inputTokenAddress: ETH,
  });
  const rp = { srcWalletAddress: USER, slippageTolerance: 0.5, fromChain: { id: 8453, name: "base" }, toChain: { id: 42161, name: "arbitrum" } };
  await sleep(2200);
  rows.push(await expectThrow("native deposit to a non-NEAR venue", () => ravn.getTransactionData(null, { ...rp, quotePayload: nearPayload("chainflip") }, { id: "ctl-1" }), /not credited/));
  await sleep(2200);
  rows.push(await expectThrow("deposit amount differs from input", () => ravn.getTransactionData(null, { ...rp, quotePayload: nearPayload("near_intents", "1") }, { id: "ctl-2" }), /differs from input/));
  await sleep(2200);
  const nearBuilt = await ravn.getTransactionData(null, { ...rp, quotePayload: nearPayload("near_intents") }, { id: "ctl-3" });
  rows.push({ control: "native NEAR deposit through relayer", result: `${nearBuilt.tx.data} -> ${await relayerSim(nearBuilt, { token: ETH, isNative: true, amountWei: 40000000000000000n })}`, pass: null });

  rows.push(await expectThrow("Solana payout without recipient", () => ravn.getQuotes({ ...PAIRS[6], fromChain: BASE, toChain: PAIRS[6].to, srcWalletAddress: USER, dstWalletAddress: undefined, type: "BRIDGE" }), /needs a recipient/));
  rows.push(await expectThrow("source chain without a relayer (zkSync)", () => ravn.getQuotes({ ...PAIRS[0], fromChain: chain(324, "zkSync"), toChain: BASE, srcWalletAddress: USER, type: "BRIDGE" }), /no relayer route/));
  console.table(rows);
  process.exit(rows.some((r) => r.pass === false) ? 1 : 0);
}

const results = [];
for (const p of PAIRS) {
  const row = { pair: p.name };
  try {
    const q = await ravn.getQuotes({
      fromChain: p.from, toChain: p.to, fromToken: p.fromToken, toToken: p.toToken,
      amount: p.amount, srcWalletAddress: USER, dstWalletAddress: p.dst, type: "BRIDGE",
    });
    row.route = q.meta.route;
    row.out = q.meta.amount;
    row.eta = q.meta.timeEstimate;
    await sleep(2200);
    const built = await roundTrip(q).getTransactionData();
    const isNative = p.fromToken.address === ETH;
    row.kind = built.metaData.ravnDepositAddress ? "deposit" : "tx";
    row.sim = await relayerSim(built, {
      token: p.fromToken.address, isNative,
      amountWei: ethers.parseUnits(String(p.amount), p.fromToken.decimals),
    });
    const key = ravnTrackingKey({ trackUrl: built.metaData.trackUrl, txHash: "0x" + "ab".repeat(32) });
    const st = await ravn.getTxStatus(8453, key);
    row.status = st.status;
  } catch (e) {
    row.error = String(e?.response?.data?.error?.code ?? e?.message ?? e).slice(0, 100);
  }
  console.log(JSON.stringify(row));
  results.push(row);
  await sleep(2200);
}
console.table(results);
