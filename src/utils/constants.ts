import { relayerAbi } from "./jsons/relayerAbi.js";

export enum ChainName {
  MAINNET = `ethereum`,
  BSC = `bsc`,
  ARBITRUM = `arbitrum`,
  MATIC = `polygon`,
  OPTIMISM = `optimism`,
  AVAX = `avalanche`,
  BASE = `base`,
  CRONOS = `cronos`,
  ZKSYNC = `zksync`,
  FANTOM = `fantom`,
  LINEA = `linea`,
  POLYGONZKEVM = `polygon-zkevm`,
  AURORA = `aurora`,
  BTTC = `bittorrent`,
  SCROLL = `scroll`,
  // Newly seeded — awaiting relayer deploy
  MANTLE = `mantle`,
  BLAST = `blast`,
  MODE = `mode`,
  SONIC = `sonic`,
  BERACHAIN = `berachain`,
  UNICHAIN = `unichain`,
  CELO = `celo`,
  GNOSIS = `gnosis`,
  SEI = `sei`,
  SONEIUM = `soneium`,
  OPBNB = `opbnb`,
  METIS = `metis`,
  WORLDCHAIN = `worldchain`,
  HYPEREVM = `hyperevm`,
  APECHAIN = `apechain`,
  TAIKO = `taiko`,
  RONIN = `ronin`,
  MOONBEAM = `moonbeam`,
  ABSTRACT = `abstract`,
  ETHERLINK = `etherlink`,
  // Destination-only bridge target — no BlazpayRelayer deployed (bridge INTO only).
  ROBINHOOD = `robinhood`,
}
export enum ChainId {
  MAINNET = 1,
  BSC = 56,
  ARBITRUM = 42161,
  MATIC = 137,
  OPTIMISM = 10,
  AVAX = 43114,
  BASE = 8453,
  CRONOS = 25,
  ZKSYNC = 324,
  FANTOM = 250,
  LINEA = 59144,
  POLYGONZKEVM = 1101,
  AURORA = 1313161554,
  BTTC = 199,
  ZKEVM = 1101,
  SCROLL = 534352,
  // Newly seeded — awaiting relayer deploy
  MANTLE = 5000,
  BLAST = 81457,
  MODE = 34443,
  SONIC = 146,
  BERACHAIN = 80094,
  UNICHAIN = 130,
  CELO = 42220,
  GNOSIS = 100,
  SEI = 1329,
  SONEIUM = 1868,
  OPBNB = 204,
  METIS = 1088,
  WORLDCHAIN = 480,
  HYPEREVM = 999,
  APECHAIN = 33139,
  TAIKO = 167000,
  RONIN = 2020,
  MOONBEAM = 1284,
  ABSTRACT = 2741,
  ETHERLINK = 42793,
  // Destination-only bridge target — no BlazpayRelayer deployed (bridge INTO only).
  ROBINHOOD = 4663,
}
export enum ChainContractAddress {
  MAINNET = "0xd3f64BAa732061F8B3626ee44bab354f854877AC",
  BSC = "0x880E0cE34F48c0cbC68BF3E745F17175BA8c650e",
  MATIC = "0x07d0ac7671D4242858D0cebcd34ec03907685947",
  AVAX = "0x1C7F7e0258c81CF41bcEa31ea4bB5191914Bf7D7",
  ARBITRUM = "0x1C7F7e0258c81CF41bcEa31ea4bB5191914Bf7D7",
  OPTIMISM = "0xad1D43efCF92133A9a0f33e5936F5ca10f2b012E",
  BASE = "0x4F68248ecB782647D1E5981a181bBe1bfFee1040",
  FANTOM = "0xBE2A77399Cde40EfbBc4e89207332c4a4079c83D",
}

