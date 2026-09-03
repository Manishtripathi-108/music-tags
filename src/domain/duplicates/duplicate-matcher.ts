import { type Track } from '@/domain/media/track';
import {
    type DuplicateCluster,
    type DuplicateFindOptions,
    type DuplicateMatchReason,
    type DuplicateTrackComparison,
} from './types';
import { cleanMetadataString } from './normalization';
import { phoneticSignature } from './phonetics';
import { stringSimilarity } from './similarity';
import { scoreTrackQuality } from './scoring';
import { DisjointSet } from './clustering';

/**
 * Pure domain duplicate detection engine.
 * Discovers candidate pairs via ISRC, file size/duration hash, exact metadata,
 * phonetic sound-alike, and fuzzy bigram string similarity, then clusters them via DisjointSet.
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
        reason: DuplicateMatchReason,
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

                if (a.duration > 0 && b.duration > 0) {
                    if (Math.abs(a.duration - b.duration) > durationToleranceSec) {
                        continue;
                    }
                }

                // Phonetic sound-alike check
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

                // Fuzzy string similarity check
                if (mode === 'all' || mode === 'similar_tags') {
                    const titleSim = stringSimilarity(a.cleanTitle, b.cleanTitle);
                    if (titleSim >= similarityThreshold) {
                        const artistSim =
                            !a.cleanArtist || !b.cleanArtist
                                ? 0.9
                                : stringSimilarity(a.cleanArtist, b.cleanArtist);

                        if (artistSim >= 0.75) {
                            const avgConfidence = Math.round((titleSim * 0.7 + artistSim * 0.3) * 100);
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

        clusterTracks.sort((a, b) => b.qualityScore - a.qualityScore);
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

    clusters.sort((a, b) => b.tracks.length - a.tracks.length);
    return clusters;
}
