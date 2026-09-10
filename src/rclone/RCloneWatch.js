import { EventEmitter } from 'events';
import { spawnRclone } from './run';


export class RCloneWatch extends EventEmitter {

    #args;

    #isRunning = false;
    #proc = null;
    #timer = null;

    #failures = 0;

    #startedAt = null;
    #endedAt = null;

    #code = null;
    #signal = null;
    #error = null;

    #restartMin;
    #restartMax;


    constructor(opt = {}) {
        super();

        const {
            remoteName,
            pollInterval = 1000 * 10,
            sharedWithMe = false,
            restartMin = 1000,
            restartMax = 30000
        } = opt;

        this.#restartMin = restartMin;
        this.#restartMax = restartMax;

        const pollInt = (Number.isInteger(pollInterval) && pollInterval >= 1000) ? (pollInterval / 1000).toFixed(0) : 10;

        this.#args = [
            'test',
            'changenotify',
            remoteName,
            '--poll-interval', pollInt + "s"
        ];

        if (sharedWithMe) {
            this.#args.push('--drive-shared-with-me');
        }
    }


    start() {
        if (this.#proc || this.#timer) {
            return this;
        }

        this.#isRunning = true;

        this.#startedAt = new Date();
        this.#endedAt = null;

        this.#code = null;
        this.#signal = null;
        this.#error = null;

        const proc = spawnRclone(this.#args, {
            onLog: log => this.#handleLog(log)
        });

        this.#proc = proc;

        this.emit('state', { watcher: this });

        proc.once('error', error => { this.#error = error; });

        proc.once('close', (code, signal) => {
            if (this.#proc !== proc) {
                return;
            }

            this.#proc = null;

            this.#endedAt = new Date();
            this.#code = code;
            this.#signal = signal;

            if (!this.#isRunning) {
                this.emit('state', { watcher: this });
                return;
            }

            if (this.runtime >= 60000) {
                this.#failures = 0;
            }

            this.#restart();
        });

        return this;
    }


    stop() {
        if (!this.#isRunning) {
            return this;
        }

        this.#isRunning = false;

        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }

        if (this.#proc) {
            this.#proc.kill('SIGTERM');
        }
        else {
            this.emit('state', { watcher: this });
        }

        return this;
    }


    #restart() {
        const delay = Math.min(
            this.#restartMin * 2 ** this.#failures,
            this.#restartMax
        );

        this.#failures++;

        const timer = this.#timer = setTimeout(() => {
            this.#timer = null;

            if (this.#isRunning) {
                this.start();
            }
        }, delay);
        
        timer.unref?.();

        this.emit('state', { watcher: this });
    }


    #handleLog(log) {
        this.emit('log', { watcher: this, log });

        const change = this.#parseChange(log);

        if (change) {
            this.emit('change', { watcher: this, change });
        }
    }

    #parseChange(log) {
        if (
            typeof log?.msg !== 'string' ||
            !log?.source?.includes('changenotify/changenotify.go')
        ) {
            return null;
        }

        const match = log.msg.match( /^("(?:\\.|[^"\\])*"):\s+([01])$/ );

        if (!match) { return null; }

        let path;

        try { path = JSON.parse(match[1]); }
        catch { path = match[1].slice(1, -1); }

        const entryType = Number(match[2]);

        return {
            path,
            type: entryType === 0 ? 'directory' : 'object',
            entryType,
            log
        };
    }

    get isRunning() { return this.#isRunning; }
    get isProcessRunning() { return !!this.#proc; }
    get isRestarting() { return !!this.#timer; }

    get state() {
        if (!this.#isRunning) {
            return this.#proc ? 'stopping' : 'stopped';
        }

        if (this.#proc) {
            return 'running';
        }

        if (this.#timer) {
            return 'restarting';
        }

        return 'starting';
    }

    get args() { return [...this.#args]; }
    get startedAt() { return this.#startedAt; }
    get endedAt() { return this.#endedAt; }

    get runtime() {
        if (!this.#startedAt) { return 0; }
        const end = this.#endedAt?.getTime() ?? Date.now();
        return end - this.#startedAt.getTime();
    }

    toJSON() {
        const { state, args, startedAt, endedAt, runtime } = this
        return {
            state,
            args,
            failures: this.#failures,
            startedAt,
            endedAt,
            runtime,
            code: this.#code,
            signal: this.#signal,
            error: this.#error
        };
    }
}