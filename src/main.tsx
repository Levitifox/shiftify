import { webUtils, OpenDialogOptions, ipcRenderer } from "electron";
import { createRoot } from "react-dom/client";
import * as fs from "node:fs";
import { useState, useEffect } from "react";

async function showOpenDialog(options: OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }> {
    return await ipcRenderer.invoke("dialog:showOpenDialog", options);
}

console.log(fs);

function FileInput({
    multiple,
    pathList,
    setPathList,
    ...props
}: { multiple?: boolean; pathList: string; setPathList: (newPath: string) => void } & React.HTMLAttributes<HTMLInputElement>) {
    return (
        <input
            type="text"
            spellCheck="false"
            value={pathList}
            onChange={event => {
                setPathList(event.target.value);
            }}
            onDragOver={event => {
                event.preventDefault();
            }}
            onDrop={event => {
                event.preventDefault();
                const files: File[] = Array.from(event.dataTransfer.files);
                const paths: string[] = files.map(file => webUtils.getPathForFile(file));
                if (multiple) {
                    setPathList(paths.join(";"));
                } else {
                    if (paths.length > 1) {
                        alert("Choose only one file");
                    } else {
                        setPathList(paths.join(";"));
                    }
                }
            }}
            {...props}
        ></input>
    );
}

function BrowseButton({
    type_,
    multiple,
    setPathList,
    ...props
}: { type_: "file" | "directory"; multiple?: boolean; setPathList: (newPath: string) => void } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            onClick={async () => {
                const result = await showOpenDialog({
                    properties: Array.prototype.concat(type_ === "file" ? ["openFile"] : ["openDirectory"], multiple ? ["multiSelections"] : []),
                });
                if (!result.canceled) {
                    const paths = result.filePaths;
                    setPathList(paths.join(";"));
                }
            }}
            {...props}
        >
            {type_ === "file" ? <>Browse file...</> : <>Browse folder...</>}
        </button>
    );
}

async function getPossibleGameVersions(allVersions: boolean): Promise<string[]> {
    try {
        const response = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
        if (!response.ok) {
            throw new Error("Failed to fetch Minecraft versions");
        }
        const data: { versions: { id: string; type: string }[] } = await response.json();
        const filteredVersions = data.versions.filter(version => version.type === "release" || allVersions);
        return filteredVersions.map(version => version.id);
    } catch (error) {
        alert("Error fetching Minecraft versions: " + error);
        return [];
    }
}

function Main() {
    const [releaseGameVersions, setReleaseGameVersions] = useState<string[]>([]);
    const [allGameVersions, setAllGameVersions] = useState<string[]>([]);
    const [inputPathList, setInputPathList] = useState("");
    const [outputPathList, setOutputPathList] = useState("");
    const [loader, setLoader] = useState("");
    const [gameVersion, setGameVersion] = useState("");
    const [showAllVersions, setShowAllVersions] = useState(false);

    useEffect(() => {
        (async () => {
            setReleaseGameVersions(await getPossibleGameVersions(false));
            setAllGameVersions(await getPossibleGameVersions(true));
        })();
    }, []);

    const possibleGameVersions = showAllVersions ? allGameVersions : releaseGameVersions;

    return (
        <>
            <h1>Shiftify</h1>
            <div className="main-pane">
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Input:</div>
                    <FileInput multiple pathList={inputPathList} setPathList={setInputPathList} className="main-pane_row_input"></FileInput>
                    <BrowseButton type_="file" multiple setPathList={setInputPathList} className="main-pane_row_browse"></BrowseButton>
                    <BrowseButton type_="directory" multiple setPathList={setInputPathList} className="main-pane_row_browse"></BrowseButton>
                </div>
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Output:</div>
                    <FileInput pathList={outputPathList} setPathList={setOutputPathList} className="main-pane_row_input"></FileInput>
                    <BrowseButton type_="directory" setPathList={setOutputPathList} className="main-pane_row_browse"></BrowseButton>
                </div>
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Loader:</div>
                    <select
                        value={loader}
                        onChange={event => {
                            setLoader(event.target.value);
                        }}
                    >
                        <option value="" disabled>
                            Choose loader
                        </option>
                        <option value="forge">Forge</option>
                        <option value="neoforge">NeoForge</option>
                        <option value="fabric">Fabric</option>
                        <option value="quilt">Quilt</option>
                    </select>
                </div>
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Game version:</div>
                    <select
                        value={gameVersion}
                        onChange={event => {
                            setGameVersion(event.target.value);
                        }}
                    >
                        <option value="" disabled>
                            Choose game version
                        </option>
                        {possibleGameVersions.map((possibleGameVersion, i) => (
                            <option key={i} value={possibleGameVersion}>
                                {possibleGameVersion}
                            </option>
                        ))}
                    </select>
                    <label>
                        Show all versions
                        <input
                            type="checkbox"
                            checked={showAllVersions}
                            onChange={event => {
                                setShowAllVersions(event.target.checked);
                            }}
                        />
                    </label>
                </div>
                <div className="main-pane_row">
                    <button
                        className="main-pane_row_process"
                        onClick={() => {
                            if (inputPathList === "") {
                                alert("No input selected");
                                return;
                            }
                            if (outputPathList === "") {
                                alert("No output selected");
                                return;
                            }
                            if (loader === "") {
                                alert("No loader selected");
                                return;
                            }
                            if (gameVersion === "") {
                                alert("No game version selected");
                                return;
                            }
                            alert(`Input: ${inputPathList}
Output: ${outputPathList}
Loader: ${loader}
Game version: ${gameVersion}`);
                        }}
                    >
                        Process
                    </button>
                </div>
            </div>
        </>
    );
}

document.addEventListener("DOMContentLoaded", () => {
    const root = createRoot(document.getElementById("app")!);
    root.render(<Main></Main>);
});
