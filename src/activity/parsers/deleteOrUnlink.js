
/*
 * ------------------------------------------------------------
 * DELETE
 * ------------------------------------------------------------
 *
 * "Moved into backup dir" je z pohledu synchronizovaného
 * stromu také DELETE.
 */

import { EventActivity } from "../../events/Event";


export const preflight = ({ msg, object }) =>{
    if (msg === 'Deleted' || msg === 'Moved into backup dir' || msg === 'Removing directory') { return object; }
};

export const parse = (parent, logObject) => {
    const { path: candidatePath, side: detectedSide } = parent.parsePath(logObject);

    if (!candidatePath) { return; }

    const side = detectedSide ?? parent.getPendingDeleteSide(candidatePath);

    parent.setPendingDeleteSide(candidatePath);

    return new EventActivity("delete", parent.task, { side, targetPath: candidatePath });
};