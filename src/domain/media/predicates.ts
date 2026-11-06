import { hasLrcTimestamps } from './lyrics';
import { type Track } from './track';

export function isLossless(track: Track): boolean {
    return Boolean(track.lossless);
}

export function isHiRes(track: Track): boolean {
    return Boolean(track.bitDepth && track.bitDepth > 16);
}

export function isMissingArt(track: Track): boolean {
    return !track.hasCoverArt;
}

export function isLowResolutionArt(track: Track, threshold = 800): boolean {
    if (!track.hasCoverArt) return false;
    return Boolean(track.coverArtWidth && track.coverArtHeight && (track.coverArtWidth < threshold || track.coverArtHeight < threshold));
}

export function isMissingBpm(track: Track): boolean {
    return !track.bpm;
}

export function isMissingLyrics(track: Track): boolean {
    return !track.lyrics || track.lyrics.trim().length === 0;
}

export function isSyncedLyrics(track: Track): boolean {
    return track.lyricsType === 'synced' || hasLrcTimestamps(track.lyrics);
}

export function isUnsyncedLyrics(track: Track): boolean {
    return track.lyricsType === 'unsynced' || (!hasLrcTimestamps(track.lyrics) && Boolean(track.lyrics && track.lyrics.trim().length > 0));
}

export function hasScanError(track: Track): boolean {
    return Boolean(track.scanError) || track.scanStatus === 'ERROR' || track.scanStatus === 'FAILED';
}

export function isMissingFile(track: Track): boolean {
    return Boolean(track.isMissing);
}

export function isLockedFile(track: Track): boolean {
    return Boolean(track.isLocked);
}

export function isReadOnlyFile(track: Track): boolean {
    return Boolean(track.isReadOnly);
}

export function isCorruptFile(track: Track): boolean {
    return Boolean(track.isCorrupt);
}

export function isSymlinkFile(track: Track): boolean {
    return Boolean(track.isSymlink);
}

export function isIncompleteScan(track: Track): boolean {
    return (
        track.scanStatus === 'PENDING' ||
        track.scanStatus === 'INCOMPLETE' ||
        track.scanStatus === 'ERROR' ||
        track.scanStatus === 'FAILED'
    );
}

export function hasAnyFileProblem(track: Track): boolean {
    return hasScanError(track) || isMissingFile(track) || isLockedFile(track) || isCorruptFile(track) || isIncompleteScan(track);
}

export function matchesFolder(track: Track, folderPath: string): boolean {
    return track.directory === folderPath || Boolean(track.filePath && track.filePath.startsWith(folderPath));
}

export function matchesSearchQuery(track: Track, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;

    return (
        Boolean(track.title && track.title.toLowerCase().includes(q)) ||
        Boolean(track.artist && track.artist.toLowerCase().includes(q)) ||
        Boolean(track.albumArtist && track.albumArtist.toLowerCase().includes(q)) ||
        Boolean(track.album && track.album.toLowerCase().includes(q)) ||
        Boolean(track.genre && track.genre.toLowerCase().includes(q)) ||
        Boolean(track.filename && track.filename.toLowerCase().includes(q)) ||
        Boolean(track.composer && track.composer.toLowerCase().includes(q)) ||
        Boolean(track.initialKey && track.initialKey.toLowerCase().includes(q)) ||
        Boolean(track.lyrics && track.lyrics.toLowerCase().includes(q)) ||
        Boolean(track.year && String(track.year).includes(q))
    );
}

export interface TrackFilterOptions {
    activeFilter?: string;
    searchQuery?: string;
}

/**
 * Canonical track collection filter used across Workstation table, sidebar counts, and duplicate filtering.
 */
export function filterTracks(tracks: Track[], options: TrackFilterOptions): Track[] {
    const { activeFilter = 'all', searchQuery = '' } = options;
    let result = tracks;

    if (activeFilter === 'problems') {
        result = result.filter(hasAnyFileProblem);
    } else if (activeFilter === 'scan-errors') {
        result = result.filter(hasScanError);
    } else if (activeFilter === 'missing-files') {
        result = result.filter(isMissingFile);
    } else if (activeFilter === 'corrupt-files') {
        result = result.filter(isCorruptFile);
    } else if (activeFilter === 'locked-files') {
        result = result.filter(isLockedFile);
    } else if (activeFilter === 'readonly-files') {
        result = result.filter(isReadOnlyFile);
    } else if (activeFilter === 'symlinks') {
        result = result.filter(isSymlinkFile);
    } else if (activeFilter === 'incomplete-scan') {
        result = result.filter(isIncompleteScan);
    } else if (activeFilter === 'lossless') {
        result = result.filter(isLossless);
    } else if (activeFilter === 'hi-res') {
        result = result.filter(isHiRes);
    } else if (activeFilter === 'missing-art') {
        result = result.filter(isMissingArt);
    } else if (activeFilter === 'low-res-art') {
        result = result.filter((t) => isLowResolutionArt(t));
    } else if (activeFilter === 'missing-bpm') {
        result = result.filter(isMissingBpm);
    } else if (activeFilter === 'missing-lyrics') {
        result = result.filter(isMissingLyrics);
    } else if (activeFilter === 'lyrics-synced') {
        result = result.filter(isSyncedLyrics);
    } else if (activeFilter === 'lyrics-unsynced') {
        result = result.filter(isUnsyncedLyrics);
    } else if (activeFilter.startsWith('folder:')) {
        const folderPath = activeFilter.slice('folder:'.length);
        result = result.filter((t) => matchesFolder(t, folderPath));
    }

    if (searchQuery.trim()) {
        result = result.filter((t) => matchesSearchQuery(t, searchQuery));
    }

    return result;
}
