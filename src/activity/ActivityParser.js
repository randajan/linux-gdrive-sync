import { parseRclonePath, toRelativePath } from "../rclone/tools";


const sideFromPathNumber = v=>{
    if (v === 1 || v === "local") { return 'local'; }
    if (v === 2 || v === "remote") { return 'remote'; }
}

export class ActivityParser {

    #task;
    #parsers;
    #localPath;
    #remoteName;
    #onActivity;

    #copyTargetSide;
    #pendingDeletes = new Map();

    constructor(parsers, localPath, remoteName, onActivity=()=>{}) {
        this.#parsers = parsers;
        this.#localPath = localPath;
        this.#remoteName = remoteName;
        this.#onActivity = onActivity;
    }

    get task() { return this.#task; }
    get localPath() { return this.#localPath; }
    get remoteName() { return this.#remoteName; }

    setTask(task) {
        if (this.#task) { throw new Error("More than one task was active at the same time"); }
        this.#task = task;
        return ()=>{
            this.#task = undefined;
            this.#copyTargetSide = undefined;
            this.#pendingDeletes.clear();
        }
    }

    getCopyTargetSide() { return this.#copyTargetSide; }
    setCopyTargetSide(val) { this.#copyTargetSide = sideFromPathNumber(val); }

    getPendingDeleteSide(path) { return this.#pendingDeletes.get(path); }
    setPendingDeleteSide(path, val) {
        val = sideFromPathNumber(val);
        if (val) { this.#pendingDeletes.set(path, val); }
        else { this.#pendingDeletes.delete(path); }
    }

    parseLog(task, log) {
        if (this.#task !== task) { throw new Error("More than one task was active at the same time"); }

        if (!log?.msg || !task.isState("running")) { return; }

        for (const parser of this.#parsers) {
            const pass = parser.preflight(log);
            if (!pass) { continue; }
            
            const activity = parser.parse(this, pass);
            if (!activity) { return; }
            this.#onActivity(activity);
            return activity;
        }
    };

    toRelativePath(targetPath) {
        return toRelativePath(this.localPath, targetPath);
    }

    parsePath(targetPath) {
        const { localPath, remoteName } = this;
        const result = parseRclonePath(localPath, remoteName, targetPath);
        return result;
    }

}