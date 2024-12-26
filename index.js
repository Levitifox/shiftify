const { app, BrowserWindow } = require("electron/main");

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
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
