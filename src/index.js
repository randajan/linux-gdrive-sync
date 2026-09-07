
import { info, log } from "@randajan/simple-lib/lib";
import { runRclone } from "./rclone/run";
import { RClone } from "./rclone/RClone";

import chokidar from 'chokidar';
import { createQueue } from "@randajan/queue";

const cfg = {
    localPath: '/home/randajan/GoogleDrive',
    remote: 'gdrive:',
    trashPath: '/home/randajan/GoogleDrive-Trash',
}

const gdrive = new RClone({
    ...cfg
});

gdrive.on("state", e => console.log("state", e));
gdrive.on("log", e => console.log("log", e));

let int;
const bisyncQueue = createQueue(async _=>{
    await gdrive.bisync();
    clearTimeout(int);
    int = setTimeout(_=>bisyncQueue(), 1000*60*5);
    int.unref?.();
}, {
    softMs:1000*3, //3sec
    hardMs:1000*60*2 //2min
});

const watcher = chokidar.watch(cfg.localPath, {
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
    }
});

watcher.on('all', (event, path) => {
    console.log(event, path);

    bisyncQueue();
});
