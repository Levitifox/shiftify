import { createRoot } from "react-dom/client";
import * as fs from "node:fs";

console.log(fs);

document.addEventListener("DOMContentLoaded", () => {
    const root = createRoot(document.getElementById("app")!);
    root.render(<h1>Hello, world</h1>);
});
