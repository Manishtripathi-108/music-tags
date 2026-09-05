import fs from 'fs';
import path from 'path';

import { SUPPORTED_AUDIO_EXTENSIONS } from '@/domain/media/media-file';

export interface DiscoveredAudioFile {
    path: string;
    filename: string;
    directory: string;
    extension: string;
    sizeBytes: number;
    mtimeMs: number;
}

export interface DirectoryCrawlerOptions {
    rootPath: string;
    recursive?: boolean;
    signal?: AbortSignal;
    onFileDiscovered?: (file: DiscoveredAudioFile) => void;
    onDirectoryEntered?: (directory: string) => void;
}

const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', '$recycle.bin', 'system volume information', '.git', '.svn', '.hg']);

/**
 * Traverses filesystem directories to discover supported audio files.
 * Does NOT interact with databases, extraction tools, or external services.
 */
export class DirectoryCrawler {
    public async crawl(options: DirectoryCrawlerOptions): Promise<DiscoveredAudioFile[]> {
        const { rootPath, recursive = true, signal, onFileDiscovered, onDirectoryEntered } = options;
        const discovered: DiscoveredAudioFile[] = [];
        const queue: string[] = [rootPath];

        // Breadth-first traversal
        // This approach avoids deep recursion and allows for better control over cancellation
        // and progress reporting.
        while (queue.length > 0) {
            if (signal?.aborted) {
                break;
            }

            const currentDir = queue.shift()!;
            onDirectoryEntered?.(currentDir);

            let dirHandle: fs.Dir | null = null;
            try {
                dirHandle = await fs.promises.opendir(currentDir);

                for await (const dirent of dirHandle) {
                    if (signal?.aborted) break;

                    const fullPath = path.join(currentDir, dirent.name);
                    const ext = path.extname(dirent.name).toLowerCase();

                    if (dirent.isDirectory() && recursive) {
                        const lowerName = dirent.name.toLowerCase();
                        if (!dirent.name.startsWith('.') && !IGNORED_DIRECTORY_NAMES.has(lowerName)) {
                            queue.push(fullPath);
                        }
                    } else if (dirent.isFile() && SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
                        try {
                            const stat = await fs.promises.stat(fullPath);
                            const fileInfo: DiscoveredAudioFile = {
                                path: fullPath,
                                filename: dirent.name,
                                directory: currentDir,
                                extension: ext,
                                sizeBytes: stat.size,
                                mtimeMs: Math.floor(stat.mtimeMs),
                            };

                            discovered.push(fileInfo);
                            onFileDiscovered?.(fileInfo);
                        } catch {
                            // Inaccessible or unreadable file stats skipped gracefully
                            continue;
                        }
                    }
                }
            } catch {
                // Inaccessible directory skipped gracefully
                continue;
            } finally {
                if (dirHandle) {
                    try {
                        await dirHandle.close();
                    } catch {}
                }
            }
        }

        return discovered;
    }
}

export const defaultDirectoryCrawler = new DirectoryCrawler();
