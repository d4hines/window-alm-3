const { ipcRenderer } = require("electron");

let oid;
ipcRenderer.on("oid", (_, id) => oid = id);

window.mouseDown = () => {
    const setDragging = (dragging) => {
        document
            .getElementById("drag-state")
            .textContent = dragging ? "BEING" : "NOT BEING";
    }

    ipcRenderer.send("dragStart");
    setDragging(true)
    window.onmouseup = () => {
        ipcRenderer.send("dragEnd");
        setDragging(false)
    }
};

ipcRenderer.on("group_icon", (_, status) => {
    const el = document.getElementById("group");
    if (status === "Form") {
        el.style.visibility = "visible";
        el.textContent = "Form Group";
    } else {
        el.style.visibility = "hidden";
    }
});

window.toggleGroup = () => {
    ipcRenderer.send("toggle_group", oid);
}
