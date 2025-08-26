import { semver, spawnSync } from "bun";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const wanted = pkg.engines?.node;
if (!wanted) process.exit(0);

const res = spawnSync(["node", "-v"]);
const curr = res.success
  ? res.stdout.toString().trim().replace(/^v/, "")
  : null;

if (!curr || !semver.satisfies(curr, wanted)) {
  console.error(
    `✖ Node ${wanted} required, but found ${curr ?? "none"}.\nInstall the right version (nvm/Volta) and try again.`,
  );
  process.exit(1);
}
