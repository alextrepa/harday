const { spawnSync } = require("node:child_process");
const path = require("node:path");

const command = process.argv[2];
const requestedPlatform = process.argv[3] ?? "host";
const embedded = process.argv.includes("--embedded");
const desktopRoot = path.resolve(__dirname, "..");
const scriptRoot = path.resolve(__dirname);
const repoRoot = path.resolve(desktopRoot, "../..");
const targetPlatform = requestedPlatform === "host" ? process.platform : requestedPlatform;
const electronForgeBin = path.join(path.dirname(require.resolve("@electron-forge/cli/package.json", { paths: [repoRoot] })), "dist", "electron-forge.js");

if (!["darwin", "win32"].includes(targetPlatform)) {
  console.error(`Unsupported desktop packaging platform: ${targetPlatform}`);
  process.exit(1);
}

if (command === "make" && targetPlatform === "darwin") {
  run(process.execPath, [path.join(scriptRoot, "prepare-dmg-deps.cjs")], {
    cwd: desktopRoot,
    env: process.env,
  });
}

run(process.execPath, [path.join(scriptRoot, "run-renderer.cjs"), "build", ...(embedded ? ["--embedded"] : [])], {
  cwd: desktopRoot,
  env: process.env,
});

run(process.execPath, [electronForgeBin, command, `--platform=${targetPlatform}`, ...(targetPlatform === "win32" ? ["--arch=x64"] : [])], {
  cwd: desktopRoot,
  env: withDesktopBinOnPath({
    ...process.env,
    TIMETRACKER_EMBED_ACTIVITY_LOGGER: embedded ? "true" : "false",
  }),
});

function withDesktopBinOnPath(baseEnv) {
  return {
    ...baseEnv,
    PATH: [path.join(desktopRoot, "bin"), baseEnv.PATH ?? ""].filter(Boolean).join(path.delimiter),
  };
}

function run(file, args, options) {
  const result = spawnSync(file, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
