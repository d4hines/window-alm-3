// DDlog imports
#![allow(non_camel_case_types, non_snake_case)]
use differential_datalog::ddval::DDValConvert;
use differential_datalog::program::RelId;
use differential_datalog::program::Update;
use differential_datalog::record::Record;
use differential_datalog::DDlog;
use test_ddlog::api::HDDlog;
use types::*;
use value::Relations;
use value::Value;

// Neon imports
use neon::prelude::*;

fn do_thing(
    delta_x: i64,
    delta_y: i64,
    old_window_x: i64,
    old_window_y: i64,
    width: i64,
    height: i64,
) -> (i64, i64, std::string::String) {
    // Set up
    fn cb(_rel: usize, _rec: &Record, _w: isize) {}
    let mut hddlog = HDDlog::run(1 as usize, false, cb).unwrap();

    // First Data
    let obj = Universe {
        oid: 1,
        universeChild: UniverseChild::Rectangle {
            x: old_window_x,
            y: old_window_y,
            width,
            height,
            rectangleChild: RectangleChild {
                color: types::Color::Blue,
            },
        },
    };
    let action = Universe {
        oid: 2,
        universeChild: UniverseChild::Action {
            actionChild: ActionChild::MoveAction {
                target: 1,
                delta_x,
                delta_y,
            },
        },
    };
    let update1 = Update::Insert {
        relid: Relations::Universe as RelId,
        v: Value::__Universe(obj).into_ddvalue(),
    };
    let update2 = Update::Insert {
        relid: Relations::Universe as RelId,
        v: Value::__Universe(action).into_ddvalue(),
    };

    let cmds = vec![update1, update2];
    // First Transact
    hddlog.transaction_start().unwrap();
    hddlog.apply_valupdates(cmds.into_iter()).unwrap();
    let mut delta = hddlog.transaction_commit_dump_changes().unwrap();
    // Clean up
    hddlog.transaction_start().unwrap();
    hddlog.clear_relation(Relations::Universe as RelId).unwrap();
    hddlog.transaction_commit().unwrap();

    // Shut down
    hddlog.stop().unwrap();

    // First Parse output
    let rects = delta.get_rel(Relations::Output_MagicRectangle as RelId);
    let (rect_val, _) = rects.iter().next().expect("Nothing returned by DDLog!");
    unsafe {
        let Value::__Output_MagicRectangle(rect) = DDValConvert::from_ddvalue_ref(rect_val);
        return (rect.x, rect.y, rect.color.to_string());
    }
}

fn hello(mut cx: FunctionContext) -> JsResult<JsArray> {
    let x_diff = cx.argument::<JsNumber>(0)?.value();
    let y_diff = cx.argument::<JsNumber>(1)?.value();

    let old_window_x = cx.argument::<JsNumber>(2)?.value();
    let old_window_y = cx.argument::<JsNumber>(3)?.value();

    let width = cx.argument::<JsNumber>(4)?.value();
    let height = cx.argument::<JsNumber>(5)?.value();

    let new_window_x = old_window_x + x_diff;
    let new_window_y = old_window_y + y_diff;

    let color = if new_window_x + width < 1000.0 && new_window_y + height < 1000.0 {
        cx.string("blue")
    } else {
        cx.string("red")
    };

    let new_window_x_js = cx.number(new_window_x);
    let new_window_y_js = cx.number(new_window_y);
    let (foo_x, foo_y, foo_color) = do_thing(
        x_diff as i64,
        y_diff as i64,
        old_window_x as i64,
        old_window_y as i64,
        width as i64,
        height as i64,
    );

    let js_x = cx.number(foo_x as f64);
    let js_y = cx.number(foo_y as f64);
    let js_color = cx.string(foo_color);

    let return_val = JsArray::new(&mut cx, 6 as u32);
    return_val.set(&mut cx, 0 as u32, new_window_x_js).unwrap();
    return_val.set(&mut cx, 1 as u32, new_window_y_js).unwrap();
    return_val.set(&mut cx, 2 as u32, color).unwrap();
    return_val.set(&mut cx, 3 as u32, js_x).unwrap();
    return_val.set(&mut cx, 4 as u32, js_y).unwrap();
    return_val.set(&mut cx, 5 as u32, js_color).unwrap();
    
    return Ok(return_val);
}

register_module!(mut cx, { cx.export_function("hello", hello) });
