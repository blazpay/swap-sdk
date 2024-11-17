export interface IRelayerTxData {
    tx: {
        data: string;
        to: string;
        value: string;
        from?: string;
    };
    spender: string;
}
