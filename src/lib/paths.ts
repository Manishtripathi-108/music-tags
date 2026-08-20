import fs from 'fs';
import path from 'path';

/**
 * Ensures Windows path supports lengths > 260 characters by prefixing \\?\ if needed.
 */
export function toCanonicalPath(filePath: string): string {
    const normalized = path.resolve(filePath);
    if (process.platform === 'win32' && !normalized.startsWith('\\\\?\\') && normalized.length > 240) {
        return `\\\\?\\${normalized}`;
    }
    return normalized;
}

/**
 * Removes Windows long-path prefix for clean UI presentation.
 */
export function toDisplayPath(filePath: string): string {
    if (filePath.startsWith('\\\\?\\')) {
        return filePath.slice(4);
    }
    return filePath;
}

/**
 * Validates that the path exists and is a directory.
 */
export async function validateDirectory(dirPath: string): Promise<{ valid: boolean; error?: string; resolvedPath: string }> {
    try {
        const resolved = path.resolve(dirPath);
        const stats = await fs.promises.stat(resolved);
        if (!stats.isDirectory()) {
            return { valid: false, error: 'Path is a file, not a directory.', resolvedPath: resolved };
        }
        return { valid: true, resolvedPath: resolved };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { valid: false, error: `Directory cannot be accessed: ${message}`, resolvedPath: dirPath };
    }
}
