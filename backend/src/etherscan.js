const fetch = require("node-fetch");

// Etherscan API defaults to ethers API key
const ETHERSCAN_API_KEY =
  process.env["ETHERSCAN_API_KEY"] || "9D13ZE7XSBTJ94N9BNJ2MA33VMAY2YPIRB";

const getABIFromEtherscan = async (address) => {
  try {
    const resp = await fetch(
      `https://api.etherscan.io/api?module=contract&action=getabi&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    ).then((x) => x.json());

    return JSON.parse(resp.result);
  } catch (e) {
    return [];
  }
};

const getSourceCodeFromEtherscan = async (address) => {
  try {
    const resp = await fetch(
      `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${address}&apikey=${ETHERSCAN_API_KEY}`
    ).then((x) => x.json());

    const { ABI, ContractName } = resp.result[0];

    return {
      ABI: JSON.parse(ABI),
      ContractName,
    };
  } catch (e) {
    return [];
  }
};

module.exports = {
  getABIFromEtherscan,
  getSourceCodeFromEtherscan,
};
