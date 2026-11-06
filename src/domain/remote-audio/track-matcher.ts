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
        confidence: bestOverallScore > 0 ? Math.min(1, bestOverallScore / 2500) : 0,
    };
}
