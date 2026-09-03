import {
    type DuplicateCluster,
    type DuplicateFindOptions,
    type DuplicateMatchMode,
    type DuplicateTrackComparison,
    type Track,
} from '@/types/audio';

/**
 * Cleans and normalizes a string for robust duplicate comparison.
 * Strips punctuation, casing, accents, and common release/tag modifiers.
 */
export function cleanMetadataString(str?: string | null): string {
    if (!str) return '';

    let cleaned = str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Strip accents

    // Remove common media suffixes in brackets/parentheses
    cleaned = cleaned.replace(
        /\s*[\(\[](?:official\s*(?:video|audio|music\s*video)|lyric\s*video|lyrics|remastered|deluxe\s*(?:edition)?|explicit|clean|hq|audio)[\)\]]/gi,
        ''
    );

    // Remove feat./ft. portions from title to focus on core title
    cleaned = cleaned.replace(/\s*(?:feat\.?|featuring|ft\.?)\s+.*$/gi, '');

    // Replace non-alphanumeric characters with space
    cleaned = cleaned.replace(/[^a-z0-9]/g, ' ');

    // Collapse multiple spaces
    return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Calculates American Soundex phonetic code for a single word.
 */
export function soundexWord(word: string): string {
    let clean = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (!clean) return '';

    // Phonetic digraph normalization for music titles and artist names
    clean = clean
        .replace(/^PH/, 'F')
        .replace(/^KN/, 'N')
        .replace(/^WR/, 'R')
        .replace(/^X/, 'Z')
        .replace(/^PS/, 'S')
        .replace(/^GN/, 'N');

    const mapping: Record<string, string> = {
        B: '1', F: '1', P: '1', V: '1',
        C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
        D: '3', T: '3',
        L: '4',
        M: '5', N: '5',
        R: '6',
    };

    let result = clean[0];
    let prevCode = mapping[clean[0]] || '';

    for (let i = 1; i < clean.length; i++) {
        const char = clean[i];
        const code = mapping[char] || '';

        if (code && code !== prevCode) {
            result += code;
            prevCode = code;
        } else if (!code) {
            prevCode = ''; // Vowels and unmapped letters separate identical codes
        }

        if (result.length === 4) break;
    }

    return result.padEnd(4, '0');
}

/**
 * Computes a multi-word phonetic representation of a string.
 */
export function phoneticSignature(str?: string | null): string {
    const cleaned = cleanMetadataString(str);
    if (!cleaned) return '';

    const words = cleaned.split(' ').filter((w) => w.length > 1);
    const codes = words.map(soundexWord).filter(Boolean);
    return Array.from(new Set(codes)).sort().join('-');
}

/**
 * Calculates Dice coefficient (0.0 to 1.0) using character bigrams.
 */
export function stringSimilarity(a: string, b: string): number {
    const strA = cleanMetadataString(a);
    const strB = cleanMetadataString(b);

    if (strA === strB) return 1.0;
    if (!strA || !strB) return 0.0;
    if (strA.length < 2 || strB.length < 2) return strA === strB ? 1.0 : 0.0;

    const getBigrams = (s: string) => {
        const bigrams = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i++) {
            const bg = s.substring(i, i + 2);
            bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
        }
        return bigrams;
    };

    const bigramsA = getBigrams(strA);
    const bigramsB = getBigrams(strB);

    let intersection = 0;
    for (const [bg, countA] of bigramsA.entries()) {
        if (bigramsB.has(bg)) {
            intersection += Math.min(countA, bigramsB.get(bg)!);
        }
    }

    const totalA = strA.length - 1;
    const totalB = strB.length - 1;
    return (2.0 * intersection) / (totalA + totalB);
}

/**
 * Evaluates the quality score of a track to pick the best keeper among duplicates.
 */
