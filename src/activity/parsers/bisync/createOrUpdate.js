import { EventActivity } from "../../events/Event";

export const preflight = ({ msg, object }) =>{
    if (msg === 'Copied (new)') { return { action:"create", object }; }
    if (msg === 'Copied (replaced existing)') { return { action:"update", object }; }
}

export const parse = (parent, { action, object }) => {
    const targetPath = parent.toRelativePath(object);
    if (!targetPath) { return; }
    const side = parent.getCopyTargetSide() || "local";
    return new EventActivity(action, parent.task, { side, targetPath });
}