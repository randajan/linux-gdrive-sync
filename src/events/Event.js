import { solid, solids } from "@randajan/props";

export class Event {

    #surname;
    #firstname;

    constructor(surname, firstname, data) {
        this.#surname = surname;
        this.#firstname = firstname;

        solid(this, "date", new Date());
        solid(this, "name", `${surname}-${firstname}`);
        solids(this, data);
    }

    get firstname() { return this.#firstname; }
    get surname() { return this.#surname; }

}


export class EventTrigger extends Event {
    constructor(firstname, data) {
        super("trigger", firstname, data);
    }
}


export class EventTask extends Event {

    constructor(task, firstname, data={}) {
        super("task", firstname, data);
        solid(this, "task", task);
    }

    toJSON() {
        if (!this.firstOccurence) { return this; }

        const { task={}, ...pass } = this;
        const { key, args, createdAt, startedAt, endedAt } = task;
        const taskDefault = (task.toJSON?.() || {});
        return { ...pass, task:{ key, args, createdAt, startedAt, endedAt, ...taskDefault } };
    }
}

export class EventActivity extends Event {
    constructor(action, task, data={}) {
        super("activity", action, data);
        solid(this, "action", action);
        solid(this, "task", task);
        
    }
}