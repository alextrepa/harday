const { spawnSync } = require("node:child_process");
const path = require("node:path");

const command = process.argv[2];
const embedded = process.argv.includes("--embedded");
const desktopRoot = path.resolve(__dirname, "..");
const scriptRoot = path.resolve(__dirname);

const env = {
  ...process.env,
  TIMETRACKER_EMBED_ACTIVITY_LOGGER: embedded ? "true" : "false",
  VITE_ENABLE_ACTIVITY_LOGGER: embedded ? "true" : "false",
  VITE_EMBED_ACTIVITY_LOGGER: embedded ? "true" : "false",
  PATH: [path.join(desktopRoot, "bin"), process.env.PATH ?? ""].filter(Boolean).join(path.delimiter),
};

run(process.execPath, [path.join(scriptRoot, "prepare-agent.cjs")], {
  cwd: desktopRoot,
  env,
});

switch (command) {
  case "build":
    runPnpmCommand(["--dir", "../..", "--filter", "@timetracker/web", "build", "--mode", "desktop"], {
      cwd: desktopRoot,
      env,
    });
    break;
  case "start":
    runPnpmCommand(["exec", "electron", "."], {
      cwd: desktopRoot,
      env: withoutElectronRunAsNode(env),
    });
    break;
  default:
    console.error(`Unsupported renderer command: ${command ?? "<missing>"}`);
    process.exit(1);
}

function withoutElectronRunAsNode(baseEnv) {
  const nextEnv = { ...baseEnv };
  delete nextEnv.ELECTRON_RUN_AS_NODE;
  return nextEnv;
}

function runPnpmCommand(args, options) {
  if (process.platform === "win32") {
    run(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "corepack", "pnpm", ...args], options);
    return;
  }

  run("corepack", ["pnpm", ...args], options);
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
