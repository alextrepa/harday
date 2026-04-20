const { execFileSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../../..");
const modules = ["macos-alias", "fs-xattr"];

for (const moduleName of modules) {
  try {
    require(moduleName);
  } catch {
    execFileSync("npm", ["rebuild", moduleName, "--build-from-source"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  }
}
