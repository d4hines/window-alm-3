const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { debounce } = require("lodash");
const { Flamingo } = require("../flamingo/lib");

const WM_MOUSEMOVE = 0x200

// Instantiate a new Flamingo domain.
const flamingo = new Flamingo();

const oidToBrowserWindowID = new Map();

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


  // We need to tell the window who it is.
  // As a hack to get around the async nature of loading the window,
  // we just wrap it in a timeout (not production worthy!).
  setTimeout(() => {
    win.webContents.send("oid", windowOID);
  }, 1000);

  // Add the window to the Flamingo domain.
  // Adding an object to Flamingo's domain assigns
  // and returns a unqiue object id.
  const windowOID = flamingo.add({
    type: "Flamingo/Windows",
    payload: { width, height }
  });

  oidToBrowserWindowID.set(windowOID, [win.id, width, height]);

  // Dispatch an Open_Window action to initialize it.
  flamingo.dispatch({
    type: "Flamingo/Open_Window",
    payload: { target: windowOID }
  });

  ipcMain.on("dragStart", () => {
    let { x: oldMouseX, y: oldMouseY } = screen.getCursorScreenPoint();
    win.hookWindowMessage(WM_MOUSEMOVE, debounce(() => {
      const { x: newMouseX, y: newMouseY } = screen.getCursorScreenPoint();
      const [xDiff, yDiff] = [newMouseX - oldMouseX, newMouseY - oldMouseY];
      oldMouseX = newMouseX;
      oldMouseY = newMouseY;
      flamingo.dispatch({
        type: "Flamingo/Move",
        payload: {
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
};


app.on('ready', () => {
  // Set up listeners for various changes in the Flamingo,
  // and register corresponding side effects. The ability write
  // defined fluents and watch for changes obviates the need for
  // middleware like thunks, sagas, or loops (Flamingo's approach
  // is quite similar to Redux-Loops, and they share a lineage in
  // in the FRP architecture.
  flamingo.on("final_coordinate", ([target, axis, coord], op) => {
    if (
      // We can exlcude deletions, which have an op code of -1 (insertions are +1).
      op === -1
      // The oidToBrowserWindowID map won't have entries for monitors.
      || !oidToBrowserWindowID.has(target)
    ) return;
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
    flamingo.dispatch({
      type: "Flamingo/Toggle_Grouping",
      payload: { target }
    });
  });

  // Add the monitors to Flamingo's database.
  for (const { bounds: { x, y, width, height } } of screen.getAllDisplays()) {
    const monitorOID = flamingo.add({
      type: "Flamingo/Monitors",
      payload: { width, height }
    });
    // Once added to Flamingo, we have to dispatch an action to initialize
    // their coordinates. In this future, this will accept width and height
    // as well, since they can change, but for this demo they're assumed static.
    flamingo.dispatch({
      type: "Flamingo/Set_Monitor_Bounds",
      payload: { monitor: monitorOID, monitor_x: x, monitor_y: y },
    });
  }

  // Create two windows to play with
  createWindow({ width: 400, height: 400 });
  createWindow({ width: 400, height: 600 });
  createWindow({ width: 400, height: 400 });
});
