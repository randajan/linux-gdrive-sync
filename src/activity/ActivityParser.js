import * as copyDirection from "./parsers/copyDirection";
import * as queuedDelete from "./parsers/queuedDelete";
import * as createOrUpdate from "./parsers/createOrUpdate";
import * as deleteOrUnlink from "./parsers/deleteOrUnlink";
import * as moveOrRename from "./parsers/moveOrRename";
import { parseRclonePath, toRelativePath } from "../rclone/tools";

const _parsers = [
    copyDirection,
    queuedDelete,
    createOrUpdate,
    deleteOrUnlink,
    moveOrRename
];

const sideFromPathNumber = v=>{
    if (v === 1 || v === "local") { return 'local'; }
    if (v === 2 || v === "remote") { return 'remote'; }
}

export class ActivityParser {

    #localPath;
    #remoteName;
    #task;
    #copyTargetSide;
    #pendingDeletes = new Map();

    constructor(localPath, remoteName) {
        this.#localPath = localPath;
        this.#remoteName = remoteName;
    }

    get localPath() { return this.#localPath; }
    get remoteName() { return this.#remoteName; }
    get task() { return this.#task; }

    getCopyTargetSide() { return this.#copyTargetSide || "?"; }
    setCopyTargetSide(val) { this.#copyTargetSide = sideFromPathNumber(val); }

    getPendingDeleteSide(path) { return this.#pendingDeletes.get(path) ?? "?"; }
    setPendingDeleteSide(path, val) {
        val = sideFromPathNumber(val);
        if (val) { this.#pendingDeletes.set(path, val); }
        else { this.#pendingDeletes.delete(path); }
    }

    setTask(task) {
        if (this.#task) { new Error(`More tasks was active at once`); }
        this.#task = task;
    }

    unsetTask(task) {
        if (this.#task !== task) { new Error(`More tasks was active at once`); }
        delete this.#task;
        delete this.#copyTargetSide;
        this.#pendingDeletes.clear();
    }

    parseLog(task, log) {
        if (!log?.msg || this.#task !== task) { return; }
        if (this.task?.isState("running")) { return; }

        for (const parser of _parsers) {
            const pass = parser.preflight(log);
            if (!pass) { continue; }
            return parser.parse(this, pass);
        }
    };

    toRelativePath(targetPath) {
        return toRelativePath(this.localPath, targetPath);
    }

    parsePath(targetPath) {
        return parseRclonePath(this.localPath, this.remoteName, targetPath);
    }

}