export enum ChainIdUnizen {
  MAINNET = 1,
  BSC = 56,
  MATIC = 137,
  AVAX = 43114,
  ARBITRUM = 42161,
  OPTIMISM = 10,
  BASE = 8453,
  FANTOM = 250,
}
export function getChainNameById(chainId: ChainId): ChainName | undefined {
  const chainMapping: { [key in ChainId]: ChainName } = {
    [ChainId.MAINNET]: ChainName.MAINNET,
    [ChainId.BSC]: ChainName.BSC,
    [ChainId.ARBITRUM]: ChainName.ARBITRUM,
    [ChainId.MATIC]: ChainName.MATIC,
    [ChainId.OPTIMISM]: ChainName.OPTIMISM,
    [ChainId.AVAX]: ChainName.AVAX,
    [ChainId.BASE]: ChainName.BASE,
    [ChainId.CRONOS]: ChainName.CRONOS,
    [ChainId.ZKSYNC]: ChainName.ZKSYNC,
    [ChainId.FANTOM]: ChainName.FANTOM,
    [ChainId.LINEA]: ChainName.LINEA,
    [ChainId.POLYGONZKEVM]: ChainName.POLYGONZKEVM,
    [ChainId.AURORA]: ChainName.AURORA,
    [ChainId.BTTC]: ChainName.BTTC,
    [ChainId.SCROLL]: ChainName.SCROLL,
    [ChainId.MANTLE]: ChainName.MANTLE,
    [ChainId.BLAST]: ChainName.BLAST,
    [ChainId.MODE]: ChainName.MODE,
    [ChainId.SONIC]: ChainName.SONIC,
    [ChainId.BERACHAIN]: ChainName.BERACHAIN,
    [ChainId.UNICHAIN]: ChainName.UNICHAIN,
    [ChainId.CELO]: ChainName.CELO,
    [ChainId.GNOSIS]: ChainName.GNOSIS,
    [ChainId.SEI]: ChainName.SEI,
    [ChainId.SONEIUM]: ChainName.SONEIUM,
    [ChainId.OPBNB]: ChainName.OPBNB,
    [ChainId.METIS]: ChainName.METIS,
    [ChainId.WORLDCHAIN]: ChainName.WORLDCHAIN,
    [ChainId.HYPEREVM]: ChainName.HYPEREVM,
    [ChainId.APECHAIN]: ChainName.APECHAIN,
    [ChainId.TAIKO]: ChainName.TAIKO,
    [ChainId.RONIN]: ChainName.RONIN,
    [ChainId.MOONBEAM]: ChainName.MOONBEAM,
    [ChainId.ABSTRACT]: ChainName.ABSTRACT,
    [ChainId.ETHERLINK]: ChainName.ETHERLINK,
    [ChainId.ROBINHOOD]: ChainName.ROBINHOOD,
  };
  return chainMapping[chainId];
}
export function getContractAddressByChainId(
  chainIdUnizen: ChainIdUnizen
): string | undefined {
  const contractAddressMapping: {
    [key in ChainIdUnizen]: ChainContractAddress;
  } = {
    [ChainIdUnizen.MAINNET]: ChainContractAddress.MAINNET,
    [ChainIdUnizen.BSC]: ChainContractAddress.BSC,
    [ChainIdUnizen.MATIC]: ChainContractAddress.MATIC,
    [ChainIdUnizen.AVAX]: ChainContractAddress.AVAX,
    [ChainIdUnizen.ARBITRUM]: ChainContractAddress.ARBITRUM,
    [ChainIdUnizen.OPTIMISM]: ChainContractAddress.OPTIMISM,
    [ChainIdUnizen.BASE]: ChainContractAddress.BASE,
    [ChainIdUnizen.FANTOM]: ChainContractAddress.FANTOM,
  };
  return contractAddressMapping[chainIdUnizen];
}
export const addressZero = "0x0000000000000000000000000000000000000000";
export const addressE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

// Explicit per-chain relayer address map. Chains NOT listed here have no
// BlazpayRelayer deployment yet. Trying to swap on an unlisted chain throws
// a clear "Relayer not deployed" error at simulate/trigger time — preventing
// the silent loss-of-funds class of bugs where the SDK falls back to an
// address that has no code.
const RELAYER_ADDRESSES: Record<number, string> = {
  // ── v2 cohort: deterministic CREATE address from TX_SIGNER (nonce 2→3). ─
  // The 12 EVM chains below all share the same proxy address. Abstract uses
  // zkSync-stack CREATE so its address differs, and Unichain landed at a
  // distinct address (its TX_SIGNER nonce had drifted before deploy).
  137: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Polygon (redeployed v2)
  146: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Sonic
  204: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // opBNB
  480: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // World Chain
  999: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // HyperEVM
  1329: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Sei
  1868: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Soneium
  2020: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Ronin
  33139: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // ApeChain
  42220: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Celo
  43111: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Hemi
  80094: '0x7d98E59FabFBaDD5eCB61CC2cf876AA97f505531', // Berachain
  130: '0xA01da2d3AbEFFbaa347B08C76EEC47169DdE72e9', // Unichain (nonce drift)
  2741: '0xb8Bd470f3C2610F83025D049085A64f1C7b78F14', // Abstract (zkSync-stack)
  // ── Existing 7 — upgraded in place to v2, proxy addresses unchanged ────
  10: '0xb8Bd470f3C2610F83025D049085A64f1C7b78F14', // Optimism
  56: '0x5c23c9a42626Ade38ae1c9a3407096d4381EE6E6', // BSC
  8453: '0xb8Bd470f3C2610F83025D049085A64f1C7b78F14', // Base
  42161: '0x5c23c9a42626Ade38ae1c9a3407096d4381EE6E6', // Arbitrum
  43114: '0xb8Bd470f3C2610F83025D049085A64f1C7b78F14', // Avalanche
  59144: '0x5c23c9a42626Ade38ae1c9a3407096d4381EE6E6', // Linea
  534352: '0x5c23c9a42626Ade38ae1c9a3407096d4381EE6E6', // Scroll
  // ── Not deployed ───────────────────────────────────────────────────────
  // 1     : Ethereum — intentionally skipped (no funds bridged, gas too high)
  // 42793 : Etherlink — intentionally skipped
};

