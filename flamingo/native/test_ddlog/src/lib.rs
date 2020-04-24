#![allow(
    unused_imports,
    non_snake_case,
    non_camel_case_types,
    non_upper_case_globals,
    unused_parens,
    non_shorthand_field_patterns,
    dead_code,
    overflowing_literals,
    unreachable_patterns,
    unused_variables,
    clippy::unknown_clippy_lints,
    clippy::missing_safety_doc
)]

use num::bigint::BigInt;
use std::convert::TryFrom;
use std::ops::Deref;
use std::ptr;
use std::result;
use std::sync;

use ordered_float::*;

use differential_dataflow::collection;
use timely::communication;
use timely::dataflow::scopes;
use timely::worker;

use differential_datalog::ddval::*;
use differential_datalog::int::*;
use differential_datalog::program::*;
use differential_datalog::record;
use differential_datalog::record::IntoRecord;
use differential_datalog::record::UpdCmd;
use differential_datalog::uint::*;
use differential_datalog::DDlogConvert;
use num_traits::cast::FromPrimitive;
use num_traits::identities::One;

use fnv::FnvHashMap;

use types::*;
pub use value::*;

pub mod api;
pub mod update_handler;

use crate::api::updcmd2upd;

/// A default implementation of `DDlogConvert` that just forwards calls
/// to generated functions of equal name.
#[derive(Debug)]
pub struct DDlogConverter {}

impl DDlogConvert for DDlogConverter {
    fn relid2name(relId: RelId) -> Option<&'static str> {
        relid2name(relId)
    }

    fn indexid2name(idxId: IdxId) -> Option<&'static str> {
        indexid2name(idxId)
    }

    fn updcmd2upd(upd_cmd: &UpdCmd) -> result::Result<Update<DDValue>, String> {
        updcmd2upd(upd_cmd)
    }
}


