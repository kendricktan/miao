const fetch = require("node-fetch");

const isUnknownSignature = (abiDecoder, trace) => {
  try {
    if (trace.tag === "TxCall") {
      const data = trace.callSigBytes + trace.callData.slice(2);
      return !abiDecoder.decodeMethod(data);
    }

    if (trace.tag === "TxDelegateCall") {
      const data = trace.delegateCallSigBytes + trace.delegateCallData.slice(2);
      return !abiDecoder.decodeMethod(data);
    }
  } catch (e) {
    return true;
  }

  // Otherwise is not a function signature
  // Just return false
  return false;
};

const flattenTrace = (trace) => {
  if (trace.tag === "TxCall") {
    return [
      {
        ...trace,
        callTrace: [],
      },
      ...flattenTraces(trace.callTrace),
    ];
  }

  if (trace.tag === "TxDelegateCall") {
    return [
      {
        ...trace,
        delegateCallTrace: [],
      },
      ...flattenTraces(trace.delegateCallTrace),
    ];
  }

  return [trace];
};

const flattenTraces = (traces) => {
  return traces
    .map((x) => flattenTrace(x))
    .reduce((acc, x) => [...acc, ...x], []);
};

const getUnknownSigBytesFromTraces = (abiDecoder, traces) => {
  // Flatten traces
  return flattenTraces(traces)
    .filter((x) => isUnknownSignature(abiDecoder, x))
    .map((x) => {
      if (x.callSigBytes) {
        return x.callSigBytes;
      }
      return x.delegateCallSigBytes;
    });
};

const getUnknownAddressesFromTraces = (abiDecoder, traces) => {
  // Flatten traces
  return flattenTraces(traces)
    .filter((x) => isUnknownSignature(abiDecoder, x))
    .map((x) => {
      if (x.callTarget) {
        return x.callTarget;
      }
      return x.delegateCallTarget;
    });
};

const signatureToABI = (sig) => {
  // Get signatures
  const inputTypes = sig
    .split("(")
    .slice(1)
    .join("")
    .split(")")
    .slice(0, -1)
    .join("")
    .split(",");

  const inputs = inputTypes.map((x, idx) => {
    return {
      name: `arg${idx}`,
      type: x,
    };
  });

  const name = sig.split("(")[0];

  return {
    inputs,
    name,
    type: "function",
  };
};

const getSignaturesFrombytes = async (bytes4) => {
  try {
    const resp = await fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=${bytes4}`
    ).then((x) => x.json());

    return resp.results.map((x) => x.text_signature);
  } catch (e) {
    return [];
  }
};

const decodeTrace = (abiDecoder, trace) => {
  if (trace.tag === "TxCall") {
    const data = trace.callSigBytes + trace.callData.slice(2);
    return {
      ...trace,
      callTrace: decodeTraces(abiDecoder, trace.callTrace),
      decoded: abiDecoder.decodeMethod(data) || null,
    };
  }

  if (trace.tag === "TxDelegateCall") {
    const data = trace.delegateCallSigBytes + trace.delegateCallData.slice(2);
    return {
      ...trace,
      delegateCallTrace: decodeTraces(abiDecoder, trace.delegateCallTrace),
      decoded: abiDecoder.decodeMethod(data) || null,
    };
  }

  if (trace.tag === "TxEvent") {
    const logs = [
      {
        data: trace.eventBytes,
        topics: trace.eventTopics,
      },
    ];

    return {
      ...trace,
      decoded: (abiDecoder.decodeLogs(logs) || [])[0] || null,
    };
  }

  // Otherwise is not a function signature
  // Just return false
  return trace;
};

const decodeTraces = (abiDecoder, traces) => {
  return traces.map((x) => decodeTrace(abiDecoder, x));
};

module.exports = {
  flattenTrace,
  flattenTraces,
  getUnknownSigBytesFromTraces,
  isUnknownSignature,
  signatureToABI,
  getSignaturesFrombytes,
  decodeTraces,
  decodeTrace,
  getUnknownAddressesFromTraces,
};
