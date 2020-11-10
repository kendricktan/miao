const path = require("path");
const fetch = require("node-fetch");
const express = require("express");
const slash = require("express-slash");
const bodyParser = require("body-parser");
const abiDecoder = require("abi-decoder");
const fs = require("fs");

const {
  getUnknownSigBytesFromTraces,
  getSignaturesFrombytes,
  signatureToABI,
  decodeTraces,
} = require("./src/helpers");

// Our "database" - A JSON File. Don't over engineer lmao
const ABI_DIR = path.resolve(".", "abis");
const DB_PATH = path.resolve(ABI_DIR, "custom.json");

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

// TODO: Auto retrieve etherscan ABI

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
app.enable("strict routing");
app.use(bodyParser.json()).use(router).use(slash());

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
    txResp = await fetch(`http://localhost:3000/tx/${txHash}`).then((x) =>
      x.json()
    );
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

  // Get unknown signature bytes
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

      // Save z custom ABI
      saveCustomABIs(abis);
    }
  }

  // Decode traces
  const decoded = decodeTraces(abiDecoder, txResp.traces);

  res.json(decoded);
});

app.listen(5000, () => {
  console.log("App listening at http://localhost:5000");
});
