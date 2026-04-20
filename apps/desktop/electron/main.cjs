const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { stat } = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, nativeImage, net, protocol, shell } = require("electron");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const staticRoot = app.isPackaged
  ? path.join(process.resourcesPath, "dist-desktop")
  : path.resolve(__dirname, "../../web/dist-desktop");
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, "assets", "harday-icon.png")
  : path.resolve(__dirname, "../../../assets/harday-icon.png");
const preloadPath = path.resolve(__dirname, "preload.cjs");
const INTERNAL_APP_API_HOST = process.env.TIMETRACKER_APP_API_HOST ?? "127.0.0.1";
const INTERNAL_APP_API_PORT = Number(process.env.TIMETRACKER_APP_API_PORT ?? 8787);
const internalAppApiRuntimeRoot = app.isPackaged
  ? path.join(process.resourcesPath, "internal-app-runtime")
  : path.resolve(__dirname, "../../..");
const internalAppApiEntryPath = app.isPackaged
  ? path.join(internalAppApiRuntimeRoot, "apps/api/src/server.ts")
  : path.resolve(__dirname, "../../api/src/server.ts");

let quitAfterShutdown = false;
let internalAppApiProcess = null;
let internalAppApiStopping = false;
let internalAppApiStartPromise = null;
let internalAppApiStopPromise = null;

async function resolveAssetPath(requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const candidate = path.resolve(staticRoot, `.${normalizedPath}`);
  const relativeCandidate = path.relative(staticRoot, candidate);

  if (relativeCandidate.startsWith("..") || path.isAbsolute(relativeCandidate)) {
    return path.join(staticRoot, "index.html");
  }

  try {
    const candidateStat = await stat(candidate);
    if (candidateStat.isDirectory()) {
      return path.join(candidate, "index.html");
    }

    return candidate;
  } catch {
    return path.join(staticRoot, "index.html");
  }
}

function registerStaticProtocol() {
  protocol.handle("app", async (request) => {
    const requestUrl = new URL(request.url);
    const assetPath = await resolveAssetPath(decodeURIComponent(requestUrl.pathname));
    return net.fetch(pathToFileURL(assetPath).toString());
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logInternalAppApiLine(line) {
  const trimmedLine = line.trim();
  if (trimmedLine) {
    console.error(`[internal-app-api] ${trimmedLine}`);
  }
}

function pipeInternalAppApiLogs(apiProcess) {
  for (const stream of [apiProcess.stdout, apiProcess.stderr]) {
    if (!stream) {
      continue;
    }

    stream.setEncoding("utf8");
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        logInternalAppApiLine(line);
      }
    });
    stream.on("end", () => {
      logInternalAppApiLine(buffer);
      buffer = "";
    });
  }
}

async function checkInternalAppApiHealth(timeoutMs = 750) {
  return await new Promise((resolve) => {
    const request = http.get(
      {
        host: INTERNAL_APP_API_HOST,
        port: INTERNAL_APP_API_PORT,
        path: "/api/health",
      },
      (response) => {
        const isHealthy = response.statusCode === 200;
        response.resume();
        response.once("end", () => resolve(isHealthy));
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error("Internal app API health check timed out"));
    });
    request.once("error", () => resolve(false));
  });
}

async function waitForInternalAppApiStartup(apiProcess) {
  let lastError = null;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (internalAppApiProcess !== apiProcess) {
      throw lastError ?? new Error("Internal connector API failed to start");
    }

    if (await checkInternalAppApiHealth()) {
      return;
    }

    if (apiProcess.exitCode !== null) {
      break;
    }

    lastError = new Error("Internal connector API is still starting");
    await delay(150);
  }

  throw lastError ?? new Error("Internal connector API failed to start");
}