export function scoreTrackQuality(track: Track): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (track.lossless) {
        score += 50;
        reasons.push('Lossless Audio');
    }

    if (track.bitDepth && track.bitDepth > 16) {
        score += 35;
        reasons.push(`${track.bitDepth}-bit Hi-Res`);
    } else if (track.bitDepth === 16) {
        score += 15;
    }

    if (track.sampleRateHz && track.sampleRateHz >= 96000) {
        score += 20;
        reasons.push(`${Math.round(track.sampleRateHz / 1000)}kHz Hi-Res`);
    } else if (track.sampleRateHz && track.sampleRateHz >= 48000) {
        score += 10;
    }

    if (track.bitrateKbps) {
        if (track.bitrateKbps >= 320) {
            score += 25;
            if (!track.lossless) reasons.push('320 kbps');
        } else if (track.bitrateKbps >= 256) {
            score += 15;
        } else if (track.bitrateKbps >= 192) {
            score += 10;
        }
    }

    if (track.hasCoverArt) {
        score += 15;
        if (track.coverArtWidth && track.coverArtWidth >= 1400) {
            score += 20;
            reasons.push(`${track.coverArtWidth}×${track.coverArtHeight} HD Cover`);
        } else if (track.coverArtWidth && track.coverArtWidth >= 600) {
            score += 10;
            reasons.push(`${track.coverArtWidth}×${track.coverArtHeight} Cover`);
        } else {
            reasons.push('Cover Art');
        }
    }

    if (track.lyricsType === 'synced' || Boolean(track.lyricsSyncedJson)) {
        score += 20;
        reasons.push('Synced Lyrics');
    } else if (track.lyrics) {
        score += 8;
        reasons.push('Lyrics');
    }

    if (track.isrc) {
        score += 5;
        reasons.push('ISRC Tagged');
    }

    if (track.trackNumber) score += 3;
    if (track.year) score += 3;
    if (track.genre) score += 3;

    return { score, reasons };
}

/**
 * Union-Find data structure for merging duplicate candidate pairs into clusters.
 */
class DisjointSet {
    parent = new Map<string, string>();
    edgeReasons = new Map<string, { reason: DuplicateCluster['matchReason']; confidence: number; label: string }>();

    find(id: string): string {
        if (!this.parent.has(id)) {
            this.parent.set(id, id);
            return id;
        }
        if (this.parent.get(id) !== id) {
            this.parent.set(id, this.find(this.parent.get(id)!));
        }
        return this.parent.get(id)!;
    }

    union(
        a: string,
        b: string,
        reason: DuplicateCluster['matchReason'],
        confidence: number,
        label: string
    ) {
        const rootA = this.find(a);
        const rootB = this.find(b);
        if (rootA !== rootB) {
            this.parent.set(rootA, rootB);
            const key = `${rootA}::${rootB}`;
            this.edgeReasons.set(key, { reason, confidence, label });
        }
    }
}

/**
 * Core Duplicate Finder engine.
 */
