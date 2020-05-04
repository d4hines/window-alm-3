// Copyright ChartIQ 2020
#![allow(non_camel_case_types, non_snake_case)]
use differential_datalog::ddval;
use differential_datalog::ddval::DDValConvert;
use differential_datalog::program::RelId;
use differential_datalog::program::Update;
use differential_datalog::record::Record;
use differential_datalog::DDlog;
use logic_ddlog::api::HDDlog;
use types::*;
use types::Object;
use value::Relations;
use value::Value;

// Neon imports
use neon::prelude::*;

extern crate neon;
extern crate neon_serde;
#[macro_use]
extern crate serde_derive;

// Struct for the DB.
pub struct Flamingo {
    hddlog: HDDlog,
}
enum Cmd {
    Add,
    Remove
}

fn new_object_to_cmd(new_object: Object, cmd_type: Cmd) -> Vec<Update<ddval::DDValue>> {
    let obj_val = Value::Object(new_object).into_ddvalue();
    let cmd = match cmd_type {
        Cmd::Add => Update::InsertOrUpdate {
            relid: Relations::Object as RelId,
            v: obj_val,
        },
        Cmd::Remove => Update::DeleteValue {
            relid: Relations::Object as RelId,
            v: obj_val,
        }
    };
    vec![cmd]
}

// These match the values
#[derive(Eq, Ord, Clone, Hash, PartialEq, PartialOrd, Serialize, Deserialize, Default)]
struct StateChange {
    val: Output_Value,
    op: isize,
}

impl Flamingo {
    fn add(&self, new_object: Object) {
        let cmds = new_object_to_cmd(new_object, Cmd::Add);
        self.hddlog.transaction_start().unwrap();
        self.hddlog.apply_valupdates(cmds.into_iter()).unwrap();
        self.hddlog.transaction_commit().unwrap();
    }

    fn dispatch(&self, action: Object) -> Vec<StateChange> {
        ///////////// Phase 1: Add Action //////////////////
        let action_cmds = new_object_to_cmd(action.clone(), Cmd::Add);
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

        let delete_action_cmds = new_object_to_cmd(action.clone(), Cmd::Remove);
        let all_cmds = vec![outfluent_cmds, delete_action_cmds];
        // Transact the new InFluents
        self.hddlog.transaction_start().unwrap();

        self.hddlog
            .apply_valupdates(all_cmds.concat().into_iter())
            // .apply_valupdates(outfluent_cmds.into_iter())
            .unwrap();
        // This contains the new stable state.
        let mut influent_delta = self.hddlog.transaction_commit_dump_changes().unwrap();

        // Map each item to a (Output_Value, isize). The isize is either +1 or -1, where +1 means insertion
        // and -1 means deletion
        influent_delta
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

    fn stop(&mut self) {
        self.hddlog.stop().unwrap();
    }
}

declare_types! {
    pub class JsFlamingo for Flamingo {
        init(mut _cx) {
          fn cb(_rel: usize, _rec: &Record, _w: isize) {}
          let hddlog = HDDlog::run(1 as usize, false, cb).unwrap();

          Ok(Flamingo {
            hddlog,
          })
        }

        method add(mut cx) {
            let arg0 = cx.argument::<JsValue>(0)?;
            let arg0_value: Object = neon_serde::from_value(&mut cx, arg0)?;
            let this = cx.this();
            let guard = cx.lock();
            this.borrow(&guard).add(arg0_value);
            Ok(cx.undefined().upcast())
        }

        method dispatch(mut cx) {
            let arg0 = cx.argument::<JsValue>(0)?;
            let arg0_value: Object = neon_serde::from_value(&mut cx, arg0)?;
            let this = cx.this();
            let guard = cx.lock();
            let results = this.borrow(&guard).dispatch(arg0_value);
            let js_value = neon_serde::to_value(&mut cx, &results)?;
            Ok(js_value)
        }

        method stop(mut cx) {
            let mut this = cx.this();
            let guard = cx.lock();
            this.borrow_mut(&guard).stop();
            Ok(cx.undefined().upcast())
        }
    }
}

register_module!(mut cx, {
    cx.export_class::<JsFlamingo>("Flamingo")?;
    Ok(())
});
