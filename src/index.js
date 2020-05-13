const { app } = require('electron');
const { Flamingo } = require("flamingo-runtime");
const { setupSideEffects, createWindow } = require("./side_effects");

// Instantiate a new Flamingo domain.
const flamingo = new Flamingo();

const oidToBrowserWindowID = new Map();

app.on('ready', () => {
  // Register all the side effects on Flamingo's event emitter.
  setupSideEffects(flamingo, oidToBrowserWindowID);

  // Setup a few windows to play with.
  createWindow(flamingo, oidToBrowserWindowID, { width: 500, height: 700 });
  createWindow(flamingo, oidToBrowserWindowID, { width: 500, height: 600 });
  for (let i = 0; i < 3; i++) {
    let win = createWindow(flamingo, oidToBrowserWindowID, { width: 400, height: 400 });
    flamingo.dispatch({
      type: "Flamingo/Move",
      payload: { target: win, magnitude_x: 2800 + i * 400, magnitude_y: 0 }
    });
  }
});
