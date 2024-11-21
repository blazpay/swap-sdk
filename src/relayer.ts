import { BigNumber, ethers } from "ethers";
import { addressE, addressZero, MESSAGE_TYPES, relayerAddresses } from "./utils/constants.js";
import {relayerAbi} from "./utils/jsons/relayerAbi.js"
import { IRelayerTxData } from "./@types/relayer.type.js"; 

export class RelayerFactory {
  private provider: ethers.providers.Web3Provider
  
  constructor(_provider: ethers.providers.Web3Provider) {
    this.provider = _provider;
  }

  async triggerContract(relayerTxData: IRelayerTxData) {
    const signer = this.provider.getSigner()
    const chainId = await signer.getChainId();
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses[chainId]
    const relayerContract = new ethers.Contract(
      relayerAddress,
      relayerAbi,
      signer
    );

    const metaTransaction = {
      user: address,
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
    };

    const tx = await relayerContract.executeMetaTransactionSwap(
      {
        ...metaTransaction,
        // signature: signature,
        spender: relayerTxData?.spender || addressZero,
        amount: relayerTxData?.amount,
        token: relayerTxData?.token,
        isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE)
      },
      { value: relayerTxData?.tx?.value, gasLimit: 1000000 }
    );

    // // Wait for the transaction to be mined
    const receipt = await tx.wait();
    return receipt;
  }
}

export default RelayerFactory;
