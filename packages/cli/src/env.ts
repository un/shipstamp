import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export type GitPreflightEnv = {
  GITPREFLIGHT_API_BASE_URL: string;
};

export function getGitPreflightEnv(rawEnv: NodeJS.ProcessEnv = process.env): GitPreflightEnv {
  const env = createEnv({
    server: {
      GITPREFLIGHT_API_BASE_URL: z.string().url()
    },
    runtimeEnv: rawEnv,
    onValidationError: () => {
      throw new Error("Invalid environment variables");
    }
  });

  return {
    GITPREFLIGHT_API_BASE_URL: env.GITPREFLIGHT_API_BASE_URL
  };
}
