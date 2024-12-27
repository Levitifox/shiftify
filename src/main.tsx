import { webUtils } from "electron";
import { createRoot } from "react-dom/client";
import * as fs from "node:fs";

console.log(fs);

function Main() {
    return (
        <>
            <h1>Shiftify</h1>
            <div className="main-pane">
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Input</div>
                    <input
                        className="main-pane_row_input"
                        type="text"
                        onDragOver={event => {
                            event.preventDefault();
                        }}
                        onDrop={event => {
                            event.preventDefault();
                            const files = event.dataTransfer.files;
                            if (files.length == 1) {
                                const file = files[0];
                                console.log(webUtils.getPathForFile(file));
                            }
                        }}
                    ></input>
                </div>
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Output</div>
                    <input className="main-pane_row_input" type="text"></input>
                </div>
            </div>
        </>
    );
}

document.addEventListener("DOMContentLoaded", () => {
    const root = createRoot(document.getElementById("app")!);
    root.render(<Main></Main>);
});
