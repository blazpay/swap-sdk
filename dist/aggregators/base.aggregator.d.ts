import { providers } from "ethers";
import { ethers } from "ethers";
export default class Base {
    senderAddress: string | null;
    tronWeb: any;
    senderTronNitro?: string | null;
    tronFeeLimit: number;
    constructor();
    setAllowance(tokenAddress: string, approvalAddress: string, provider: any, chainId: number, amount: ethers.BigNumber | undefined, router: string): Promise<void>;
    triggerContract(chainId: number, provider: providers.Web3Provider, txn: any): Promise<{
        walletAddress: any;
        hash: any;
        tx?: undefined;
    } | {
        walletAddress: string;
        tx: providers.TransactionResponse;
        hash?: undefined;
    }>;
    getGasPrice(chainId: number): Promise<any>;
    init(): Promise<void>;
}
