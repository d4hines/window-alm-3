let oid = -1;
const window = (width, height) => ({
    "object": {
        "oid": oid++,
        "sort": "Windows"
    },
    "attributes": [
        {
            "oid": 1,
            "val": {
                "Attr_Height": {
                    "height_1": height
                }
            }
        },
        {
            "oid": 1,
            "val": {
                "Attr_Width": {
                    "width": width
                }
            }
        }
    ]
});

const move = (target, x, y) => ({
    "object": {
      "oid": oid++,
      "sort": "Windows"
    },
    "attributes": [
      {
        "oid": 1,
        "val": {
          "Attr_Target": {
            "target_1": target
          }
        }
      },
      {
        "oid": 1,
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
