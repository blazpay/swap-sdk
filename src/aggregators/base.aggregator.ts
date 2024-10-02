import { Contract, providers } from "ethers";
import { ethers } from "ethers";
import tokenAbi from "../utils/abis/token.abi.json";
import { apiCall } from "../utils/axios.js";

const addressZero = "0x0000000000000000000000000000000000000000";

export default class Base {
  senderAddress: string | null;
  tronWeb: any;
  senderTronNitro?: string | null;
  tronFeeLimit: number;
  constructor() {
    this.senderAddress = null;
    this.tronWeb = window.tronWeb;
    this.senderTronNitro = null;
    this.tronFeeLimit = 1000000000;
  }

  async setAllowance(
    tokenAddress: string,
    approvalAddress: string,
    provider: any,
    chainId: number,
    amount = ethers.constants.MaxUint256,
    router: string
  ) {
    if (
      tokenAddress === ethers.constants.AddressZero ||
      tokenAddress === addressZero
    ) {
      return;
    }
    if (Number(chainId) === 728126428) {
      if (!window.tronWeb) {
        console.error("tron is not defined");
        return;
      }
      try {
        const encodedTokenAddress = this.tronWeb.address.fromHex(
          "41" + tokenAddress.substring(2)
        );
        const encodedApprovalAddress =
          router === "nitro"
            ? this.tronWeb.address.fromHex("41" + approvalAddress.substring(2))
            : approvalAddress;
        const contract = await this.tronWeb.contract(
          tokenAbi,
          encodedTokenAddress
        );
        const allowance = await contract
          .allowance(this.senderTronNitro, encodedApprovalAddress)
          .call();
        if (allowance.lt(amount)) {
          await contract.approve(encodedApprovalAddress, amount).send();
        }
        return;
      } catch (error: any) {
        console.log(error, "error");
        throw error;
      }
    }

    const erc20 = new Contract(tokenAddress, tokenAbi, provider.getSigner());
    const allowance = await erc20.allowance(
      this.senderAddress,
      approvalAddress
    );

    if (allowance.lt(amount)) {
      const approveTx = await erc20.approve(approvalAddress, amount, {
        gasPrice: await provider.getGasPrice(),
      });
      try {
        await approveTx.wait();
        console.log(`Transaction mined successfully: ${approveTx.hash}`);
      } catch (error) {
        console.log(`Transaction failed with error: ${error}`);
      }
    }
  }

  async triggerContract(
    chainId: number,
    provider: providers.Web3Provider,
    txn: any
  ) {
    try {
      if (Number(chainId) === 728126428) {
        const signedTx = await this.tronWeb.trx.sign(txn);
        const { txID } = await this.tronWeb.trx.sendRawTransaction(signedTx);

        return {
          walletAddress: this.tronWeb.defaultAddress.base58,
          hash: txID,
        };
      }
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();
      const tx = await signer.sendTransaction(txn);
      await tx.wait();
      return {
        walletAddress,
        tx,
      };
    } catch (error) {
      throw error;
    }
  }

  async getGasPrice(chainId: number) {
    try {
      const data = await apiCall({
        method: "GET",
        url: `https://open-api.openocean.finance/v4/${chainId}/gasPrice`,
      });

      return data?.data;
    } catch (error) {
      console.log("log: unable to get gas price", error);
    }
  }

  async init() {}
}
