const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("timetrackerDesktop", {});
