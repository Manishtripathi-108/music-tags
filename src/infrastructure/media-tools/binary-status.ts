import { spawnSync } from 'child_process';

export interface BinaryStatus {
    name: string;
    found: boolean;
    version?: string;
    path?: string;
    error?: string;
}

export interface BinaryVerificationResult {
    exiftool: BinaryStatus;
    ffprobe: BinaryStatus;
    ffmpeg: BinaryStatus;
    allReady: boolean;
}

/**
 * Resolves the absolute filesystem path for a binary using where.exe on Windows or which on Unix.
 */
function resolveBinaryPath(binaryName: string): string | undefined {
    try {
        const isWin = process.platform === 'win32';
        const locator = isWin ? 'where.exe' : 'which';
        const result = spawnSync(locator, [binaryName], {
            shell: false,
            encoding: 'utf-8',
            timeout: 3000,
        });

        if (result.status === 0 && result.stdout) {
            const firstLine = result.stdout.trim().split(/\r?\n/)[0]?.trim();
            return firstLine || undefined;
        }
    } catch {}
    return undefined;
}

/**
 * Normalizes raw version CLI output into a clean semantic version string.
 */
function cleanVersionString(binaryName: string, raw: string): string {
    const trimmed = raw.replace(/\r/g, '').trim();
    const firstLine = trimmed.split('\n')[0] || '';

    if (binaryName.toLowerCase().includes('exiftool')) {
        const match = firstLine.match(/\d+(?:\.\d+)+/);
        return match ? match[0] : firstLine;
    }

    if (binaryName.toLowerCase().includes('ffmpeg') || binaryName.toLowerCase().includes('ffprobe')) {
        const match = firstLine.match(/version\s+([^\s]+)/i);
        if (match) return match[1];
    }

    return firstLine || 'unknown';
}

/**
 * Executes a binary with a version argument to check for presence and retrieve version details.
 */
export function checkBinary(binaryName: string, versionArg: string = '-version'): BinaryStatus {
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

        const rawOutput = (result.stdout || result.stderr || '').trim();
        const found = result.status === 0;
        const version = found ? cleanVersionString(binaryName, rawOutput) : undefined;
        const binPath = found ? resolveBinaryPath(binaryName) : undefined;

        return {
            name: binaryName,
            found,
            version,
            path: binPath,
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

/**
 * Verifies system availability and versions for ExifTool, FFprobe, and FFmpeg.
 */
export function verifyMediaBinaries(): BinaryVerificationResult {
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
