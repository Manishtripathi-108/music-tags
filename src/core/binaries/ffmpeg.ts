import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { toCanonicalPath } from '@/lib/paths';

const THUMBNAIL_DIR = path.resolve(process.cwd(), '.cache', 'art');

if (!fs.existsSync(THUMBNAIL_DIR)) {
    fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

export async function extractCoverArt(filePath: string, fileId: string): Promise<string | null> {
    const targetImage = path.join(THUMBNAIL_DIR, `${fileId}.jpg`);

    // Return cached version if exists
    if (fs.existsSync(targetImage)) {
        return `/api/media/art/${fileId}.jpg`;
    }

    const canonical = toCanonicalPath(filePath);

    return new Promise((resolve) => {
        // Extract first attached picture stream
        const args = ['-v', 'error', '-y', '-i', canonical, '-an', '-vcodec', 'copy', targetImage];

        const child = spawn('ffmpeg', args, {
            shell: false,
            windowsHide: true,
        });

        const timer = setTimeout(() => {
            child.kill();
            resolve(null);
        }, 10000);

        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0 && fs.existsSync(targetImage) && fs.statSync(targetImage).size > 0) {
                resolve(`/api/media/art/${fileId}.jpg`);
            } else {
                // Remove empty target file if failed
                if (fs.existsSync(targetImage)) {
                    try {
                        fs.unlinkSync(targetImage);
                    } catch {}
                }
                resolve(null);
            }
        });

        child.on('error', () => {
            clearTimeout(timer);
            resolve(null);
        });
    });
}
