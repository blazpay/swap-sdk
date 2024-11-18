import { apiCall } from "../utils/axios.js";
const addressZero = "0x0000000000000000000000000000000000000000";
export default class Base {
    senderAddress;
    senderTronNitro;
    tronFeeLimit;
    constructor() {
        this.senderAddress = null;
        this.senderTronNitro = null;
        this.tronFeeLimit = 1000000000;
    }
    async setSenderAddress(address) {
        this.senderAddress = address;
    }
    // async triggerContract(
    //   chainId: number,
    //   provider: providers.Web3Provider,
    //   txn: any
    // ) {
    //   try {
    //     if (Number(chainId) === 728126428) {
    //       const signedTx = await this.tronWeb.trx.sign(txn);
    //       const { txID } = await this.tronWeb.trx.sendRawTransaction(signedTx);
    //       return {
    //         walletAddress: this.tronWeb.defaultAddress.base58,
    //         hash: txID,
    //       };
    //     }
    //     const signer = await provider.getSigner();
    //     const walletAddress = await signer.getAddress();
    //     const tx = await signer.sendTransaction(txn);
    //     await tx.wait();
    //     return {
    //       walletAddress,
    //       tx,
    //     };
    //   } catch (error) {
    //     throw error;
    //   }
    // }
    async getGasPrice(chainId) {
        try {
            const data = await apiCall({
                method: "GET",
                url: `https://open-api.openocean.finance/v4/${chainId}/gasPrice`,
                headers: {
                    apikey: "v1KMZyXotXue4HiQEO3O60qj7iP3SP2j",
                },
            });
            return data?.data;
        }
        catch (error) {
            console.log("log: unable to get gas price", error);
        }
    }
    isNativeAddresss(address) {
        if ([
            "0x0000000000000000000000000000000000000000",
            "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            "0x0000000000000000000000000000000000001010",
            "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
        ].includes(address))
            return true;
        return false;
    }
    async init() { }
}
//# sourceMappingURL=base.aggregator.js.map