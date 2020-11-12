import { useState } from "react";
import { ToastProvider, useToasts } from "react-toast-notifications";
import {
  TextareaAutosize,
  TextField,
  Container,
  Button,
  Collapse,
  SvgIcon,
  CircularProgress,
} from "@material-ui/core";
import PropTypes from "prop-types";
import { fade, makeStyles, withStyles } from "@material-ui/core/styles";
import { TreeItem, TreeView } from "@material-ui/lab";
import bigInt from "big-integer";
import { useSpring, animated } from "react-spring/web.cjs"; // web.cjs is required for IE 11 support

import "./App.css";

let BACKEND_URL = process.env["BACKEND_URL"] || "http://localhost:3001";

if (BACKEND_URL[BACKEND_URL.length - 1] !== "/") {
  BACKEND_URL = BACKEND_URL + "/";
}

function MinusSquare(props) {
  return (
    <SvgIcon fontSize="inherit" style={{ width: 14, height: 14 }} {...props}>
      {/* tslint:disable-next-line: max-line-length */}
      <path d="M22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0zM17.873 11.023h-11.826q-.375 0-.669.281t-.294.682v0q0 .401.294 .682t.669.281h11.826q.375 0 .669-.281t.294-.682v0q0-.401-.294-.682t-.669-.281z" />
    </SvgIcon>
  );
}

function PlusSquare(props) {
  return (
    <SvgIcon fontSize="inherit" style={{ width: 14, height: 14 }} {...props}>
      {/* tslint:disable-next-line: max-line-length */}
      <path d="M22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0zM17.873 12.977h-4.923v4.896q0 .401-.281.682t-.682.281v0q-.375 0-.669-.281t-.294-.682v-4.896h-4.923q-.401 0-.682-.294t-.281-.669v0q0-.401.281-.682t.682-.281h4.923v-4.896q0-.401.294-.682t.669-.281v0q.401 0 .682.281t.281.682v4.896h4.923q.401 0 .682.281t.281.682v0q0 .375-.281.669t-.682.294z" />
    </SvgIcon>
  );
}

function CloseSquare(props) {
  return (
    <SvgIcon
      className="close"
      fontSize="inherit"
      style={{ width: 14, height: 14 }}
      {...props}
    >
      {/* tslint:disable-next-line: max-line-length */}
      <path d="M17.485 17.512q-.281.281-.682.281t-.696-.268l-4.12-4.147-4.12 4.147q-.294.268-.696.268t-.682-.281-.281-.682.294-.669l4.12-4.147-4.12-4.147q-.294-.268-.294-.669t.281-.682.682-.281.696 .268l4.12 4.147 4.12-4.147q.294-.268.696-.268t.682.281 .281.669-.294.682l-4.12 4.147 4.12 4.147q.294.268 .294.669t-.281.682zM22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0z" />
    </SvgIcon>
  );
}

function TransitionComponent(props) {
  const style = useSpring({
    from: { opacity: 0, transform: "translate3d(20px,0,0)" },
    to: {
      opacity: props.in ? 1 : 0,
      transform: `translate3d(${props.in ? 0 : 20}px,0,0)`,
    },
  });

  return (
    <animated.div style={style}>
      <Collapse {...props} />
    </animated.div>
  );
}

TransitionComponent.propTypes = {
  /**
   * Show the component; triggers the enter or exit states
   */
  in: PropTypes.bool,
};

const StyledTreeItem = withStyles((theme) => ({
  iconContainer: {
    "& .close": {
      opacity: 0.3,
    },
  },
  group: {
    marginLeft: 7,
    paddingLeft: 18,
    borderLeft: `1px dashed ${fade(theme.palette.text.primary, 0.4)}`,
  },
}))((props) => (
  <TreeItem {...props} TransitionComponent={TransitionComponent} />
));

const useStyles = makeStyles({
  root: {
    flexGrow: 1,
    wordWrap: "break-word",
  },
});

