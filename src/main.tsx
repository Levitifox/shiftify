import { webUtils, OpenDialogOptions, ipcRenderer } from "electron";
import { createRoot } from "react-dom/client";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { useState, useEffect, useRef } from "react";
import * as StreamZip from "node-stream-zip";
import TOML from "smol-toml";

async function showOpenDialog(options: OpenDialogOptions): Promise<{ canceled: boolean; filePaths: string[] }> {
    return await ipcRenderer.invoke("dialog:showOpenDialog", options);
}

console.log(fs);

function FileInput({
    multiple,
    pathList,
    setPathList,
    ...props
}: { multiple?: boolean; pathList: string; setPathList: (newPath: string) => void } & React.InputHTMLAttributes<HTMLInputElement>) {
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

async function queryPossibleGameVersions(allVersions: boolean): Promise<string[]> {
    try {
        const response = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
        if (!response.ok) {
            throw new Error(`Failed to fetch Minecraft versions: ${await response.text()}`);
        }
        const data: { versions: { id: string; type: string }[] } = await response.json();
        const filteredVersions = data.versions.filter(version => version.type === "release" || allVersions);
        return filteredVersions.map(version => version.id);
    } catch (error) {
        alert("Error fetching Minecraft versions: " + error);
        return [];
    }
}

type Mod = {
    path: string;
    basename: string;
    name?: string | undefined;
    status: "error" | "discovered" | "done";
    error?: unknown | undefined;
};

async function gatherModsFromPath(inputPath: string): Promise<Mod[]> {
    console.log("gatherModsFromPath", inputPath);
    try {
        const stat = await fs.stat(inputPath);
        if (stat.isDirectory()) {
            return await gatherModsFromPaths((await fs.readdir(inputPath)).map(name => path.join(inputPath, name)));
        } else if (inputPath.endsWith(".jar")) {
            const zip = new StreamZip.async({ file: inputPath });
            let name: string | undefined = undefined;
            try {
                const forgeModMetadata: unknown = TOML.parse((await zip.entryData("META-INF/mods.toml")).toString());
                if (
                    typeof forgeModMetadata === "object" &&
                    forgeModMetadata !== null &&
                    "mods" in forgeModMetadata &&
                    Array.isArray(forgeModMetadata.mods) &&
                    forgeModMetadata.mods.length > 0 &&
                    "displayName" in forgeModMetadata.mods[0] &&
                    typeof forgeModMetadata.mods[0].displayName === "string"
                ) {
                    name = forgeModMetadata.mods[0].displayName;
                }
            } catch (_error) {}
            try {
                const neoforgeModMetadata: unknown = TOML.parse((await zip.entryData("META-INF/neoforge.mods.toml")).toString());
                if (
                    typeof neoforgeModMetadata === "object" &&
                    neoforgeModMetadata !== null &&
                    "mods" in neoforgeModMetadata &&
                    Array.isArray(neoforgeModMetadata.mods) &&
                    neoforgeModMetadata.mods.length > 0 &&
                    "displayName" in neoforgeModMetadata.mods[0] &&
                    typeof neoforgeModMetadata.mods[0].displayName === "string"
                ) {
                    name = neoforgeModMetadata.mods[0].displayName;
                }
            } catch (_error) {}
            try {
                const fabricModMetadata: unknown = JSON.parse((await zip.entryData("fabric.mod.json")).toString().replaceAll("\n", " "));
                if (
                    typeof fabricModMetadata === "object" &&
                    fabricModMetadata !== null &&
                    "name" in fabricModMetadata &&
                    typeof fabricModMetadata.name === "string"
                ) {
                    name = fabricModMetadata.name;
                }
            } catch (_error) {}
            try {
                const quiltModMetadata: unknown = JSON.parse((await zip.entryData("quilt.mod.json")).toString().replaceAll("\n", " "));
                if (
                    typeof quiltModMetadata === "object" &&
                    quiltModMetadata !== null &&
                    "quilt_loader" in quiltModMetadata &&
                    typeof quiltModMetadata.quilt_loader === "object" &&
                    quiltModMetadata.quilt_loader !== null &&
                    "metadata" in quiltModMetadata.quilt_loader &&
                    typeof quiltModMetadata.quilt_loader.metadata === "object" &&
                    quiltModMetadata.quilt_loader.metadata !== null &&
                    "name" in quiltModMetadata.quilt_loader.metadata &&
                    typeof quiltModMetadata.quilt_loader.metadata.name === "string"
                ) {
                    name = quiltModMetadata.quilt_loader.metadata.name;
                }
            } catch (_error) {}
            await zip.close();
            if (name === undefined) {
                throw new Error("Mod name not found");
            }
            return [{ path: inputPath, basename: path.basename(inputPath), name, status: "discovered" }];
        } else {
            return [];
        }
    } catch (error) {
        return [{ path: inputPath, basename: path.basename(inputPath), status: "error", error }];
    }
}

async function gatherModsFromPaths(inputPaths: string[]): Promise<Mod[]> {
    console.log("gatherModsFromPaths", inputPaths);

    return (await Promise.all(inputPaths.map(inputPath => gatherModsFromPath(inputPath)))).flat();
}

async function* processMod(mod: Mod, outputPath: string, loader: string, gameVersion: string): AsyncGenerator<Mod, void, undefined> {
    await new Promise(r => setTimeout(r, 100));
    yield { ...mod, status: "done" };
}

async function* processMods(inputPaths: string[], outputPath: string, loader: string, gameVersion: string): AsyncGenerator<Mod[], void, undefined> {
    console.log("process, inputPaths:", inputPaths, "outputPath:", outputPath, "loader:", loader, "gameVersion:", gameVersion);

    let processedMods = [];
    let unprocessedMods = await gatherModsFromPaths(inputPaths);
    yield unprocessedMods;
    while (unprocessedMods.length > 0) {
        const currentMod = unprocessedMods[0];
        unprocessedMods = unprocessedMods.slice(1);
        let lastCurrentMod = currentMod;
        for await (const newCurrentMod of processMod(currentMod, outputPath, loader, gameVersion)) {
            yield [...processedMods, newCurrentMod, ...unprocessedMods];
            lastCurrentMod = newCurrentMod;
        }
        processedMods.push(lastCurrentMod);
    }

    console.log("process done");
}

function Main() {
    const [releaseGameVersions, setReleaseGameVersions] = useState<string[]>([]);
    const [allGameVersions, setAllGameVersions] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            setReleaseGameVersions(await queryPossibleGameVersions(false));
            setAllGameVersions(await queryPossibleGameVersions(true));
        })();
    }, []);

    const [inputPathList, setInputPathList] = useState("");
    const currentInputPathList = useRef("");
    const [outputPathList, setOutputPathList] = useState("");
    const [loader, setLoader] = useState("");
    const [gameVersion, setGameVersion] = useState("");
    const [showAllVersions, setShowAllVersions] = useState(false);

    const possibleGameVersions = showAllVersions ? allGameVersions : releaseGameVersions;

    const [mods, setMods] = useState<Mod[]>([]);
    const [processing, setProcessing] = useState(false);
    const processedCount = useRef(0);

    function putInputPathList(newPathList: string) {
        if (processing) {
            return;
        }
        currentInputPathList.current = newPathList;
        setInputPathList(newPathList);
    }

    useEffect(() => {
        (async () => {
            const oldProcessedCount = processedCount.current;
            const inputPaths = inputPathList === "" ? [] : inputPathList.split(";");
            const newMods = await gatherModsFromPaths(inputPaths);
            if (currentInputPathList.current === inputPathList && processedCount.current === oldProcessedCount) {
                setMods(newMods);
            }
        })();
    }, [inputPathList]);

    return (
        <>
            <h1>Shiftify</h1>
            <div className="main-pane">
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Input:</div>
                    <FileInput
                        className="main-pane_row_input"
                        multiple
                        pathList={inputPathList}
                        setPathList={putInputPathList}
                        disabled={processing}
                    ></FileInput>
                    <BrowseButton className="main-pane_row_browse" type_="file" multiple setPathList={putInputPathList} disabled={processing}></BrowseButton>
                    <BrowseButton
                        className="main-pane_row_browse"
                        type_="directory"
                        multiple
                        setPathList={putInputPathList}
                        disabled={processing}
                    ></BrowseButton>
                </div>
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Output:</div>
                    <FileInput className="main-pane_row_input" pathList={outputPathList} setPathList={setOutputPathList} disabled={processing}></FileInput>
                    <BrowseButton className="main-pane_row_browse" type_="directory" setPathList={setOutputPathList} disabled={processing}></BrowseButton>
                </div>
                <div className="main-pane_row">
                    <div className="main-pane_row_label">Loader:</div>
                    <select
                        value={loader}
                        onChange={event => {
                            setLoader(event.target.value);
                        }}
                        disabled={processing}
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
                        disabled={processing}
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
                            if (processing) {
                                return;
                            }
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
                            (async () => {
                                processedCount.current += 1;
                                setProcessing(true);
                                const inputPaths = inputPathList === "" ? [] : inputPathList.split(";");
                                for await (const newMods of processMods(inputPaths, outputPathList, loader, gameVersion)) {
                                    setMods(newMods);
                                }
                                setProcessing(false);
                            })();
                        }}
                        disabled={processing}
                    >
                        Process
                    </button>
                </div>
            </div>
            <div className="status-pane">
                <table className="status-pane_mods">
                    <thead>
                        <tr className="status-pane_mod-header">
                            <th className="status-pane_mod-file">File</th>
                            <th className="status-pane_mod-name">Name</th>
                            <th className="status-pane_mod-status">Status</th>
                        </tr>
                    </thead>
                    {mods.length > 0 && (
                        <tbody>
                            {mods.map((mod, i) => (
                                <tr key={i} className={`status-pane_mod status-pane_mod-${mod.status}`} title={mod.path}>
                                    <td className="status-pane_mod-file">{mod.basename}</td>
                                    <td className="status-pane_mod-name">{mod.name}</td>
                                    <td className="status-pane_mod-status">
                                        {mod.status === "error" ? (
                                            <>{String(mod.error)}</>
                                        ) : mod.status === "discovered" ? (
                                            <></>
                                        ) : mod.status === "done" ? (
                                            <>OK</>
                                        ) : (
                                            (() => {
                                                mod.status satisfies never;
                                                throw new Error("Not exchastive");
                                            })()
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    )}
                </table>
            </div>
        </>
    );
}

document.addEventListener("DOMContentLoaded", () => {
    const root = createRoot(document.getElementById("app")!);
    root.render(<Main></Main>);
});