export function findDuplicates(
    tracks: Track[],
    options: DuplicateFindOptions = { mode: 'all' }
): DuplicateCluster[] {
    const {
        mode = 'all',
        similarityThreshold = 0.85,
        durationToleranceSec = 5,
        folderPath,
    } = options;

    let pool = tracks;
    if (folderPath) {
        pool = pool.filter(
            (t) =>
                t.directory === folderPath ||
                (Boolean(t.filePath) && t.filePath!.startsWith(folderPath))
        );
    }

    if (pool.length < 2) return [];

    const ds = new DisjointSet();
    const trackMap = new Map<string, Track>();
    for (const t of pool) {
        trackMap.set(t.id, t);
    }

    const pairMatched = new Set<string>();
    const markPair = (
        idA: string,
        idB: string,
        reason: DuplicateCluster['matchReason'],
        confidence: number,
        label: string
    ) => {
        if (idA === idB) return;
        const key = idA < idB ? `${idA}::${idB}` : `${idB}::${idA}`;
        if (pairMatched.has(key)) return;
        pairMatched.add(key);
        ds.union(idA, idB, reason, confidence, label);
    };

    // 1. Exact ISRC matching
    if (mode === 'all' || mode === 'isrc') {
        const isrcMap = new Map<string, string[]>();
        for (const t of pool) {
            const isrc = t.isrc?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (isrc && isrc.length >= 10) {
                const group = isrcMap.get(isrc) || [];
                group.push(t.id);
                isrcMap.set(isrc, group);
            }
        }
        for (const [isrc, ids] of isrcMap.entries()) {
            if (ids.length > 1) {
                for (let i = 1; i < ids.length; i++) {
                    markPair(ids[0], ids[i], 'isrc', 100, `Exact ISRC Match (${isrc})`);
                }
            }
        }
    }

    // 2. Exact File / Audio Hash or Content Match
    if (mode === 'all' || mode === 'hash') {
        const hashMap = new Map<string, string[]>();
        for (const t of pool) {
            if (t.sizeBytes && t.durationSeconds) {
                // Secondary content match: identical byte size and duration
                const key = `${t.sizeBytes}_${Math.round(t.durationSeconds)}`;
                const group = hashMap.get(key) || [];
                group.push(t.id);
                hashMap.set(key, group);
            }
        }
        for (const [, ids] of hashMap.entries()) {
            if (ids.length > 1) {
                for (let i = 1; i < ids.length; i++) {
                    markPair(ids[0], ids[i], 'file_hash', 100, 'Identical File Size & Duration');
                }
            }
        }
    }

    // 3. Exact Normalized Metadata (Title + Artist)
    if (mode === 'all' || mode === 'exact_tags') {
        const tagMap = new Map<string, string[]>();
        for (const t of pool) {
            const cleanTitle = cleanMetadataString(t.title);
            const cleanArtist = cleanMetadataString(t.artist || t.albumArtist);
            if (cleanTitle && cleanArtist) {
                const key = `${cleanTitle}:::${cleanArtist}`;
                const group = tagMap.get(key) || [];
                group.push(t.id);
                tagMap.set(key, group);
            }
        }
        for (const [, ids] of tagMap.entries()) {
            if (ids.length > 1) {
                for (let i = 1; i < ids.length; i++) {
                    markPair(ids[0], ids[i], 'exact_tags', 98, 'Exact Title & Artist');
                }
            }
        }
    }

    // 4. Fuzzy Metadata Match & Phonetic Sound-Alike
    if (mode === 'all' || mode === 'similar_tags' || mode === 'phonetic') {
        const prepared = pool.map((t) => ({
            id: t.id,
            track: t,
            cleanTitle: cleanMetadataString(t.title),
            cleanArtist: cleanMetadataString(t.artist || t.albumArtist),
            phoneticTitle: phoneticSignature(t.title),
            phoneticArtist: phoneticSignature(t.artist || t.albumArtist),
            duration: t.durationSeconds || 0,
        }));

        for (let i = 0; i < prepared.length; i++) {
            const a = prepared[i];
            if (!a.cleanTitle) continue;

            for (let j = i + 1; j < prepared.length; j++) {
                const b = prepared[j];
                if (!b.cleanTitle) continue;

                // Duration gate: if both durations are known, skip if outside tolerance
                if (a.duration > 0 && b.duration > 0) {
                    if (Math.abs(a.duration - b.duration) > durationToleranceSec) {
                        continue;
                    }
                }

                // A. Phonetic check
                if (mode === 'all' || mode === 'phonetic') {
                    if (
                        a.phoneticTitle &&
                        b.phoneticTitle &&
                        a.phoneticTitle === b.phoneticTitle &&
                        (!a.phoneticArtist || !b.phoneticArtist || a.phoneticArtist === b.phoneticArtist)
                    ) {
                        markPair(a.id, b.id, 'phonetic', 90, 'Similar Sounding Name (Phonetic)');
                        continue;
                    }
                }

                // B. Fuzzy string similarity
                if (mode === 'all' || mode === 'similar_tags') {
                    const titleSim = stringSimilarity(a.cleanTitle, b.cleanTitle);
                    if (titleSim >= similarityThreshold) {
                        const artistSim =
                            !a.cleanArtist || !b.cleanArtist
                                ? 0.9
                                : stringSimilarity(a.cleanArtist, b.cleanArtist);

                        if (artistSim >= 0.75) {
                            const avgConfidence = Math.round(((titleSim * 0.7 + artistSim * 0.3)) * 100);
                            markPair(
                                a.id,
                                b.id,
                                'similar_tags',
                                avgConfidence,
                                `Fuzzy Metadata Match (${avgConfidence}%)`
                            );
                        }
                    }
                }
            }
        }
    }

    // Group tracks by disjoint set root
    const clustersMap = new Map<string, string[]>();
    for (const t of pool) {
        if (ds.parent.has(t.id)) {
            const root = ds.find(t.id);
            const group = clustersMap.get(root) || [];
            group.push(t.id);
            clustersMap.set(root, group);
        }
    }

    const clusters: DuplicateCluster[] = [];

    for (const [rootId, ids] of clustersMap.entries()) {
        const uniqueIds = Array.from(new Set(ids));
        if (uniqueIds.length < 2) continue;

        const clusterTracks: DuplicateTrackComparison[] = uniqueIds.map((id) => {
            const track = trackMap.get(id)!;
            const quality = scoreTrackQuality(track);
            return {
                track,
                isRecommendedKeeper: false,
                qualityScore: quality.score,
                reasons: quality.reasons,
            };
        });

        // Sort descending by quality score
        clusterTracks.sort((a, b) => b.qualityScore - a.qualityScore);

        // Mark the highest quality track as recommended keeper
        clusterTracks[0].isRecommendedKeeper = true;

        const sampleTrack = clusterTracks[0].track;

        clusters.push({
            id: rootId,
            matchReason: 'exact_tags',
            matchReasonLabel: 'Duplicate Cluster',
            confidence: 95,
            displayTitle: sampleTrack.title || sampleTrack.filename,
            displayArtist: sampleTrack.artist || sampleTrack.albumArtist || 'Unknown Artist',
            tracks: clusterTracks,
        });
    }

    // Sort clusters by number of duplicates descending
    clusters.sort((a, b) => b.tracks.length - a.tracks.length);

    return clusters;
}
