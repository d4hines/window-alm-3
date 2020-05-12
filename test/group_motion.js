const { expect } = require('chai');
const { Flamingo } = require("flamingo-runtime");


//////////////////////////////////////////////////////
// This first section is copy-pasted from ./snapping.js
///////////////////////////////////////////////////////
/**
 * Utility function for generating Final_Coordinate data
 * which is returned by Flamingo after move actions.
*/
const finalCoordinate = (windowID, axis, coord, op = 1) => ({
    type: "final_coordinate",
    // This tuple matches the function signature defined in the ALM program: 
    // "Final_Coordinate : Windows x Axes -> Integers"
    // Final_Coordinate tells us where the window is after
    // applying special conditions like snapping.
    value: [windowID, axis, coord],
    // The op value says whether the fact was added or removed.
    // A 1 says this fact became true(-1 would mean it became false)
    op,
});

/**
 * Utility function for generating Connected data
 * which is returned by Flamingo after move actions.
 */
const groupIcon = (a, b, op = 1) => ({
    op,
    type: "group_icon",
    value: [a, b]
});

describe("Groups", () => {
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
            console.log("/////////////", args[0].type);
            for (const {type, value, op} of results) {
                console.log(type, value, op);
            }
            // Narrow the results to just the insertions of final_coordinates
            const insertions = results.filter(({ type, op }) => type === "final_coordinate" && op === 1);
            for (const i of insertions) {
                const { value: [id, axis, coord] } = i;
                // For each final_coordinate, look for others with the same window and axis.
                const others = insertions
                    .filter(({ value: [otherID, otherAxis, otherCoord] }) =>
                        otherID === id
                        && otherAxis === axis
                        && coord !== otherCoord);
                // If we find more than 1, there's a problem.
                if (others.length > 1) {
                    throw new Error(`Found multiple coordinates for window ${id} on axis ${axis}`);
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
    describe("Group Icon", () => {
        let win1;
        let win2;
        let win3;
        beforeEach(() => {
            // @TODO add more comments
            // Add the windows.
            win1 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });
            win2 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });
            win3 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });

            // Initialize the windows
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win1 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win2 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win3 },
            });
        });

        it("Should show 'Form' icon when windows are connected but not grouped.", () => {
            // Move 2 110 pixels right. This cause it to snap left to 1.
            const results1 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 110, magnitude_y: 0 },
            });
            expect(results1).to.include.deep.members([
                groupIcon(win1, "Form"),
                groupIcon(win2, "Form")
            ]);

            // Move 2 way off in right field
            const results2 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 900, magnitude_y: 0 },
            });

            expect(results2).to.include.deep.members([
                groupIcon(win1, "NoIcon"),
                groupIcon(win2, "NoIcon"),
                groupIcon(win3, "NoIcon"),
            ]);

            // Move 3 to be 110 pixels right of 1.
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win3, magnitude_x: 200, magnitude_y: 0 },
            });

            // Move 2 to fill in the gap.
            const results3 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: -900, magnitude_y: 0 },
            });

            expect(results3).to.include.deep.members([
                groupIcon(win1, "Form"),
                groupIcon(win2, "Form"),
                groupIcon(win3, "Form"),
            ]);
        });

        it("Should show 'NoIcon' icon when windows not connected.", () => {
            // Move 2 Directly adjacent to 1
            const results1 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 100, magnitude_y: 0 },
            });

            expect(results1).to.include.deep.members([
                groupIcon(win1, "Form"),
                groupIcon(win2, "Form"),
            ]);

            // Move 2 way off in right field
            const results2 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 900, magnitude_y: 0 },
            });

            expect(results2).to.include.deep.members([
                groupIcon(win1, "NoIcon"),
                groupIcon(win2, "NoIcon"),
            ]);
        });
    });

    describe("Group Formation", () => {
        let win1;
        let win2;
        let win3;
        it("Toggling grouping on a window should cause any windows connected to that window to form a group.", () => {
            // In this scenario, we're going to line up windows 1, 2 and 3
            // such that they're adjacent to each other. Then we'll toggle
            // grouping on 1, so that 1, 2, and 3 form a group.

            // Add the windows.
            win1 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });
            win2 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });
            win3 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });

            // Initialize the windows
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win1 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win2 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win3 },
            });

            // Move 3 way off into right field.
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win3, magnitude_x: 1000, magnitude_y: 0 },
            });

            // Move 2 to the right of 1.
            const move1 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 100, magnitude_y: 0 },
            });
            expect(move1).to.include.deep.members([
                groupIcon(win1, "Form"),
                groupIcon(win2, "Form"),
            ]);

            // Move 3 to the right of 2.
            const move2 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win3, magnitude_x: -800, magnitude_y: 0 },
            });
            expect(move2).to.include.deep.members([
                groupIcon(win3, "Form"),
            ]);

            // The previously connected elements should stay connected.
            expect(move2).to.not.include.deep.members([
                groupIcon(win1, "Form", -1),
                groupIcon(win2, "Form", -1),
            ]);

            // Group them together.
            const group = flamingo.dispatch({
                type: "Flamingo/Toggle_Grouping",
                payload: { target: win1 },
            });

            expect(group).to.include.deep.members([
                groupIcon(win1, "Disband", 1),
                groupIcon(win2, "Disband", 1),
                groupIcon(win3, "Disband", 1),
            ]);
        });
    });

    describe("Group Motion", () => {
        it.only("Moving a window should move all other windows in the group", () => {
            // @TODO Make diagram.
            // Add the windows.
            let win1 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });
            let win2 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });
            let win3 = flamingo.add({
                type: "Flamingo/Windows",
                payload: { width: 100, height: 100 }
            });

            // Initialize the windows
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win1 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win2 },
            });
            flamingo.dispatch({
                type: "Flamingo/Open_Window",
                payload: { target: win3 },
            });

            // Move 2 to the right of 1.
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 100, magnitude_y: 0 },
            });
            // Move 3 to the right of 2.
            flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win3, magnitude_x: 200, magnitude_y: 0 },
            });


            // Group them together.
            flamingo.dispatch({
                type: "Flamingo/Toggle_Grouping",
                payload: { target: win1 },
            });

            // Move window 1 10 pixels to the right.
            const results1 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win1, magnitude_x: 10, magnitude_y: 0 },
            });
            expect(results1).to.include.deep.members([
                finalCoordinate(win1, "X", 10),
                finalCoordinate(win2, "X", 110),
                finalCoordinate(win3, "X", 210),
            ]);

            // Move window 2 10 pixels to the right.
            const results2 = flamingo.dispatch({
                type: "Flamingo/Move",
                payload: { target: win2, magnitude_x: 10, magnitude_y: 0 },
            });
            expect(results2).to.include.deep.members([
                finalCoordinate(win1, "X", 20),
                finalCoordinate(win2, "X", 120),
                finalCoordinate(win3, "X", 220),
            ]);
        });

        describe("Snapping to windows", () => {
            let win1;
            let win2;
            let win3;
            beforeEach(() => {
                // We're going to be working with three windows, called 1, 2, and 3.
                // Respectively, they have coords (0,0), (100, 0), and (300, -100).
                // 1 and 2 have width and height of 100, while 3 has width and height of 300.
                win1 = flamingo.add({
                    type: "Flamingo/Windows",
                    payload: { width: 100, height: 100 }
                });
                win2 = flamingo.add({
                    type: "Flamingo/Windows",
                    payload: { width: 100, height: 100 }
                });
                win3 = flamingo.add({
                    type: "Flamingo/Windows",
                    payload: { width: 300, height: 300 }
                });

                // Initialize the windows
                flamingo.dispatch({
                    type: "Flamingo/Open_Window",
                    payload: { target: win1 },
                });
                flamingo.dispatch({
                    type: "Flamingo/Open_Window",
                    payload: { target: win2 },
                });
                flamingo.dispatch({
                    type: "Flamingo/Open_Window",
                    payload: { target: win3 },
                });

                // Move windows to starting positions
                flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { target: win2, magnitude_x: 100, magnitude_y: 0 },
                });

                flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { target: win3, magnitude_x: 300, magnitude_y: -100 },
                });

                // Group 1 and 2 together.
                flamingo.dispatch({
                    type: "Flamingo/Toggle_Grouping",
                    // You could target either 1 or 2 here.
                    payload: { target: win2 },
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
                    // We'll move 2 to within snapping range of 3, and it should carry
                    // 1 along with it.
                    const results = flamingo.dispatch({
                        type: "Flamingo/Move",
                        payload: { target: win2, magnitude_x: 90, magnitude_y: 0 },
                    });
                    expect(results).to.include.deep.members([
                        finalCoordinate(win1, "X", 100),
                        finalCoordinate(win2, "X", 200),
                    ]);
                });

                it("Should move others in the group when snapping transitively", () => {
                    // This is exactly the same as above, except this time we'll move
                    // 1, and it should have the same effect.
                    const results = flamingo.dispatch({
                        type: "Flamingo/Move",
                        payload: { target: win1, magnitude_x: 90, magnitude_y: 0 },
                    });

                    expect(results).to.include.deep.members([
                        finalCoordinate(win1, "X", 100),
                        finalCoordinate(win2, "X", 200),
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
                        payload: { target: win2, magnitude_x: 90, magnitude_y: -90 },
                    });

                    expect(results).to.include.deep.members([
                        finalCoordinate(win1, "X", 100),
                        finalCoordinate(win1, "Y", -100),
                        finalCoordinate(win2, "X", 200),
                        finalCoordinate(win2, "Y", -100),
                    ]);
                });
                it("Should move others in the group when snapping transitively", () => {
                    // This is exactly the same as above, except this time we'll move
                    // 1, and it should have the same effect.
                    const results = flamingo.dispatch({
                        type: "Flamingo/Move",
                        payload: { target: win1, magnitude_x: 90, magnitude_y: -90 },
                    });

                    expect(results).to.include.deep.members([
                        finalCoordinate(win1, "X", 100),
                        finalCoordinate(win1, "Y", -100),
                        finalCoordinate(win2, "X", 200),
                        finalCoordinate(win2, "Y", -100),
                    ]);
                });
            });
        });

        describe("Snapping to sides of monitors", () => {
            let monitor;
            let win2;
            let win3;

            beforeEach(() => {
                // We're going to be working with a monitor called 1.
                // It's the primary, so it starts at (0,0), and has a
                // width and height of 800x600.

                // Add monitor
                monitor = flamingo.add({
                    type: "Flamingo/Monitors",
                    payload: { width: 800, height: 600 }
                });
                // Initialize monitor coords.
                flamingo.dispatch({
                    type: "Flamingo/Set_Monitor_Bounds",
                    payload: { monitor, monitor_x: 0, monitor_y: 0 },
                });

                // We'll also be working with two windows, called 2 and 3.
                // Both windows have a width and height of 100. Their coords
                // are (0,0) and (100, 0), respectively.
                win2 = flamingo.add({
                    type: "Flamingo/Windows",
                    payload: { width: 100, height: 100 }
                });
                win3 = flamingo.add({
                    type: "Flamingo/Windows",
                    payload: { width: 100, height: 100 }
                });
                // Initialize the windows
                flamingo.dispatch({
                    type: "Flamingo/Open_Window",
                    payload: { target: win2 },
                });
                flamingo.dispatch({
                    type: "Flamingo/Open_Window",
                    payload: { target: win3 },
                });

                // Move window 3 to its starting positions
                flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { target: win3, magnitude_x: 100, magnitude_y: 0 },
                });

                // Group 1 and 2 together.
                flamingo.dispatch({
                    type: "Flamingo/Toggle_Grouping",
                    // You could target either 2 or 3 here.
                    payload: { target: win2 },
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
                    payload: { target: win2, magnitude_x: 10, magnitude_y: 100 },
                });

                expect(results).to.include.deep.members([
                    finalCoordinate(win2, "Y", 100),
                    finalCoordinate(win3, "Y", 100),
                ]);
            });

            it("Should move others in the group when snapping directly", () => {
                // This is exactly the same above, except this time we'll move
                // 3, and it should have the same effect.
                const results = flamingo.dispatch({
                    type: "Flamingo/Move",
                    payload: { target: win3, magnitude_x: 10, magnitude_y: 100 },
                });

                expect(results).to.include.deep.members([
                    finalCoordinate(win2, "Y", 100),
                    finalCoordinate(win3, "Y", 100),
                ]);
            });
        });
    });
});
