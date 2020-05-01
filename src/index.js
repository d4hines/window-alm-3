
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { Flamingo } = require("../flamingo/lib");


const flamingo = new Flamingo(0, "bob", "dylan", "bob@gmail.com");
console.log(JSON.stringify(flamingo.getNewObject(), undefined, 2))

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

  // ipcMain.on("dragStart", () => {
  //   const { x: oldMouseX, y: oldMouseY } = screen.getCursorScreenPoint();
  //   const { x: oldWindowX, y: oldWindowY, width, height } = mainWindow.getBounds();
  //   mainWindow.hookWindowMessage(WM_MOUSEMOVE, () => {
  //     const { x: newMouseX, y: newMouseY } = screen.getCursorScreenPoint();
  //     const [xDiff, yDiff] = [newMouseX - oldMouseX, newMouseY - oldMouseY];
  //     const [newWindowX, newWindowY, color, js_x, js_y, js_color] = hello(xDiff, yDiff, oldWindowX, oldWindowY, width, height);

  //     mainWindow.setBounds({
  //       x: js_x,
  //       y: js_y
  //     });
  //     mainWindow.webContents.send("color", js_color.toLowerCase().includes("red") ? "red" : "blue");
  //   });
  // });

  // ipcMain.on("dragEnd", () => {
  //   console.log("Drag Ended!");
  //   mainWindow.unhookWindowMessage(WM_MOUSEMOVE);
  // });
};

app.on('ready', createWindow);
