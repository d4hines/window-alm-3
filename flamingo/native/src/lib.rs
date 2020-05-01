#![allow(non_camel_case_types, non_snake_case)]
use differential_datalog::ddval;
use differential_datalog::ddval::DDValConvert;
use differential_datalog::program::RelId;
use differential_datalog::program::Update;
use differential_datalog::record::Record;
use differential_datalog::DDlog;
use logic_ddlog::api::HDDlog;
use types::*;
use value::Relations;
use value::Value;

// Neon imports
use neon::prelude::*;

#[macro_use]
extern crate neon;
#[macro_use]
extern crate neon_serde;
#[macro_use]
extern crate serde_derive;

// Struct for the DB.
pub struct Flamingo {
    id: i32,
    first_name: String,
    last_name: String,
    email: String,
    hddlog: HDDlog,
}

fn new_object_to_cmd(new_object: NewObject) -> Vec<Update<ddval::DDValue>> {
    let obj = vec![Update::Insert {
        relid: Relations::Object as RelId,
        v: Value::Object(new_object.object).into_ddvalue(),
    }];
    let attributes = new_object
        .attributes
        .iter()
        .map(|a| Update::Insert {
            relid: Relations::Attribute as RelId,
            v: Value::Attribute(a.clone()).into_ddvalue(),
        })
        .collect();

    let all = vec![obj, attributes];

    all.concat()
}

// These match the values
#[derive(Eq, Ord, Clone, Hash, PartialEq, PartialOrd, Serialize, Deserialize, Default)]
struct StateChange {
    val: Output_Value,
    op: isize,
}

impl Flamingo {
    fn add(&self, new_object: NewObject) {
        let cmds = new_object_to_cmd(new_object);
        self.hddlog.transaction_start().unwrap();
        self.hddlog.apply_valupdates(cmds.into_iter()).unwrap();
        self.hddlog.transaction_commit();
    }

    fn dispatch(&self, action: NewObject) -> Vec<StateChange> {
        ///////////// Phase 1: Add Action //////////////////
        let action_cmds = new_object_to_cmd(action);
        self.hddlog.transaction_start().unwrap();
        self.hddlog
            .apply_valupdates(action_cmds.into_iter())
            .unwrap();
        let mut action_delta = self.hddlog.transaction_commit_dump_changes().unwrap();
        //////////////// Phase 2: Stabilize New State ////////////////
        // Extract the OutFluents returned from the action transaction.
        let outfluents = action_delta.get_rel(Relations::OutFluent as RelId);
        // Map each of them into InFluents
        let outfluent_cmds: Vec<Update<ddval::DDValue>> = outfluents
            .into_iter()
            .map(|(val, _)| unsafe {
                // The call to Value::OutFluent is unsafe.
                let Value::OutFluent(outfluent_ref) = DDValConvert::from_ddvalue_ref(val);
                let outfluent = outfluent_ref.clone();
                let influent = InFluent {
                    params: outfluent.params,
                    ret: outfluent.ret,
                };
                // We use InsertOrUpdate so as to avoid duplcating fluent values (fluents are functions)
                Update::InsertOrUpdate {
                    relid: Relations::InFluent as RelId,
                    v: Value::InFluent(influent).into_ddvalue(),
                }
            })
            .collect();
            
        // Transact the new InFluents
        self.hddlog.transaction_start().unwrap();
        
        self.hddlog
            .apply_valupdates(outfluent_cmds.into_iter())
            .unwrap();
        // This contains the new stable state.
        let mut influent_delta = self.hddlog.transaction_commit_dump_changes().unwrap();
        // Map each item to a (Output_Value, isize). The isize is either +1 or -1, where +1 means insertion
        // and -1 means deletion
        action_delta
            .get_rel(Relations::Output as RelId)
            .into_iter()
            .map(|(val, op)| unsafe {
                // The call to Value::Output is unsafe.
                let Value::Output(outfluent_ref) = DDValConvert::from_ddvalue_ref(val);
                let output = outfluent_ref.clone();
                StateChange {
                    val: output.val,
                    op: *op,
                }
            })
            .into_iter()
            .collect()
    }
}

declare_types! {
    pub class JsFlamingo for Flamingo {
        init(mut cx) {
          let id = cx.argument::<JsNumber>(0)?;
          let first_name: Handle<JsString> = cx.argument::<JsString>(1)?;
          let last_name: Handle<JsString> = cx.argument::<JsString>(2)?;
          let email: Handle<JsString> = cx.argument::<JsString>(3)?;

          fn cb(_rel: usize, _rec: &Record, _w: isize) {}
          let mut hddlog = HDDlog::run(1 as usize, false, cb).unwrap();

          Ok(Flamingo {
            id: id.value() as i32,
            first_name: first_name.value(),
            last_name: last_name.value(),
            email: email.value(),
            hddlog,
          })
        }
    
        method getNewObject(mut cx) {
            let attrs = vec![
                Attribute {
                    oid: 1,
                    val: AttributeValue::Attr_Target {target_1: 100}
                },
                Attribute {
                    oid: 1,
                    val: AttributeValue::Attr_Magnitude {magnitude_1: Axes::X, magnitude_ret: 100}
                },
                Attribute {
                    oid: 1,
                    val: AttributeValue::Attr_Magnitude {magnitude_1: Axes::Y, magnitude_ret: 100}
                },
            ];
            let attrs_std_Vec = std_Vec::from(attrs);
            let foo: NewObject = NewObject {
                attributes: attrs_std_Vec,
                object: types::Object {
                    oid: 1,
                    sort: Node::Windows
                }
            };

            let js_value = neon_serde::to_value(&mut cx, &foo)?;
            Ok(js_value)
        }

        method add(mut cx) {
            let arg0 = cx.argument::<JsValue>(0)?;
            let arg0_value: NewObject = neon_serde::from_value(&mut cx, arg0)?;
            let this = cx.this();
            let guard = cx.lock();
            this.borrow(&guard).add(arg0_value);
            Ok(cx.undefined().upcast())
        }

        method dispatch(mut cx) {
            let arg0 = cx.argument::<JsValue>(0)?;
            let arg0_value: NewObject = neon_serde::from_value(&mut cx, arg0)?;
            let this = cx.this();
            let guard = cx.lock();
            let results = this.borrow(&guard).dispatch(arg0_value);
            let js_value = neon_serde::to_value(&mut cx, &results)?;
            Ok(js_value)
        }
    }
}

register_module!(mut cx, {
    cx.export_class::<JsFlamingo>("Flamingo")?;
    Ok(())
});
