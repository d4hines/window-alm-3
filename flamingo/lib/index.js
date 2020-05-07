const { Flamingo: NativeFlamingo } = require('../native');

const parse_new_object = ({ type, payload }) => {
    // The type is namespaced, e.g. "Flamingo/Move"
    // Chop off everything up to the "/"
    const sort = type.replace(/.*\//, "");
    const oid = payload.oid;
    delete payload.oid;
    const attributes = Object.keys(payload)
        .reduce((prev, curr) => {
            // Due to the way it's serialized, every attribute
            // gets an extra level of nesting,
            // e.g. { height { height: 100 }}
            prev[curr] = { [curr]: payload[curr] }
            return prev;
        }, {});

    return {
        oid,
        sort,
        attributes
    }
}

const parse_result = ({ val, op }) => {
    const type = Object.keys(val)[0];
    const value = Object
        .keys(val[type])
        .sort()
        .map(x => val[type][x]);
    return { type, value, op };
}

class Flamingo {
    constructor() {
        this.nativeFlamingo = new NativeFlamingo();
    }

    add(object) {
        this.nativeFlamingo.add(parse_new_object(object));
    }

    dispatch(action) {
        return this.nativeFlamingo
            .dispatch(parse_new_object(action))
            .map(parse_result);
    }

    stop() {
        this.nativeFlamingo.stop();
    }
}

module.exports = { Flamingo };
