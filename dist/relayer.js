import { ethers } from "ethers";
import { addressE, addressZero, relayerAddresses } from "./utils/constants.js";
import { relayerAbi } from "./utils/jsons/relayerAbi.js";
export class RelayerFactory {
    provider;
    constructor(_provider) {
        this.provider = _provider;
    }
    async triggerContract(relayerTxData) {
        const signer = this.provider.getSigner();
        const chainId = await signer.getChainId();
        const address = await signer.getAddress();
        const relayerAddress = relayerAddresses[chainId];
        const relayerContract = new ethers.Contract(relayerAddress, relayerAbi, signer);
        const metaTransaction = {
            user: address,
            targetContract: relayerTxData?.tx?.to,
            data: relayerTxData?.tx?.data,
        };
        const tx = await relayerContract.executeMetaTransactionSwap({
            ...metaTransaction,
            // signature: signature,
            spender: relayerTxData?.spender || addressZero,
            amount: relayerTxData?.amount,
            token: relayerTxData?.token,
            isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE)
        }, { value: relayerTxData?.tx?.value, gasLimit: 1000000 });
        // // Wait for the transaction to be mined
        const receipt = await tx.wait();
        return receipt;
    }
}
export default RelayerFactory;
//# sourceMappingURL=relayer.js.map