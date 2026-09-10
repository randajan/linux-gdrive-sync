

import { RCloneBisync } from "./rclone/RCloneBisync";

const gdriveBisync = new RCloneBisync({
    appRoot:"/home/randajan/.local/state/linux-gdrive-sync",
    localPath: '/home/randajan/GoogleDrive',
    remoteName: 'gdrive:',
    trashPath: '/home/randajan/GoogleDrive-Trash',
    runOnInit:true
});