export declare enum ChainName {
    MAINNET = "ethereum",
    BSC = "bsc",
    ARBITRUM = "arbitrum",
    MATIC = "polygon",
    OPTIMISM = "optimism",
    AVAX = "avalanche",
    BASE = "base",
    CRONOS = "cronos",
    ZKSYNC = "zksync",
    FANTOM = "fantom",
    LINEA = "linea",
    POLYGONZKEVM = "polygon-zkevm",
    AURORA = "aurora",
    BTTC = "bittorrent",
    SCROLL = "scroll"
}
export declare enum ChainId {
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
    SCROLL = 534352
}
export declare enum ChainContractAddress {
    MAINNET = "0xd3f64BAa732061F8B3626ee44bab354f854877AC",
    BSC = "0x880E0cE34F48c0cbC68BF3E745F17175BA8c650e",
    MATIC = "0x07d0ac7671D4242858D0cebcd34ec03907685947",
    AVAX = "0x1C7F7e0258c81CF41bcEa31ea4bB5191914Bf7D7",
    ARBITRUM = "0x1C7F7e0258c81CF41bcEa31ea4bB5191914Bf7D7",
    OPTIMISM = "0xad1D43efCF92133A9a0f33e5936F5ca10f2b012E",
    BASE = "0x4F68248ecB782647D1E5981a181bBe1bfFee1040",
    FANTOM = "0xBE2A77399Cde40EfbBc4e89207332c4a4079c83D"
}
export declare enum ChainIdUnizen {
    MAINNET = 1,
    BSC = 56,
    MATIC = 137,
    AVAX = 43114,
    ARBITRUM = 42161,
    OPTIMISM = 10,
    BASE = 8453,
    FANTOM = 250
}
export declare function getChainNameById(chainId: ChainId): ChainName | undefined;
export declare function getContractAddressByChainId(chainIdUnizen: ChainIdUnizen): string | undefined;
export declare const addressZero = "0x0000000000000000000000000000000000000000";
export declare const addressE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
