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
  createWindow(flamingo, oidToBrowserWindowID, { width: 500, height: 700 });
  createWindow(flamingo, oidToBrowserWindowID, { width: 500, height: 500 });
  createWindow(flamingo, oidToBrowserWindowID, { width: 450, height: 450 });
  createWindow(flamingo, oidToBrowserWindowID, { width: 400, height: 400 });
});
