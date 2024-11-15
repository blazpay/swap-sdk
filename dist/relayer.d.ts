import { ethers } from "ethers";
import { IRelayerTxData } from "./@types/relayer.type.js";
export declare class RelayerFactory {
    private provider;
    constructor(_provider: ethers.providers.Web3Provider);
    triggerContract(relayerTxData: IRelayerTxData): Promise<any>;
}
export default RelayerFactory;
