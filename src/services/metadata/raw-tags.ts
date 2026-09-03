import { type RawTag } from '@/domain/media/track';
import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';

/**
 * Builds a comprehensive list of raw tag items from ExifTool and FFprobe metadata.
 */
export function buildRawTagList(
    rawExif?: Record<string, unknown> | null,
    probeResult?: FFprobeAudioResult | null
): RawTag[] {
    const rawTags: RawTag[] = [];

    // 1. Ingest all ExifTool tags
    if (rawExif && typeof rawExif === 'object') {
        for (const [key, val] of Object.entries(rawExif)) {
            if (val === undefined || val === null || key === 'SourceFile') continue;
            const parts = key.split(':');
            const groupName = parts.length > 1 ? parts[0] : 'ExifTool';
            const tag = parts.length > 1 ? parts.slice(1).join(':') : parts[0];

            rawTags.push({
                tag,
                group: `Exif: ${groupName}`,
                description: key,
                value: typeof val === 'object' ? JSON.stringify(val) : (val as string | number | boolean),
                isWritable: !['File', 'Composite', 'ExifTool'].includes(groupName),
            });
        }
    }

    // 2. Ingest all FFprobe / FFmpeg metadata
    if (probeResult && typeof probeResult === 'object') {
        if (probeResult.format) {
            const f = probeResult.format as Record<string, unknown>;
            const formatKeys = [
                'format_name',
                'format_long_name',
                'duration',
                'size',
                'bit_rate',
                'probe_score',
                'nb_streams',
            ] as const;

            for (const fk of formatKeys) {
                if (f[fk] !== undefined && f[fk] !== null) {
                    rawTags.push({
                        tag: fk,
                        group: 'FFmpeg: Format',
                        description: `format.${fk}`,
                        value: f[fk] as string | number | boolean,
                        isWritable: false,
                    });
                }
            }

            if (f.tags && typeof f.tags === 'object') {
                for (const [tagKey, tagVal] of Object.entries(f.tags)) {
                    if (tagVal !== undefined && tagVal !== null) {
                        rawTags.push({
                            tag: tagKey,
                            group: 'FFmpeg: Tags',
                            description: `format.tags.${tagKey}`,
                            value: tagVal as string | number | boolean,
                            isWritable: false,
                        });
                    }
                }
            }
        }

        if (Array.isArray(probeResult.streams)) {
            probeResult.streams.forEach((s, idx) => {
                const sObj = s as Record<string, unknown>;
                const streamType = s.codec_type ? s.codec_type.toUpperCase() : `Stream ${idx}`;
                const streamGroup = `FFmpeg: ${streamType} (${s.codec_name || idx})`;

                const streamProps = [
                    'index',
                    'codec_name',
                    'codec_long_name',
                    'sample_rate',
                    'channels',
                    'channel_layout',
                    'bits_per_sample',
                    'bits_per_raw_sample',
                    'bit_rate',
                    'duration',
                ] as const;

                for (const prop of streamProps) {
                    if (sObj[prop] !== undefined && sObj[prop] !== null) {
                        rawTags.push({
                            tag: prop,
                            group: streamGroup,
                            description: `streams[${idx}].${prop}`,
                            value: sObj[prop] as string | number | boolean,
                            isWritable: false,
                        });
                    }
                }

                if (s.disposition && typeof s.disposition === 'object') {
                    for (const [dKey, dVal] of Object.entries(s.disposition)) {
                        if (dVal === 1) {
                            rawTags.push({
                                tag: `disposition.${dKey}`,
                                group: streamGroup,
                                description: `streams[${idx}].disposition.${dKey}`,
                                value: '1 (active)',
                                isWritable: false,
                            });
                        }
                    }
                }

                if (s.tags && typeof s.tags === 'object') {
                    for (const [tKey, tVal] of Object.entries(s.tags)) {
                        if (tVal !== undefined && tVal !== null) {
                            rawTags.push({
                                tag: tKey,
                                group: `${streamGroup} Tags`,
                                description: `streams[${idx}].tags.${tKey}`,
                                value: tVal,
                                isWritable: false,
                            });
                        }
                    }
                }
            });
        }
    }

    return rawTags;
}
