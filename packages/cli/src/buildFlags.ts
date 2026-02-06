declare const __GITPREFLIGHT_OFFICIAL_BUILD__: boolean | undefined;

export const GITPREFLIGHT_OFFICIAL_BUILD =
  typeof __GITPREFLIGHT_OFFICIAL_BUILD__ === "boolean" ? __GITPREFLIGHT_OFFICIAL_BUILD__ : false;

export function assertSourceBuild(featureLabel: string) {
  if (GITPREFLIGHT_OFFICIAL_BUILD) {
    throw new Error(
      `${featureLabel} is disabled in official GitPreflight builds. Build from source to enable source-only features.`
    );
  }
}
