# Blazpay Swap-SDK — Provider Integration Guide

Single-file reference for adding a new swap / bridge provider end-to-end. Read top-to-bottom once, then jump to "Adding a Provider" and follow the checklist.

---

## TL;DR

The Blazpay DeFi swap stack is **four cooperating layers**:

1. **`swap-sdk`** (this repo) — TypeScript SDK with one class per aggregator (`OneInch`, `Lifi`, `Kyber`, `Odos`, `Nordstern`, etc.). Each class implements `getQuotes` and `getTransactionData`. A `TradeManager` fans out all aggregators in parallel.
2. **`BlazpayRelayer` contract** (UUPS upgradeable) — wraps every swap. Pulls user tokens / native, optionally takes a Blazpay fee, then `.call(aggregatorRouter, data)` to execute.
3. **`bz-backend`** — runs the SDK server-side to stream quotes via SSE, caches them in Redis for 5 min, builds the tx on demand, signs the relayer meta-tx with EIP-712. Also proxies any aggregator that needs a server-only API key.
4. **`defi-dex`** — React FE. Opens an `EventSource` to `/api/defi/quotes`, sorts quotes by output amount, and runs `simulate → swap` through the SDK's `simulateTx` / `triggerTransaction`.

Adding a new provider means writing **one aggregator class** in this repo (+ optionally one backend controller if it needs API keys). No contract change.

---

## Repo layout (this repo)

```
swap-sdk/
├── src/
│   ├── index.ts                       # TradeManager + register every aggregator here
│   ├── aggregator.factory.ts          # parallel quote fanout, error swallowing
│   ├── relayer.ts                     # MetaTransaction builder + simulate/trigger via BlazpayRelayer
│   ├── @types/                        # IQuoteParams, IQuote, IRelayerTxData, IChain, IToken
│   ├── enums/aggregator.enum.ts       # AGGREGATORS enum — add your provider id here
│   ├── aggregators/
│   │   ├── base.aggregator.ts         # Base class: senderAddress, isNativeAddresss(), getGasPrice()
│   │   ├── index.ts                   # re-export every aggregator
│   │   ├── OneInch.aggregator.ts      # proxied, uses bz-backend (`/1inch`)
│   │   ├── OpenOcean.aggregator.ts    # proxied, uses configure({openOceanApiKey})
│   │   ├── Unizen.aggregator.ts       # proxied, uses configure({unizenApiKey})
│   │   ├── SquidRouter.aggregator.ts  # proxied
│   │   ├── KyberSwap.aggregator.ts    # direct (no key needed)
│   │   ├── Lifi.aggregator.ts         # direct
│   │   ├── Symbiosis.aggregator.ts    # direct
│   │   ├── Nitro.aggregator.ts        # direct
│   │   ├── IceCream.aggregator.ts     # direct
│   │   ├── ButterNetwork.aggregator.ts# direct
│   │   ├── ChangeNow.aggregator.ts    # proxied
│   │   ├── Kima.aggregator.ts         # talks to kima.blazpay.com (separate backend)
│   │   ├── Nordstern.aggregator.ts    # direct, no auth
│   │   └── Odos.aggregator.ts         # proxied (enterprise key in backend)
│   └── utils/
│       ├── axios.ts                   # apiCall helper
│       ├── config.ts                  # configure({ openOceanApiKey, unizenApiKey, baseApiUrl })
│       ├── constants.ts               # baseUrl, ChainId/Name maps, relayerAddresses(chainId), addressZero, addressE
│       ├── helper.ts
│       ├── quote.ts                   # Quote { data, meta, restProps; getTransactionData() }
│       ├── types.ts
│       └── jsons/relayerAbi.ts        # ABI of BlazpayRelayer (deployed)
```

---

## Data model

Every aggregator works with these types (`src/@types/`):

