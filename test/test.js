const { expect } = require('chai');
const { Flamingo } = require("../flamingo/lib");
const { new_window } = require("../src/convert");

/**Utility function for generating Final_Coordinate data
 * which is returned by Flamingo after move actions.
*/
const finalCoordinate = (windowID, axis, coord) => ({
  type: "final_coordinate",
  // This tuple matches the ALM function signature: 
  // "Final_Coordinate : Windows x Axes -> Integers"
  value: [windowID, axis, coord],
  // The 1 says this fact became true (-1 means it became false)
  op: 1
});

describe('Window Motion', () => {
  let flamingo;

  beforeEach(() => {
    // This spins up a new Flamingo database (in memory)
    flamingo = new Flamingo();
  });

  afterEach(() => {
    // This wipes and shuts down the database.
    flamingo.stop();
  });

  describe("Opening a Window", () => {
    it.only("Should initialize their coordinates to (0, 0)", () => {

      // Opening a window happens in two phases: first, you have
      // to add the windwo to the database (see below); then,
      // you have to dispatch a "open" action targeting that window.

      // Before you can dispatch actions that target an object,
      // you must add that object to Flamingo's database.
      // We'll add window 1.
      flamingo.add({
        type: "Flamingo/Windows",
        // Every object (including every action) must have
        // a unique object id (oid).
        payload: { oid: 1, width: 300, height: 300 }
      });

      // Dispatching an action synchronously returns the new
      // state that results from that action.
      const results = flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 2, target: 1 },
      });

      expect(results).to.have.deep.members([
        finalCoordinate(1, "X", 0),
        finalCoordinate(1, "Y", 0)
      ]);
    });
  });

  // describe('Window snapping', () => {
  //   // We're going to be working with two windows, 1 and 2
  //   // We'll open them both,
  //   beforeEach(() => {
  //     // Add window 1 to the domain, with width and height 300
  //     flamingo.add(fsaToFlamingo({
  //       type: "add/window",
  //       payload: { oid: 1, width: 300, height: 300 }
  //     }));

  //     // Add window 2 to the domain, with width and height 100
  //     flamingo.add(fsaToFlamingo({
  //       type: "add/window",
  //       payload: { oid: 2, width: 100, height: 100 }
  //     }));

  //     // Open both windows, which initializes their coords at (0, 0)
  //     flamingo.dispatch(fsaToFlamingo({
  //       type: "action/open",
  //       payload: { oid: 3, target: 1 },
  //     }));
      
  //     flamingo.dispatch(fsaToFlamingo({
  //       type: "action/open",
  //       payload: { oid: 4, target: 2 },
  //     }));
  //   });

  //   it('Snap Left', function () {
  //     // We're going to start with both at (0,0).
  //     // We'll move 2 to (100, 310), and it will snap
  //     // to (100, 300)
      
  //     //   0                             0
  //     //   +-----------+                 +-----------+
  //     // 0 |           |   100         0 |           | 100
  //     //   |    1      |  +---+          |   1       +----+
  //     //   |           |  |310|   +--->  |           |300 |
  //     //   |           |  +---+          |           +----+
  //     //   |           |    2            |           |  2
  //     //   +-----------+                 +-----------+

  //     const results = flamingo.dispatch(fsaToFlamingo({
  //       type: "action/open",
  //       payload: { target: 2 },
  //     }));

  //   });
  // });
});
