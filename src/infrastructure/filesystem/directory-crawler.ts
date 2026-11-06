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
    ctimeMs?: number | null;
    birthtimeMs?: number | null;
    isReadOnly?: boolean;
    isLocked?: boolean;
    isSymlink?: boolean;
    isMissing?: boolean;
    scanError?: string | null;
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
                    } else if ((dirent.isFile() || dirent.isSymbolicLink()) && SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
                        const isSymlink = dirent.isSymbolicLink();
                        try {
                            const stat = await fs.promises.stat(fullPath);
                            let isReadOnly = false;
                            try {
                                await fs.promises.access(fullPath, fs.constants.W_OK);
                            } catch {
                                isReadOnly = true;
                            }

                            const fileInfo: DiscoveredAudioFile = {
                                path: fullPath,
                                filename: dirent.name,
                                directory: currentDir,
                                extension: ext,
                                sizeBytes: stat.size,
                                mtimeMs: Math.floor(stat.mtimeMs),
                                ctimeMs: stat.ctimeMs ? Math.floor(stat.ctimeMs) : null,
                                birthtimeMs: stat.birthtimeMs ? Math.floor(stat.birthtimeMs) : null,
                                isSymlink,
                                isReadOnly,
                                isLocked: false,
                                isMissing: false,
                                scanError: null,
                            };

                            discovered.push(fileInfo);
                            onFileDiscovered?.(fileInfo);
                        } catch (err: unknown) {
                            const errorObj = err as NodeJS.ErrnoException;
                            const isLocked = errorObj?.code === 'EBUSY';
                            const isReadOnly = errorObj?.code === 'EACCES' || errorObj?.code === 'EPERM';
                            const isMissing = errorObj?.code === 'ENOENT';
                            const errorMsg = errorObj?.message || 'Failed to inspect audio file';

                            const fileInfo: DiscoveredAudioFile = {
                                path: fullPath,
                                filename: dirent.name,
                                directory: currentDir,
                                extension: ext,
                                sizeBytes: 0,
                                mtimeMs: 0,
                                ctimeMs: null,
                                birthtimeMs: null,
                                isSymlink,
                                isReadOnly,
                                isLocked,
                                isMissing,
                                scanError: errorMsg,
                            };

                            discovered.push(fileInfo);
                            onFileDiscovered?.(fileInfo);
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
