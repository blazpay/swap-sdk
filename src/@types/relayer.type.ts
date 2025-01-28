export interface IRelayerTxData {
    tx: {
        data: string,
        to: string,
        value: string,
        from?: string,
    },
    spender: string
    amount: number,
    token: string,
    isNative: boolean,
    quote?: any
}

export interface ITokenAndWalletInfo {
    userAddress: string,
    decimals: number,
    chainId: number
}

export interface IRelayerRawTxData extends IRelayerTxData, ITokenAndWalletInfo {}