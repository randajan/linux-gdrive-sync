import nodePath from "path";

export const stripAnsi = str => {
    return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
};


export const toRelativePath = (rootPath, targetPath) => {

    if (typeof targetPath !== 'string') {
        return targetPath;
    }

    targetPath = targetPath.trim();

    if (!nodePath.isAbsolute(targetPath)) {
        return targetPath.replaceAll('\\', '/').replace(/^\.\/+/, '');
    }

    return nodePath
        .relative(rootPath, targetPath)
        .replaceAll('\\', '/');
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