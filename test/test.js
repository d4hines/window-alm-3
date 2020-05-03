const { expect } = require('chai');
const { Flamingo } = require("../flamingo/lib");

/**
 * Utility function for generating Final_Coordinate data
 * which is returned by Flamingo after move actions.
*/
const finalCoordinate = (windowID, axis, coord) => ({
  type: "final_coordinate",
  // This tuple matches the ALM function signature: 
  // "Final_Coordinate : Windows x Axes -> Integers"
  // Final_Coordinate tells us where the window is after
  // applying special conditions like snapping.
  value: [windowID, axis, coord],
  // The 1 says this fact became true (-1 would mean it became false)
  op: 1
});

/**
 * Utility function for generating Snapped data
 * which is returned by Flamingo after move actions.
 */
const snapped = (a, b) => ({
  op: 1,
  type: "snapped",
  value: [a, b]
});

describe('Window Motion', () => {
  let flamingo;

  beforeEach(() => {
    // This spins up a new Flamingo database (in memory)
    flamingo = new Flamingo();

    // Flamingo.dispatch is how we send actions to the Flamingo database.
    // Using the awful power of Javascript prototypes, we patch Flamingo.dispatch
    // to throw an error if it ever returns more than one final coordinate
    // for a given window, which would means there's an error in the logic somewhere.
    // Eventually Flamingo will detect these kinds of mistakes itself compile-time,
    // but for now it needs the extra help.
    const dispatch = Flamingo.prototype.dispatch;
    flamingo.dispatch = (...args) => {
      const results = dispatch.apply(flamingo, args);
      // Narrow the results to just the insertions of final_coordinates
      const insertions = results.filter(({ type, op }) => type === "final_coordinate" && op === 1);
      for (const { value: [id, axis] } of insertions) {
        // For each final_coordinate, look for others with the same window and axis.
        const others = insertions
          .filter(({ value: [otherID, otherAxis] }) => otherID === id && otherAxis === axis);
        // If we find more than 1, there's a problem.
        if (others.length > 1) {
          throw new Error(`Found multiple coordinates for window ${id} on axis ${axis}`)
        }
      }
      return results;
    }
  });

  afterEach(() => {
    // This wipes and shuts down the database.
    flamingo.stop();
  });

  describe("Opening a Window", () => {
    it("Should initialize their coordinates to (0, 0)", () => {
      // Opening a window happens in two phases: first, you have
      // to add the window to the database (see below); then,
      // you have to dispatch an "open" action targeting that window.

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
      // state that results from that action occuring.
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

  describe('Window snapping', () => {
    // We're going to be working with two windows, 1 and 2
    beforeEach(() => {
      // Add window 1 to the domain, with width and height 300
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 1, width: 300, height: 300 }
      });

      // Add window 2 to the domain, with width and height 100
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });

      // Open both windows, which initializes their coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 3, target: 1 },
      });
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });
    });

    it('Should snap left', () => {
      // We're going to start with both at (0,0).
      // We'll move 2 to (310, 100), and it will snap
      // to 1 at (300, 100)
      //   0                             0
      //   +-----------+                 +-----------+
      // 0 |           |   100         0 |           | 100
      //   |    1      |  +---+          |   1       +----+
      //   |           |  |310|   +--->  |           |300 |
      //   |           |  +---+          |           +----+
      //   |           |    2            |           |  2
      //   +-----------+                 +-----------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 310, magnitude_y: 100 },
      });

      // We ignore the deletions by using .include instead of .have
      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 300),
        finalCoordinate(2, "Y", 100),
        snapped(2, 1)
      ]);
    });

    it('Should snap right', () => {
      // Same routine as before, except this time we'll
      // move 2 to (-110, 100), so it will snap left
      // to (-100, 100)
      //                     0                                 0
      //               +-----------+                     +-----------+
      //      100      |           |            100    0 |           |
      //    +-------+0 |           |             +-------+           |
      //    |       |  |    1      |             |       |    1      |
      //-110|  2    |  |           |  +--->  -100|  2    |           |
      //    |       |  |           |             |       |           |
      //    +-------+  |           |             +-------+           |
      //               +-----------+                     +-----------+
      //
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: -110, magnitude_y: 100 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", -100),
        finalCoordinate(2, "Y", 100),
        snapped(2, 1)
      ]);
    });

    it('Should snap bottom', () => {
      // Same routine as before, except this time we'll
      // move 2 to (290, -110), so it will snap bottom
      // to (-100, 100)
      //           -110
      //          +-------+             -100
      //          |       |            +-------+
      //       290|  2    |            |       |
      //          |       |         290|  2    |
      //  0       +-------+    0       |       |
      //  +-----------+        +-------+---+---+
      //  |           |        |           |
      //0 |           |      0 |           |
      //  |    1      |        |    1      |
      //  |           |  +---> |           |
      //  |           |        |           |
      //  |           |        |           |
      //  +-----------+        +-----------+

      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 290, magnitude_y: -110 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 290),
        finalCoordinate(2, "Y", -100),
        snapped(2, 1)
      ]);
    });
    it('Should snap top', () => {
      // Same routine as before, except this time we'll
      // move 2 to (100, 319), so it will snap top
      // to (100, 300)
      //        0                    0
      //  +-----------+        +-----------+
      //0 |           |      0 |           |
      //  |           |        |           |
      //  |    1      |        |    1      |
      //  |           |        |           |
      //  |           |        |           |
      //  |           |        |           |
      //  +-----------+        +--+-----+--+ 300
      //       319       +--->    | 2   |
      //     +-----+           100|     |
      //     | 2   |              +-----+
      //  100|     |
      //     +-----+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 100, magnitude_y: 319 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 100),
        finalCoordinate(2, "Y", 300),
        snapped(2, 1)
      ]);
    });
  });

  describe('Window corner snapping', () => {
    // We'll work with the same two windows to test corner snapping
    beforeEach(() => {
      // Add window 1 to the domain, with width and height 300
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 1, width: 300, height: 300 }
      });

      // Add window 2 to the domain, with width and height 100
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });

      // Open both windows, which initializes their coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 3, target: 1 },
      });

      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });
    });

    it('Should snap to the bottom left corner (snap top)', () => {
      // We're going to start with both at (0,0).
      // We'll move 2 to (10, 319), and it will snap
      // to 1 at (0, 300)
      //   0                    0
      //   +-----------+        +-----------+
      // 0 |           |      0 |           |
      //   |           |        |           |
      //   |    1      |        |    1      |
      //   |           |        |           |
      //   |           |  +---> |           |
      //   |           |        |           |
      //   +--319------+        +-----+-----+ 300
      //    +-----+             | 2   |
      //    | 2   |            0|     |
      //  10|     |             +-----+
      //    +-----+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 10, magnitude_y: 319 },
      });

      expect(results).to.include.deep.members([
        // X value shouldn't change.
        finalCoordinate(2, "Y", 300),
        snapped(2, 1)
      ]);
    });

    // The next 7 tests will just be rotations of the above scenario.
    it('Should snap to the bottom right corner (snap top)', () => {
      //      0                    0
      //      +-----------+        +-----------+
      //    0 |           |      0 |           |
      //      |           |        |           |
      //      |    1      |        |    1      |
      //      |           |        |           |
      //      |           |  +---> |           |
      //      |           |        |           |
      //      +-------319-+        +-----+-----+ 300
      //           +-----+               | 2   |
      //           | 2   |            200|     |
      //        190|     |               +-----+
      //           +-----+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 190, magnitude_y: 319 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 200),
        finalCoordinate(2, "Y", 300),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the bottom right corner (snap left)', () => {
      //  0                           0
      //  +-----------+               +-----------+
      //0 |           |             0 |           |
      //  |           |  190          |           |
      //  |    1      | +-----+       |    1      | 200
      //  |           | | 2   | +---> |           +-----+
      //  |           | |319  |       |           | 2   |
      //  |           | +-----+       |           |300  |
      //  +-----------+               +-----------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 319, magnitude_y: 190 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 300),
        finalCoordinate(2, "Y", 200),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the top right corner (snap left)', () => {
      //  0                            0
      //  +-----------+   10           +-----------+-----+
      //0 |           | +-----+      0 |           | 2   |
      //  |           | | 2   |        |           |300  |
      //  |    1      | |319  |  +---> |    1      +-----+
      //  |           | +-----+        |           |
      //  |           |                |           |
      //  |           |                |           |
      //  +-----------+                +-----------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 319, magnitude_y: 10 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 300),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the top right corner (snap bottom)', () => {
      //                 -110
      //          +-----+                      -100
      //          |  2  |                     +-----+
      //          |190  |                     |  2  |
      //   0      +-----+             0       |200  |
      //  +--------------+           +--------------+
      // 0|              |          0|              |
      //  |              |   +---->  |              |
      //  |      1       |           |      1       |
      //  |              |           |              |
      //  |              |           |              |
      //  |              |           |              |
      //  +--------------+           +--------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 190, magnitude_y: -110 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 200),
        finalCoordinate(2, "Y", -100),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the top left corner (snap bottom)', () => {
      //   -110
      //   +-----+                    -100
      //   |  2  |                   +-----+
      //   |1    |                   |  2  |
      //   +-----+                   |0    |
      //  +--------------+           +-----+--------+
      // 0|              |          0|              |
      //  |              |   +---->  |              |
      //  |      1       |           |      1       |
      //  |              |           |              |
      //  |              |           |              |
      //  |              |           |              |
      //  +--------------+           +--------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 1, magnitude_y: -110 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "Y", -100),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the top left corner (snap right)', () => {
      //           0                             0
      //    10   +--------------+        +--------------------+
      // +-----+ |0             |        | 2   |0             |
      // | 2   | |              | +----> | -100|              |
      // | -101| |      1       |        +-----+      1       |
      // +-----+ |              |              |              |
      //         |              |              |              |
      //         |              |              |              |
      //         +--------------+              +--------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: -101, magnitude_y: 10 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", -100),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the bottom left corner (snap right)', () => {
      //           0                               0
      //         +--------------+                +--------------+
      //         |0             |                |0             |
      //    190  |              | +---->         |              |
      // +-----+ |      1       |             200|      1       |
      // | 2   | |              |          +-----+              |
      // | -101| |              |          | 2   |              |
      // +-----+ |              |          | -100|              |
      //         +--------------+          +--------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: -101, magnitude_y: 190 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "Y", 200),
        finalCoordinate(2, "X", -100),
        snapped(2, 1)
      ]);
    });
  });

  describe("Snapping to the sides of Monitors", () => {
    beforeEach(() => {
      // Monitors are added in the same way as windows.
      // We'll work with a single monitor, with width 800 and height 600.
      flamingo.add({
        type: "Flamingo/Monitors",
        payload: { oid: 1, width: 800, height: 600 }
      });
      // We'll use a single window with width and height 100 for each test.
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });

      // Initialize the monitor with X and Y (since it's the primary,
      // we'll set to (0,0)).
      flamingo.dispatch({
        type: "Flamingo/Set_Monitor_Bounds",
        payload: { oid: 3, monitor: 1, monitor_x: 0, monitor_y: 0 },
      });

      // Open the window, which initializes its coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });
    });

    // Windows snap to the inside edges of monitors (as opposed to
    // the outside edges as with other windows).
    it("Should snap left", () => {
      //   0                                  0
      //   +-------------------------+        +-------------------------+
      // 0 |                         |      0 |                         |
      //   |   100                   |        | 100                     |
      //   | +-------+               |        +-------+                 |
      //   | |   2   |         1     |        |   2   |           1     |
      //   | |10     |               | +----> |0      |                 |
      //   | +-------+               |        +-------+                 |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   +-------------------------+        +-------------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 10, magnitude_y: 100 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "Y", 100),
        snapped(2, 1)
      ]);
    });

    it("Should snap top", () => {
      //   0                                  0
      //   +------10-----------------+        +-----+-------+-----------+
      // 0 |    +-------+            |      0 |     |   2   |           |
      //   |    |   2   |            |        |     |100    |           |
      //   |    |100    |            |        |     +-------+           |
      //   |    +-------+      1     |        |                   1     |
      //   |                         | +----> |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   +-------------------------+        +-------------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 100, magnitude_y: 10 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 100),
        snapped(2, 1)
      ]);
    });

    it("Should snap right", () => {
      //   0                                  0
      //   +-------------------------+        +-------------------------+
      // 0 |                         |      0 |                         |
      //   |                 100     |        |                   100   |
      //   |               +-------+ |        |                 +-------+
      //   |         1     |   2   | |        |         1       |   2   |
      //   |               |690    | | +----> |                 |700    |
      //   |               +-------+ |        |                 +-------+
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   +-------------------------+        +-------------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 690, magnitude_y: 100 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 700),
        finalCoordinate(2, "Y", 100),
        snapped(2, 1)
      ]);
    });

    it("Should snap bottom", () => {
      //   0                                  0
      //   +-------------------------+        +-------------------------+
      // 0 |                         |      0 |                         |
      //   |             1           |        |                         |
      //   |                         |        |                         |
      //   |       490               |        |                         |
      //   |     +-------+           | +----> |       500               |
      //   |     |   2   |           |        |     +-------+           |
      //   |     |100    |           |        |     |   2   |           |
      //   |     +-------+           |        |     |100    |           |
      //   +-------------------------+        +-------------+-----------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 100, magnitude_y: 490 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 100),
        finalCoordinate(2, "Y", 500),
        snapped(2, 1)
      ]);
    });
  });

  describe('Snapping to the corners of Monitors', () => {
    // We'll do the same setup as the above set of tests.
    beforeEach(() => {
      flamingo.add({
        type: "Flamingo/Monitors",
        payload: { oid: 1, width: 800, height: 600 }
      });
      // We'll use a single window with width and height 100 for each test.
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });

      // Initialize the monitor with X and Y (since it's the primary,
      // we'll set to (0,0)).
      flamingo.dispatch({
        type: "Flamingo/Set_Monitor_Bounds",
        payload: { oid: 3, monitor: 1, monitor_x: 0, monitor_y: 0 },
      });

      // Open the window, which initializes its coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });
    });

    it('Should snap to the top left corner', () => {
      //   0                                  0
      //   +----10-------------------+        +-------+-----------------+
      // 0 | +-------+               |      0 |   2   |                 |
      //   | |   2   |   1           |        |       |                 |
      //   | |10     |               |        +-------+                 |
      //   | +-------+               |        |                         |
      //   |                         | +----> |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   +-------------------------+        +-------------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 10, magnitude_y: 10 },
      });

      // No change in coordinates, since the window snapped back to its original position
      expect(results.find(({ type }) => type === "final_coordinate")).to.be.undefined;
      expect(results).to.include.deep.members([
        snapped(2, 1)
      ]);
    });

    it('Should snap to the top right corner', () => {
      //   0                                  0
      //   +-------------------10----+        +-----------------+-------+
      // 0 |               +-------+ |      0 |                 |   2   |
      //   |               |   2   | |        |                 |700    |
      //   |               |690    | |        |                 +-------+
      //   |        1      +-------+ | +----> |       1                 |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   +-------------------------+        +-------------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 690, magnitude_y: 10 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 700),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the bottom left corner', () => {
      //   0                                  0
      //   +-------------------------+        +-------------------------+
      // 0 |                         |      0 |                         |
      //   |                         |        |                         |
      //   |                         |        |                         |
      //   |        1         490    | +----> |        1                |
      //   |               +-------+ |        |                    500  |
      //   |               |   2   | |        |                 +-------+
      //   |               |690    | |        |                 |   2   |
      //   |               +-------+ |        |                 |700    |
      //   +-------------------------+        +-------------------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 690, magnitude_y: 490 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 700),
        finalCoordinate(2, "Y", 500),
        snapped(2, 1)
      ]);
    });

    it('Should snap to the bottom right corner', () => {
      //   0                                  0
      //   +-------------------------+        +-------------------------+
      // 0 |                         |      0 |                         |
      //   |                         |        |                         |
      //   |            1            |        |            1            |
      //   |    490                  | +----> |                         |
      //   | +-------+               |        |  500                    |
      //   | |   2   |               |        +-------+                 |
      //   | |10     |               |        |   2   |                 |
      //   | +-------+               |        |       |                 |
      //   +-------------------------+        +-------+-----------------+
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 10, magnitude_y: 500 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "Y", 500),
        snapped(2, 1)
      ]);
    });
  });

  describe('When not to snap', () => {
    it('Should not snap if the window overlaps another window', () => {
      // +---------+
      // |         |
      // |    1  +----------+
      // |       | |        |
      // |       | |   2    |
      // +---------+        |
      //         |          |
      //         +----------+

      // Add window 1
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 1, width: 100, height: 100 }
      });
      // Add window 2
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });
      // Open both windows, which initializes their coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 1 },
      });
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });

      // Move window 2 to (90, 50)
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 90, magnitude_y: 50 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 90),
        finalCoordinate(2, "Y", 50),
      ]);
    });

    it('Should not snap if the window overlaps a monitor', () => {
      // Same scenario as above, but this time 1 is a monitor.

      // Add the monitor
      flamingo.add({
        type: "Flamingo/Monitors",
        payload: { oid: 1, width: 800, height: 600 }
      });
      // Add the window
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });

      // Initialize the monitor with X and Y (since it's the primary,
      // we'll set to (0,0)).
      flamingo.dispatch({
        type: "Flamingo/Set_Monitor_Bounds",
        payload: { oid: 3, monitor: 1, monitor_x: 0, monitor_y: 0 },
      });

      // Open the window, which initializes its coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });

      // Move window 2 to (790, 50)
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 790, magnitude_y: 50 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 790),
        finalCoordinate(2, "Y", 50),
      ]);
    });

    it('Should not snap if not in snapping range.', () => {
      // Like other snaping tests, except we'll move
      // window 2 really far away and expect it to stay put  

      // Add window 1
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 1, width: 100, height: 100 }
      });
      // Add window 2
      flamingo.add({
        type: "Flamingo/Windows",
        payload: { oid: 2, width: 100, height: 100 }
      });
      // Open both windows, which initializes their coords at (0, 0)
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 1 },
      });
      flamingo.dispatch({
        type: "Flamingo/Open_Window",
        payload: { oid: 4, target: 2 },
      });

      // Move window 2 to (1000, 1000)
      const results = flamingo.dispatch({
        type: "Flamingo/Move",
        payload: { oid: 5, target: 2, magnitude_x: 1000, magnitude_y: 1000 },
      });

      expect(results).to.include.deep.members([
        finalCoordinate(2, "X", 1000),
        finalCoordinate(2, "Y", 1000),
      ]);
    });
  });
});
