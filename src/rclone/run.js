import { spawn } from 'child_process';


export const runRclone = (args, onLog) => new Promise((resolve, reject) => {

    const proc = spawn('rclone', [
        ...args,
        '--use-json-log'
    ], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const logs = [];

    let stdoutBuffer = '';
    let stderrBuffer = '';

    const handleLines = (chunk, stream) => {

        const isStdout = stream === 'stdout';

        if (isStdout) {
            stdout += chunk;
            stdoutBuffer += chunk;
        }
        else {
            stderr += chunk;
            stderrBuffer += chunk;
        }

        let buffer = isStdout
            ? stdoutBuffer
            : stderrBuffer;

        const lines = buffer.split('\n');
        buffer = lines.pop();

        if (isStdout) {
            stdoutBuffer = buffer;
        }
        else {
            stderrBuffer = buffer;
        }

        for (const line of lines) {
            parseLogLine(line);
        }
    };

    const parseLogLine = line => {
        if (!line.trim()) return;

        try {
            const entry = JSON.parse(line);

            logs.push(entry);
            onLog?.(entry);
        }
        catch {
            // Normální výstup příkazů jako `rclone version`
            // není rclone log, takže ho do logs nedáváme.
        }
    };

    proc.stdout.on('data', chunk => {
        handleLines(chunk.toString(), 'stdout');
    });

    proc.stderr.on('data', chunk => {
        handleLines(chunk.toString(), 'stderr');
    });

    proc.once('error', reject);

    proc.once('close', (code, signal) => {

        // Zpracovat případný poslední neukončený řádek
        parseLogLine(stdoutBuffer);
        parseLogLine(stderrBuffer);

        const result = {
            code,
            signal,
            stdout,
            stderr,
            logs
        };

        if (code === 0) {
            resolve(result);
        }
        else {
            const error = new Error(`rclone exited with code ${code}`);
            error.result = result;

            reject(error);
        }
    });
});