const { ipcRenderer } = require("electron");

const setDragging = (dragging) => {
    document
        .getElementById("drag-state")
        .textContent = dragging ? "BEING" : "NOT BEING";
}

const setBackgroundColor = (color) => {
    document.body.style.backgroundColor = color
}

window.mouseDown = () => {
    ipcRenderer.send("dragStart");
    setDragging(true)
    window.onmouseup = () => {
        ipcRenderer.send("dragEnd");
        setDragging(false)

        ipcRenderer.on("color", (_, color) => {
            const hexColor = color === "red" ? "#f18b8b" : "#8becf1";
            setBackgroundColor(hexColor);
        });
    }
}
