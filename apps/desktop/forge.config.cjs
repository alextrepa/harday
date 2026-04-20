const path = require("node:path");

const embedActivityLogger = process.env.TIMETRACKER_EMBED_ACTIVITY_LOGGER === "true";
const outputDirectory = embedActivityLogger ? "out-embedded" : "out";
const dmgName = embedActivityLogger ? "HarDay Embedded" : "HarDay";
const windowsAppName = embedActivityLogger ? "harday_embedded" : "harday";
const windowsSetupIcon = path.resolve(__dirname, "../../assets/harday-icon.ico");

module.exports = {
  packagerConfig: {
    asar: true,
    out: outputDirectory,
    executableName: "HarDay",
    appBundleId: embedActivityLogger ? "com.timetracker.harday.embedded" : "com.timetracker.harday",
    appCategoryType: "public.app-category.productivity",
    icon: path.resolve(__dirname, "../../assets/harday-icon"),
    ignore: [/^\/bin(?:\/|$)/, /^\/build(?:\/|$)/, /^\/node_modules(?:\/|$)/, /^\/out(?:\/|$)/, /^\/out-embedded(?:\/|$)/],
    extraResource: [
      path.resolve(__dirname, "../web/dist-desktop"),
      path.resolve(__dirname, "../../assets"),
      ...(embedActivityLogger ? [path.resolve(__dirname, "build/embedded-agent")] : []),
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: dmgName,
        icon: path.resolve(__dirname, "../../assets/harday-icon.icns"),
        format: "ULFO",
        overwrite: true,
      },
    },
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: windowsAppName,
        authors: "TimeTracker",
        description: embedActivityLogger
          ? "HarDay desktop app with embedded activity logger support."
          : "HarDay desktop app for local-first time tracking.",
        setupExe: embedActivityLogger ? "HarDay-Embedded-Setup.exe" : "HarDay-Setup.exe",
        setupIcon: windowsSetupIcon,
      },
    },
  ],
};
