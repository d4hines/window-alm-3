const new_window = (oid, width, height) => ({
    "object": {
        "oid": oid,
        "sort": "Windows"
    },
    "attributes": [
        {
            "oid": oid,
            "val": {
                "Attr_Height": {
                    "height_1": height
                }
            }
        },
        {
            "oid": oid,
            "val": {
                "Attr_Width": {
                    "width": width
                }
            }
        }
    ]
});
const open_window = (oid, target) => ({
    "object": {
        "oid": oid,
        "sort": "Open_Window"
    },
    "attributes": [
        {
            "oid": oid,
            "val": {
                "Attr_Target": {
                    "target_1": target
                }
            }
        },
    ]
});

const move = (oid, target, x, y) => ({
    "object": {
        "oid": oid,
        "sort": "Move"
    },
    "attributes": [
        {
            "oid": oid,
            "val": {
                "Attr_Target": {
                    "target_1": target
                }
            }
        },
        {
            "oid": oid,
            "val": {
                "Attr_Magnitude": {
                    "magnitude_1": "X",
                    "magnitude_ret": x
                }
            }
        },
        {
            "oid": 1,
            "val": {
                "Attr_Magnitude": {
                    "magnitude_1": "Y",
                    "magnitude_ret": y
                }
            }
        }
    ]
});
// const parse_result = ({ val, op }) => {

//     switch ()
// }
const final_coordinate = ({ val: {
    Out_Final_Coordinate: {
        final_coordinate: {
            _1,
            _2,
            _3
        }
    }
}, op }) => ([[_1, _2, _3], op]);

module.exports = {
    new_window,
    open_window,
    move,
    final_coordinate
};
