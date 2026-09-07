import { RCloneTask } from "./RCloneTask";
import { mergeHandlers } from "./tools";
import { EventEmitter } from "events";


export class RCloneRun extends EventEmitter {

    #queue = [];
    #running = null;

    /**
     * @param {string[]} args
     * @param {(entry: object) => void} [onLog]
     */
    run(args, onEvent) {
        const last = this.#queue.at(-1);
        const key = RCloneTask.generateKey(args);
        if (last?.key === key) { return last.merge(onEvent); }

        const task = new RCloneTask(this, key, args, onEvent);

        this.#queue.push(task);

        if (!this.#running) { this.#next(); }
        else { task.queued(); }

        return task.promise;
    }

    async #next() {
        if (this.#running) return;

        const task = this.#queue.shift();

        if (!task) return;

        this.#running = task;
        
        await task.run();

        this.#running = null;
        this.#next();
    }

    get isRunning() {
        return !!this.#running;
    }

    get queueSize() {
        return this.#queue.length;
    }

    get isBusy() {
        return this.isRunning || this.queueSize > 0;
    }
}