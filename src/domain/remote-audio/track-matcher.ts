import { type Track } from '@/domain/media/track';
import { isDolbyAtmosAudio, parseQualityString } from './quality-analyzer';
import { type RemoteTrackSummary } from './types';

function cleanString(str?: string | null): string {
    if (!str) return '';
    return str
        .toLowerCase()
        .replace(/[\(\[\{].*?[\)\]\}]/g, ' ') // remove bracketed text e.g. (feat. xyz)
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Computes a token similarity score between 0 and 1.
 */
function tokenSimilarity(s1: string, s2: string): number {
    const tokens1 = new Set(s1.split(' ').filter(Boolean));
    const tokens2 = new Set(s2.split(' ').filter(Boolean));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let matchCount = 0;
    for (const t of tokens1) {
        if (tokens2.has(t)) matchCount++;
    }

    const overlap = (2 * matchCount) / (tokens1.size + tokens2.size);
    return overlap;
}

export interface MatchSelectionResult {
    bestMatch: RemoteTrackSummary | null;
    bestLosslessMatch: RemoteTrackSummary | null;
    bestDolbyMatch: RemoteTrackSummary | null;
    hasDolby: boolean;
    confidence: number;
}

/**
 * Computes a normalized match confidence score (0.0 to 1.0) between a local track and a remote candidate.
 */
export function calculateMatchConfidence(localTrack: Track, candidate: RemoteTrackSummary | null): number {
    if (!candidate) return 0;
    const localTitle = cleanString(localTrack.title || localTrack.filename);
    const candidateTitle = cleanString(candidate.title);
    if (!candidateTitle) return 0;

    const titleSim = tokenSimilarity(localTitle, candidateTitle);

    let artistSim = 0.6;
    const localArtist = cleanString(localTrack.artist);
    const candidateArtist = cleanString(candidate.artist);
    if (localArtist && candidateArtist) {
        artistSim = tokenSimilarity(localArtist, candidateArtist);
    }

    let albumSim = 0.6;
    const localAlbum = cleanString(localTrack.album);
    const candidateAlbum = cleanString(candidate.album);
    if (localAlbum && candidateAlbum) {
        albumSim = tokenSimilarity(localAlbum, candidateAlbum);
    }

    let durationSim = 1.0;
    if (localTrack.durationSeconds && candidate.duration) {
        const diff = Math.abs(localTrack.durationSeconds - candidate.duration);
        const ratio = Math.max(localTrack.durationSeconds, candidate.duration) / Math.max(1, Math.min(localTrack.durationSeconds, candidate.duration));
        if (diff > 120 || ratio > 2.0) durationSim = 0.0;
        else if (diff > 45 || ratio > 1.4) durationSim = 0.25;
        else if (diff > 20) durationSim = 0.55;
        else if (diff > 10) durationSim = 0.8;
        else if (diff > 3) durationSim = 0.95;
        else durationSim = 1.0;
    }

    const score = titleSim * 0.50 + artistSim * 0.30 + durationSim * 0.15 + albumSim * 0.05;
    return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

/**
 * Evaluates candidate tracks returned from remote search against local track metadata.
 */
export function selectBestTrackMatch(
    localTrack: Track,
    candidates: RemoteTrackSummary[],
    preferDolby = false
): MatchSelectionResult {
    if (!candidates || candidates.length === 0) {
        return {
            bestMatch: null,
            bestLosslessMatch: null,
            bestDolbyMatch: null,
            hasDolby: false,
            confidence: 0,
        };
    }

    // Populate individual confidence for each candidate
    for (const c of candidates) {
        c.confidence = calculateMatchConfidence(localTrack, c);
    }

    const localTitle = cleanString(localTrack.title || localTrack.filename);
    const localArtist = cleanString(localTrack.artist);
    const localAlbum = cleanString(localTrack.album);
    const localDuration = localTrack.durationSeconds;

    let hasDolby = false;
    let bestDolbyMatch: RemoteTrackSummary | null = null;
    let bestDolbyScore = -1;

    let bestLosslessMatch: RemoteTrackSummary | null = null;
    let bestLosslessQualityScore = -1;

    let bestOverallMatch: RemoteTrackSummary | null = null;
    let bestOverallScore = -1;

    for (const candidate of candidates) {
        const candidateTitle = cleanString(candidate.title);
        const candidateArtist = cleanString(candidate.artist);
        const candidateAlbum = cleanString(candidate.album);

        // Title score
        const titleSim = tokenSimilarity(localTitle, candidateTitle);

        // Artist score
        let artistSim = 0.5; // neutral if artist not available
        if (localArtist && candidateArtist) {
            artistSim = tokenSimilarity(localArtist, candidateArtist);
        }

        // Album score
        let albumSim = 0.5;
        if (localAlbum && candidateAlbum) {
            albumSim = tokenSimilarity(localAlbum, candidateAlbum);
        }

        // Duration score
        let durationSim = 1.0;
        if (localDuration && candidate.duration) {
            const diff = Math.abs(localDuration - candidate.duration);
            if (diff > 30) {
                durationSim = 0.3;
            } else if (diff > 10) {
                durationSim = 0.7;
            } else if (diff > 3) {
                durationSim = 0.9;
            } else {
                durationSim = 1.0;
            }
        }

        // Overall match score
        const matchScore = titleSim * 0.5 + artistSim * 0.3 + albumSim * 0.1 + durationSim * 0.1;

        // Skip candidate if title similarity is too weak (< 0.25)
        if (titleSim < 0.25 && matchScore < 0.3) {
            continue;
        }

        const isDolby = isDolbyAtmosAudio(candidate);
        if (isDolby) {
            hasDolby = true;
            if (matchScore > bestDolbyScore) {
                bestDolbyScore = matchScore;
                bestDolbyMatch = candidate;
            }
        }

        const qualityTier = parseQualityString(candidate.audioQuality, candidate.format);
        if (qualityTier.isLossless && !isDolby) {
            const combinedScore = matchScore * 1000 + qualityTier.score;
            if (combinedScore > bestLosslessQualityScore) {
                bestLosslessQualityScore = combinedScore;
                bestLosslessMatch = candidate;
            }
        }

        const combinedOverallScore = matchScore * 1000 + (preferDolby && isDolby ? 500 : 0) + qualityTier.score;
        if (combinedOverallScore > bestOverallScore) {
            bestOverallScore = combinedOverallScore;
            bestOverallMatch = candidate;
        }
    }

    const selected = preferDolby ? (bestDolbyMatch || bestOverallMatch) : (bestLosslessMatch || bestOverallMatch);

    return {
        bestMatch: selected,
        bestLosslessMatch,
        bestDolbyMatch,
        hasDolby,
        confidence: selected ? calculateMatchConfidence(localTrack, selected) : 0,
    };
}
