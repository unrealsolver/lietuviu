import { translategemma } from "./integrations/translategemma/";
import { vduKirciuoklis } from "./integrations/vdu_kirciuoklis";
import type { ProcessingRuntimeConfig } from "./runtime";

export const processingConfig: ProcessingRuntimeConfig = {
  paths: {
    inDir: "../databanks/sources",
    outDir: "../databanks/dist",
  },
  plugins: [translategemma(), vduKirciuoklis()],
  defaults: {
    replayPolicy: "REPLAY_THEN_LIVE",
    featureConcurrency: 4,
    errorPolicy: "FAIL",
  },
};
