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

// export const relayerAddresses = (chain: number):string => {
//   if(chain == 137) 
//     return '0xdDdd393a0cC91368b5E61b4714E72259F4E061eA'
//   else return '0x10c112A6032dC97ec8854457FA3961D29dB2045A'
// }
export const relayerAddresses = (chain: number): string => {
  if (chain === 137) return '0xa851D4125cC029743F371eaD4F9DdE4BA04F5146';
  if ([42161, 534352, 56, 59144].includes(chain)) return '0x5c23c9a42626Ade38ae1c9a3407096d4381EE6E6';
  return '0xb8Bd470f3C2610F83025D049085A64f1C7b78F14';
}

export const relayerJson = relayerAbi

export const baseUrl = `http://localhost:5000/api/defi`;
// export const baseUrl = `https://api.blazpay.com/api/defi`;

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