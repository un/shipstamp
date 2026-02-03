declare const __SHIPSTAMP_CLI_VERSION__: string | undefined;

export const SHIPSTAMP_CLI_VERSION =
  typeof __SHIPSTAMP_CLI_VERSION__ === "string" && __SHIPSTAMP_CLI_VERSION__.trim().length > 0
    ? __SHIPSTAMP_CLI_VERSION__
    : "0.0.0";
