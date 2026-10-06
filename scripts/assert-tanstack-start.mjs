/**
 * Fail the build if TanStack Start is below the XSS fix (1.168.60)
 * or if the vulnerable-deploy override is switched on.
 * Redeploying an older git commit still builds that commit; this guard
 * stops the current tree from shipping a downgraded package.
 */
import { readFileSync } from "node:fs";

const MINIMUM = [1, 168, 60];
const pkg = JSON.parse(
  readFileSync(new URL("../node_modules/@tanstack/react-start/package.json", import.meta.url), "utf8"),
);

function olderThanMinimum(version) {
  const parts = String(version)
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < MINIMUM.length; i += 1) {
    if (parts[i] !== MINIMUM[i]) return parts[i] < MINIMUM[i];
  }
  return false;
}

if (process.env.DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS === "1") {
  console.error("Build refused: DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS must stay unset.");
  process.exit(1);
}

if (olderThanMinimum(pkg.version)) {
  console.error(
    `Build refused: @tanstack/react-start@${pkg.version} is below 1.168.60. Do not redeploy a pre-patch commit.`,
  );
  process.exit(1);
}

console.log(`@tanstack/react-start@${pkg.version} ok`);
