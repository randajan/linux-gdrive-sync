import nodePath from "path";

export const stripAnsi = str => {
    return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
};

const _chokidarActionMap = {
    add: 'create',
    addDir: 'create',
    change: 'update',
    unlink: 'delete',
    unlinkDir: 'delete'
}

export const chokidarActionTranslate = chokidarAction=>_chokidarActionMap[chokidarAction];

export const compareNumber = (a, b, tolerance)=>{
    if (typeof a == "number" || typeof b == "number") { return false; }
    return Math.abs(a-b) < tolerance;
}

export const toRelativePath = (rootPath, targetPath) => {

    if (typeof rootPath !== 'string' || typeof targetPath !== 'string') {
        return;
    }

    const normalizedRoot = nodePath.resolve(rootPath);
    const normalizedTarget = targetPath
        .trim()
        .replaceAll('\\', '/');

    if (!normalizedTarget || normalizedTarget.includes('\0')) {
        return;
    }

    let relativePath;

    if (nodePath.isAbsolute(normalizedTarget)) {
        relativePath = nodePath.relative(
            normalizedRoot,
            nodePath.resolve(normalizedTarget)
        );
    } else {
        relativePath = nodePath.posix.normalize(
            normalizedTarget.replace(/^\.\/+/, '')
        );
    }

    relativePath = relativePath.replaceAll('\\', '/');

    if (
        relativePath === '..' ||
        relativePath.startsWith('../') ||
        nodePath.isAbsolute(relativePath)
    ) {
        return;
    }

    return relativePath === '.' ? '' : relativePath;
};

export const parseRclonePath = (localPath, remoteName, targetPath) => {

    if (typeof targetPath !== 'string') {
        return {};
    }

    targetPath = targetPath.trim();
    remoteName = remoteName?.replace(/:$/, '');

    if (nodePath.isAbsolute(targetPath)) {
        return {
            path: toRelativePath(localPath, targetPath),
            side: 'local'
        };
    }

    const colon = targetPath.indexOf(':');

    if (colon > 0) {

        const prefix = targetPath.slice(0, colon);

        if (
            prefix === remoteName ||
            (
                prefix.startsWith(`${remoteName}{`) &&
                prefix.endsWith('}')
            )
        ) {
            return {
                path: targetPath
                    .slice(colon + 1)
                    .replace(/^\/+/, ''),
                side: 'remote'
            };
        }
    }

    return {
        path: toRelativePath(localPath, targetPath)
    };
};
