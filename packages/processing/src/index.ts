import { processingConfig } from "./config";
import { runProcessing } from "./runtime";
import { exit } from "node:process";

exit(await runProcessing(processingConfig));
