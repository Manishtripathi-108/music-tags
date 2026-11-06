import { type AudioMetadata } from './audio-metadata';
import { type AudioTechnicalInfo } from './audio-technical-info';
import { type CoverArtInfo } from './cover-art';
import { type LyricsInfo } from './lyrics';
import { type MediaFile } from './media-file';

/**
 * The canonical Track domain aggregate.
 * Composes core file metadata, editorial tags, technical specifications,
 * cover art, and lyrics information.
 */
export interface Track extends MediaFile, AudioMetadata, AudioTechnicalInfo, CoverArtInfo, LyricsInfo {
    id: string;
    filename: string;
    filePath?: string;
    directory?: string;
    isModified?: boolean;
}

export interface RawTag {
    tag: string;
    group: string;
    value: string | number | boolean | null;
    description?: string;
    isWritable?: boolean;
}

/**
 * Details of the currently active track selected in the workstation inspector.
 */
export interface ActiveTrackDetail {
    metadata: Track | null;
    rawTags: RawTag[];
    isLoading: boolean;
}
