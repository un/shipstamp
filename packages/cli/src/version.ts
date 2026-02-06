declare const __GITPREFLIGHT_CLI_VERSION__: string | undefined;

export const GITPREFLIGHT_CLI_VERSION =
  typeof __GITPREFLIGHT_CLI_VERSION__ === "string" && __GITPREFLIGHT_CLI_VERSION__.trim().length > 0
    ? __GITPREFLIGHT_CLI_VERSION__
    : "0.0.0";
