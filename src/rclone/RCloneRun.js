import { Event } from "../events/Event";
import { Logger } from "./Logger";
import { RCloneTask } from "./RCloneTask";
import { EventEmitter } from "events";


export class RCloneRun extends EventEmitter {

    #queue = [];
    #running = null;

    constructor(cfg) {
        super();

        const { logPath } = cfg;

        if (logPath) {
            const logger = new Logger({
                logPath
            });

            this.on("all", (event)=>{
                logger.write(event);
            });
        }

    }

    emit(event) {
        if (!event || !(event instanceof Event)) { return false; }
        const { surname, name } = event;

        super.emit(name, event);
        super.emit(surname, event);
        super.emit('all', event);

        return true;
    }

    /**
     * @param {string[]} args
     * @param {(entry: object) => void} [onLog]
     */
    run(taskName, args, opt={}) {
        const last = this.#queue.at(-1);
        const key = RCloneTask.generateKey(taskName, args);
        if (last?.key === key) { return last.merge(opt); }

        const task = new RCloneTask(this, taskName, key, args, opt);

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

    get isRunning() { return !!this.#running; }
    get queueSize() { return this.#queue.length; }
    get isBusy() { return this.isRunning || this.queueSize > 0; }
}