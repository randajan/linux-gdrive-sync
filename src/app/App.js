import fs from 'fs';
import nodePath from 'path';
import fsExt from 'fs-ext';
import { Logger } from '../rclone/Logger';
import EventEmitter from 'events';
import { Event, EventApp } from '../events/Event';

const _apps = new Set();

export class App extends EventEmitter {

    #fd;
    #runId;
    #lastId = 0n;
    #state = "init";
    #appRoot;

    constructor(appRoot) {
        super();

        this.#appRoot = appRoot;

        if (appRoot) {
            const logger = new Logger({
                logPath:nodePath.join(appRoot, "logs")
            });

            this.on("all", (event)=>{
                logger.write(event);
            });
        }

        this.start();
    }

    get runId() { return this.#runId?.toString(36); }
    get state() { return this.#state; }

    isState(state) { return this.#state === state; }
    isStates(...states) { return states.includes(this.#state); }

    emit(event) {
        if (!event || !(event instanceof Event)) { return false; }
        const { surname, name } = event;

        super.emit(name, event);
        super.emit(surname, event);
        super.emit('all', event);

        return true;
    }

    nextId() {
        if (!this.#runId) { return; }
        return `${this.runId}-${(this.#lastId++).toString(36)}`;
    }

    start() {
        fs.mkdirSync(this.#appRoot, { recursive:true });

        const statePath = nodePath.join(this.#appRoot, 'run-id');
        this.#fd = fs.openSync(statePath, 'a+');

        try {
            fsExt.flockSync(this.#fd, 'exnb');

            const value = fs.readFileSync(this.#fd, 'utf8').trim();
            this.#runId = (value ? BigInt(value) : 0n) + 1n;

            fs.ftruncateSync(this.#fd, 0);
            fs.writeSync(this.#fd, String(this.#runId));
        } catch (error) {
            fs.closeSync(this.#fd);
            this.#fd = undefined;
            this.#state = "error";
            throw error;
        }

        this.#state = "started";
        _apps.add(this);
        
        this.emit(new EventApp(this, "state", { state:"started", app:this }));
    }

    stop() {
        if (this.#fd === undefined) { return; }
        const fd = this.#fd;
        this.#fd = undefined;

        this.emit(new EventApp(this, "state", { state:"stopping", app:this }));

        fsExt.flockSync(fd, 'un');
        fs.closeSync(fd);
        this.#state = "stopped";
        _apps.delete(this);
    }

}

const shutdown = reason => {
    for (const app of [..._apps]) { app.stop(reason); }
};

process.once('SIGINT', () => {
    shutdown('SIGINT');
    process.exit(0);
});

process.once('SIGTERM', () => {
    shutdown('SIGTERM');
    process.exit(0);
});

// process.once('uncaughtException', error => {
//     shutdown('uncaughtException');
//     console.error(error);
//     process.exit(1);
// });

// process.once('unhandledRejection', error => {
//     shutdown('unhandledRejection');
//     console.error(error);
//     process.exit(1);
// });