
/*
 * ------------------------------------------------------------
 * CONTEXT
 * ------------------------------------------------------------
 *
 * Tyto logy NEJSOU activity.
 * Pouze nám říkají, na kterou stranu následné operace míří.
 *
 * Např.:
 *
 * - Path1 Queue delete - /home/.../foo.pdf
 *
 * Samotný Queue delete NENÍ activity.
 *
 * Pouze si zapamatujeme, že případné následné
 * "Deleted" / "Removing directory" patří Path1.
*/


export const preflight = ({ msg }) => msg.match(/Path([12])\s+Queue delete\s+-\s*(.+)$/);

export const parse = (parent, queuedDelete) => {
    const { path:targetPath, side:detectedSide } = parent.parsePath(queuedDelete[2]);
    if (!targetPath) { return; }
    
    parent.setPendingDeleteSide(targetPath, detectedSide ?? Number(queuedDelete[1]));
}

//no activity is returned
