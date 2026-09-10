import { spawn } from 'child_process';
import { stripAnsi } from './tools';


const createLineParser = (onLine) => {

    let buffer = '';

    const push = chunk => {
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
            onLine(line);
        }
    };

    const flush = () => {
        if (buffer.trim()) {
            onLine(buffer);
        }

        buffer = '';
    };

    return {
        push,
        flush
    };
};


/**
 * Spustí rclone proces a průběžně streamuje jeho výstup.
 *
 * Nic neakumuluje v paměti.
 * Vhodné i pro dlouho běžící procesy typu changenotify.
 *
 * @param {string[]} args
 * @param {object} [opt]
 * @param {(entry: object) => void} [opt.onLog]
 * @param {(chunk: string) => void} [opt.onStdout]
 * @param {(chunk: string) => void} [opt.onStderr]
 * @returns {import('node:child_process').ChildProcess}
 */
export const spawnRclone = (args, opt = {}) => {

    const {
        onLog,
        onStdout,
        onStderr
    } = opt;

    const proc = spawn('rclone', [
        ...args,
        '--use-json-log'
    ], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    const parseLogLine = line => {
        if (!line.trim()) return;
        if (!onLog) { return; }

        try {
            const entry = JSON.parse(line);
            if (typeof entry.msg === 'string') {
                entry.msg = stripAnsi(entry.msg);
            }
            onLog(Object.freeze(entry));
        }
        catch {
            // Normální stdout příkazů jako `rclone version`
            // není rclone JSON log.
        }
    };

    const stdoutParser = createLineParser(parseLogLine);
    const stderrParser = createLineParser(parseLogLine);

    proc.stdout.on('data', chunk => {
        const str = chunk.toString();

        onStdout?.(str);
        stdoutParser.push(str);
    });

    proc.stderr.on('data', chunk => {
        const str = chunk.toString();

        onStderr?.(str);
        stderrParser.push(str);
    });

    proc.stdout.once('end', () => {
        stdoutParser.flush();
    });

    proc.stderr.once('end', () => {
        stderrParser.flush();
    });

    return proc;
};


/**
 * Spustí jednorázový rclone proces a počká na jeho dokončení.
 *
 * Na rozdíl od spawnRclone ukládá stdout, stderr a logs.
 *
 * @param {string[]} args
 * @param {(entry: object) => void} [onLog]
 */
export const runRclone = (args, onLog) => new Promise((resolve, reject) => {

    let stdout = '';
    let stderr = '';
    const logs = [];

    let spawnError = null;

    const proc = spawnRclone(args, {

        onLog: entry => {
            logs.push(entry);
            onLog?.(entry);
        },

        onStdout: chunk => {
            stdout += chunk;
        },

        onStderr: chunk => {
            stderr += chunk;
        }
    });

    proc.once('error', error => {
        spawnError = error;
    });

    proc.once('close', (code, signal) => {

        const result = {
            code,
            signal,
            stdout,
            stderr,
            logs
        };

        if (spawnError) {
            spawnError.result = result;
            reject(spawnError);
            return;
        }

        if (code === 0) {
            resolve(result);
            return;
        }

        const error = new Error(`rclone exited with code ${code}`);
        error.result = result;

        reject(error);
    });
});