const { EventEmitter } = require("events");
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

class Flamingo extends EventEmitter {
    constructor() {
        super();
        this.nativeFlamingo = new NativeFlamingo();
        // Incremented on every call to nativeFlamingo.
        // Every object in Flamingo's model needs an unique id.
        this.nextID = 0;
    }

    add(object) {
        const oid = this.nextID++;
        object.payload.oid = oid;
        this.nativeFlamingo.add(parse_new_object(object));
        return oid;
    }

    dispatch({type, payload}) {
        const results = this.nativeFlamingo
            .dispatch(parse_new_object({type, payload: {...payload, oid: this.nextID++}}))
            .map(parse_result);

        for (const { type, value, op } of results) {
            this.emit(type, value, op);
        }

        return results;
    }

    stop() {
        this.nativeFlamingo.stop();
    }
}

module.exports = { Flamingo };
