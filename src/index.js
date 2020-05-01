const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { debounce } = require("lodash");
const { new_window, move, open_window, parse_result } = require("./convert");
const { Flamingo } = require("../flamingo/lib");

const WM_MOUSEMOVE = 0x200

// Instantiate a new Flamingo domain.
const flamingo = new Flamingo();

const oidToBrowserWindowID = new Map();
// This is a counter that helps ensure we don't have
// collisions in our object ids.
let nextOID = 0;

const createWindow = () => {
  const width = 800;
  const height = 600;

  // Create the browser window.
  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  });
  // and load the index.html of the app.
  win.loadFile(path.join(__dirname, 'index.html'));

  const windowOID = nextOID++;
  oidToBrowserWindowID.set(windowOID, win.id);

  // Add the window to the Flamingo domain.
  flamingo.add(new_window(windowOID, width, height));

  // Dispatch an Open_Window action to initialize it.
  const openOID = nextOID++;
  flamingo.dispatch(open_window(openOID, windowOID));

  ipcMain.on("dragStart", () => {
    let { x: oldMouseX, y: oldMouseY } = screen.getCursorScreenPoint();
    win.hookWindowMessage(WM_MOUSEMOVE, debounce(() => {
      const { x: newMouseX, y: newMouseY } = screen.getCursorScreenPoint();
      const [xDiff, yDiff] = [newMouseX - oldMouseX, newMouseY - oldMouseY];
      oldMouseX = newMouseX;
      oldMouseY = newMouseY;
      const moveOID = nextOID++;
      const results = flamingo.dispatch(move(moveOID, windowOID, xDiff, yDiff))
        .map(parse_result)
        .filter(({ type, op }) => type === "final_coordinate" && op === 1);
      // In a real app, this would be somewhere else, as part
      // of a dedicated "effects" module. Notice that it doesn't
      // rely on any closures in the above scope.
      results
        .forEach(({ value: [target, axis, coord] }) => {
          const browserID = oidToBrowserWindowID.get(target);
          const browserWindow = BrowserWindow.fromId(browserID);
          browserWindow.setBounds({ [axis.toLowerCase()]: coord });
        });
    }), 32);
  });

  ipcMain.on("dragEnd", () => {
    win.unhookWindowMessage(WM_MOUSEMOVE);
  });
};

app.on('ready', () => {
  createWindow();
  createWindow();
});
