import { solid, solids } from "@randajan/props";

export class Event {

    #app;
    #surname;
    #firstname;

    constructor(app, surname, firstname, data) {
        this.#app = app;
        this.#surname = surname;
        this.#firstname = firstname;

        solid(this, "id", app.nextId());
        solid(this, "date", new Date());
        solid(this, "name", `${surname}-${firstname}`);
        solids(this, data);
    }

    get app() { return this.#app; }
    get firstname() { return this.#firstname; }
    get surname() { return this.#surname; }

}

export class EventApp extends Event {
    constructor(app, firstname, data) {
        super(app, "app", firstname, data);
    }
}

export class EventTrigger extends Event {
    constructor(app, firstname, data) {
        super(app, "trigger", firstname, data);
    }
}


export class EventTask extends Event {

    constructor(task, firstname, data={}) {
        super(task.app, "task", firstname, data);
        solid(this, "task", task);
    }

    toJSON() {
        const { task, ...pass } = this;
        const taskSerialized = task?.serialize?.(this.firstOccurence) || task;
        return { ...pass, task:taskSerialized };
    }
}

export class EventActivity extends Event {
    constructor(action, task, data={}) {
        super(task.app, "activity", action, data);
        solid(this, "action", action);
        solid(this, "task", task);
        
    }
}