// Whitelist of chains where the relayer is confirmed deployed and operational.
// Used by the SDK's relayer flows to fail fast when a swap is attempted on an
// unsupported chain instead of sending funds to a non-existent contract.
// All 20 cohort chains are v2, signer = 0x75a8b522FC3195e3a3570F11f111AC89c0D35975
// (TX_SIGNER), 0.1% fees enabled (inPercentFee=10). Ethereum and Etherlink are
// intentionally not deployed.
export const RELAYER_DEPLOYED_CHAINS: ReadonlySet<number> = new Set([
  10,     // Optimism
  56,     // BSC
  130,    // Unichain
  137,    // Polygon (v2 redeploy)
  146,    // Sonic
  204,    // opBNB
  480,    // World Chain
  999,    // HyperEVM
  1329,   // Sei
  1868,   // Soneium
  2020,   // Ronin
  2741,   // Abstract
  8453,   // Base
  33139,  // ApeChain
  42161,  // Arbitrum
  42220,  // Celo
  43111,  // Hemi
  43114,  // Avalanche
  59144,  // Linea
  80094,  // Berachain
  534352, // Scroll
]);

export const relayerAddresses = (chain: number): string => {
  const addr = RELAYER_ADDRESSES[chain];
  if (!addr) {
    throw new Error(
      `BlazpayRelayer not deployed on chain ${chain}. ` +
      `Deploy the contract, add its address to RELAYER_ADDRESSES in ` +
      `swap-sdk/src/utils/constants.ts, and add the chainId to ` +
      `RELAYER_DEPLOYED_CHAINS.`
    );
  }
  return addr;
};

export const isRelayerDeployed = (chain: number): boolean =>
  RELAYER_DEPLOYED_CHAINS.has(chain);

export const assertRelayerDeployed = (chain: number): void => {
  if (!isRelayerDeployed(chain)) {
    throw new Error(
      `BlazpayRelayer is not enabled on chain ${chain} yet. ` +
      `Swap blocked to prevent loss of funds — deploy the relayer and ` +
      `add the chainId to RELAYER_DEPLOYED_CHAINS in the SDK.`
    );
  }
};

export const relayerJson = relayerAbi

// Resolve the base URL at module load time. In the browser, use prod for
// any non-local host (matches defi-dex's own axios.ts pattern). In Node
// (e.g. tests, server-side use) default to prod — localhost would be wrong
// for any deployed consumer. Consumers can still override via
// `configure({ baseApiUrl: ... })` if they want.
const PROD_API_URL = 'https://api.blazpay.com/api/defi';
const LOCAL_API_URL = 'http://localhost:5000/api/defi';

function resolveBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.host) {
    const host = window.location.host;
    if (/^(localhost|127\.|192\.168\.)/.test(host)) return LOCAL_API_URL;
  }
  return PROD_API_URL;
}

export const baseUrl = resolveBaseUrl();

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) public"
];

export const routers = {
  nitro: 'https://api-beta.pathfinder.routerprotocol.com/api/v2/status',
  open_ocean: 'https://open-api.openocean.finance/cross_chain/v1/cross/getCrossStatus',
  butter_network: 'https://bs-app-api.chainservice.io/api/queryBridgeInfoBySourceHash',
  symbiosis: 'https://api.symbiosis.finance/crosschain/tx/',
  unizen: 'https://api.zcx.com/trade/v1/info/trade/',
  lifi: 'https://li.quest/v1/status',
  kima: 'https://graphql.kima.network/v1/graphql'
}

export enum ChainNameKima {
  Arbitrum = 'ARB',
  Avalache = 'AVX',
  BSC = 'BSC',
  btc = 'BTC',
  Ethereum = 'ETH',
  Pptimism = 'OPT',
  Polygon = 'POL',
  SOL = 'SOL',
  TRX = 'TRX',
}