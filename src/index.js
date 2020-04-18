
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { hello } = require("../flamingo/lib");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const WM_MOUSEMOVE = 0x200

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  ipcMain.on("dragStart", () => {
    const { x: oldMouseX, y: oldMouseY } = screen.getCursorScreenPoint();
    const { x: oldWindowX, y: oldWindowY, width, height } = mainWindow.getBounds();
    mainWindow.hookWindowMessage(WM_MOUSEMOVE, () => {
      const { x: newMouseX, y: newMouseY } = screen.getCursorScreenPoint();
      const [xDiff, yDiff] = [newMouseX - oldMouseX, newMouseY - oldMouseY];
      const [newWindowX, newWindowY, color] = hello(xDiff, yDiff, oldWindowX, oldWindowY, width, height);

      mainWindow.setBounds({
        x: newWindowX,
        y: newWindowY
      });
      mainWindow.webContents.send("color", color);
    });
  });

  ipcMain.on("dragEnd", () => {
    console.log("Drag Ended!");
    mainWindow.unhookWindowMessage(WM_MOUSEMOVE);
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
