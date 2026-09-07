import { solids } from "@randajan/props";
import { RCloneRun } from "./RCloneRun";



export class RClone extends RCloneRun {

    #glob = {};

    constructor(opt = {}) {
        const { localPath, remote, trashPath } = opt;

        super();

        solids(this.#glob, {
            localPath,
            remote,
            trashPath,
        });
    }

    async bisync(opt = {}) {
        const { localPath, remote, trashPath } = this.#glob;
        const { onEvent } = opt;

        return this.run([
            'bisync',
            localPath,
            remote,
            '--check-access',
            '--resilient',
            '--recover',
            '--max-lock', '2m',
            '--max-delete', '10',
            '--create-empty-src-dirs',
            '--conflict-resolve', 'newer',
            '--backup-dir1', trashPath,
            '--drive-skip-gdocs',
            '--fast-list',
            '--track-renames',
            '-v'
        ], onEvent);
    }

    async dedupe(opt = {}) {
        const { remote } = this.#glob;
        const { onEvent, mode="list" } = opt;

        return this.run([
            'dedupe',
            remote,
            '--dedupe-mode', mode,
            '--drive-skip-gdocs',
            "--fast-list",
            '--stats', '5s',
            '-v'
        ], onEvent);
    }

    async test(opt={}) {
        const { onEvent } = opt;
        return this.run(["lsf", "gdrive:"], onEvent);
    }

}