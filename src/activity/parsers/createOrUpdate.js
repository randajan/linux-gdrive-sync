import { EventActivity } from "../../events/Event";

export const preflight = ({ msg, object }) =>{
    if (msg === 'Copied (new)') { return { action:"create", object }; }
    if (msg === 'Copied (replaced existing)') { return { action:"update", object }; }
}

export const parse = (parent, { action, object }) => {
    const side = parent.getCopyTargetSide();
    const targetPath = parent.toRelativePath(object);
    if (!targetPath || !side) { return; }
    const { task } = parent;
    return new EventActivity(action, { task, side, targetPath });
}