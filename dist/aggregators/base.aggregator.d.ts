export default class Base {
    senderAddress: string | null;
    senderTronNitro?: string | null;
    tronFeeLimit: number;
    constructor();
    setSenderAddress(address: string): Promise<void>;
    getGasPrice(chainId: number): Promise<any>;
    init(): Promise<void>;
}
