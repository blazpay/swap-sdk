import { BigNumber, ethers } from "ethers";
import { IRelayerRawTxData, IRelayerTxData } from "./@types/relayer.type.js";
export declare class RelayerFactory {
    private provider;
    constructor(_provider?: ethers.providers.Web3Provider);
    triggerContract(relayerTxData: IRelayerTxData): Promise<any>;
    getMetaTransactionByteData(relayerTxData: IRelayerRawTxData): {
        approvalData: string | undefined;
        executeData: string;
        value: BigNumber;
        to: string;
    };
}
export default RelayerFactory;
