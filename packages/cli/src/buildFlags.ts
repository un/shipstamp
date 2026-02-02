declare const __SHIPSTAMP_OFFICIAL_BUILD__: boolean | undefined;

export const SHIPSTAMP_OFFICIAL_BUILD =
  typeof __SHIPSTAMP_OFFICIAL_BUILD__ === "boolean" ? __SHIPSTAMP_OFFICIAL_BUILD__ : false;

export function assertSourceBuild(featureLabel: string) {
  if (SHIPSTAMP_OFFICIAL_BUILD) {
    throw new Error(
      `${featureLabel} is disabled in official Shipstamp builds. Build from source to enable source-only features.`
    );
  }
}
