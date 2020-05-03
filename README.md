# Electron + ALM Demo

Copyright ChartIQ 2020. All rights reserved.

This repo demo's a compiled ALM program working with Electron
as a native node module.

## Getting Started
- Follow the set up steps for Neon CLI here: https://neon-bindings.com/docs/getting-started . This includes installing Rust and the windows-build-tools for node-gyp support.
- Make sure you have Yarn installed: https://yarnpkg.com/getting-started/install `npm i -g yarn`
- In the root of the repo:
  - run `yarn` to install packages. This will also build the Rust lib.
  - Run `yarn start` to start the Electron app.

There's a known bug where the color change doesn't kick in until after the first drag.