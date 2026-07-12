import { chmodSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const HOOKS_PATH = "scripts/hooks";
const PRE_COMMIT_HOOK = `${HOOKS_PATH}/pre-commit`;
const COMMIT_MSG_HOOK = `${HOOKS_PATH}/commit-msg`;

if (existsSync(".git")) {
  execFileSync("git", ["config", "core.hooksPath", HOOKS_PATH], {
    stdio: "inherit",
  });
}

if (existsSync(PRE_COMMIT_HOOK)) {
  chmodSync(PRE_COMMIT_HOOK, 0o755);
}

if (existsSync(COMMIT_MSG_HOOK)) {
  chmodSync(COMMIT_MSG_HOOK, 0o755);
}
