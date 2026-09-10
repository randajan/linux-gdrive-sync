

import { RCloneBisync } from "./rclone/RCloneBisync";

const gdriveBisync = new RCloneBisync({
    localPath: '/home/randajan/GoogleDrive',
    remoteName: 'gdrive:',
    trashPath: '/home/randajan/GoogleDrive-Trash',
    logPath:"/home/randajan/.local/state/linux-gdrive-sync/logs",
    runOnInit:true
});

gdriveBisync.on("activity", console.log);