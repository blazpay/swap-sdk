# swap-sdk

TypeScript SDK for fetching swap/bridge quotes across multiple aggregators (1inch, OpenOcean, LiFi, etc.) and preparing transaction payloads.

## Install

```bash
npm i swap-sdk
```

## Usage

```ts
import { TradeManager, configure } from "swap-sdk";

configure({
  // Required for OpenOcean aggregator calls
  openOceanApiKey: process.env.OPENOCEAN_API_KEY!,
  // Optional (only if your Unizen status endpoint requires it)
  // unizenApiKey: process.env.UNIZEN_API_KEY,
  // If you use relayer-backed aggregators in this SDK, set your API base URL here
  // baseApiUrl: "https://api.example.com/api/defi",
});

const tm = new TradeManager();

await tm.getQuotes({
  type: "SWAP",
  fromChain: { id: 1, name: "Ethereum" },
  toChain: { id: 1, name: "Ethereum" },
  fromToken: { address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", symbol: "ETH", decimals: 18 },
  toToken: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
  amount: "0.1",
  srcWalletAddress: "0x...",
  onNewQuote: (q) => console.log("quote", q),
  onLastQuote: () => console.log("done"),
});
```

## Configuration

This SDK intentionally does **not** ship with embedded API keys. Configure secrets at runtime:

- `openOceanApiKey`: required for OpenOcean swap/bridge quotes.
- `unizenApiKey`: optional; if your Unizen status endpoint requires an auth key.
- `baseApiUrl`: base URL for any backend endpoints this SDK calls (if applicable to your deployment).

## Security / Publishing notes

- Never commit real API keys (or any credentials) to git.
- Run `npm audit` and keep dependencies updated before publishing.
