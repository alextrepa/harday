const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("timetrackerDesktop", {
  bootstrapLocalState: ipcRenderer.sendSync("timetracker:get-bootstrap-local-state"),
});
