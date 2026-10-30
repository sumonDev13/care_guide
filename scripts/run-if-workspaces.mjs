// Root helper: run an npm script in every workspace, tolerating the "no apps
// scaffolded yet" state today while faithfully propagating real script failures
// once workspaces exist. (npm's --if-present covers missing script *names*,
// not a zero-workspace budget, which exits with "No workspaces found!".)
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const script = process.argv[2];
if (!script) {
  console.error("usage: node scripts/run-if-workspaces.mjs <script>");
  process.exit(1);
}

const appsDir = path.join(import.meta.dirname, "..", "apps");
const hasWorkspaces =
  existsSync(appsDir) &&
  readdirSync(appsDir).some((entry) => existsSync(path.join(appsDir, entry, "package.json")));

if (!hasWorkspaces) {
  console.log("No workspaces yet — nothing to run. (Workspace apps are added in later steps.)");
  process.exit(0);
}

const result = spawnSync("npm", ["run", "--workspaces", "--if-present", script], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
