import { Contract } from "ethers";
import { ethers } from "ethers";
import tokenAbi from "../utils/abis/token.abi.json";
import { apiCall } from "../utils/axios.js";

const addressZero = "0x0000000000000000000000000000000000000000";

export default class Base {
  senderAddress: string | null;
  constructor() {
    this.senderAddress = null;
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
    // if (Number(chainId) === 728126428) {
    //   try {
    //     const encodedTokenAddress = this.tronweb.address.fromHex(
    //       "41" + tokenAddress.substring(2)
    //     );
    //     const encodedApprovalAddress =
    //       router === "nitro"
    //         ? this.tronweb.address.fromHex("41" + approvalAddress.substring(2))
    //         : approvalAddress;
    //     const contract = await this.tronweb.contract(
    //       tokenAbi,
    //       encodedTokenAddress
    //     );
    //     const allowance = await contract
    //       .allowance(this.senderTronNitro, encodedApprovalAddress)
    //       .call();
    //     if (allowance.lt(amount)) {
    //       await contract.approve(encodedApprovalAddress, amount).send();
    //     }
    //     return;
    //   } catch (error: any) {
    //     console.log(error, "error");
    //     throw error;
    //   }
    // }

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
