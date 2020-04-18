use neon::prelude::*;

fn hello(mut cx: FunctionContext) -> JsResult<JsArray> {
    let x_diff = cx.argument::<JsNumber>(0)?.value();
    let y_diff = cx.argument::<JsNumber>(1)?.value();

    let old_window_x = cx.argument::<JsNumber>(2)?.value();
    let old_window_y = cx.argument::<JsNumber>(3)?.value();

    let width = cx.argument::<JsNumber>(4)?.value();
    let height = cx.argument::<JsNumber>(5)?.value();

    let new_window_x = old_window_x + x_diff;
    let new_window_y = old_window_y + y_diff;

    let color = if  new_window_x + width < 1000.0 && new_window_y + height < 1000.0 {
        cx.string("blue")
    } else {
        cx.string("red")
    };
    

    let new_window_x_js = cx.number(new_window_x);
    let new_window_y_js = cx.number(new_window_y);

    let return_val = JsArray::new(&mut cx, 3 as u32);
    return_val.set(&mut cx, 0 as u32, new_window_x_js).unwrap();
    return_val.set(&mut cx, 1 as u32, new_window_y_js).unwrap();
    return_val.set(&mut cx, 2 as u32, color).unwrap();
    return Ok(return_val);
}

register_module!(mut cx, {
    cx.export_function("hello", hello)
});
