const { expect } = require('chai');
const { Flamingo } = require("../flamingo/lib");

//////////////////////////////////////////////////////
// This first section is copy-pasted from ./snapping.js
///////////////////////////////////////////////////////
/**
 * Utility function for generating Final_Coordinate data
 * which is returned by Flamingo after move actions.
*/
const finalCoordinate = (windowID, axis, coord) => ({
    type: "final_coordinate",
    // This tuple matches the function signature defined in the ALM program: 
    // "Final_Coordinate : Windows x Axes -> Integers"
    // Final_Coordinate tells us where the window is after
    // applying special conditions like snapping.
    value: [windowID, axis, coord],
    // The op value says whether the fact was added or removed.
    // A 1 says this fact became true(-1 would mean it became false)
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

describe.only("Group Motion", () => {
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
            const { type } = args[0];
            const results = dispatch.apply(flamingo, args);
            // Narrow the results to just the insertions of final_coordinates
            const insertions = results.filter(({ type, op }) => type === "final_coordinate" && op === 1);
            for (const i of insertions) {
                console.log(i.value);
                i.value.pop();
                console.log(i.value);
                const { value: [id, axis] } = i;
                // For each final_coordinate, look for others with the same window and axis.
                const others = insertions
                    .filter(({ value: [otherID, otherAxis] }) => otherID === id && otherAxis === axis);
                // If we find more than 1, there's a problem.
                if (others.length > 1) {
                    console.error(`Found multiple coordinates for window ${id} on axis ${axis}`)
                }
            }
            return results;
        }
    });

    afterEach(() => {
        // This wipes and shuts down the database.
        flamingo.stop();
    });
    //////////////// End copy-pasted section ///////////////////////////
    ///////////////////////////////////////////////////////////////////

    it("Moving a window should move all other windows in the group", () => {
        // In this scenario, we have a group formed with windows 1 and 2.
        // We're going to move window 1 10 pixels to the right, which
        // will cause window 2 to move the same amount.
        // Here's the diagram.
        //     0                              0
        //     +---------+---------+          +---------+---------+
        //    0|         |  100    |        10|         |  110    |
        //     |  1      |   2     |  +--->   |  1      |   2     |
        //     |         |         |          |         |         |
        //     |         |         |          |         |         |
        //     +---------+---------+          +---------+---------+

        // Add the windows.
        flamingo.add({
            type: "Flamingo/Windows",
            payload: { oid: 1, width: 100, height: 100 }
        });
        flamingo.add({
            type: "Flamingo/Windows",
            payload: { oid: 2, width: 100, height: 100 }
        });

        // Initialize the windows
        flamingo.dispatch({
            type: "Flamingo/Open_Window",
            payload: { oid: 3, target: 1 },
        });
        flamingo.dispatch({
            type: "Flamingo/Open_Window",
            payload: { oid: 4, target: 2 },
        });

        // Move 2 to the right of 1.
        flamingo.dispatch({
            type: "Flamingo/Move",
            payload: { oid: 5, target: 2, magnitude_x: 100, magnitude_y: 0 },
        });
        
        // Group them together.
        flamingo.dispatch({
            type: "Flamingo/Toggle_Grouping",
            payload: { oid: 6, target: 2 },
        });
        
        // Move window 1 10 pixels to the right.
        const results = flamingo.dispatch({
            type: "Flamingo/Move",
            payload: { oid: 7, target: 1, magnitude_x: 10, magnitude_y: 0 },
        });

        expect(results).to.include.deep.members([
            finalCoordinate(1, "X", 10),
            finalCoordinate(2, "X", 110)
        ]);
    });

    describe("Snapping to windows", () => {
        beforeEach(() => {
            // We're going to be working with three windows, called 1, 2, and 3.
            // Respectively, they have coords (0,0), (100, 0), and (300, -100).
            // 1 and 2 have width and height of 100, while 3 has width and height of 300.
            flamingo.add({
                type: "Flamingo/Windows",
                payload: { oid: 1, width: 100, height: 100 }
            });
            flamingo.add({
                type: "Flamingo/Windows",
                payload: { oid: 2, width: 100, height: 100 }
            });
            flamingo.add({
                type: "Flamingo/Windows",
                payload: { oid: 3, width: 300, height: 300 }
            });

            // Initialize the windows
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { oid: 4, target: 1 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { oid: 5, target: 2 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { oid: 6, target: 3 },
            });

            // Move windows to starting positions
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { oid: 7, target: 2, magnitude_x: 100, magnitude_y: 0 },
            });
            
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { oid: 8, target: 3, magnitude_x: 300, magnitude_y: -100 },
            });

            // Group 1 and 2 together.
            flamingo.dispatch({
                type: "Flamingo/Toggle_Grouping",
                // You could target either 1 or 2 here.
                payload: { oid: 6, target: 2 },
            });
        });

        describe("Snapping to sides of windows", () => {
            // For both scenarios below, the before-and-after diagram looks like this:
            //                                   -100                                                 -100
            //                                +---------------------+                              +---------------------+
            //                                |                     |                              |                     |
            //                                |                     |                              |                     |
            //   0                            |300                  |           0                  |300                  |
            //  +-------------------+         |                     |          +-------------------+                     |
            // 0|         |100      |         |                     |       100|         |200      |                     |
            //  |    1    |    2    |         |        3            |  +---->  |    1    |    2    |        3            |
            //  |         |         |         |                     |          |         |         |                     |
            //  |         |         |         |                     |          |         |         |                     |
            //  +---------+---------+         |                     |          +---------+---------+                     |
            //                                |                     |                              |                     |
            //                                |                     |                              |                     |
            //                                +---------------------+                              +---------------------+
            it("Should move others in the group when snapping directly", () => {
                console.log("/////////////////////////////////////////");
                // We'll move 2 to within snapping range of 3, and it should carry
                // 1 along with it.
                const results = flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { oid: 8, target: 2, magnitude_x: 90, magnitude_y: 0 },
                });
                expect(results).to.include.deep.members([
                    finalCoordinate(1, "X", 100),
                    finalCoordinate(2, "X", 200),
                    snapped(2, 3)
                ]);
            });

            it("Should move others in the group when snapping transitively", () => {
                // This is exactly the same as above, except this time we'll move
                // 1, and it should have the same effect.
                const results = flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { oid: 8, target: 1, magnitude_x: 90, magnitude_y: 0 },
                });

                expect(results).to.include.deep.members([
                    finalCoordinate(1, "X", 100),
                    finalCoordinate(2, "X", 200),
                    snapped(2, 3)
                ]);
            });
        });

        describe("Snapping to corners of windows", () => {
            // For both scenarios below, the before-and-after diagram looks like this:
            //                           -100                                                 -100
            //                 -90    +---------------------+          +-------------------+---------------------+
            //  +-------------------+ |                     |          |         | 200     |                     |
            //  |         |190      | |                     |          |    1    |    2    |                     |
            //  |    1    |    2    | |300                  |          |         |         |300                  |
            //  |         |         | |                     |          |         |         |                     |
            //  |         |         | |                     |          +---------+---------+                     |
            //  +---------+---------+ |        3            |  +---->                      |        3            |
            //                        |                     |                              |                     |
            //                        |                     |                              |                     |
            //                        |                     |                              |                     |
            //                        |                     |                              |                     |
            //                        |                     |                              |                     |
            //                        +---------------------+                              +---------------------+
            it("Should move others in the group when snapping directly", () => {
                // We'll move 2 to within snapping range of 3, and it should carry
                // 1 along with it.
                const results = flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { oid: 8, target: 2, magnitude_x: 90, magnitude_y: -90 },
                });

                expect(results).to.include.deep.members([
                    finalCoordinate(1, "X", 100),
                    finalCoordinate(1, "Y", -100),
                    finalCoordinate(2, "X", 200),
                    finalCoordinate(2, "Y", -100),
                    snapped(2, 3)
                ]);
            });
            it("Should move others in the group when snapping transitively", () => {
                // This is exactly the same as above, except this time we'll move
                // 1, and it should have the same effect.
                const results = flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { oid: 8, target: 1, magnitude_x: 90, magnitude_y: -90 },
                });

                expect(results).to.include.deep.members([
                    finalCoordinate(1, "X", 100),
                    finalCoordinate(1, "Y", -100),
                    finalCoordinate(2, "X", 200),
                    finalCoordinate(2, "Y", -100),
                    snapped(2, 3)
                ]);
            });
        });
    });

    describe("Snapping to sides of monitors", () => {
        beforeEach(() => {
            // We're going to be working with a monitor called 1.
            // It's the primary, so it starts at (0,0), and has a
            // width and height of 800x600.

            // Add monitor
            flamingo.add({
                type: "Flamingo/Monitors",
                payload: { oid: 1, width: 800, height: 600 }
            });
            // We'll also be working with two windows, called 2 and 3.
            // Both windows have a width and height of 100. Their coords
            // are (0,0) and (100, 0), respectively.
            flamingo.add({
                type: "Flamingo/Windows",
                payload: { oid: 2, width: 100, height: 100 }
            });
            flamingo.add({
                type: "Flamingo/Windows",
                payload: { oid: 3, width: 100, height: 100 }
            });

            // Initialize monitor coords.
            flamingo.dispatch({
                type: "Flamingo/Set_Monitor_Bounds",
                payload: { oid: 4, monitor: 1, monitor_x: 0, monitor_y: 0 },
            });
            // Initialize the windows
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { oid: 5, target: 2 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { oid: 6, target: 3 },
            });

            // Move window 3 to its starting positions
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { oid: 7, target: 3, magnitude_x: 100, magnitude_y: 0 },
            });

            // Group 1 and 2 together.
            flamingo.dispatch({
                type: "Flamingo/Toggle_Grouping",
                // You could target either 2 or 3 here.
                payload: { oid: 8, target: 2 },
            });
        });

        // For the below two scenarios, we'll be moving the group down and right,
        // but close enough that it snaps back to the monitor. Here's the diagram:
        //           0                                         0
        //  +--------------------------------+         +--------------------------------+
        // 0|                                |        0|                                |
        //  |                           1    |         |                           1    |
        //  | 100                            |         | 100                            |
        //  |  +-------------------+         |         +-------------------+            |
        //  |10|         |110      |         |         |         |110      |            |
        //  |  |    2    |    3    |         |  +----> |    2    |    3    |            |
        //  |  |         |         |         |         |         |         |            |
        //  |  |         |         |         |         |         |         |            |
        //  |  +---------+---------+         |         +---------+---------+            |
        //  |                                |         |                                |
        //  |                                |         |                                |
        //  |                                |         |                                |
        //  +--------------------------------+         +--------------------------------+
        it("Should move others in the group when snapping directly", () => {
            // We'll move 2 to within snapping range of 1, and it should carry
            // 3 along with it.
            const results = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { oid: 8, target: 2, magnitude_x: 10, magnitude_y: 100 },
            });

            expect(results).to.include.deep.members([
                finalCoordinate(2, "Y", 100),
                finalCoordinate(3, "Y", 100),
                snapped(2, 1)
            ]);
        });

        it("Should move others in the group when snapping directly", () => {
            // This is exactly the same above, except this time we'll move
            // 3, and it should have the same effect.
            const results = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { oid: 8, target: 3, magnitude_x: 10, magnitude_y: 100 },
            });

            expect(results).to.include.deep.members([
                finalCoordinate(2, "Y", 100),
                finalCoordinate(3, "Y", 100),
                snapped(2, 1)
            ]);
        });
    });
});
