import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("desktop connector lifecycle", () => {
  it("acquires the single-instance lock before starting application services", async () => {
    const source = await readFile(
      new URL("./electron/main.cjs", import.meta.url),
      "utf8",
    );

    const lockIndex = source.indexOf("app.requestSingleInstanceLock()");
    const readyIndex = source.indexOf("app.whenReady()");

    expect(lockIndex).toBeGreaterThan(-1);
    expect(readyIndex).toBeGreaterThan(lockIndex);
    expect(source).toContain('app.on("second-instance"');
  });

  it("uses archive-only production plugins and shuts the API down before quitting", async () => {
    const source = await readFile(
      new URL("./electron/main.cjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("allowDevelopmentPlugins: !app.isPackaged");
    expect(source).toContain("bundledPluginArchives: []");
    expect(source).not.toContain("resolveBundledPluginArchives()");
    expect(source).toContain("installedPluginDirectory:");
    expect(source).toContain('app.on("before-quit"');
    expect(source).toContain("stopInternalAppApi().finally(() => app.quit())");
  });

  it("keeps connector installation behind the active desktop window IPC bridge", async () => {
    const [mainSource, preloadSource] = await Promise.all([
      readFile(new URL("./electron/main.cjs", import.meta.url), "utf8"),
      readFile(new URL("./electron/preload.cjs", import.meta.url), "utf8"),
    ]);

    expect(preloadSource).toContain(
      'ipcRenderer.invoke("timetracker:install-connector-plugin")',
    );
    expect(mainSource).toContain(
      'ipcMain.handle("timetracker:install-connector-plugin"',
    );
    expect(mainSource).toContain("event.sender !== mainWindow.webContents");
    expect(mainSource).toContain("selectConnectorPluginArchive(");
    expect(mainSource).toContain("installConnectorPluginForServer(");
    expect(preloadSource).toContain(
      'ipcRenderer.invoke("timetracker:uninstall-connector-plugin"',
    );
    expect(mainSource).toContain(
      'ipcMain.handle("timetracker:uninstall-connector-plugin"',
    );
    expect(mainSource).toContain("uninstallConnectorPluginForServer(");
  });

  it("keeps development directory configuration out of production builds", async () => {
    const source = await readFile(
      new URL("./electron/main.cjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      "Development plugin directories are unavailable in production builds.",
    );
    expect(source).toContain("selectDevelopmentPluginDirectory(");
    expect(source).toContain("applyDevelopmentPluginDirectories(");
    expect(source).toContain("await stopInternalAppApi()");
    expect(source).toContain("await ensureInternalAppApiRunning()");
  });
});
