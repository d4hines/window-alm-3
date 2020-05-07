const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { debounce } = require("lodash");
const { Flamingo } = require("../flamingo/lib");

const WM_MOUSEMOVE = 0x200

// Instantiate a new Flamingo domain.
const flamingo = new Flamingo();

const oidToBrowserWindowID = new Map();
// This is a counter that helps ensure we don't have
// collisions in our object ids.
let nextOID = 0;

const createWindow = ({ width, height }) => {
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
  oidToBrowserWindowID.set(windowOID, [win.id, width, height]);

  // We need to tell the window who it is.
  // As a hack to get around the async nature of loading the window,
  // we just wrap it in a timeout (not production worthy!).
  setTimeout(() => {
    win.webContents.send("oid", windowOID);
  }, 1000);

  // Add the window to the Flamingo domain.
  flamingo.add({
    type: "Flamingo/Windows",
    payload: { oid: windowOID, width, height }
  });

  // Dispatch an Open_Window action to initialize it.
  const openOID = nextOID++;
  flamingo.dispatch({
    type: "Flamingo/Open_Window",
    payload: { oid: openOID, target: windowOID }
  });

  ipcMain.on("dragStart", () => {
    let { x: oldMouseX, y: oldMouseY } = screen.getCursorScreenPoint();
    win.hookWindowMessage(WM_MOUSEMOVE, debounce(() => {
      const { x: newMouseX, y: newMouseY } = screen.getCursorScreenPoint();
      const [xDiff, yDiff] = [newMouseX - oldMouseX, newMouseY - oldMouseY];
      oldMouseX = newMouseX;
      oldMouseY = newMouseY;
      const moveOID = nextOID++;
      flamingo.dispatch({
        type: "Flamingo/Move",
        payload: {
          oid: moveOID,
          target: windowOID,
          magnitude_x: xDiff,
          magnitude_y: yDiff,
        }
      });
    }), 32);
  });

  ipcMain.on("dragEnd", () => {
    win.unhookWindowMessage(WM_MOUSEMOVE);
  });

  return windowOID;
};


app.on('ready', () => {
  // Add the monitors to Flamingo's database.
  for (const { bounds: { x, y, width, height } } of screen.getAllDisplays()) {
    const monitorOID = nextOID++;
    flamingo.add({
      type: "Flamingo/Monitors",
      payload: { oid: monitorOID, width, height }
    });
    // Once added to Flamingo, we have to dispatch an action to initialize
    // their coordinates. In this future, this will accept width and height
    // as well, since they can change, but for this demo they're assumed static.
    flamingo.dispatch({
      type: "Flamingo/Set_Monitor_Bounds",
      payload: { oid: nextOID++, monitor: monitorOID, monitor_x: x, monitor_y: y },
    });
  }

  // Create two windows to play with
  createWindow({ width: 400, height: 400 });
  createWindow({ width: 400, height: 600 });
  createWindow({ width: 400, height: 400 });

  flamingo.on("final_coordinate", ([target, axis, coord], op) => {
    if (op === -1) return;
    const [browserID, width, height] = oidToBrowserWindowID.get(target);
    const browserWindow = BrowserWindow.fromId(browserID);
    browserWindow.setBounds({ [axis.toLowerCase()]: coord, width, height });
  });

  flamingo.on("group_icon", ([target, icon], op) => {
    if (op === -1) return;
    const [browserID] = oidToBrowserWindowID.get(target);
    const browserWindow = BrowserWindow.fromId(browserID);
    browserWindow.webContents.send("group_icon", icon)
  });

  ipcMain.on("toggle_group", (_, target) => {
    const foo = nextOID++;
    flamingo.dispatch({
      type: "Flamingo/Toggle_Grouping",
      payload: { oid: foo, target }
    });
  });
});