async function ensureInternalAppApiRunning() {
  if (await checkInternalAppApiHealth()) {
    return;
  }

  if (internalAppApiProcess && !internalAppApiStopping) {
    await waitForInternalAppApiStartup(internalAppApiProcess);
    return;
  }

  if (internalAppApiStartPromise) {
    return await internalAppApiStartPromise;
  }

  internalAppApiStartPromise = (async () => {
    if (internalAppApiStopPromise) {
      await internalAppApiStopPromise;
    }

    if (await checkInternalAppApiHealth()) {
      return;
    }

    if (!existsSync(internalAppApiEntryPath)) {
      throw new Error(`Internal connector API entry missing: ${internalAppApiEntryPath}`);
    }

    internalAppApiStopping = false;
    const apiProcess = spawn(process.execPath, ["--experimental-strip-types", internalAppApiEntryPath], {
      cwd: internalAppApiRuntimeRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        TIMETRACKER_APP_API_HOST: INTERNAL_APP_API_HOST,
        TIMETRACKER_APP_API_PORT: String(INTERNAL_APP_API_PORT),
        TIMETRACKER_APP_API_STATE_PATH:
          process.env.TIMETRACKER_APP_API_STATE_PATH ?? path.join(app.getPath("userData"), "app-api-state.json"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    internalAppApiProcess = apiProcess;
    pipeInternalAppApiLogs(apiProcess);

    apiProcess.on("exit", (code, signal) => {
      if (internalAppApiProcess !== apiProcess) {
        return;
      }

      if (!internalAppApiStopping && code !== 0) {
        console.error(`Internal connector API exited unexpectedly (code: ${code ?? "null"}, signal: ${signal ?? "none"}).`);
      }

      internalAppApiProcess = null;
      internalAppApiStopping = false;
    });

    try {
      await waitForInternalAppApiStartup(apiProcess);
    } catch (error) {
      if (internalAppApiProcess === apiProcess) {
        internalAppApiStopping = true;
        internalAppApiProcess = null;
      }

      if (apiProcess.exitCode === null && !apiProcess.killed) {
        apiProcess.kill("SIGKILL");
      }

      throw error;
    }
  })().finally(() => {
    internalAppApiStartPromise = null;
  });

  return await internalAppApiStartPromise;
}

async function stopInternalAppApi() {
  if (internalAppApiStartPromise) {
    try {
      await internalAppApiStartPromise;
    } catch {
      // Start failures already reset internal API state.
    }
  }

  if (!internalAppApiProcess) {
    return;
  }

  if (internalAppApiStopPromise) {
    return await internalAppApiStopPromise;
  }

  const apiProcess = internalAppApiProcess;
  internalAppApiStopping = true;

  internalAppApiStopPromise = new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      if (internalAppApiProcess === apiProcess) {
        internalAppApiProcess = null;
        internalAppApiStopping = false;
      }
      resolve();
    };

    const killTimeout = setTimeout(() => {
      if (apiProcess.exitCode === null && !apiProcess.killed) {
        apiProcess.kill("SIGKILL");
      }
    }, 1500);

    apiProcess.once("exit", () => {
      clearTimeout(killTimeout);
      finish();
    });

    if (apiProcess.exitCode !== null) {
      clearTimeout(killTimeout);
      finish();
      return;
    }

    apiProcess.kill("SIGTERM");
  }).finally(() => {
    internalAppApiStopPromise = null;
  });

  return await internalAppApiStopPromise;
}

function shouldWaitForShutdown() {
  return Boolean(internalAppApiProcess || internalAppApiStartPromise || internalAppApiStopPromise);
}

async function resolveRendererUrl() {
  if (process.env.TIMETRACKER_DESKTOP_RENDERER_URL) {
    return process.env.TIMETRACKER_DESKTOP_RENDERER_URL;
  }

  return "app://local/";
}

async function createMainWindow() {
  const rendererUrl = await resolveRendererUrl();
  const allowedOrigin = new URL(rendererUrl).origin;
  const macChromeOptions =
    process.platform === "darwin"
      ? {
          titleBarStyle: "hidden",
          trafficLightPosition: { x: 16, y: 18 },
        }
      : {};

  const window = new BrowserWindow({
    width: 1320,
    height: 900,
    minWidth: 390,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#f4eee5",
    icon: iconPath,
    title: "Time Tracker",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    },
    ...macChromeOptions,
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, navigationUrl) => {
    const destination = new URL(navigationUrl);
    if (destination.origin !== allowedOrigin) {
      event.preventDefault();
      void shell.openExternal(navigationUrl);
    }
  });

  await window.loadURL(rendererUrl);
}

app.whenReady().then(async () => {
  if (process.platform === "darwin") {
    app.dock.setIcon(nativeImage.createFromPath(iconPath));
  }

  if (!process.env.TIMETRACKER_DESKTOP_RENDERER_URL) {
    registerStaticProtocol();
  }

  try {
    await ensureInternalAppApiRunning();
  } catch (error) {
    console.error("Failed to start internal connector API.", error);
  }

  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (quitAfterShutdown || !shouldWaitForShutdown()) {
    return;
  }

  event.preventDefault();
  quitAfterShutdown = true;
  void Promise.allSettled([stopInternalAppApi()]).finally(() => {
    app.quit();
  });
});
