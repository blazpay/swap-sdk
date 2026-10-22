#!/usr/bin/env node
// Which RAVN venues can run through BlazpayRelayer?
//
// For each (pair, venue) it asks RAVN for a quote restricted to that venue,
// turns it into an execution, and then eth_calls the venue's transaction on
// Base mainnet FROM the relayer address, with state overrides that give the
// relayer the input funds and the allowance it would set itself
// (executeMetaTransactionSwap pulls the user's tokens, forceApproves the
// spender, then calls the target). No funds move and nothing is signed.
//
//   node scripts/ravn-relayer-probe.mjs                  # sender = user EOA (what the SDK sends)
//   node scripts/ravn-relayer-probe.mjs --sender relayer # sender = the relayer contract
//   node scripts/ravn-relayer-probe.mjs --only nordstern,across
//
// Keyless RAVN allows 30 requests a minute per IP, so calls are paced.

import { ethers } from "ethers";

const RAVN = "https://app.ravn.exchange/api/v1";
const RPC = process.env.BASE_RPC || "https://mainnet.base.org";
const RELAYER = "0xb8Bd470f3C2610F83025D049085A64f1C7b78F14"; // BlazpayRelayer on Base
const USER = "0x8ba1f109551bD432803012645Ac136ddd64DBA72"; // an EOA with no allowances
const BTC_DEST = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const SOL_DEST = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";

const BASE = 8453;
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // FiatToken: balances slot 9, allowed slot 10
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const USDC_IN = "100000000"; // 100 USDC
const ETH_IN = "40000000000000000"; // 0.04 ETH

const SAME = ["nordstern", "kyberswap", "okx", "0x_swap", "flytrade", "bebop", "mayan"];
const CROSS = ["relay", "across", "mayan", "eco", "layerswap", "near_intents"];
const TO_BTC = ["layerswap", "thorchain", "relay", "compose", "near_intents"];
const TO_SOL = ["mayan", "relay", "across", "compose", "near_intents"];

const CASES = [
  ...SAME.map((v) => ({ name: "Base USDC->ETH", v, out: [BASE, NATIVE], inTok: USDC_BASE, amt: USDC_IN })),
  ...SAME.map((v) => ({ name: "Base ETH->USDC", v, out: [BASE, USDC_BASE], inTok: NATIVE, amt: ETH_IN })),
  ...CROSS.map((v) => ({ name: "Base USDC->Arb USDC", v, out: [42161, USDC_ARB], inTok: USDC_BASE, amt: USDC_IN })),
  ...CROSS.map((v) => ({ name: "Base ETH->Arb ETH", v, out: [42161, NATIVE], inTok: NATIVE, amt: ETH_IN })),
  ...TO_BTC.map((v) => ({ name: "Base USDC->BTC", v, out: [-1, "native"], inTok: USDC_BASE, amt: USDC_IN, dest: BTC_DEST })),
  ...TO_BTC.map((v) => ({ name: "Base ETH->BTC", v, out: [-1, "native"], inTok: NATIVE, amt: ETH_IN, dest: BTC_DEST })),
  ...TO_SOL.map((v) => ({ name: "Base USDC->Sol USDC", v, out: [-2, USDC_SOL], inTok: USDC_BASE, amt: USDC_IN, dest: SOL_DEST })),
];

const args = process.argv.slice(2);
const senderMode = args.includes("--sender") ? args[args.indexOf("--sender") + 1] : "user";
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const sender = senderMode === "relayer" ? RELAYER : USER;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function ravn(path, body) {
  const wait = lastCall + 2100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const res = await fetch(`${RAVN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`${path} ${res.status} ${json.error?.code ?? ""} ${json.error?.message ?? ""}`.trim());
  return json.data;
}

const pad32 = (hex) => ethers.zeroPadValue(ethers.toBeHex(BigInt(hex)), 32);
const mapSlot = (key, slot) =>
  ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [key, slot]));
const allowanceSlot = (owner, spender, slot) =>
  ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes32"], [spender, mapSlot(owner, slot)]));

async function simulate({ tx, spender, inTok, amt }) {
  const override = { [RELAYER]: { balance: ethers.toBeHex(10n ** 18n) } }; // gas money for a native send
  if (inTok === NATIVE) {
    override[RELAYER].balance = ethers.toBeHex(BigInt(amt) + 10n ** 18n);
  } else {
    override[USDC_BASE] = {
      stateDiff: {
        [mapSlot(RELAYER, 9)]: pad32(amt),
        [allowanceSlot(RELAYER, spender, 10)]: pad32(amt),
      },
    };
  }
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ from: RELAYER, to: tx.to, data: tx.data, value: ethers.toBeHex(BigInt(tx.value ?? "0")) }, "latest", override],
    }),
  });
  const json = await res.json();
  return json.error ? `REVERT ${json.error.message}`.slice(0, 120) : "ok";
}

const rows = [];
for (const c of CASES) {
  if (only && !only.has(c.v)) continue;
  const row = { case: c.name, venue: c.v, type: "-", sim: "-", userInCalldata: "-" };
  try {
    const q = await ravn("/quote", {
      inputChainId: BASE,
      outputChainId: c.out[0],
      inputToken: c.inTok,
      outputToken: c.out[1],
      inputAmount: c.amt,
      userAddress: sender,
      destinationAddress: c.dest ?? USER,
      refundAddress: USER,
      onlyVenues: c.v === "compose" ? undefined : [c.v],
    });
    if (c.v === "compose" && q.venue.id !== "compose") {
      row.sim = `skip (winner ${q.venue.id})`;
      rows.push(row);
      continue;
    }
    const e = await ravn("/execute", { quoteToken: q.quoteToken });
    row.type = e.executionType;
    if (e.executionType === "TRANSACTION" && e.transaction?.to) {
      const spender = e.approval?.spender ?? e.transaction.to;
      row.sim = await simulate({ tx: e.transaction, spender, inTok: c.inTok, amt: c.amt });
      row.userInCalldata = e.transaction.data.toLowerCase().includes(USER.slice(2).toLowerCase()) ? "yes" : "no";
      row.spenderIsTo = (e.approval?.spender ?? e.transaction.to).toLowerCase() === e.transaction.to.toLowerCase() ? "yes" : "no";
    } else if (e.executionType === "DEPOSIT") {
      row.sim = `deposit ${e.deposit.chainId === BASE ? "on Base" : `chain ${e.deposit.chainId}`} amount==input:${e.deposit.amount === c.amt}`;
    } else {
      row.sim = "not relayable";
    }
  } catch (err) {
    row.sim = `no route: ${err.message}`.slice(0, 120);
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}
console.log(`\nsender=${senderMode} (${sender})`);
console.table(rows);
