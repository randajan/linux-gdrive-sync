
import { info, log } from "@randajan/simple-lib/lib";
import { runRclone } from "./rclone/run";

const remote = "gdrive:";

(async () => {

    const r = await runRclone([
        'dedupe',
        remote,
        '--dedupe-mode', 'list',
        '--drive-skip-gdocs',
        "--fast-list",
        '--stats', '5s',
        '-v'
    ], entry => {
        console.log(entry);
    });

    console.log("DONE", r);

})();