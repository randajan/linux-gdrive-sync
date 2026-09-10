import { App } from "../app/App";
import { RCloneTask } from "./RCloneTask";


export class RCloneRun extends App {

    #queue = [];
    #currentTask = null;

    /**
     * @param {string[]} args
     * @param {(entry: object) => void} [onLog]
     */
    run(taskName, args, opt={}) {
        if (!this.isStates("started", "running")) {
            throw new Error("App is is not running");
        }

        const last = this.#queue.at(-1);
        const key = RCloneTask.generateKey(taskName, args);
        if (last?.key === key) { return last.merge(opt); }

        const task = new RCloneTask(this, taskName, key, args, opt);

        this.#queue.push(task);

        if (!this.#currentTask) { this.#next(); }
        else { task.queued(); }

        return task.promise;
    }

    async #next() {
        if (this.#currentTask) return;

        const task = this.#queue.shift();

        if (!task) return;

        this.#currentTask = task;

        try {
            await task.run();
        }
        finally {
            this.#currentTask = null;
            this.#next();
        }

    }

    get state() { return !!this.#currentTask ? "running" : super.state; }
    get queueSize() { return this.#queue.length; }
    get isBusy() { return !!this.#currentTask || this.queueSize > 0; }
}