function tracesToTreeItem(startId, traces) {
  return traces.map((trace, idx) => {
    if (trace.tag === "TxEvent") {
      let label = `event:log${trace.eventTopics.length}(${[
        trace.eventBytes,
        ...trace.eventTopics,
      ].join(", ")})`;

      if (trace.decoded) {
        const event = prettyFunctionArgsDisplay(
          `${trace.decoded.events.map((x) => {
            let val = x.value;
            if (x.type.toLowerCase().includes("int")) {
              try {
                val = bigInt(x.value, 16);
                val = val.toString();
              } catch (e) {}
            }
            return x.name + "=" + val;
          })}`
        );

        label = `event::${trace.decoded.name}(\n\t${event}\n)`;
      }

      return (
        <StyledTreeItem
          nodeId={`${startId + idx}`}
          label={
            <TextareaAutosize
              rowsMax={5}
              style={{ width: "99%", marginTop: "5px", whiteSpace: "pre" }}
            >
              {label}
            </TextareaAutosize>
          }
        ></StyledTreeItem>
      );
    }

    if (trace.tag === "TxCall") {
      let label = `call:${trace.callTarget}::${trace.callSigBytes}(${trace.callData})`;

      if (trace.decoded) {
        const func = prettyFunctionArgsDisplay(
          `${trace.decoded.params.map((x) => {
            let val = x.value;
            if (x.type.toLowerCase().includes("int")) {
              try {
                val = bigInt(x.value, 16);
                val = val.toString();
              } catch (e) {}
            }
            return x.name + "=" + val;
          })}`
        );

        label = `call::${trace.callTarget}\n${trace.decoded.name}(\n\t${func}\n)`;
      }

      return (
        <StyledTreeItem
          nodeId={`${startId + idx}`}
          label={
            <TextareaAutosize
              rowsMax={5}
              style={{ width: "99%", marginTop: "5px", whiteSpace: "pre" }}
            >
              {label}
            </TextareaAutosize>
          }
          onLabelClick={(e) => {
            e.preventDefault();
          }}
        >
          {tracesToTreeItem(startId + traces.length, trace.callTrace)}
        </StyledTreeItem>
      );
    }

    if (trace.tag === "TxDelegateCall") {
      let label = `delegateCall::${trace.delegateCallTarget}\n${trace.delegateCallSigBytes}(${trace.delegateCallData})`;

      if (trace.decoded) {
        const func = prettyFunctionArgsDisplay(
          `${trace.decoded.params.map((x) => {
            let val = x.value;
            if (x.type.toLowerCase().includes("int")) {
              try {
                val = bigInt(x.value, 16);
                val = val.toString();
              } catch (e) {}
            }
            return x.name + "=" + val;
          })}`
        );

        label = `delegateCall::${trace.delegateCallTarget}\n${trace.decoded.name}(\n\t${func}\n)`;
      }

      return (
        <StyledTreeItem
          nodeId={`${startId + idx}`}
          label={
            <TextareaAutosize
              rowsMax={5}
              style={{ width: "99%", marginTop: "5px", whiteSpace: "pre" }}
            >
              {label}
            </TextareaAutosize>
          }
          onLabelClick={(e) => {
            e.preventDefault();
          }}
        >
          {tracesToTreeItem(startId + traces.length, trace.delegateCallTrace)}
        </StyledTreeItem>
      );
    }

    if (trace.tag === "TxReturn") {
      const label = `return::${trace.returnData}`;
      return (
        <StyledTreeItem
          nodeId={`${startId + idx}`}
          label={
            <TextareaAutosize
              rowsMax={5}
              style={{ width: "99%", marginTop: "5px", whiteSpace: "pre" }}
            >
              {label}
            </TextareaAutosize>
          }
          onLabelClick={(e) => {
            e.preventDefault();
          }}
        ></StyledTreeItem>
      );
    }

    if (trace.tag === "TxRevert") {
      const label = `revert::${trace.revertReason}`;
      return (
        <StyledTreeItem
          nodeId={`${startId + idx}`}
          label={
            <TextareaAutosize
              rowsMax={5}
              style={{ width: "99%", marginTop: "5px", whiteSpace: "pre" }}
            >
              {label}
            </TextareaAutosize>
          }
          onLabelClick={(e) => {
            e.preventDefault();
          }}
        ></StyledTreeItem>
      );
    }

    return <></>;
  });
}

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

const prettyFunctionArgsDisplay = (args) => {
  return args.split(",").join(",\n\t");
};

function App() {
  const treeClasses = useStyles();

  const { addToast } = useToasts();
  const [fetching, setFetching] = useState(false);
  const [traces, setTraces] = useState(null);
  const [transactionHash, setTransactionHash] = useState("");

  const fetchTransactionHash = async () => {
    setFetching(true);

    if (transactionHash.length !== 66) {
      addToast("Invalid tx hash", { appearance: "error" });
      setFetching(false);
      return;
    }

    try {
      const resp = await fetch(
        `${BACKEND_URL}tx/${transactionHash}`
      ).then((x) => x.json());

      setTraces(resp);
      addToast("Successfully traced transaction", { appearance: "success" });
    } catch (e) {
      setTraces(null);
      addToast(`An error occured: ${e.toString()}`, { appearance: "error" });
    }

    setFetching(false);
  };

  return (
    <>
      <Container maxWidth="sm">
        <div className="App-content">
          <h2>Miao</h2>
          <TextField
            placeholder="Transaction hash"
            fullWidth
            color="secondary"
            variant="outlined"
            value={transactionHash}
            onChange={(e) => setTransactionHash(e.target.value)}
          />
          <br />
          <Button
            onClick={fetchTransactionHash}
            fullWidth
            color="secondary"
            variant="outlined"
          >
            Trace
          </Button>
        </div>

        <br />
      </Container>
      <Container maxWidth="lg">
        <hr style={{ borderTop: "1px solid grey", borderBottom: "0px" }} />
        <br />

        {fetching && (
          <div style={{ textAlign: "center" }}>
            <CircularProgress color="secondary" />
          </div>
        )}

        {!fetching && traces && (
          <TreeView
            className={treeClasses.root}
            defaultExpanded={flattenTraces(traces || []).map((x, idx) => `${idx}`)}
            defaultCollapseIcon={<MinusSquare />}
            defaultExpandIcon={<PlusSquare />}
            defaultEndIcon={<CloseSquare />}
          >
            {tracesToTreeItem(0, traces)}
          </TreeView>
        )}
      </Container>
    </>
  );
}

const Main = () => {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  );
};

export default Main;
