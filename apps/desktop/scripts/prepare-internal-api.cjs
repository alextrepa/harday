const { cpSync, existsSync, mkdirSync, rmSync } = require("node:fs");
const path = require("node:path");

const desktopRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(desktopRoot, "../..");
const outputRoot = path.resolve(desktopRoot, "build/internal-app-runtime");

const copyTargets = [
  {
    from: path.resolve(repoRoot, "apps/api"),
    to: path.join(outputRoot, "apps/api"),
  },
  {
    from: path.resolve(repoRoot, "packages/shared"),
    to: path.join(outputRoot, "packages/shared"),
  },
  {
    from: path.resolve(repoRoot, "node_modules/zod"),
    to: path.join(outputRoot, "node_modules/zod"),
  },
];

rmSync(outputRoot, { recursive: true, force: true });

for (const target of copyTargets) {
  if (!existsSync(target.from)) {
    console.error(`Missing internal API runtime dependency: ${target.from}`);
    process.exit(1);
  }

  mkdirSync(path.dirname(target.to), { recursive: true });
  cpSync(target.from, target.to, {
    recursive: true,
    force: true,
  });
}
