import fs from 'fs';
import path from 'path';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { ensureDatabaseInitialized } from '@/infrastructure/database/init';
import { audioFiles, canonicalAudioMetadata } from '@/infrastructure/database/schema';
import { parseQualityString, getLocalTrackQuality } from '@/domain/remote-audio/quality-analyzer';
import { type AudioQualityTier, type RemoteStreamInfo } from '@/domain/remote-audio/types';
import { probeAudioFile } from '@/infrastructure/media-tools/ffprobe';

export interface QualityCheckResult {
    canDownload: boolean;
    skipped: boolean;
    hasSameOrHigher: boolean;
    reason?: 'same_or_higher_quality' | 'not_in_library' | 'upgrade_available' | 'force_redownload';
    message: string;
    localTrack?: {
        title: string;
        artist?: string;
        qualityLabel: string;
        score: number;
        filePath?: string;
        isLossless: boolean;
    } | null;
    remoteQuality: {
        qualityLabel: string;
        score: number;
        isLossless: boolean;
        bitDepth?: number | null;
        sampleRateHz?: number | null;
        codec?: string;
    };
}

/**
 * Normalizes text for loose title/artist matching.
 */
function normalizeText(text?: string | null): string {
    return (text || '')
        .toLowerCase()
        .replace(/[/\\?%*:|"<>()[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Checks if the user already has the same or higher quality of this track in their library or download directory.
 */
export async function checkLibraryQualityForTrack({
    isrc,
    title,
    artist,
    streamInfo,
    downloadDirectory,
    forceRedownload = false,
}: {
    isrc?: string | null;
    title?: string | null;
    artist?: string | null;
    streamInfo: Partial<RemoteStreamInfo> & {
        isrc?: string;
        sampleRate?: number;
        bitDepth?: number;
        quality?: string;
        format?: string;
        codec?: string;
        tier?: string;
    };
    downloadDirectory?: string;
    forceRedownload?: boolean;
}): Promise<QualityCheckResult> {
    // 1. Evaluate remote stream quality
    const streamNormalized: Partial<RemoteStreamInfo> = {
        quality: streamInfo.quality || streamInfo.format,
        format: streamInfo.format || streamInfo.codec,
        codec: streamInfo.codec,
        bitDepth: streamInfo.bitDepth,
        sampleRate: streamInfo.sampleRate,
    };

    const remoteTier: AudioQualityTier = parseQualityString(
        streamInfo.quality || streamInfo.format || `${streamInfo.bitDepth}-bit / ${streamInfo.sampleRate} Hz ${streamInfo.codec || ''}`,
        streamInfo.format || streamInfo.codec,
        streamNormalized
    );

    // 2. Query database for matching local track
    await ensureDatabaseInitialized();

    const targetIsrc = (streamInfo.isrc || isrc || '').trim();
    const cleanTitle = normalizeText(title);
    const cleanArtist = normalizeText(artist);

    let matchedRow: {
        file: typeof audioFiles.$inferSelect;
        meta: typeof canonicalAudioMetadata.$inferSelect | null;
    } | null = null;

    if (targetIsrc) {
        const rows = await db
            .select()
            .from(canonicalAudioMetadata)
            .innerJoin(audioFiles, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(sql`lower(${canonicalAudioMetadata.isrc}) = lower(${targetIsrc})`)
            .limit(1);

        if (rows.length > 0) {
            matchedRow = {
                file: rows[0].audio_files,
                meta: rows[0].canonical_audio_metadata,
            };
        }
    }

    if (!matchedRow && cleanTitle) {
        // Search by title and artist match
        const rows = await db
            .select()
            .from(canonicalAudioMetadata)
            .innerJoin(audioFiles, eq(audioFiles.id, canonicalAudioMetadata.fileId))
            .where(sql`lower(${canonicalAudioMetadata.title}) = lower(${title})`)
            .limit(10);

        for (const row of rows) {
            const rowTitle = normalizeText(row.canonical_audio_metadata.title);
            const rowArtist = normalizeText(row.canonical_audio_metadata.artist);
            if (rowTitle === cleanTitle && (!cleanArtist || !rowArtist || rowArtist.includes(cleanArtist) || cleanArtist.includes(rowArtist))) {
                matchedRow = {
                    file: row.audio_files,
                    meta: row.canonical_audio_metadata,
                };
                break;
            }
        }
    }

    // 3. Also check downloadDirectory if a file with matching ISRC exists on disk
    let diskTrackQuality: AudioQualityTier | null = null;
    let diskPath: string | null = null;

    if (downloadDirectory && fs.existsSync(downloadDirectory)) {
        const candidateNames: string[] = [];
        if (targetIsrc) {
            candidateNames.push(`${targetIsrc}.flac`, `${targetIsrc}.mp3`, `${targetIsrc}.m4a`, `${targetIsrc}.wav`);
        }
        if (artist && title) {
            const base = `${artist} - ${title}`.replace(/[/\\?%*:|"<>]/g, '_').trim();
            candidateNames.push(`${base}.flac`, `${base}.mp3`, `${base}.m4a`);
        }

        for (const name of candidateNames) {
            const full = path.join(downloadDirectory, name);
            if (fs.existsSync(full)) {
                diskPath = full;
                const probe = await probeAudioFile(full);
                if (probe?.streams?.[0]) {
                    const st = probe.streams[0];
                    const isLossless = (st.codec_name || '').includes('flac') || (st.codec_name || '').includes('alac') || parseInt(st.bits_per_raw_sample || '0', 10) > 0;
                    diskTrackQuality = {
                        isLossless,
                        bitDepth: st.bits_per_sample || (st.bits_per_raw_sample ? parseInt(st.bits_per_raw_sample, 10) : (isLossless ? 16 : null)),
                        sampleRateHz: st.sample_rate ? parseInt(st.sample_rate, 10) : null,
                        bitrateKbps: st.bit_rate ? Math.round(parseInt(st.bit_rate, 10) / 1000) : null,
                        isDolbyAtmos: false,
                        codec: st.codec_name || 'audio',
                        score: isLossless ? 1000 + (st.bits_per_sample === 24 ? 500 : 100) : (st.bit_rate ? Math.round(parseInt(st.bit_rate, 10) / 1000) : 256),
                        label: `${st.bits_per_sample || 16}-bit / ${st.sample_rate || 44100} Hz ${st.codec_name?.toUpperCase() || ''}`.trim(),
                    };
                }
                break;
            }
        }
    }

    // 4. Compute local quality tier from matched DB row or disk file
    let localTier: AudioQualityTier | null = null;
    let localTitle = title || 'Track';
    let localArtist = artist || '';
    let localFilePath: string | undefined = undefined;

    if (matchedRow?.meta) {
        localTitle = matchedRow.meta.title || localTitle;
        localArtist = matchedRow.meta.artist || localArtist;
        localFilePath = matchedRow.file.path;

        const isLossless = Boolean(matchedRow.meta.lossless);
        const bitDepth = matchedRow.meta.bitDepth ?? (isLossless ? 16 : null);
        const sampleRateHz = matchedRow.meta.sampleRateHz ?? (isLossless ? 44100 : null);
        const bitrateKbps = matchedRow.meta.bitrateKbps ?? null;
        const codec = (matchedRow.meta.codec || matchedRow.file.extension || 'flac').replace(/^\./, '').toLowerCase();

        let score = 0;
        if (isLossless) {
            score = 1000;
            if (bitDepth) {
                if (bitDepth >= 24) score += 500;
                else if (bitDepth >= 16) score += 100;
            }
            if (sampleRateHz) {
                if (sampleRateHz >= 192000) score += 800;
                else if (sampleRateHz >= 176400) score += 700;
                else if (sampleRateHz >= 96000) score += 500;
                else if (sampleRateHz >= 88200) score += 400;
                else if (sampleRateHz >= 48000) score += 150;
                else if (sampleRateHz >= 44100) score += 100;
            }
        } else {
            score = bitrateKbps ?? 256;
        }

        const label = isLossless
            ? `${bitDepth || 16}-bit / ${sampleRateHz ? sampleRateHz / 1000 : 44.1} kHz ${codec.toUpperCase()}`
            : `${bitrateKbps ? `${bitrateKbps} kbps ` : ''}${codec.toUpperCase()}`;

        localTier = {
            isLossless,
            bitDepth,
            sampleRateHz,
            bitrateKbps,
            isDolbyAtmos: false,
            codec,
            score,
            label,
        };
    } else if (diskTrackQuality) {
        localTier = diskTrackQuality;
        localFilePath = diskPath || undefined;
    }

    // 5. Comparison: Do we already have same or higher quality in our list?
    if (localTier) {
        const hasSameOrHigher = localTier.score >= remoteTier.score;

        if (forceRedownload) {
            return {
                canDownload: true,
                skipped: false,
                hasSameOrHigher,
                reason: 'force_redownload',
                message: `Force redownloading: Remote ${remoteTier.label} (Local ${localTier.label})`,
                localTrack: {
                    title: localTitle,
                    artist: localArtist,
                    qualityLabel: localTier.label,
                    score: localTier.score,
                    filePath: localFilePath,
                    isLossless: localTier.isLossless,
                },
                remoteQuality: {
                    qualityLabel: remoteTier.label,
                    score: remoteTier.score,
                    isLossless: remoteTier.isLossless,
                    bitDepth: remoteTier.bitDepth,
                    sampleRateHz: remoteTier.sampleRateHz,
                    codec: remoteTier.codec,
                },
            };
        }

        if (hasSameOrHigher) {
            return {
                canDownload: false,
                skipped: true,
                hasSameOrHigher: true,
                reason: 'same_or_higher_quality',
                message: `Already have same or higher quality in your library: "${localTitle}" (${localTier.label} >= Remote ${remoteTier.label}). Download skipped.`,
                localTrack: {
                    title: localTitle,
                    artist: localArtist,
                    qualityLabel: localTier.label,
                    score: localTier.score,
                    filePath: localFilePath,
                    isLossless: localTier.isLossless,
                },
                remoteQuality: {
                    qualityLabel: remoteTier.label,
                    score: remoteTier.score,
                    isLossless: remoteTier.isLossless,
                    bitDepth: remoteTier.bitDepth,
                    sampleRateHz: remoteTier.sampleRateHz,
                    codec: remoteTier.codec,
                },
            };
        }

        // Local exists but is lower quality -> Upgrade available!
        return {
            canDownload: true,
            skipped: false,
            hasSameOrHigher: false,
            reason: 'upgrade_available',
            message: `Quality upgrade available for "${localTitle}": ${localTier.label} → ${remoteTier.label}`,
            localTrack: {
                title: localTitle,
                artist: localArtist,
                qualityLabel: localTier.label,
                score: localTier.score,
                filePath: localFilePath,
                isLossless: localTier.isLossless,
            },
            remoteQuality: {
                qualityLabel: remoteTier.label,
                score: remoteTier.score,
                isLossless: remoteTier.isLossless,
                bitDepth: remoteTier.bitDepth,
                sampleRateHz: remoteTier.sampleRateHz,
                codec: remoteTier.codec,
            },
        };
    }

    // 6. Track not found in list -> Proceed to download
    return {
        canDownload: true,
        skipped: false,
        hasSameOrHigher: false,
        reason: 'not_in_library',
        message: `New track: "${title || 'Track'}" (${remoteTier.label})`,
        localTrack: null,
        remoteQuality: {
            qualityLabel: remoteTier.label,
            score: remoteTier.score,
            isLossless: remoteTier.isLossless,
            bitDepth: remoteTier.bitDepth,
            sampleRateHz: remoteTier.sampleRateHz,
            codec: remoteTier.codec,
        },
    };
}
