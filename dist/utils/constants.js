export var ChainName;
(function (ChainName) {
    ChainName["MAINNET"] = "ethereum";
    ChainName["BSC"] = "bsc";
    ChainName["ARBITRUM"] = "arbitrum";
    ChainName["MATIC"] = "polygon";
    ChainName["OPTIMISM"] = "optimism";
    ChainName["AVAX"] = "avalanche";
    ChainName["BASE"] = "base";
    ChainName["CRONOS"] = "cronos";
    ChainName["ZKSYNC"] = "zksync";
    ChainName["FANTOM"] = "fantom";
    ChainName["LINEA"] = "linea";
    ChainName["POLYGONZKEVM"] = "polygon-zkevm";
    ChainName["AURORA"] = "aurora";
    ChainName["BTTC"] = "bittorrent";
    ChainName["SCROLL"] = "scroll";
})(ChainName || (ChainName = {}));
export var ChainId;
(function (ChainId) {
    ChainId[ChainId["MAINNET"] = 1] = "MAINNET";
    ChainId[ChainId["BSC"] = 56] = "BSC";
    ChainId[ChainId["ARBITRUM"] = 42161] = "ARBITRUM";
    ChainId[ChainId["MATIC"] = 137] = "MATIC";
    ChainId[ChainId["OPTIMISM"] = 10] = "OPTIMISM";
    ChainId[ChainId["AVAX"] = 43114] = "AVAX";
    ChainId[ChainId["BASE"] = 8453] = "BASE";
    ChainId[ChainId["CRONOS"] = 25] = "CRONOS";
    ChainId[ChainId["ZKSYNC"] = 324] = "ZKSYNC";
    ChainId[ChainId["FANTOM"] = 250] = "FANTOM";
    ChainId[ChainId["LINEA"] = 59144] = "LINEA";
    ChainId[ChainId["POLYGONZKEVM"] = 1101] = "POLYGONZKEVM";
    ChainId[ChainId["AURORA"] = 1313161554] = "AURORA";
    ChainId[ChainId["BTTC"] = 199] = "BTTC";
    ChainId[ChainId["ZKEVM"] = 1101] = "ZKEVM";
    ChainId[ChainId["SCROLL"] = 534352] = "SCROLL";
})(ChainId || (ChainId = {}));
export var ChainContractAddress;
(function (ChainContractAddress) {
    ChainContractAddress["MAINNET"] = "0xd3f64BAa732061F8B3626ee44bab354f854877AC";
    ChainContractAddress["BSC"] = "0x880E0cE34F48c0cbC68BF3E745F17175BA8c650e";
    ChainContractAddress["MATIC"] = "0x07d0ac7671D4242858D0cebcd34ec03907685947";
    ChainContractAddress["AVAX"] = "0x1C7F7e0258c81CF41bcEa31ea4bB5191914Bf7D7";
    ChainContractAddress["ARBITRUM"] = "0x1C7F7e0258c81CF41bcEa31ea4bB5191914Bf7D7";
    ChainContractAddress["OPTIMISM"] = "0xad1D43efCF92133A9a0f33e5936F5ca10f2b012E";
    ChainContractAddress["BASE"] = "0x4F68248ecB782647D1E5981a181bBe1bfFee1040";
    ChainContractAddress["FANTOM"] = "0xBE2A77399Cde40EfbBc4e89207332c4a4079c83D";
})(ChainContractAddress || (ChainContractAddress = {}));
export var ChainIdUnizen;
(function (ChainIdUnizen) {
    ChainIdUnizen[ChainIdUnizen["MAINNET"] = 1] = "MAINNET";
    ChainIdUnizen[ChainIdUnizen["BSC"] = 56] = "BSC";
    ChainIdUnizen[ChainIdUnizen["MATIC"] = 137] = "MATIC";
    ChainIdUnizen[ChainIdUnizen["AVAX"] = 43114] = "AVAX";
    ChainIdUnizen[ChainIdUnizen["ARBITRUM"] = 42161] = "ARBITRUM";
    ChainIdUnizen[ChainIdUnizen["OPTIMISM"] = 10] = "OPTIMISM";
    ChainIdUnizen[ChainIdUnizen["BASE"] = 8453] = "BASE";
    ChainIdUnizen[ChainIdUnizen["FANTOM"] = 250] = "FANTOM";
})(ChainIdUnizen || (ChainIdUnizen = {}));
export function getChainNameById(chainId) {
    const chainMapping = {
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
export function getContractAddressByChainId(chainIdUnizen) {
    const contractAddressMapping = {
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
//# sourceMappingURL=constants.js.map