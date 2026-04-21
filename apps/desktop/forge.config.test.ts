import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

function loadForgeConfig() {
  const modulePath = require.resolve("./forge.config.cjs");
  delete require.cache[modulePath];
  return require(modulePath);
}

describe("desktop forge config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores the removed embedded activity logger mode", async () => {
    vi.stubEnv("TIMETRACKER_EMBED_ACTIVITY_LOGGER", "true");

    const config = await loadForgeConfig();
    const squirrelMaker = config.makers.find((maker: { name: string }) => maker.name === "@electron-forge/maker-squirrel");

    expect(config.packagerConfig.out).toBe("out");
    expect(config.packagerConfig.appBundleId).toBe("com.timetracker.harday");
    expect(config.packagerConfig.extraResource).not.toContain(expect.stringContaining("embedded-agent"));
    expect(squirrelMaker?.config).toMatchObject({
      name: "harday",
      description: "HarDay desktop app for local-first time tracking.",
      setupExe: "HarDay-Setup.exe",
    });
  });
});
