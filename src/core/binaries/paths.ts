import { spawnSync } from 'child_process';

export interface BinaryStatus {
    name: string;
    found: boolean;
    version?: string;
    path?: string;
    error?: string;
}

export function checkBinary(binaryName: string, versionArg: string = '-ver'): BinaryStatus {
    try {
        const result = spawnSync(binaryName, [versionArg], {
            shell: false,
            encoding: 'utf-8',
            timeout: 5000,
        });

        if (result.error) {
            return {
                name: binaryName,
                found: false,
                error: result.error.message,
            };
        }

        const version = (result.stdout || result.stderr || '').trim().split('\n')[0];
        return {
            name: binaryName,
            found: result.status === 0,
            version: version || 'unknown',
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            name: binaryName,
            found: false,
            error: message,
        };
    }
}

export function verifyMediaBinaries(): {
    exiftool: BinaryStatus;
    ffprobe: BinaryStatus;
    ffmpeg: BinaryStatus;
    allReady: boolean;
} {
    const exiftool = checkBinary('exiftool', '-ver');
    const ffprobe = checkBinary('ffprobe', '-version');
    const ffmpeg = checkBinary('ffmpeg', '-version');

    return {
        exiftool,
        ffprobe,
        ffmpeg,
        allReady: exiftool.found && ffprobe.found && ffmpeg.found,
    };
}
