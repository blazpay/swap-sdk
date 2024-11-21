export interface IRelayerTxData {
    tx: {
        data: string;
        to: string;
        value: string;
        from?: string;
    };
    spender: string;
    amount: number;
    token: string;
    isNative: boolean;
}
