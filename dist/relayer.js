import { BigNumber, ethers } from "ethers";
import { addressE, addressZero, ERC20_ABI, relayerAddresses } from "./utils/constants.js";
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
        const relayerAddress = relayerAddresses(chainId);
        const relayerContract = new ethers.Contract(relayerAddress, relayerAbi, signer);
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
            fee = feeAmount.add(inPercentFee.mul(value).div(BigNumber.from(10000)));
        console.log("🚀 ~ RelayerFactory ~ triggerContract ~ fee:", fee, feeAmount, inPercentFee);
        console.log("🚀 ~ RelayerFactory ~ triggerContract ~ value:", value, value.add(fee));
        const gasEstimate = await relayerContract.estimateGas.executeMetaTransactionSwap({
            ...metaTransaction,
            nativeValue: value
        }, { value: !enableFees ? value : value.add(fee) });
        console.log("🚀 ~ RelayerFactory ~ triggerContract ~ gasEstimate:", gasEstimate);
        const tx = await relayerContract.executeMetaTransactionSwap({
            ...metaTransaction,
            nativeValue: value
        }, { value: !enableFees ? value : value.add(fee), gasLimit: gasEstimate });
        const receipt = await tx.wait();
        return receipt;
    }
    getMetaTransactionByteData(relayerTxData) {
        const relayerAddress = relayerAddresses(relayerTxData?.chainId);
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
        const executeData = relayerInterface.encodeFunctionData("executeMetaTransactionSwap", [metaTransaction]);
        return {
            approvalData,
            executeData,
            value,
            to: relayerAddress
        };
    }
}
export default RelayerFactory;
//# sourceMappingURL=relayer.js.map