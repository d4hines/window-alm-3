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
            "oid": oid,
            "val": {
                "Attr_Magnitude": {
                    "magnitude_1": "Y",
                    "magnitude_ret": y
                }
            }
        }
    ]
});

const parse_result = ({ val, op }) => {
    const type = Object.keys(val)[0];
    const value = Object
        .keys(val[type])
        .sort()
        .map(x => val[type][x]);
    return { type, value, op };
}

module.exports = {
    new_window,
    open_window,
    move,
    parse_result
};
