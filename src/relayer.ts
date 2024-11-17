import { ethers } from "ethers";
import { MESSAGE_TYPES, relayerAddresses } from "./utils/constants.js";
import relayerAbi from "./utils/jsons/relayer.json" with { type: 'json' };
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
      nonce: 1728461413034, // This nonce should be unique for the user
    };

    const domain = {
      name: "BlazpayRelayer",
      version: "1",
      chainId: chainId,
      verifyingContract: relayerAddress,
    }

    console.log(domain, "domain")

    const signature = await signer._signTypedData(
      domain,
      {
        MetaTransaction: MESSAGE_TYPES.MetaTransaction
      },
      metaTransaction
    );
    console.log(signature, "signature")

    console.log(metaTransaction, "metaTransaction")

    const tx = await relayerContract.executeMetaTransaction(
      {
        ...metaTransaction,
        signature: signature,
      },
      { value: ethers.utils.parseEther("2"), gasLimit: 1000000 }
    );

    // // Wait for the transaction to be mined
    const receipt = await tx.wait();
    console.log("Meta-transaction executed:", receipt);
    return receipt;
  }
}

export default RelayerFactory;
