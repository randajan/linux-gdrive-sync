
/*
 * ------------------------------------------------------------
 * CONTEXT
 * ------------------------------------------------------------
 *
 * Tyto logy NEJSOU activity.
 * Pouze nám říkají, na kterou stranu následné operace míří.
 *
 * Např.:
 * - Path2    Do queued copies to    - Path1
 *
 * znamená:
 *
 * následující copy operace mění Path1 = local
 */

export const preflight = ({ msg }) => msg.match(/Path([12])\s+Do queued copies to\s+-\s*Path([12])/);

export const parse = (parent, copyDirection) => {
    parent.setCopyTargetSide(Number(copyDirection[2]));
}

//no activity is returned only state change