```ts
interface IQuoteParams {
  fromChain: { id: number; name: string };
  toChain:   { id: number; name: string };
  fromToken: { address: string; symbol: string; decimals: number; ... };
  toToken:   { address: string; symbol: string; decimals: number; ... };
  amount: number;             // human-readable, e.g. 0.1 (not wei)
  slippage?: number;          // percentage, e.g. 0.5 means 0.5%
  srcWalletAddress: string;   // user's wallet
  dstWalletAddress?: string;  // defaults to srcWalletAddress
  type: "SWAP" | "BRIDGE";
  excludeSwap?: AGGREGATORS[];
  excludeBridge?: AGGREGATORS[];
}

interface IQuote {                // → emitted to FE via SSE
  id: string;                     // uuid; backend stores full quote in Redis under this key for 5 min
  aggregator: string;             // matches AGGREGATORS enum
  route: string;                  // display label, e.g. "Odos", "Uniswap V3"
  amount: number;                 // human-readable output
  usdAmount: number;
  networkFee: number | string;    // display only
  platformFee: number | string;   // display only
  priceImpact: number;
  slippage: number;
  allowanceTo: string;            // router address for ERC20 approvals
}

class Quote {
  data: any;                      // raw provider response (kept for second-call build)
  meta: IQuote;                   // ↑ above, JSON-serialized to SSE
  restProps: IRestQuoteProps;     // { fromChain, toChain, srcWalletAddress, dstWalletAddress, slippageTolerance, quotePayload }
  async getTransactionData(): Promise<{ tx, spender, metaData? }>;
}

interface IRelayerTxData {
  tx:    { to: string; data: string; value: string | bigint; from?: string; gasLimit?: number };
  spender: string;                // router address, becomes MetaTransaction.recipient
  amount: number | bigint;        // input amount in wei
  token:  string;                 // input token address (0x0 / 0xeee for native)
  isNative: boolean;
}
```

---

## The flow (one quote, one swap)

```
FE                          bz-backend                        Provider              BlazpayRelayer
│                                  │                                │                       │
├── EventSource /defi/quotes ──────►│ swapService.getQuotes (SDK)    │                       │
│                                  ├── new TradeManager()           │                       │
│                                  ├── aggregator.getQuotes() ──────►│ /quote                │
│                                  │◄─── Quote                       │                       │
│   data: <IQuote meta> ◄──────────┤ redis.set(meta.id, quote, 5min)│                       │
│                                  │                                │                       │
├── select highest amount          │                                │                       │
├── GET /defi/swap/:id ───────────►│ redis.get → quote.getTransactionData()                  │
│                                  ├── aggregator.getTransactionData() ───►│ /build         │
│   { tx, spender } ◄──────────────┤◄─── { tx: {to, data, value} }   │                       │
│                                  │                                │                       │
├── tradeSdk.simulateTx(provider, relayerTxData)                    │                       │
│  ├── relayer.nonces(user)                                                                  │
│  ├── POST /defi/sign { metaTx, chainId } ◄── backend signs as TX_SIGNER                    │
│  ├── relayer.executeMetaTransactionSwap.staticCall(metaTx, sig) ──►│                       │
│  │                                                                  ├── reverts here?       │
│  │                                                                  │  see "Gotchas"        │
│                                                                                            │
├── tradeSdk.triggerTransaction(provider, relayerTxData)                                     │
│  └── signer.sendTransaction → poll receipt manually (no tx.wait, see v5/v6 note)           │
```

---

## The BlazpayRelayer contract

Deployed at chain-specific addresses (see `relayerAddresses(chainId)` in `src/utils/constants.ts`). UUPS upgradeable. The function we call:

```solidity
function executeMetaTransactionSwap(
  MetaTransaction memory _metaTx,  // { targetContract, data, amount, token, isNative, recipient, nativeValue, nonce, deadline }
  bytes memory signature
) external payable;
```

Flow inside the contract for a **native input** swap:
1. `require(block.timestamp <= deadline)`
2. `require(nonce == nonces[msg.sender])` and increment
3. `require(ECDSA.recover(metaTxHash, signature) == msg.sender)` — EIP-712 typed-data check
4. If native: `recipient.call{value: nativeValue}("")` — sends ETH to router via `receive()`
5. `targetContract.call{value: 0}(data)` — invokes the swap with `msg.value = 0`

For **ERC20 input**:
1. (same nonce / deadline / signature checks)
2. `IERC20(token).transferFrom(msg.sender, this, amount)`
3. `IERC20(token).transfer(recipient, amount - fee)`
4. `targetContract.call{value: 0}(data)`

