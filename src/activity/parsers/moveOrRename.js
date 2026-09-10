import nodePath from "path";
import { EventActivity } from "../../events/Event";

/*
 * ------------------------------------------------------------
 * MOVE / RENAME
 * ------------------------------------------------------------
 *
 * Např.:
 *
 * msg:    Renamed from "foo/a.txt"
 * object: bar/a.txt
 */

export const preflight = ({ msg, object }) =>{
    const renamed = msg.match(/^Renamed from (".*")$/);
    if (renamed) { return { renamed, object }; }
}

export const parse = (parent, { renamed, object }) => {
    if (!object) { return; }
    
    let source;

    /*
    * Rclone používá quoted string,
    * JSON.parse nám zároveň vyřeší escapování.
    */
    try { source = JSON.parse(renamed[1]); }
    catch { source = renamed[1].slice(1, -1); }

    const sourcePath = parent.toRelativePath(source);
    const targetPath = parent.toRelativePath(object);
    if (!sourcePath || !targetPath) { return; }

    const action = nodePath.posix.dirname(sourcePath) === nodePath.posix.dirname(targetPath) ? 'rename' : 'move';

    const side = parent.getCopyTargetSide();
    const { task } = parent;
    return new EventActivity(action, { task, side, sourcePath, targetPath });
}