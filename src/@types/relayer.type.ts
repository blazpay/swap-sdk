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
    quote?: any,
    // The build's metaData. Deposit-address providers (Houdini, StealthEX)
    // set isDirectTransfer: their tx must be sent from the user's wallet.
    metaData?: { isDirectTransfer?: boolean }
}

export interface ITokenAndWalletInfo {
    userAddress: string,
    decimals: number,
    chainId: number
}

export interface IRelayerRawTxData extends IRelayerTxData, ITokenAndWalletInfo {}