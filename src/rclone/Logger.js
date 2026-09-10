import fs from "fs";
import path from "path";

export class Logger {

    #logPath;
    #stream;
    #date;

    constructor(opt = {}) {
        const { logPath } = opt;

        this.#logPath = logPath;

        fs.mkdirSync(this.#logPath, {
            recursive: true
        });
    }

    #getStream() {
        const date = new Date().toISOString().slice(0, 10);

        if (this.#date !== date) {
            this.#stream?.end();

            this.#date = date;

            this.#stream = fs.createWriteStream(
                path.join(this.#logPath, `${date}.jsonl`),
                { flags: "a" }
            );
        }

        return this.#stream;
    }

    write(event) {
        this.#getStream().write(
            JSON.stringify(event) + "\n"
        );
    }

}