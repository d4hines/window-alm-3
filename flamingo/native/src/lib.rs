#![allow(non_camel_case_types, non_snake_case)]
// Neon imports
use neon::prelude::*;

mod domain {
    use differential_datalog::ddval;
    use differential_datalog::ddval::DDValConvert;
    use differential_datalog::program::RelId;
    use differential_datalog::program::Update;
    use differential_datalog::record::Record;
    use differential_datalog::DDlog;
    use types::*;
    use types::*;
    use value::Relations;
    use value::Value;

    pub type Coordinate = (i64, Axes, i64);

    pub struct Window {
        pub oid: OID,
        pub width: i64,
        pub height: i64,
    }

    pub enum Fact {
        Coordinate(Coordinate),
        Window(Window),
    }
    impl Fact {
        fn to_ddlog_insert(&self) -> Update<ddval::DDValue> {
            let v = match self {
                Fact::Coordinate((oid, axis, coord)) => {
                    let obj = types::Input_Coordinate {
                        _1: oid.clone(),
                        _2: axis.clone(),
                        ret: coord.clone(),
                    };
                    Value::Input_Coordinate(obj).into_ddvalue()
                }
                Fact::Window(win) => {
                    let obj = types::Input_Windows {
                        oid: win.oid.clone(),
                        width: win.width.clone(),
                        height: win.height.clone(),
                    };
                    Value::Input_Windows(obj).into_ddvalue()
                }
            };
            Update::Insert {
                relid: Relations::Universe as RelId,
                v,
            }
        }
    }

    pub enum Change {
        Insertion,
        Deletion,
    }

    pub type FactChange = (Fact, Change);

    pub enum Actions {
        Open_Window {
            target: OID,
        },
        Drag {
            target: OID,
            distance: i64,
            direction: Directions,
        },
    }
}

// DDlog imports
use differential_datalog::ddval::DDValConvert;
use differential_datalog::program::RelId;
use differential_datalog::record::Record;
use differential_datalog::DDlog;
use logic_ddlog::api::HDDlog;
use types::*;
use value::Relations;
use value::Value;
// Struct for the DB.
pub struct Flamingo {
    hddlog: HDDlog,
}

impl Flamingo {
    fn add(&self, fact: domain::Fact) -> OID {
        return 0;
    }

    fn dispatch(&self, action: domain::Actions) {}
}

declare_types! {
    /// JS class wrapping Flamingo struct.
    pub class JSFlamingo for Flamingo {
        init(mut cx) {
            fn cb(_rel: usize, _rec: &Record, _w: isize) {}
            let mut hddlog = HDDlog::run(1 as usize, false, cb).unwrap();
            Ok(Flamingo { hddlog })
        }
        method add(mut cx) {
            // Take the first argument, which must be an array
            let js_arr_handle: Handle<JsArray> = cx.argument(0)?;
            // Convert a JsArray to a Rust Vec
            let obj1 = js_arr_handle.get(&mut cx, 0)
                .unwrap().downcast::<JsString>().unwrap();
            let obj2 = obj1.value();
            let obj3 = obj2.as_str();
            let fact = match obj3 {
                "windows" => {
                    let oid = js_arr_handle.get(&mut cx, 1)
                        .unwrap().downcast::<JsNumber>()
                        .unwrap().value() as i64;
                    let width = js_arr_handle.get(&mut cx, 2)
                        .unwrap().downcast::<JsNumber>()
                        .unwrap().value() as i64;
                    let height = js_arr_handle.get(&mut cx, 3)
                        .unwrap().downcast::<JsNumber>()
                        .unwrap().value() as i64;
                    Ok(domain::Fact::Window(domain::Window{ oid, width, height }))
                }
                _ => Err("Invalid add")
            };
            let this = cx.this();
            let guard = cx.lock();
            let result = this.borrow(&guard).add(fact.unwrap());
            Ok(cx.undefined().upcast())
        }
    }
}

register_module!(mut cx, {
    cx.export_class::<JSFlamingo>("Flamingo")?;
    Ok(())
});
