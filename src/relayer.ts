import { BigNumber, ethers } from "ethers";
import { addressE, addressZero, baseUrl, ERC20_ABI, relayerAddresses } from "./utils/constants.js";
import { relayerAbi } from "./utils/jsons/relayerAbi.js"
import { IRelayerRawTxData, IRelayerTxData } from "./@types/relayer.type.js";
import { getErrorMessage } from "./utils/helper.js";
import { apiCall } from "./utils/axios.js";

export class RelayerFactory {
  private provider: ethers.providers.Web3Provider

  constructor(_provider?: ethers.providers.Web3Provider) {
    this.provider = _provider!;
  }

  async sortQuotes(relayerTxs: IRelayerTxData[]) {
    const signer = this.provider.getSigner()
    const chainId = await signer.getChainId();
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses(chainId)
    const relayerContract = new ethers.Contract(
      relayerAddress,
      relayerAbi,
      signer
    );

    let newQuotes: any[] = []
    await Promise.all(relayerTxs.map(async (relayerTxData: IRelayerTxData) => {
      try {
        const metaTransaction = {
          user: address,
          targetContract: relayerTxData?.tx?.to,
          data: relayerTxData?.tx?.data,
          spender: relayerTxData?.spender || addressZero,
          amount: relayerTxData?.amount,
          token: relayerTxData?.token,
          isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
        };
        const feeAmount = await relayerContract.feeAmount();
        const inPercentFee = await relayerContract.inPercentFee();
        const enableFees = await relayerContract.enableFees();

        const value = ethers.utils.parseEther((Number(relayerTxData?.tx?.value || 0) / Math.pow(10, 18))?.toString());

        let fee = 0;
        if (metaTransaction.isNative === true)
          fee = feeAmount.add(
            inPercentFee.mul(value).div(BigNumber.from(10000))
          );

        await relayerContract.estimateGas.executeMetaTransactionSwap(
          {
            ...metaTransaction,
            nativeValue: value
          },
          { value: !enableFees ? value : value.add(fee) }
        );
        newQuotes.push(relayerTxData.quote)
      } catch (error) {
        console.log("error with quote")
      }
    }))
    return newQuotes
  }

  async simulateTransaction(relayerTxData: IRelayerTxData) {
    const signer = this.provider.getSigner()
    const chainId = await signer.getChainId();
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses(chainId)
    const relayerContract = new ethers.Contract(
      relayerAddress,
      relayerAbi,
      signer
    );

    const nonce = await relayerContract.nonces(address)

    const metaTransaction = {
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
      recipient: relayerTxData?.spender || addressZero,
      amount: relayerTxData?.amount,
      token: relayerTxData?.token,
      isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
      nonce: nonce,
      deadline: Math.round(new Date().getTime() / 1000 + 100)
    };

    const feeAmount = await relayerContract.feeAmount();
    const inPercentFee = await relayerContract.inPercentFee();
    const enableFees = await relayerContract.enableFees();

    const value = ethers.utils.parseEther((Number(relayerTxData?.tx?.value || 0) / Math.pow(10, 18))?.toString());

    let fee = 0;
    if (metaTransaction.isNative === true)
      fee = feeAmount.add(
        inPercentFee.mul(value).div(BigNumber.from(10000))
      );

    const data = await apiCall({
      method: "POST",
      url: baseUrl + "/sign",
      data: {
        metaTx: {
          ...metaTransaction,
          nativeValue: value
        },
        chainId: Number(chainId)
      }
    })

    const gasEstimate = await relayerContract.estimateGas.executeMetaTransactionSwap(
      {
        ...metaTransaction,
        nativeValue: value
      },
      data.data,
      { value: !enableFees ? value : value.add(fee) }
    );
    const txObj: any = { value: !enableFees ? value : value.add(fee), gasLimit: Math.round(Number(gasEstimate) * 1.5) }
    await relayerContract.callStatic.executeMetaTransactionSwap(
      {
        ...metaTransaction,
        nativeValue: value
      },
      data.data,
      txObj
    );
  }

  async triggerContract(relayerTxData: IRelayerTxData) {
    const signer = this.provider.getSigner()
    const chainId = await signer.getChainId();
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses(chainId)
    const relayerContract = new ethers.Contract(
      relayerAddress,
      relayerAbi,
      signer
    );

    const nonce = await relayerContract.nonces(address)

    const metaTransaction = {
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
      recipient: relayerTxData?.spender || addressZero,
      amount: relayerTxData?.amount,
      token: relayerTxData?.token,
      isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
      nonce: nonce,
      deadline: Math.round(new Date().getTime() / 1000 + 100)
    };

    const feeAmount = await relayerContract.feeAmount();
    const inPercentFee = await relayerContract.inPercentFee();
    const enableFees = await relayerContract.enableFees();

    const value = ethers.utils.parseEther((Number(relayerTxData?.tx?.value || 0) / Math.pow(10, 18))?.toString());

    let fee = 0;
    if (metaTransaction.isNative === true)
      fee = feeAmount.add(
        inPercentFee.mul(value).div(BigNumber.from(10000))
      );

    const data = await apiCall({
      method: "POST",
      url: baseUrl + "/sign",
      data: {
        metaTx: {
          ...metaTransaction,
          nativeValue: value
        },
        chainId: Number(chainId)
      }
    })

    const gasEstimate = await relayerContract.estimateGas.executeMetaTransactionSwap(
      {
        ...metaTransaction,
        nativeValue: value
      },
      data.data,
      { value: !enableFees ? value : value.add(fee) }
    );
    const txObj: any = { value: !enableFees ? value : value.add(fee), gasLimit: Math.round(Number(gasEstimate) * 1.5) }
    let tx;

    try {
      tx = await relayerContract.executeMetaTransactionSwap(
        {
          ...metaTransaction,
          nativeValue: value
        },
        data.data,
        txObj
      );
    } catch (error: any) {
      const isUnkownError = getErrorMessage(error);
      if (isUnkownError === false) {
        tx = await relayerContract.executeMetaTransactionSwap(
          {
            ...metaTransaction,
            nativeValue: value
          },
          data.data,
          txObj
        );
      } else {
        throw new Error(error)
      }
    }

    const receipt = await tx.wait();
    return receipt;
  }

  getMetaTransactionByteData(relayerTxData: IRelayerRawTxData) {
    const relayerAddress = relayerAddresses(relayerTxData?.chainId)
    let approvalData;

    if (!relayerTxData?.isNative) {
      const tokenInterface = new ethers.utils.Interface(ERC20_ABI);

      approvalData = tokenInterface.encodeFunctionData("approve", [
        relayerAddress,
        relayerTxData?.amount,
      ]);
    }

    const relayerInterface = new ethers.utils.Interface(relayerAbi);

    const metaTransaction = {
      user: relayerTxData?.userAddress,
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
      spender: relayerTxData?.spender || addressZero,
      amount: relayerTxData?.amount,
      token: relayerTxData?.token,
      isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
    };

    const value = ethers.utils.parseEther((Number(relayerTxData?.tx?.value || 0) / Math.pow(10, 18))?.toString());

    const executeData = relayerInterface.encodeFunctionData(
      "executeMetaTransactionSwap",
      [metaTransaction]
    );

    return {
      approvalData,
      executeData,
      value,
      to: relayerAddress
    };
  }
}

export default RelayerFactory;
