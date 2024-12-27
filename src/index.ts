import { app, BrowserWindow, dialog, ipcMain } from "electron";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

ipcMain.handle("dialog:showOpenDialog", async (_event, options) => {
    return await dialog.showOpenDialog(options);
});

app.whenReady().then(() => {
    const mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile("index.html");
});

app.on("window-all-closed", () => {
    app.quit();
});
