const path = require("node:path");

const windowsSetupIcon = path.resolve(__dirname, "../../assets/harday-icon.ico");

module.exports = {
  packagerConfig: {
    asar: true,
    out: "out",
    executableName: "HarDay",
    appBundleId: "com.timetracker.harday",
    appCategoryType: "public.app-category.productivity",
    icon: path.resolve(__dirname, "../../assets/harday-icon"),
    ignore: [/^\/bin(?:\/|$)/, /^\/build(?:\/|$)/, /^\/node_modules(?:\/|$)/, /^\/out(?:\/|$)/],
    extraResource: [
      path.resolve(__dirname, "../web/dist-desktop"),
      path.resolve(__dirname, "../../assets"),
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: {
        name: "HarDay",
        icon: path.resolve(__dirname, "../../assets/harday-icon.icns"),
        format: "ULFO",
        overwrite: true,
      },
    },
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "harday",
        authors: "TimeTracker",
        description: "HarDay desktop app for local-first time tracking.",
        setupExe: "HarDay-Setup.exe",
        setupIcon: windowsSetupIcon,
      },
    },
  ],
};
