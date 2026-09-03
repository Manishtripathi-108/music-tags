import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { toCanonicalPath } from '../filesystem/paths';

export const THUMBNAIL_DIR = path.resolve(process.cwd(), '.cache', 'art');

if (!fs.existsSync(/*turbopackIgnore: true*/ THUMBNAIL_DIR)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ THUMBNAIL_DIR, { recursive: true });
}

/**
 * Extracts cover art from an audio file using FFmpeg with ExifTool fallback.
 * Saves result in .cache/art/${fileId}.jpg and returns the web-accessible URL.
 */
export async function extractCoverArt(filePath: string, fileId: string): Promise<string | null> {
    const targetImage = path.join(THUMBNAIL_DIR, `${fileId}.jpg`);

    // Return cached version if already present and non-empty
    if (fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
        try {
            if (fs.statSync(/*turbopackIgnore: true*/ targetImage).size > 0) {
                return `/api/media/art/${fileId}.jpg`;
            }
        } catch {}
    }

    const canonical = toCanonicalPath(filePath);

    // 1. Try extracting attached picture via FFmpeg
    const ffmpegSuccess = await new Promise<boolean>((resolve) => {
        const args = ['-v', 'error', '-y', '-i', canonical, '-an', '-vcodec', 'copy', targetImage];
        const child = spawn('ffmpeg', args, {
            shell: false,
            windowsHide: true,
        });

        const timer = setTimeout(() => {
            child.kill();
            resolve(false);
        }, 10000);

        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0 && fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
                try {
                    if (fs.statSync(/*turbopackIgnore: true*/ targetImage).size > 0) {
                        return resolve(true);
                    }
                } catch {}
            }
            if (fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
                try {
                    fs.unlinkSync(/*turbopackIgnore: true*/ targetImage);
                } catch {}
            }
            resolve(false);
        });

        child.on('error', () => {
            clearTimeout(timer);
            resolve(false);
        });
    });

    if (ffmpegSuccess) {
        return `/api/media/art/${fileId}.jpg`;
    }

    // 2. Fallback: ExifTool binary extraction (-Picture for ID3/FLAC, -CoverArt for MP4/M4A)
    const exiftoolSuccess = await new Promise<boolean>((resolve) => {
        const outStream = fs.createWriteStream(targetImage);
        const child = spawn('exiftool', ['-b', '-Picture', canonical], {
            shell: false,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });

        const timer = setTimeout(() => {
            child.kill();
            outStream.close();
            resolve(false);
        }, 10000);

        child.stdout.pipe(outStream);

        child.on('close', (code) => {
            clearTimeout(timer);
            outStream.close(() => {
                if (code === 0 && fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
                    try {
                        if (fs.statSync(/*turbopackIgnore: true*/ targetImage).size > 0) {
                            return resolve(true);
                        }
                    } catch {}
                }
                if (fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
                    try {
                        fs.unlinkSync(/*turbopackIgnore: true*/ targetImage);
                    } catch {}
                }

                // Try -CoverArt for M4A / QuickTime
                const outStream2 = fs.createWriteStream(targetImage);
                const child2 = spawn('exiftool', ['-b', '-CoverArt', canonical], {
                    shell: false,
                    windowsHide: true,
                    stdio: ['ignore', 'pipe', 'ignore'],
                });

                const timer2 = setTimeout(() => {
                    child2.kill();
                    outStream2.close();
                    resolve(false);
                }, 10000);

                child2.stdout.pipe(outStream2);

                child2.on('close', (code2) => {
                    clearTimeout(timer2);
                    outStream2.close(() => {
                        if (code2 === 0 && fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
                            try {
                                if (fs.statSync(/*turbopackIgnore: true*/ targetImage).size > 0) {
                                    return resolve(true);
                                }
                            } catch {}
                        }
                        if (fs.existsSync(/*turbopackIgnore: true*/ targetImage)) {
                            try {
                                fs.unlinkSync(/*turbopackIgnore: true*/ targetImage);
                            } catch {}
                        }
                        resolve(false);
                    });
                });

                child2.on('error', () => {
                    clearTimeout(timer2);
                    outStream2.close();
                    resolve(false);
                });
            });
        });

        child.on('error', () => {
            clearTimeout(timer);
            outStream.close();
            resolve(false);
        });
    });

    if (exiftoolSuccess) {
        return `/api/media/art/${fileId}.jpg`;
    }

    return null;
}
