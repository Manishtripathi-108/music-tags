export const SUPPORTED_AUDIO_EXTENSIONS_LIST = [
    '.mp3',
    '.flac',
    '.m4a',
    '.mp4',
    '.aac',
    '.ogg',
    '.opus',
    '.wav',
    '.aiff',
    '.aif',
    '.wma',
    '.alac',
    '.ape',
] as const;

export type SupportedAudioExtension = (typeof SUPPORTED_AUDIO_EXTENSIONS_LIST)[number];

export const SUPPORTED_AUDIO_EXTENSIONS: ReadonlySet<string> = new Set<string>(SUPPORTED_AUDIO_EXTENSIONS_LIST);

export function isSupportedAudioExtension(ext: string): ext is SupportedAudioExtension {
    return SUPPORTED_AUDIO_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Domain representation of a physical media file on the filesystem.
 */
export interface MediaFile {
    id: string;
    filename: string;
    filePath?: string;
    directory?: string;
    extension: string;
    sizeBytes?: number;
    mtimeMs?: number;
}
