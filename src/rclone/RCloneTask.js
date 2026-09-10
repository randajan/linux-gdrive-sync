import { createHash } from "crypto";
import { runRclone } from "./run";
import { EventActivity, EventTask } from "../events/Event";

export class RCloneTask {

    static generateKey = (taskName, args) => {
        return createHash('sha256')
            .update(JSON.stringify({ taskName, args }))
            .digest('base64url')
            .slice(0, 22);
    }

    #promise;
    #state = 'init';
    #handlers = new Set();

    #resolve;
    #reject;

    #emitter;
    #name;
    #key;
    #args = [];
    #activities = [];
    #activityParser;
    #triggers = [];
    #ts = { createdAt: new Date() };
    #id = Date.now();

    constructor(emitter, name, key, args, opt={}) {

        this.#emitter = emitter;
        this.#name = name;
        this.#key = key;
        this.#args = [...args];
        this.#activities = [];

        const { onEvent, triggers, activityParser } = opt;

        if (typeof onEvent === "function") { this.#handlers.add(onEvent); }
        if (Array.isArray(triggers)) { this.#triggers = [...triggers]; }

        this.#activityParser = activityParser;

        this.#promise = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
    }

    get parent() { return this.#emitter; }

    get id() { return this.#id; }
    get name() { return this.#name; }
    get promise() { return this.#promise; }

    get state() { return this.#state; }
    get key() { return this.#key; }
    get args() { return [...this.#args]; }
    get triggers() { return [...this.#triggers]; }
    get activities() { return [...this.#activities]; }

    get createdAt() { return this.#ts.createdAt; }
    get startedAt() { return this.#ts.startedAt; }
    get endedAt() { return this.#ts.endedAt; }

    get runtime() {
        const { startedAt, endedAt } = this.#ts;
        if (!startedAt) { return; }
        const end = endedAt?.getTime() ?? Date.now();
        return end - startedAt.getTime();
    }

    isState(state) { return this.#state === state; }
    isStates(...states) { return states.includes(this.#state); }

    #emit(event) {
        if (!this.#emitter.emit(event)) { return false; }
        for (const handler of this.#handlers) { handler(event); }
        return true;
    }

    #addActivity(activity) {
        if (activity?.task !== this || !(activity instanceof EventActivity)) { return; }
        this.#activities.push(activity);
        this.#emit(activity);
    }

    queued() {
        this.#state = "queued";
        const firstOccurence = true;
        this.#emit(new EventTask(this, "state", { state: "queued", firstOccurence }));
    }

    merge(opt={}) {
        if (!this.isState("queued")) { throw new Error('Cannot modify running task'); }

        const { onEvent, triggers } = opt;

        if (typeof onEvent === "function") { this.#handlers.add(onEvent); }
        if (Array.isArray(triggers)) { this.#triggers = [...this.#triggers, ...triggers]; }

        this.#emit(new EventTask(this, "state", { state: "merged" }));

        return this.#promise;
    }

    #start() {
        if (this.isState("completed") || this.isState("failed")) {
            throw new Error('Task already ended');
        }

        if (this.isState("running")) {
            throw new Error('Task already started');
        }

        const firstOccurence = this.isState("init");
        this.#state = 'running';
        this.#ts.startedAt = new Date();

        this.#emit(new EventTask(this, "state", { state: "started", firstOccurence }));
    }

    #complete(result) {
        this.#state = 'completed';
        this.#ts.endedAt = new Date();
        const { code, signal } = result;
        this.#emit(new EventTask(this, "state", { state: "completed", code, signal }));
        this.#resolve(result);
    }

    #fail(error) {
        this.#state = 'failed';
        this.#ts.endedAt = new Date();
        this.#emit(new EventTask(this, "state", { state: "failed", error }));
        this.#reject(error);
    }

    async run() {
        this.#start();

        const ap = this.#activityParser;
        ap?.setTask(this);

        try {
            const result = await runRclone(
                this.#args,
                log =>{
                    this.#emit(new EventTask(this, "log", { log }));
                    if (ap) { this.#addActivity(ap.parseLog(this, log)); }
                }
            );

            this.#complete(result);
        }
        catch (error) {
            this.#fail(error);
        }
        finally {
            ap?.unsetTask(this);
        }
    }

    toJSON() {
        const { id, name, state, runtime } = this;
        const triggers = this.#triggers.length;
        const activities = this.#activities.length;
        return { id, name, state, runtime, triggers, activities } 
    }
}