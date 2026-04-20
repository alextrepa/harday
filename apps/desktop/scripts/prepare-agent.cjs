const { spawnSync } = require("node:child_process");
const { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } = require("node:fs");
const path = require("node:path");

const shouldEmbed = process.env.TIMETRACKER_EMBED_ACTIVITY_LOGGER === "true";
const desktopRoot = path.resolve(__dirname, "..");
const agentProjectRoot = path.resolve(desktopRoot, "../macos-agent");
const embeddedOutputDir = path.resolve(desktopRoot, "build/embedded-agent");
const embeddedBinaryPath = path.join(embeddedOutputDir, "timetracker-agent");

if (!shouldEmbed) {
  process.exit(0);
}

if (!existsSync(agentProjectRoot)) {
  if (existsSync(embeddedBinaryPath)) {
    process.exit(0);
  }

  console.error(`Missing embedded agent project: ${agentProjectRoot}`);
  process.exit(1);
}

const buildResult = spawnSync("swift", ["build", "-c", "release", "--product", "timetracker-agent"], {
  cwd: agentProjectRoot,
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

const builtBinaryPath = findAgentBinary(path.resolve(agentProjectRoot, ".build"));

if (!builtBinaryPath) {
  console.error("Unable to locate the built timetracker-agent binary.");
  process.exit(1);
}

mkdirSync(embeddedOutputDir, { recursive: true });
copyFileSync(builtBinaryPath, embeddedBinaryPath);
chmodSync(embeddedBinaryPath, 0o755);

function findAgentBinary(searchRoot) {
  if (!existsSync(searchRoot)) {
    return null;
  }

  const stack = [searchRoot];
  const matches = [];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath) {
      continue;
    }

    for (const entry of readdirSync(currentPath)) {
      const entryPath = path.join(currentPath, entry);
      const stats = statSync(entryPath);

      if (stats.isDirectory()) {
        stack.push(entryPath);
        continue;
      }

      if (stats.isFile() && entry === "timetracker-agent") {
        matches.push(entryPath);
      }
    }
  }

  return matches.find((match) => match.includes(`${path.sep}release${path.sep}`)) ?? matches[0] ?? null;
}
