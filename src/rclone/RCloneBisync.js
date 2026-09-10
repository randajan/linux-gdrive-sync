import { createQueue } from "@randajan/queue";
import chokidar from 'chokidar';
import { RCloneWatch } from "./RCloneWatch";
import { RCloneRun } from "./RCloneRun";
import { EventTrigger } from "../events/Event";
import { toRelativePath } from "./tools";
import { ActivityParser } from "../activity/ActivityParser";



export class RCloneBisync extends RCloneRun {

    #cfg;
    #bouncer;
    #localWatch;
    #remoteWatch;

    constructor(cfg = {}) {
        const {
            localPath,
            remoteName,
            trashPath,
            logPath,
            runOnInit,
            partialSuffix = '.partial'
        } = cfg;

        super({ logPath });

        this.#cfg = { localPath, remoteName, trashPath, partialSuffix }

        const activityParser = new ActivityParser(localPath, remoteName);

        let int;
        const bouncer = this.#bouncer = createQueue(async triggers => {
            clearTimeout(int);
            await this.#runBisync({ triggers, activityParser });
            clearTimeout(int);
            int = setTimeout(_ =>{
                this.emit(new EventTrigger("heartbeat", { isTimeBased:true }));
            }, 1000 * 60 * 15); //15 min resync
            int.unref?.();
        }, {
            softMs: 1000 * 5, //5sec
            hardMs: 1000 * 60 * 5 //5min
        });

        const localWatch = this.#localWatch = chokidar.watch(localPath, {
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            },
            ignored: filePath => {
                const suffix = partialSuffix;
                return suffix && filePath.endsWith(suffix);
            }
        });

        localWatch.on('all', (action, path, stats) => {
            path = this.toRelativePath(path);
            this.emit(new EventTrigger("local", { path, action, stats }));
        });

        const remoteWatch = this.#remoteWatch = new RCloneWatch({
            remoteName,
            sharedWithMe: true
        });

        remoteWatch.on("change", ({ change }) => {
            this.emit(new EventTrigger("remote", change));
        });

        remoteWatch.start();

        this.on("trigger", bouncer); //add to debounce queue

        if (runOnInit) {
            this.emit(new EventTrigger("init", { isTimeBased:true }));
        };
    }

    get localPath() { return this.#cfg.localPath; }
    get remoteName() { return this.#cfg.remoteName; }

    get bouncer() { return this.#bouncer; }
    get localWatch() { return this.#localWatch; }
    get remoteWatch() { return this.#remoteWatch; }

    toRelativePath(targetPath) {
        return toRelativePath(this.localPath, targetPath);
    }

    parsePath(targetPath) {
        return parseRclonePath(this.localPath, this.remoteName, targetPath);
    }

    async #runBisync(opt={}) {
        const { localPath, remoteName, trashPath, partialSuffix } = this.#cfg;

        return this.run("bisync", [
            'bisync',
            localPath,
            remoteName,
            '--check-access',
            '--resilient',
            '--recover',
            '--max-lock', '2m',
            '--max-delete', '10',
            '--create-empty-src-dirs',
            '--conflict-resolve', 'newer',
            '--backup-dir1', trashPath,
            '--drive-skip-gdocs',
            '--track-renames',
            '--partial-suffix', partialSuffix,
            '-v'
        ], opt);
    }

    async runDedupe(opt = {}) {
        const { remoteName } = this.#cfg;
        const { mode = "list", ...passOpt } = opt;

        return this.run(`dedupe-${mode}`, [
            'dedupe',
            remoteName,
            '--dedupe-mode', mode,
            '--drive-skip-gdocs',
            '--stats', '5s',
            '-v'
        ], passOpt);
    }

}