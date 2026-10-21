import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const tmp = mkdtempSync(path.join(os.tmpdir(), "rov-tests-"));

for (const t of ["stats", "mergeGames", "storage.offline", "matchSync"]) {
  run(`node tests/${t}.test.mjs`);
}
for (const t of ["playedAt", "rivalBrief"]) {
  const out = path.join(tmp, `${t}.test.mjs`);
  run(`npx esbuild tests/${t}.test.mjs --bundle --platform=node --format=esm --alias:@=. --loader:.js=jsx --outfile="${out}" --log-level=error`);
  run(`node "${out}"`);
}
console.log("ALL TESTS OK");