**Key implication:** the aggregator router must handle pre-delivered tokens / ETH (most do; if a router strictly requires `msg.value == amount` for native and won't use balance-based accounting, that pair will revert at step 5).

EIP-712 domain: `{ name: "BlazpayRelayer", version: "1", chainId, verifyingContract }`.

---

## Adding a new provider — checklist

### 1. Enum

`src/enums/aggregator.enum.ts`:

```ts
export enum AGGREGATORS {
  // ...existing
  MY_PROVIDER = "my_provider",
}
```

### 2. Aggregator class

`src/aggregators/MyProvider.aggregator.ts`:

```ts
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { IQuoteParams, IRestQuoteProps } from "../@types/index.js";
import { apiCall } from "../utils/axios.js";
import { AGGREGATORS } from "../enums/aggregator.enum.js";
import Quote from "../utils/quote.js";
import Base from "./base.aggregator.js";
import { baseUrl } from "../utils/constants.js"; // only if proxied through bz-backend

const PROVIDER_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"; // OR "0x0...0" — check provider docs

export default class MyProviderAggregator extends Base {
  name: string;
  BASE_URL: string;

  constructor() {
    super();
    this.name = AGGREGATORS.MY_PROVIDER;
    // Direct provider: this.BASE_URL = "https://api.provider.com";
    // Proxied:        this.BASE_URL = baseUrl + "/my-provider";
    this.BASE_URL = "https://api.provider.com";
  }

  private resolveTokenAddress(address: string): string {
    return this.isNativeAddresss(address) ? PROVIDER_NATIVE : address;
  }

  async getQuotes(params: IQuoteParams): Promise<Quote> {
    if (params.fromChain.id !== params.toChain.id) {
      throw new Error("MyProvider supports single-chain swaps only"); // remove if it supports bridging
    }

    const query = {
      // map IQuoteParams → provider's expected query
      src: this.resolveTokenAddress(params.fromToken.address),
      dst: this.resolveTokenAddress(params.toToken.address),
      amount: ethers
        .parseUnits(String(params.amount), params.fromToken.decimals)
        .toString(),
      from: params.srcWalletAddress,
      slippage: params.slippage ?? 0.5,
    };

    const data = await apiCall({
      method: "GET",                                  // POST if provider needs body
      url: `${this.BASE_URL}/quote/${params.fromChain.id}`,
      params: query,
    });

    // GUARD against empty / no-route responses — otherwise zero-output quotes
    // pollute the SSE stream and the FE picks one as "best".
    if (!data?.tx?.to || !data?.toAmount || data.toAmount === "0") {
      throw new Error("MyProvider: no route found");
    }

    const swapAmount = ethers.formatUnits(data.toAmount, params.toToken.decimals);

    const meta = {
      id: uuidv4(),
      aggregator: AGGREGATORS.MY_PROVIDER,
      route: "MyProvider",
      amount: Number(Number(swapAmount).toFixed(4)),
      usdAmount: Number(data.outValueUsd ?? 0),
      networkFee: Number(data.gasFeeUsd ?? 0).toFixed(6),
      platformFee: 0,
      priceImpact: 0,
      slippage: params.slippage ?? 0.5,
      allowanceTo: data.tx.to,
    };

    return new Quote(data, meta, {
      fromChain: { id: params.fromChain.id, name: params.fromChain.name.toLowerCase() },
      toChain:   { id: params.toChain.id,   name: params.toChain.name.toLowerCase() },
      slippageTolerance: params.slippage ?? 0.5,
      srcWalletAddress: params.srcWalletAddress,
      dstWalletAddress: params.dstWalletAddress,
      quotePayload: query,    // keep what you sent — needed at build time if you have to re-quote
    });
  }

  async getTransactionData(
    data: any,                  // the raw response we stashed in Quote.data
    restProps: IRestQuoteProps  // chains, wallets, slippage, original quotePayload
  ): Promise<{ tx: any; spender: string }> {

    // Case A — provider's quote already contains tx.{to,data,value}:
    //   just re-fetch (quote may have expired) and return its tx.
    // Case B — provider needs a second "build" call:
    //   POST {pathId / routeSummary / quoteId} to /build → tx.

    // Case A example:
    const fresh = await apiCall({
      method: "GET",
      url: `${this.BASE_URL}/quote/${restProps.fromChain.id}`,
      params: restProps.quotePayload,
    });

    if (!fresh?.tx?.to || !fresh?.tx?.data) {
      throw new Error("MyProvider: failed to (re)build transaction");
    }

    return {
      tx: {
        to:    fresh.tx.to,
        data:  fresh.tx.data,
        value: fresh.tx.value ?? "0",
        from:  restProps.srcWalletAddress,
      },
      spender: fresh.tx.to,    // typically the router address
    };
  }

  // Optional but recommended for cross-chain providers:
  // async getTxStatus(chainId: number, hash: string): Promise<{ status, hash }> { ... }
}
```

### 3. Export and register

`src/aggregators/index.ts`:
```ts
export { default as MyProviderAggregator } from './MyProvider.aggregator.js';
```

`src/index.ts` — in the `TradeManager` constructor:
```ts
this.aggregatorFactory.register(AGGREGATORS.MY_PROVIDER, new MyProviderAggregator());
```

### 4. (Conditional) backend proxy

**Only** add a backend proxy when the provider needs:
- A server-side API key, or
- A referrer / partner identifier you don't want shipped in client JS, or
- IP-based rate limits that the SDK in the FE would trip

Skip the proxy if the provider's public endpoint works directly from the browser.

If a proxy is needed:

`bz-backend/controllers/defi/myProvider.js`:
```js
import axios from 'axios';

const URL = 'https://api.provider.com';
const headers = () => ({
  'x-api-key': process.env.MY_PROVIDER_API_KEY,
  'Content-Type': 'application/json',
});

export const myProviderQuote = async (req, res) => {
  try {
    const { data } = await axios.post(`${URL}/quote`, req.body, { headers: headers() });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error?.response?.status || 500).json({
      error: error?.response?.data || error.message,
    });
  }
};
```

`bz-backend/routes/defi.routes.js`:
```js
import { myProviderQuote } from '../controllers/defi/myProvider.js';
router.post('/my-provider/quote', myProviderQuote);
```

And in your aggregator class, set `this.BASE_URL = baseUrl + "/my-provider"` (where `baseUrl` is imported from `src/utils/constants.ts`).

### 5. (Conditional) default-include in the SSE stream

`bz-backend/services/swap.service.js` has `excludeSwap` / `excludeBridge` defaults. Don't add your new provider unless you want it OFF by default. Default behavior is **included**.

### 6. Build, version bump, ship

```bash
# In swap-sdk
npm run build
# bump version in package.json (e.g. 1.5.7)
git add -A
git commit -m "vX.Y.Z: add MyProvider aggregator"
git tag -a vX.Y.Z -m "vX.Y.Z — MyProvider"
git push origin <branch>
git push origin vX.Y.Z

# In bz-backend AND defi-dex package.json: bump the pin
"swap-sdk": "github:blazpay/swap-sdk#vX.Y.Z"

# Reinstall (Vite git-dep cache busts here)
cd bz-backend && rm -rf node_modules/swap-sdk && npm install swap-sdk --legacy-peer-deps
cd defi-dex && rm -rf node_modules/swap-sdk node_modules/.vite && npm install swap-sdk --legacy-peer-deps
# Restart bz-backend node process
# Restart Vite dev server (so it re-optimizes deps)
```

---

## Worked example: Nordstern (direct, no auth)

`Nordstern.aggregator.ts`:
- BASE_URL = `https://api.nordstern.finance`
- Single endpoint: `GET /aggregator/:chainId?src&dst&amount&from&slippage`
- Native = `0xEee…EeE`
- Response: `{ tx: {to, data, value}, toAmount, swaps[] }`
- No build endpoint — quote response already has tx. `getTransactionData` re-quotes for freshness.
- No backend proxy needed (no key).

Total integration: 1 file added (~100 lines), 3 lines added to enum/index/factory. Done.

## Worked example: Odos (proxied, two-step quote→assemble)

`Odos.aggregator.ts` + `bz-backend/controllers/defi/odos.js`:
- Two endpoints: `POST /sor/quote/v3` → returns `pathId`. `POST /sor/assemble` → returns `transaction.{to, data, value}`.
- Native = `0x0…0`.
- Requires `x-api-key` for enterprise → backend proxy holds the key.
- SDK calls `baseUrl + "/odos/quote"` and `/odos/assemble` (the proxy).
- `pathId` expires after 60s — in `getTransactionData` we **re-quote** first to get a fresh pathId, then assemble. The Redis-cached 5-min `Quote` ensures the FE can pick a quote any time, but the pathId is always refreshed before assembling.

## Worked example: KyberSwap (direct, two-step routes→build)

- Single-chain only; throws on cross-chain.
- `GET /:chainName/api/v1/routes` returns `data.routeSummary` and `data.routerAddress`.
- `POST /:chainName/api/v1/route/build` with the exact `routeSummary` returns `data.{data, routerAddress, transactionValue, amountIn}`.
- Slippage in **bps**, clamped [0, 2000].
- For native input: `value = transactionValue ?? amountIn`. For ERC20: `value = "0"`.

---

## Gotchas — read before integrating

### Ethers v5 / v6 boundary (defi-dex FE still uses v5)

The SDK is on **ethers v6**. The FE injects an **ethers v5** `Web3Provider`. Anything that crosses that boundary needs normalization. The SDK's `relayer.ts` already handles this — don't undo it.

Symptoms of forgetting:
- `Do not know how to serialize a BigInt` — JSON.stringify(bigint) in axios body. Convert to string for the wire.
- `INVALID_ARGUMENT: value={ type: "BigNumber" }` — ethers v6 contract call got a v5 BigNumber. Run inputs through `toBigIntWei` in `relayer.ts`.
- `Cannot mix BigInt and other types` — `BigNumber * 3n`. v5 runner returned a BigNumber from `estimateGas`; normalize via `toBigIntWei`.
- `receipt.confirmations is not a function` — v6's `tx.wait()` listener crashes on v5 receipt shape. The SDK polls receipts manually instead of using `tx.wait()`.

If you write a new aggregator, you don't have to worry about this — these traps live in `relayer.ts`. Just don't pass raw FE-provided numerics into ethers v6 calls without normalizing.

### Vite optimized-deps cache

When you bump the SDK pin and `npm install` in defi-dex, Vite's dependency optimizer may still serve the **previous** bundle from `node_modules/.vite/deps/`. Always delete that directory before restarting `npm run dev`:

```bash
rm -rf defi-dex/node_modules/.vite
```

Or run `vite --force`.

### Quote freshness vs Redis TTL

Backend caches each quote in Redis for **5 minutes** keyed by `Quote.meta.id`. But many providers (Odos, 1inch, Squid) expire their quote ids in **under a minute**.

Rule: if your provider has a short quote lifetime, **re-quote inside `getTransactionData`** using `restProps.quotePayload` to obtain a fresh route, then build/assemble. Don't reuse the original quote id.

### Native token addresses

Three sentinels are used across the codebase. `Base.isNativeAddresss()` recognizes:
- `0x0000000000000000000000000000000000000000`
- `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
- `0x0000000000000000000000000000000000001010` (Matic legacy)
- `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` (EIP-55-mixed)

Always convert through `this.resolveTokenAddress()` (or your own equivalent) to the **provider's** preferred native sentinel before sending.

### Relayer signature shape

The contract requires `ECDSA.recover(metaTxHash, signature) == msg.sender`. The backend signs with `process.env.TX_SIGNER` (or `POL_TX_SIGNER` on chain 137). For the relayer call to succeed, the signer key must derive to the user's address — i.e. user wallets are Blazpay-managed accounts whose private key the backend holds. **If you're using an external wallet for `msg.sender`, the simulate will revert with "Invalid signature".**

### Fees

`feeAmount` (flat native) and `inPercentFee` (bps × 100, i.e. `100 = 1%`) live on the relayer contract. `enableFees` is the global toggle. On most chains they're currently zero. If you enable fees, native swaps must send `msg.value = nativeValue + fee` (the SDK already computes this in `relayer.ts`).

### SSE stream errors

`EventSource.onerror` fires on **every** SSE close, including the normal `res.end()` after all aggregators have responded. The console error `EventSource ... failed` is benign noise from the quote-stream finishing — not a failure.

### Aggregator failures are swallowed

`AggregatorFactory.getQuotes` wraps each provider in try/catch and logs `Error from <ProviderName>: ...`. A single broken provider can't kill the stream. Use that log to debug provider-specific issues; it's the most direct signal.

---

## Cross-version files (don't break)

When changing `relayer.ts`, keep these working:

1. **`toBigIntWei(value)`** — accepts bigint, number, decimal/hex string, v5 BigNumber instance (`_hex` / `toHexString`), v5 BigNumber JSON form (`{type, hex}`). Used everywhere a foreign numeric crosses into bigint arithmetic.
2. **`simulateTransaction` / `triggerContract`** — must call `toBigIntWei` on every return from a `relayerContract.*()` call (nonce, feeAmount, inPercentFee, estimateGas) before arithmetic.
3. **`triggerContract`** — uses a manual `waitForReceipt` poll instead of `tx.wait()`. Do not switch back to `tx.wait()` while the FE is still on ethers v5.

---

## File map cheat-sheet

| What | Where |
|---|---|
| Register a new aggregator | `src/index.ts` TradeManager constructor |
| Aggregator id enum | `src/enums/aggregator.enum.ts` |
| Per-provider class | `src/aggregators/<Name>.aggregator.ts` |
| Aggregator re-export | `src/aggregators/index.ts` |
| Relayer addresses + chain maps | `src/utils/constants.ts` |
| Relayer ABI | `src/utils/jsons/relayerAbi.ts` |
| EIP-712 / nonce / estimateGas logic | `src/relayer.ts` |
| Quote wrapper (data + meta + restProps) | `src/utils/quote.ts` |
| Runtime config (API keys, base URL) | `src/utils/config.ts` |
| Backend SSE entrypoint | `bz-backend/controllers/defi/swap.js` |
| Backend cache + provider exclude list | `bz-backend/services/swap.service.js` |
| Backend EIP-712 signer | `bz-backend/controllers/defi/transaction.controller.js → signTx` |
| Backend routes | `bz-backend/routes/defi.routes.js` |
| FE swap page | `defi-dex/src/pages/defi/swap.tsx` |
| FE TradeManager wrapper | `defi-dex/src/utils/trade.ts` |
| FE history API | `defi-dex/src/apis/defi.api.ts` |

---

## Going live on a new chain (relayer deployment)

The SDK refuses to simulate or send any swap on a chain whose `chainId` is
not in `RELAYER_DEPLOYED_CHAINS` (`swap-sdk/src/utils/constants.ts`). This
prevents the silent loss-of-funds class of bugs where the SDK would fall
back to an address with no code.

When you deploy the `BlazpayRelayer` on a new chain:

1. **Deploy** the contract (use `finalContracts/deployed/BlazpayRelayer.deployed.sol`).
   Initialize with `signer = <the wallet whose private key is in your bz-backend `TX_SIGNER` env var>`.
2. **Add the deployed address to `RELAYER_ADDRESSES`** in `swap-sdk/src/utils/constants.ts`:
   ```ts
   const RELAYER_ADDRESSES = {
     ...
     <chainId>: '0x<deployed address>',
   };
   ```
3. **Add the chainId to `RELAYER_DEPLOYED_CHAINS`** in the same file.
4. **Bump version, commit, tag, push** the swap-sdk.
5. **Update consumer pins** in `bz-backend` and `defi-dex` to the new SDK
   version; `rm -rf node_modules/swap-sdk` and `node_modules/.vite` then
   `npm install`.
6. **Restart bz-backend.**
7. **Flip the chain visible** in the DB:
   ```
   cd bz-backend && node --env-file=.env scripts/enableChain.js <chainId>
   ```

The script prints the same checklist as a reminder when you run it.

Token catalog and Network records for the 13 awaiting-deploy chains are
already seeded by `bz-backend/scripts/seedChainsTokens.js` — they just
have `show: false` until step 7.

---

## Adding a provider — minimal-friction recipe

1. Skim the provider's docs. Decide: SWAP-only or also BRIDGE? Quote-and-tx in one call or two? Native sentinel?
2. Copy `src/aggregators/Nordstern.aggregator.ts` (simple) or `src/aggregators/Odos.aggregator.ts` (two-step + proxy) as a template.
3. Map the provider's request/response into `IQuoteParams` / `Quote` / `{tx, spender}`.
4. Add to enum, index, and `TradeManager`.
5. `npm run build`, smoke-test with `curl` against the provider's live endpoint to confirm your request shape works.
6. (If proxy needed) add controller + route + env var in `bz-backend`.
7. Bump version, tag, push, update both consumer pins, reinstall, restart.

Expect ~30–60 minutes per provider if their API is well-documented.
