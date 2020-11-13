const path = require("path");
const fetch = require("node-fetch");
const express = require("express");
const slash = require("express-slash");
const bodyParser = require("body-parser");
const abiDecoder = require("abi-decoder");
const fs = require("fs");
const cors = require("cors");
const morgan = require("morgan");

const PORT = process.env["PORT"] || 3001;
let ETHTXD_URL = process.env["ETHTXD_URL"] || "http://localhost:3002/";

// We want a trailing slash
if (ETHTXD_URL[ETHTXD_URL.length - 1] !== "/") {
  ETHTXD_URL = `${ETHTXD_URL}/`;
}

const {
  getUnknownSigBytesFromTraces,
  getSignaturesFrombytes,
  signatureToABI,
  decodeTraces,
  getUnknownAddressesFromTraces,
} = require("./src/helpers");

const { getSourceCodeFromEtherscan } = require("./src/etherscan");

// Our "database" - A JSON File. Don't over engineer lmao
const ABI_DIR = path.resolve(".", "abis");
const DB_PATH = path.resolve(ABI_DIR, "custom.json");

const RETRIEVED_HISTORY = path.resolve(".", "retrieved.json");
const CONTRACT_NAMES = path.resolve(".", "contract-names.json");

// Saves to custom data
const saveCustomABIs = (abis) => {
  let existingABIs = [];
  try {
    existingABIs = JSON.parse(fs.readFileSync(DB_PATH));
  } catch (e) {
    existingABIs = [];
  }

  fs.writeFileSync(DB_PATH, JSON.stringify([...existingABIs, ...abis]));
};

const saveEtherscanABI = (address, abi) => {
  fs.writeFileSync(
    path.resolve(ABI_DIR, `${address}.json`),
    JSON.stringify(abi)
  );
};

const saveRetrieved = (addresses) => {
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(RETRIEVED_HISTORY));
  } catch (e) {
    existing = {};
  }

  fs.writeFileSync(
    RETRIEVED_HISTORY,
    JSON.stringify({
      ...existing,
      ...addresses
        .map((x) => {
          return {
            [x]: true,
          };
        })
        .reduce((acc, x) => {
          return { ...acc, ...x };
        }, {}),
    })
  );
};

const saveContractNames = (contractNames) => {
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(CONTRACT_NAMES));
  } catch (e) {
    existing = {};
  }

  fs.writeFileSync(
    CONTRACT_NAMES,
    JSON.stringify({ ...existing, ...contractNames })
  );
};

const hasRetrieved = (address) => {
  try {
    const existing = JSON.parse(fs.readFileSync(RETRIEVED_HISTORY));
    return !!existing[address];
  } catch (e) {
    return false;
  }
};

// Loads up all the saved ABIs
for (const f of fs.readdirSync(ABI_DIR)) {
  abiDecoder.addABI(require(path.resolve(ABI_DIR, f)));
}

const app = express();

const router = express.Router({
  caseSensitive: app.get("case sensitive routing"),
  strict: app.get("strict routing"),
});

// Middlewares
app.use(cors());
app.enable("strict routing");
app.use(morgan("tiny")).use(bodyParser.json()).use(router).use(slash());

router.get("/", async (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.get("/tx/:txHash/", async (req, res) => {
  const { txHash } = req.params;

  if (!txHash) {
    res.status(400).json({
      success: false,
      message: "No tx hash provided",
    });
    return;
  }

  // Attempt to trace calls
  let txResp;
  try {
    txResp = await fetch(`${ETHTXD_URL}tx/${txHash}`).then((x) => x.json());
  } catch (e) {
    // ethtxd fails
    res.status(500).json({
      success: false,
      message: "Unknown error occured",
    });
    return;
  }

  // Can't retrieve json
  if (txResp.tag !== "SuccessResponse") {
    res.status(400).json({
      success: false,
      message: txResp.reason,
    });
    return;
  }

  // Get data from etherscan
  const unknownAddresses = getUnknownAddressesFromTraces(
    abiDecoder,
    txResp.traces
  ).filter((x) => !hasRetrieved(x));
  if (unknownAddresses.length > 0) {
    // Get all the abis
    const sourceCodes = await Promise.all(
      unknownAddresses.map((x) => getSourceCodeFromEtherscan(x))
    );

    const abis = sourceCodes.map((x) => x.ABI).filter((x) => !!x);

    // Extract out contract names
    const contractNames = sourceCodes
      .map(({ ContractName }, idx) => {
        if (ContractName) {
          return { [unknownAddresses[idx].toLowerCase()]: ContractName };
        }
        return {};
      })
      .reduce((acc, x) => {
        return { ...acc, ...x };
      }, {});

    // Add to abi decoder
    for (const abi of abis) {
      abiDecoder.addABI(abi);
    }

    // Save logged abis
    for (let i = 0; i < abis.length; i++) {
      if (abis[i].length > 0) {
        saveEtherscanABI(unknownAddresses[i], abis[i]);
      }
    }

    // Saved retrieved addresses
    saveRetrieved(unknownAddresses);

    // Save Contract names
    saveContractNames(contractNames);
  }

  // If its not known on etherscan, get unknown signature bytes from 4bytes
  const unknownSigBytes = getUnknownSigBytesFromTraces(
    abiDecoder,
    txResp.traces
  );

  // If there is an unknown sig bytes
  if (unknownSigBytes.length > 0) {
    // Get signatures fromm unknown signature bytes and flatten them
    const signatures = (
      await Promise.all(unknownSigBytes.map((x) => getSignaturesFrombytes(x)))
    ).reduce((acc, x) => [...acc, ...x], []);

    if (signatures.length > 0) {
      // Convert signatures to abis
      const abis = signatures.map((x) => signatureToABI(x));

      // Add them to the abi encoder
      abiDecoder.addABI(abis);

      // Save the custom ABI
      saveCustomABIs(abis);
    }
  }

  // Read contract names
  let contractNames = {};

  if (fs.existsSync(CONTRACT_NAMES)) {
    contractNames = JSON.parse(fs.readFileSync(CONTRACT_NAMES));
  }

  // Decode traces
  const decoded = decodeTraces(contractNames, abiDecoder, txResp.traces);

  res.json({ success: true, traces: decoded });
});

app.listen(PORT, () => {
  console.log(`Ethtxd URL: ${ETHTXD_URL}`);
  console.log(`App listening at http://localhost:${PORT}`);
});
