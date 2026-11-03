import { createConnector } from "./app/create.js";
import { openBrowser } from "./auth/sign-in.js";
import { config } from "./config.js";

// Runs the connector in a terminal: it prints what's happening and joins GROUP_CODE. The desktop app runs
// the same connector inside its own process.
const { connector, status } = createConnector({
  openBrowser,
  autoJoinGroupCode: config.groupCode,
  onCode(code) {
    const shown = code.userCode.length === 8 ? `${code.userCode.slice(0, 4)}-${code.userCode.slice(4)}` : code.userCode;
    console.log(`\nSign in to Airspace: approve ${shown} at ${code.verificationUrl} (opening it in your browser)\n`);
    openBrowser(code.verificationUrl);
  },
});

const exit = (code: number) => {
  void connector.stop().then(() => process.exit(code));
};

// There's no "Get a new code" button in a terminal; restarting is the retry.
status.subscribe(({ account }) => {
  if (account.state === "error") exit(1);
});
process.on("SIGINT", () => {
  exit(0);
});

connector.start();
