import { createQueue } from "@randajan/queue";
import chokidar from 'chokidar';
import { RCloneWatch } from "./RCloneWatch";
import { RCloneRun } from "./RCloneRun";
import { EventTrigger } from "../events/Event";
import { chokidarActionTranslate, parseRclonePath, toRelativePath } from "./tools";
import { ActivityParser, bisyncActivityParsers } from "../activity/ActivityParser";
import { ActivityFootprints } from "../activity/ActivityFootprints";
import nodePath from "path";


export class RCloneBisync extends RCloneRun {

    #cfg;
    #intId;
    #bouncer;
    #localWatch;
    #remoteWatch;
    #activityParsers;

    constructor(cfg = {}) {
        const {
            localPath, remoteName, trashPath, appRoot,
            runOnInit, partialSuffix = '.partial',
            remoteFootprintTtl = 10 * 1000,
            localFootprintTtl = 5 * 1000,
            forceResyncMs = 15 * 60 * 1000, //15 min resync
            debounceSoftMs = 5 * 1000, //5sec
            debunceHardMs = 5 * 60 * 1000, //5min
            chokidarDelayMs = 500 //0.5sec
        } = cfg;

        super(appRoot);

        this.#cfg = {
            localPath, remoteName, trashPath, partialSuffix,
            forceResyncMs
        }

        const afps = new ActivityFootprints({ remote: remoteFootprintTtl, local: localFootprintTtl });
        this.#activityParsers = {
            bisync:new ActivityParser(bisyncActivityParsers, localPath, remoteName, afps.createHandler())
        }

        const bouncer = this.#bouncer = createQueue(this.#handleTriggers.bind(this), {
            softMs: debounceSoftMs,
            hardMs: debunceHardMs
        });

        const localWatch = this.#localWatch = chokidar.watch(localPath, {
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000,
                pollInterval: 100
            },
            ignored: filePath => {
                const name = nodePath.basename(filePath);

                if (partialSuffix && filePath.endsWith(partialSuffix)) { return true; }

                if (name === '.DS_Store') { return true; }
                if (name === 'Thumbs.db') { return true; }
                if (name.startsWith('.~lock.') && name.endsWith('#')) { return true; }
                if (name.startsWith('~$')) { return true; }
                if (name.startsWith('.#')) { return true; }

                return false;
            }
        });

        localWatch.on('all', (action, path, stats) => {
            setTimeout(_ => {
                path = this.toRelativePath(path);
                const match = afps.match("local", path, chokidarActionTranslate(action), stats?.ctime);
                this.emit(new EventTrigger(this, "local", { path, action, stats, match }));
            }, chokidarDelayMs);
        });

        const remoteWatch = this.#remoteWatch = new RCloneWatch({
            remoteName,
            sharedWithMe: true
        });

        remoteWatch.on("change", ({ change }) => {
            const { path } = change;
            const match = afps.match("remote", path);
            this.emit(new EventTrigger(this, "remote", { ...change, match }));
        });

        remoteWatch.start();

        this.on("trigger", event => {
            if (!event.match?.matched) { bouncer(event); }
        }); //add to debounce queue

        if (runOnInit) {
            this.emit(new EventTrigger(this, "init", { isTimeBased: true }));
        } else {
            this.#planHeartbeat();
        }
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

    async #stopHeartbeat() {
        if (this.#intId == null) { return; }
        clearTimeout(this.#intId);
        this.#intId = null;
    }

    async #planHeartbeat() {
        this.#stopHeartbeat();
        this.#intId = setTimeout(_ => {
            this.emit(new EventTrigger(this, "heartbeat", { isTimeBased: true }));
        }, this.#cfg.forceResyncMs);
        this.#intId.unref?.();
    }

    async #handleTriggers(triggersArgs) {
        this.#stopHeartbeat();
        
        const triggers = triggersArgs.map(t => t[0]);

        const activityParser = this.#activityParsers.bisync;
        await this.#runBisync({ triggers, activityParser });

        this.#planHeartbeat();
    }

    async #runBisync(opt = {}) {
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

    async #runCopy(fromSide, path, opt = {}) {
        const { localPath, remoteName, trashPath, partialSuffix } = this.#cfg;

        const local = nodePath.join(localPath, path);
        const remote = `${remoteName}${path}`;

        const source = fromSide === 'local' ? local : remote;
        const target = fromSide === 'local' ? remote : local;

        const args = [
            'copyto',
            source,
            target,
            '--update',
            '--drive-skip-gdocs',
            '--partial-suffix', partialSuffix,
            '-v'
        ];

        if (fromSide === 'remote') {
            args.push('--backup-dir', trashPath);
        }

        return this.run('copy', args, opt);
    }

    async #runDelete(fromSide, path, opt = {}) {

        const { localPath, remoteName, trashPath } = this.#cfg;

        if (fromSide === 'local') {
            return this.run('delete', [
                'deletefile',
                `${remoteName}${path}`,
                '-v'
            ], opt);
        }

        if (fromSide === 'remote') {
            return this.run('delete', [
                'moveto',
                nodePath.join(localPath, path),
                nodePath.join(trashPath, path),
                '-v'
            ], opt);
        }
    }

}