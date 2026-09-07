import { runRclone } from "./run";

export class RCloneTask {

    static generateKey = (args)=>{ return JSON.stringify(args); }

    #state = 'init';
    #handlers = new Set();

    #resolve;
    #reject;

    #emitter;
    #key;
    #args = [];
    #ts = { createdAt: new Date() }

    constructor(emitter, key, args, onEvent) {
        this.#emitter = emitter;
        this.#key = key;
        this.#args = [...args];

        if (typeof onEvent === "function") { this.#handlers.add(onEvent); }

        this.promise = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
    }

    get state() { return this.#state; }
    get key() { return this.#key; }
    get args() { return [...this.#args]; }

    get createdAt() { return this.#ts.createdAt; }
    get startedAt() { return this.#ts.startedAt; }
    get endedAt() { return this.#ts.endedAt; }

    get runtime() {
        const { startedAt, endedAt } = this.#ts;
        if (!startedAt) { return 0; }
        const end = endedAt?.getTime() ?? Date.now();
        return end - startedAt.getTime();
    }

    isState(state) { return this.#state === state; }

    emit(eventName, entry={}) {
        entry = {...entry, task:this};
        this.#emitter.emit(eventName, entry);
        for (const handler of this.#handlers) {
            handler(eventName, entry);
        }
    }

    queued() {
        this.#state = "queued";
        this.emit("state", { merged:false });
    }

    merge(onEvent) {
        if (!this.isState("queued")) { throw new Error('Cannot modify running task'); }

        if (onEvent) { this.#handlers.add(onEvent); }

        this.emit("state", { merged:true });

        return this.promise;
    }

    #start() {
        if (this.isState("completed") || this.isState("failed")) {
            throw new Error('Task already ended');
        }

        if (this.isState("running")) {
            throw new Error('Task already started');
        }

        this.#state = 'running';
        this.#ts.startedAt = new Date();

        this.emit("state", { });
    }

    #complete(result) {
        this.#state = 'completed';
        this.#ts.endedAt = new Date();
        this.emit("state", { result });
        this.#resolve(result);
    }

    #fail(error) {
        this.#state = 'failed';
        this.#ts.endedAt = new Date();
        this.emit("state", { error });
        this.#reject(error);
    }

    async run() {
        this.#start();

        try {
            const result = await runRclone(
                this.#args,
                log => this.emit("log", { log })
            );

            this.#complete(result);
        }
        catch (error) {
            this.#fail(error);
        }
    }
}