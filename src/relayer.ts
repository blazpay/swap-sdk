import { ethers } from "ethers";
import { addressE, addressZero, baseUrl, ERC20_ABI, relayerAddresses } from "./utils/constants.js";
import { relayerAbi } from "./utils/jsons/relayerAbi.js"
import { IRelayerRawTxData, IRelayerTxData } from "./@types/relayer.type.js";
import { getErrorMessage } from "./utils/helper.js";
import { apiCall } from "./utils/axios.js";

export class RelayerFactory {
  private provider?: ethers.BrowserProvider
  
  private requireProvider(): ethers.BrowserProvider {
    if (!this.provider) throw new Error("RelayerFactory requires a BrowserProvider for this operation.");
    return this.provider;
  }

  constructor(_provider?: ethers.BrowserProvider) {
    this.provider = _provider;
  }

  private toBigIntWei(value: any): bigint {
    if (value === null || value === undefined) return 0n;
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.trunc(value));
    if (typeof value === "string") return BigInt(value);
    if (typeof value === "object") {
      // ethers v5 BigNumber instance (has _hex / toHexString)
      if (typeof value.toHexString === "function") {
        return BigInt(value.toHexString());
      }
      if (typeof value._hex === "string") {
        return BigInt(value._hex);
      }
      // JSON-serialized ethers v5 BigNumber: { type: "BigNumber", hex: "0x..." }
      if (value.type === "BigNumber" && typeof value.hex === "string") {
        return BigInt(value.hex);
      }
    }
    return BigInt(value.toString());
  }

  async sortQuotes(relayerTxs: IRelayerTxData[]) {
    const provider = this.requireProvider();
    const signer = await provider.getSigner()
    const chainId = Number((await provider.getNetwork()).chainId);
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses(chainId)
    const relayerContract: any = new ethers.Contract(
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
          amount: this.toBigIntWei(relayerTxData?.amount),
          token: relayerTxData?.token,
          isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
        };
        const feeAmount = this.toBigIntWei(await relayerContract.feeAmount());
        const inPercentFee = this.toBigIntWei(await relayerContract.inPercentFee());
        const enableFees = await relayerContract.enableFees();

        const value = this.toBigIntWei(relayerTxData?.tx?.value);

        let fee = 0n;
        if (metaTransaction.isNative === true) {
          fee = feeAmount + (inPercentFee * value) / 10000n;
        }

        const txValue = !enableFees ? value : value + fee;
        await relayerContract.executeMetaTransactionSwap.estimateGas(
          {
            ...metaTransaction,
            nativeValue: value
          },
          { value: txValue }
        );
        newQuotes.push(relayerTxData.quote)
      } catch (error) {
        console.log("error with quote")
      }
    }))
    return newQuotes
  }

  async simulateTransaction(relayerTxData: IRelayerTxData) {
    const provider = this.requireProvider();
    const signer = await provider.getSigner()
    const chainId = Number((await provider.getNetwork()).chainId);
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses(chainId)
    const relayerContract: any = new ethers.Contract(
      relayerAddress,
      relayerAbi,
      signer
    );

    const nonce = this.toBigIntWei(await relayerContract.nonces(address));

    const metaTransaction = {
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
      recipient: relayerTxData?.spender || addressZero,
      amount: this.toBigIntWei(relayerTxData?.amount),
      token: relayerTxData?.token,
      isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
      nonce: nonce,
      deadline: BigInt(Math.round(new Date().getTime() / 1000 + 100))
    };

    const feeAmount = this.toBigIntWei(await relayerContract.feeAmount());
    const inPercentFee = this.toBigIntWei(await relayerContract.inPercentFee());
    const enableFees = await relayerContract.enableFees();

    const value = this.toBigIntWei(relayerTxData?.tx?.value);

    let fee = 0n;
    if (metaTransaction.isNative === true) {
      fee = feeAmount + (inPercentFee * value) / 10000n;
    }

    const data = await apiCall({
      method: "POST",
      url: baseUrl + "/sign",
      data: {
        metaTx: {
          ...metaTransaction,
          amount: metaTransaction.amount.toString(),
          nonce: metaTransaction.nonce.toString(),
          deadline: metaTransaction.deadline.toString(),
          nativeValue: value.toString(),
        },
        chainId: Number(chainId)
      }
    })

    const txValue = !enableFees ? value : value + fee;
    const gasEstimate = this.toBigIntWei(
      await relayerContract.executeMetaTransactionSwap.estimateGas(
        {
          ...metaTransaction,
          nativeValue: value
        },
        data.data,
        { value: txValue }
      )
    );
    const txObj: any = { value: txValue, gasLimit: (gasEstimate * 3n) / 2n }
    await relayerContract.executeMetaTransactionSwap.staticCall(
      {
        ...metaTransaction,
        nativeValue: value
      },
      data.data,
      txObj
    );
  }

  async triggerContract(relayerTxData: IRelayerTxData) {
    const provider = this.requireProvider();
    const signer = await provider.getSigner()
    const chainId = Number((await provider.getNetwork()).chainId);
    const address = await signer.getAddress();

    const relayerAddress = relayerAddresses(chainId)
    const relayerContract: any = new ethers.Contract(
      relayerAddress,
      relayerAbi,
      signer
    );

    const nonce = this.toBigIntWei(await relayerContract.nonces(address));

    const metaTransaction = {
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
      recipient: relayerTxData?.spender || addressZero,
      amount: this.toBigIntWei(relayerTxData?.amount),
      token: relayerTxData?.token,
      isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
      nonce: nonce,
      deadline: BigInt(Math.round(new Date().getTime() / 1000 + 100))
    };

    const feeAmount = this.toBigIntWei(await relayerContract.feeAmount());
    const inPercentFee = this.toBigIntWei(await relayerContract.inPercentFee());
    const enableFees = await relayerContract.enableFees();

    const value = this.toBigIntWei(relayerTxData?.tx?.value);

    let fee = 0n;
    if (metaTransaction.isNative === true) {
      fee = feeAmount + (inPercentFee * value) / 10000n;
    }

    const data = await apiCall({
      method: "POST",
      url: baseUrl + "/sign",
      data: {
        metaTx: {
          ...metaTransaction,
          amount: metaTransaction.amount.toString(),
          nonce: metaTransaction.nonce.toString(),
          deadline: metaTransaction.deadline.toString(),
          nativeValue: value.toString(),
        },
        chainId: Number(chainId)
      }
    })

    const txValue = !enableFees ? value : value + fee;
    const gasEstimate = this.toBigIntWei(
      await relayerContract.executeMetaTransactionSwap.estimateGas(
        {
          ...metaTransaction,
          nativeValue: value
        },
        data.data,
        { value: txValue }
      )
    );
    const txObj: any = { value: txValue, gasLimit: (gasEstimate * 3n) / 2n }
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

    // Avoid tx.wait() — ethers v6's internal txListener calls
    // receipt.confirmations() as a method, which throws when the runner
    // is an ethers v5 provider (where confirmations is a property).
    // Poll for the receipt manually so we're agnostic to v5/v6 shape.
    const hash: string = tx.hash;
    const rpcProvider: any =
      (signer && (signer as any).provider) || this.provider;

    const receipt = await this.waitForReceipt(rpcProvider, hash);
    if (receipt && (receipt as any).transactionHash == null) {
      (receipt as any).transactionHash = hash;
    }
    return receipt;
  }

  private async waitForReceipt(
    provider: any,
    hash: string,
    { intervalMs = 2000, timeoutMs = 180000 }: { intervalMs?: number; timeoutMs?: number } = {}
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const r = await provider.getTransactionReceipt(hash);
        if (r) return r;
      } catch (_) {
        // ignore transient lookup errors
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Timed out waiting for transaction receipt: ${hash}`);
  }

  getMetaTransactionByteData(relayerTxData: IRelayerRawTxData) {
    const relayerAddress = relayerAddresses(relayerTxData?.chainId)
    const amountBigInt = this.toBigIntWei(relayerTxData?.amount);
    let approvalData;

    if (!relayerTxData?.isNative) {
      const tokenInterface = new ethers.Interface(ERC20_ABI);

      approvalData = tokenInterface.encodeFunctionData("approve", [
        relayerAddress,
        amountBigInt,
      ]);
    }

    const relayerInterface = new ethers.Interface(relayerAbi);

    const metaTransaction = {
      user: relayerTxData?.userAddress,
      targetContract: relayerTxData?.tx?.to,
      data: relayerTxData?.tx?.data,
      spender: relayerTxData?.spender || addressZero,
      amount: amountBigInt,
      token: relayerTxData?.token,
      isNative: (relayerTxData.token === addressZero || relayerTxData.token === addressE),
    };

    const value = this.toBigIntWei(relayerTxData?.tx?.value);

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
