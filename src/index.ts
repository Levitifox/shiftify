import { app, BrowserWindow } from "electron";

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 1100,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    win.loadFile("index.html");
});

app.on("window-all-closed", () => {
    app.quit();
});