pub fn prog(__update_cb: Box<dyn CBFn>) -> Program {
    let Universe = Relation {
                       name:         "Universe".to_string(),
                       input:        true,
                       distinct:     false,
                       key_func:     Some((|__key: &DDValue| {
                                              let ref u = unsafe { Value::__Universe::from_ddvalue_ref(__key) }.0;
                                              Value::__Signedval64(u.oid.clone()).into_ddvalue()
                                          })),
                       id:           Relations::Universe as RelId,
                       rules:        vec![
                           ],
                       arrangements: vec![
                           Arrangement::Map{
                              name: r###"Universe{.oid=_0, .universeChild=Rectangle{.x=_, .y=_, .width=_, .height=_, .rectangleChild=_}}"###.to_string(),
                               afun: &{fn __f(__v: DDValue) -> Option<(DDValue,DDValue)>
                               {
                                   let __cloned = __v.clone();
                                   match unsafe { Value::__Universe::from_ddvalue(__v) }.0 {
                                       Universe{oid: ref _0, universeChild: UniverseChild::Rectangle{x: _, y: _, width: _, height: _, rectangleChild: _}} => Some(Value::__Signedval64(_0.clone()).into_ddvalue()),
                                       _ => None
                                   }.map(|x|(x,__cloned))
                               }
                               __f},
                               queryable: false
                           },
                           Arrangement::Map{
                              name: r###"Universe{.oid=_, .universeChild=Action{.actionChild=MoveAction{.target=_0, .delta_x=_, .delta_y=_}}}"###.to_string(),
                               afun: &{fn __f(__v: DDValue) -> Option<(DDValue,DDValue)>
                               {
                                   let __cloned = __v.clone();
                                   match unsafe { Value::__Universe::from_ddvalue(__v) }.0 {
                                       Universe{oid: _, universeChild: UniverseChild::Action{actionChild: ActionChild::MoveAction{target: ref _0, delta_x: _, delta_y: _}}} => Some(Value::__Signedval64(_0.clone()).into_ddvalue()),
                                       _ => None
                                   }.map(|x|(x,__cloned))
                               }
                               __f},
                               queryable: false
                           }],
                       change_cb:    None
                   };
    let Output_MagicRectangle = Relation {
                                    name:         "Output_MagicRectangle".to_string(),
                                    input:        false,
                                    distinct:     true,
                                    key_func:     None,
                                    id:           Relations::Output_MagicRectangle as RelId,
                                    rules:        vec![
                                        /* Output_MagicRectangle(.oid=oid, .x=new_x, .y=new_y, .width=width, .height=height, .color=new_color) :- Universe(.oid=oid, .universeChild=Rectangle{.x=x, .y=y, .width=width, .height=height, .rectangleChild=_}), Universe(.oid=_, .universeChild=Action{.actionChild=MoveAction{.target=oid, .delta_x=delta_x, .delta_y=delta_y}}), var new_x = (x + delta_x), var new_y = (y + delta_y), var new_color = if (((new_x + width) < 64'sd1000) and ((new_y + height) < 64'sd1000)) {
                                                                                                                                                                                                                                                                                                                                                                                                                                                          Blue{}
                                                                                                                                                                                                                                                                                                                                                                                                                                                      } else {
                                                                                                                                                                                                                                                                                                                                                                                                                                                            Red{}
                                                                                                                                                                                                                                                                                                                                                                                                                                                        }. */
                                        Rule::ArrangementRule {
                                            description: "Output_MagicRectangle(.oid=oid, .x=new_x, .y=new_y, .width=width, .height=height, .color=new_color) :- Universe(.oid=oid, .universeChild=Rectangle{.x=x, .y=y, .width=width, .height=height, .rectangleChild=_}), Universe(.oid=_, .universeChild=Action{.actionChild=MoveAction{.target=oid, .delta_x=delta_x, .delta_y=delta_y}}), var new_x = (x + delta_x), var new_y = (y + delta_y), var new_color = if (((new_x + width) < 64'sd1000) and ((new_y + height) < 64'sd1000)) {\n                                                                                                                                                                                                                                                                                                                                                                                                               Blue{}\n                                                                                                                                                                                                                                                                                                                                                                                                           } else {\n                                                                                                                                                                                                                                                                                                                                                                                                                 Red{}\n                                                                                                                                                                                                                                                                                                                                                                                                             }.".to_string(),
                                            arr: ( Relations::Universe as RelId, 0),
                                            xform: XFormArrangement::Join{
                                                       description: "Universe(.oid=oid, .universeChild=Rectangle{.x=x, .y=y, .width=width, .height=height, .rectangleChild=_}), Universe(.oid=_, .universeChild=Action{.actionChild=MoveAction{.target=oid, .delta_x=delta_x, .delta_y=delta_y}})".to_string(),
                                                       ffun: None,
                                                       arrangement: (Relations::Universe as RelId,1),
                                                       jfun: &{fn __f(_: &DDValue ,__v1: &DDValue,__v2: &DDValue) -> Option<DDValue>
                                                       {
                                                           let (oid, x, y, width, height) = match unsafe {  Value::__Universe::from_ddvalue_ref(__v1) }.0 {
                                                               Universe{oid: ref oid, universeChild: UniverseChild::Rectangle{x: ref x, y: ref y, width: ref width, height: ref height, rectangleChild: _}} => (oid, x, y, width, height),
                                                               _ => return None
                                                           };
                                                           let (delta_x, delta_y) = match unsafe {  Value::__Universe::from_ddvalue_ref(__v2) }.0 {
                                                               Universe{oid: _, universeChild: UniverseChild::Action{actionChild: ActionChild::MoveAction{target: _, delta_x: ref delta_x, delta_y: ref delta_y}}} => (delta_x, delta_y),
                                                               _ => return None
                                                           };
                                                           let ref new_x = match (x.clone().wrapping_add(delta_x.clone())) {
                                                               new_x => new_x,
                                                               _ => return None
                                                           };
                                                           let ref new_y = match (y.clone().wrapping_add(delta_y.clone())) {
                                                               new_y => new_y,
                                                               _ => return None
                                                           };
                                                           let ref new_color = match if (((&*(&(new_x.clone().wrapping_add(width.clone())))) < (&*(&(1000 as i64)))) && ((&*(&(new_y.clone().wrapping_add(height.clone())))) < (&*(&(1000 as i64))))) {
                                                                                         (Color::Blue{})
                                                                                     } else {
                                                                                         (Color::Red{})
                                                                                     } {
                                                               new_color => new_color,
                                                               _ => return None
                                                           };
                                                           Some(Value::__Output_MagicRectangle((Output_MagicRectangle{oid: oid.clone(), x: new_x.clone(), y: new_y.clone(), width: width.clone(), height: height.clone(), color: new_color.clone()})).into_ddvalue())
                                                       }
                                                       __f},
                                                       next: Box::new(None)
                                                   }
                                        }],
                                    arrangements: vec![
                                        ],
                                    change_cb:    Some(sync::Arc::new(sync::Mutex::new(__update_cb.clone())))
                                };
    let __Null = Relation {
                     name:         "__Null".to_string(),
                     input:        false,
                     distinct:     false,
                     key_func:     None,
                     id:           Relations::__Null as RelId,
                     rules:        vec![
                         ],
                     arrangements: vec![
                         Arrangement::Map{
                            name: r###"_"###.to_string(),
                             afun: &{fn __f(__v: DDValue) -> Option<(DDValue,DDValue)>
                             {
                                 let __cloned = __v.clone();
                                 match unsafe { Value::__Tuple0__::from_ddvalue(__v) }.0 {
                                     _ => Some(Value::__Tuple0__(()).into_ddvalue()),
                                     _ => None
                                 }.map(|x|(x,__cloned))
                             }
                             __f},
                             queryable: true
                         }],
                     change_cb:    None
                 };
    Program {
        nodes: vec![
            ProgNode::Rel{rel: Universe},
            ProgNode::Rel{rel: Output_MagicRectangle},
            ProgNode::Rel{rel: __Null}
        ],
        init_data: vec![
        ]
    }
}