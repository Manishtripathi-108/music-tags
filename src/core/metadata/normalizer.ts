import { CanonicalAudioMetadata, RawTagItem } from '@/types/audio';
import { FFprobeAudioResult } from '../binaries/ffprobe';

interface TagLookup {
    get(...keys: string[]): unknown;
    getString(...keys: string[]): string | null;
    getNumber(...keys: string[]): number | null;
    getTotalNumber(...keys: string[]): number | null;
    hasAny(...keys: string[]): boolean;
}

/**
 * Creates a normalized, case-insensitive, group-agnostic lookup map
 * from raw ExifTool and FFprobe metadata.
 */
function createTagLookup(
    rawExif: Record<string, unknown>,
    probeResult?: FFprobeAudioResult | null
): TagLookup {
    const map = new Map<string, unknown>();

    // 1. Ingest raw ExifTool tags
    for (const [key, val] of Object.entries(rawExif)) {
        if (val === undefined || val === null || val === '') continue;
        const lowerKey = key.toLowerCase();
        map.set(lowerKey, val);

        // Strip group prefix (e.g. 'vorbis:tracknumber' -> 'tracknumber')
        const colonIdx = lowerKey.indexOf(':');
        if (colonIdx !== -1) {
            const bare = lowerKey.slice(colonIdx + 1);
            if (!map.has(bare)) {
                map.set(bare, val);
            }
        }
    }

    // 2. Ingest FFprobe format tags as secondary fallback
    if (probeResult?.format?.tags) {
        for (const [key, val] of Object.entries(probeResult.format.tags)) {
            if (val === undefined || val === null || val === '') continue;
            const lowerKey = key.toLowerCase();
            if (!map.has(lowerKey)) {
                map.set(lowerKey, val);
            }
            // Normalize underscores/dashes, e.g. 'album_artist' -> 'albumartist'
            const bare = lowerKey.replace(/[^a-z0-9]/g, '');
            if (!map.has(bare)) {
                map.set(bare, val);
            }
        }
    }

    return {
        get(...keys: string[]): unknown {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (val !== undefined && val !== null && val !== '') {
                    return val;
                }
            }
            return null;
        },

        getString(...keys: string[]): string | null {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (typeof val === 'string' && val.trim().length > 0) {
                    return val.trim();
                }
                if (typeof val === 'number') {
                    return String(val);
                }
            }
            return null;
        },

        getNumber(...keys: string[]): number | null {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (typeof val === 'number' && !isNaN(val)) return val;
                if (typeof val === 'string') {
                    if (val.includes('/')) {
                        const num = parseInt(val.split('/')[0], 10);
                        if (!isNaN(num)) return num;
                    }
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed)) return parsed;
                }
            }
            return null;
        },

        getTotalNumber(...keys: string[]): number | null {
            for (const k of keys) {
                const val = map.get(k.toLowerCase());
                if (typeof val === 'string' && val.includes('/')) {
                    const parts = val.split('/');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1], 10);
                        if (!isNaN(num)) return num;
                    }
                }
                if (typeof val === 'number' && !isNaN(val)) return val;
                if (typeof val === 'string') {
                    const parsed = parseInt(val, 10);
                    if (!isNaN(parsed)) return parsed;
                }
            }
            return null;
        },

        hasAny(...keys: string[]): boolean {
            for (const k of keys) {
                if (map.has(k.toLowerCase())) return true;
            }
            return false;
        },
    };
}

/**
 * Normalizes raw extractor metadata from ExifTool and FFprobe into the canonical audio schema.
 */
export function normalizeAudioMetadata(
    fileId: string,
    rawExif: Record<string, unknown>,
    probeResult?: FFprobeAudioResult | null
): {
    canonical: CanonicalAudioMetadata;
    rawTags: RawTagItem[];
} {
    const lookup = createTagLookup(rawExif, probeResult);

    const title = lookup.getString(
        'title',
        'id3:title',
        'vorbis:title',
        'quicktime:title',
        'riff:title'
    );

    const artist = lookup.getString(
        'artist',
        'id3:artist',
        'vorbis:artist',
        'quicktime:artist',
        'riff:artist'
    );

    const albumArtist = lookup.getString(
        'albumartist',
        'album_artist',
        'id3:albumartist',
        'id3:band',
        'vorbis:albumartist',
        'quicktime:albumartist',
        'band'
    );

    const album = lookup.getString(
        'album',
        'id3:album',
        'vorbis:album',
        'quicktime:album'
    );

    // Track numbering
    const trackNumber = lookup.getNumber('tracknumber', 'track', 'id3:track');
    const totalTracks = lookup.getTotalNumber(
        'tracknumber',
        'track',
        'totaltracks',
        'tracktotal',
        'id3:totaltracks'
    );

    // Disc numbering
    const discNumber = lookup.getNumber('discnumber', 'partofset', 'disc', 'disknumber', 'id3:partofset');
    const totalDiscs = lookup.getTotalNumber(
        'discnumber',
        'partofset',
        'disctotal',
        'totaldiscs',
        'id3:partofset'
    );

    // Release date and year extraction
    const rawDate = lookup.get(
        'date',
        'year',
        'contentcreatedate',
        'createdate',
        'recordingtime',
        'originalreleaseyear',
        'originalyear',
        'releasedate',
        'tyer',
        'tdrc'
    );

    let year: number | null = null;
    let dateReleased: string | null = null;
    if (rawDate !== null && rawDate !== undefined) {
        const dateStr = String(rawDate).trim();
        dateReleased = dateStr;
        const match = dateStr.match(/\b(19\d\d|20\d\d)\b/);
        if (match) {
            year = parseInt(match[1], 10);
        }
    }

    // Genre extraction with cleaning for "None" or prefix artifacts
    let genre = lookup.getString('genre', 'id3:genre', 'vorbis:genre', 'quicktime:genre');
    if (genre) {
        if (/^(none|255)$/i.test(genre.trim())) {
            genre = null;
        } else {
            genre = genre.replace(/^genre:\s*/i, '').trim() || null;
        }
    }

    const composer = lookup.getString('composer', 'id3:composer', 'vorbis:composer', 'quicktime:composer', 'tcom');
    const conductor = lookup.getString('conductor', 'id3:conductor', 'vorbis:conductor', 'tpe3');
    const lyricist = lookup.getString('lyricist', 'id3:lyricist', 'vorbis:lyricist', 'writer');
    const arranger = lookup.getString('arranger', 'id3:arranger', 'vorbis:arranger');
    const remixer = lookup.getString('remixer', 'id3:remixer', 'vorbis:remixer', 'tpe4');
    const engineer = lookup.getString('engineer', 'id3:engineer', 'vorbis:engineer');
    const producer = lookup.getString('producer', 'id3:producer', 'vorbis:producer');
    const mixer = lookup.getString('mixer', 'id3:mixer', 'vorbis:mixer');
    const masteringEngineer = lookup.getString('masteringengineer', 'id3:masteringengineer', 'vorbis:masteringengineer');

    // Publishing / Label / Identifiers
    const publisher = lookup.getString(
        'publisher',
        'organization',
        'label',
        'id3:publisher',
        'vorbis:publisher',
        'vorbis:organization',
        'tpub'
    );

    const label = lookup.getString('label', 'organization', 'id3:label', 'vorbis:label', 'vorbis:organization');
    const catalogNumber = lookup.getString('catalognumber', 'catalogno', 'id3:catalognumber', 'vorbis:catalognumber');
    const barcode = lookup.getString('barcode', 'upc', 'ean', 'id3:barcode', 'vorbis:barcode', 'vorbis:upc');
    const copyright = lookup.getString('copyright', 'id3:copyright', 'vorbis:copyright', 'tcop');
    const isrc = lookup.getString('isrc', 'isrcnumber', 'id3:isrc', 'vorbis:isrcnumber', 'vorbis:isrc', 'tsrc');

    const bpm = lookup.getNumber(
        'bpm',
        'beatsperminute',
        'tempo',
        'id3:bpm',
        'id3:beatsperminute',
        'id3:tbpm',
        'vorbis:bpm',
        'vorbis:tempo',
        'quicktime:bpm',
        'quicktime:tempo',
        'tbpm',
        'fbpm'
    );
    const initialKey = lookup.getString(
        'initialkey',
        'key',
        'id3:initialkey',
        'id3:key',
        'id3:tkey',
        'vorbis:initialkey',
        'vorbis:key',
        'quicktime:initialkey',
        'quicktime:key',
        'tkey'
    );
    const mood = lookup.getString('mood', 'id3:mood', 'vorbis:mood', 'tmood');
    const rating = lookup.getNumber('rating', 'id3:rating');
    const comment = lookup.getString('comment', 'description', 'id3:comment', 'vorbis:comment', 'quicktime:comment');

    // Technical Audio specifications
    const stream = probeResult?.streams?.find((s) => s.codec_type === 'audio') || probeResult?.streams?.[0];
    const durationSeconds =
        lookup.getNumber('duration') ||
        (probeResult?.format?.duration ? parseFloat(probeResult.format.duration) : 0) ||
        (stream?.duration ? parseFloat(stream.duration) : 0) ||
        0;

    const bitrateKbps =
        (probeResult?.format?.bit_rate ? Math.round(parseFloat(probeResult.format.bit_rate) / 1000) : null) ||
        (stream?.bit_rate ? Math.round(parseFloat(stream.bit_rate) / 1000) : null) ||
        lookup.getNumber('audiobitrate', 'avgbitrate');

    const sampleRateHz =
        (stream?.sample_rate ? parseInt(stream.sample_rate, 10) : null) ||
        lookup.getNumber('audiosamplerate', 'samplerate');

    const channels = stream?.channels || lookup.getNumber('audiochannels', 'channels');
    const channelLayout = stream?.channel_layout || (channels === 2 ? 'stereo' : channels === 1 ? 'mono' : null);
    const bitDepth =
        (stream?.bits_per_raw_sample ? parseInt(stream.bits_per_raw_sample, 10) : null) ||
        stream?.bits_per_sample ||
        lookup.getNumber('bitspersample', 'audiobitspersample');

    const codec =
        stream?.codec_name ||
        String(lookup.get('audiocodec', 'audioformat', 'filetype') || '').toLowerCase() ||
        null;

    const lossless =
        codec === 'flac' ||
        codec === 'alac' ||
        codec === 'pcm_s16le' ||
        codec === 'pcm_s24le' ||
        codec === 'wav' ||
        codec === 'aiff';

    // Cover Art Detection across all containers (FLAC, MP3, M4A, OGG, WAV)
    const hasCoverArt = !!(
        lookup.hasAny(
            'picture',
            'coverart',
            'flac:picture',
            'id3:picture',
            'quicktime:coverart',
            'vorbis:metadata_block_picture',
            'picturemimetype',
            'flac:picturemimetype',
            'id3:picturemimetype'
        ) ||
        probeResult?.streams?.some(
            (s) =>
                s.disposition?.attached_pic === 1 ||
                s.codec_name === 'mjpeg' ||
                s.codec_name === 'png' ||
                s.codec_type === 'video'
        )
    );

    const videoStream = probeResult?.streams?.find(
        (s) =>
            s.disposition?.attached_pic === 1 ||
            s.codec_name === 'mjpeg' ||
            s.codec_name === 'png' ||
            s.codec_type === 'video'
    );

    let coverArtMime: string | null = null;
    let coverArtWidth: number | null = null;
    let coverArtHeight: number | null = null;
    let coverArtType: string | null = null;
    let coverArtDescription: string | null = null;

    if (hasCoverArt) {
        coverArtMime =
            lookup.getString('picturemimetype', 'flac:picturemimetype', 'id3:picturemimetype') ||
            (videoStream?.codec_name === 'png' ? 'image/png' : 'image/jpeg');

        coverArtWidth =
            lookup.getNumber('picturewidth', 'flac:picturewidth', 'imagewidth') ||
            (videoStream && (videoStream as Record<string, unknown>).width
                ? Number((videoStream as Record<string, unknown>).width)
                : null);

        coverArtHeight =
            lookup.getNumber('pictureheight', 'flac:pictureheight', 'imageheight') ||
            (videoStream && (videoStream as Record<string, unknown>).height
                ? Number((videoStream as Record<string, unknown>).height)
                : null);

        coverArtType =
            lookup.getString('picturetype', 'flac:picturetype', 'id3:picturetype') ||
            'Front Cover';

        coverArtDescription =
            lookup.getString('picturedescription', 'flac:picturedescription', 'id3:picturedescription') ||
            (videoStream?.tags?.title || videoStream?.tags?.comment || null);
    }

    // Lyrics extraction
    const rawLyrics = lookup.getString(
        'lyrics',
        'unsyncedlyrics',
        'id3:unsyncedlyrics',
        'id3:lyrics',
        'vorbis:lyrics',
        'vorbis:unsyncedlyrics',
        'quicktime:lyrics',
        'uslt'
    );

    const rawSyncedLyrics = lookup.getString(
        'synchronizedlyrics',
        'syncedlyrics',
        'id3:synchronizedlyrics',
        'id3:syncedlyrics',
        'vorbis:syncedlyrics',
        'sylt'
    );

    const isLrc = rawLyrics ? /\[\d{2}:\d{2}/.test(rawLyrics) : false;
    const lyrics = rawSyncedLyrics || rawLyrics;
    const lyricsUnsynced = rawSyncedLyrics ? rawLyrics : isLrc ? null : rawLyrics;
    const lyricsSyncedJson = rawSyncedLyrics
        ? JSON.stringify(rawSyncedLyrics)
        : isLrc && rawLyrics
          ? JSON.stringify(rawLyrics)
          : null;

    const lyricsLanguage = lookup.getString('lyricslanguage', 'id3:lyricslanguage');

    const canonical: CanonicalAudioMetadata = {
        fileId,
        title,
        artist,
        albumArtist,
        album,
        trackNumber,
        totalTracks,
        discNumber,
        totalDiscs,
        year,
        dateReleased,
        releaseDate: dateReleased,
        genre,
        genres: genre ? [genre] : [],
        composer,
        conductor,
        lyricist,
        arranger,
        remixer,
        engineer,
        producer,
        mixer,
        masteringEngineer,
        publisher,
        label,
        catalogNumber,
        barcode,
        copyright,
        isrc,
        bpm,
        initialKey,
        mood,
        rating,
        description: lookup.getString('description'),
        comment,
        lyrics,
        lyricsLanguage,
        lyricsUnsynced,
        lyricsSyncedJson,
        durationSeconds,
        bitrateKbps,
        bitrateType: null,
        sampleRateHz,
        channels,
        channelLayout,
        bitDepth,
        codec,
        lossless,
        hasCoverArt,
        coverArtMime,
        coverArtWidth,
        coverArtHeight,
        coverArtType,
        coverArtDescription,
    };

    const rawTags = buildRawTagList(rawExif, probeResult);

    return { canonical, rawTags };
}

/**
 * Builds a comprehensive list of raw tag items from ExifTool and FFprobe metadata.
 */
export function buildRawTagList(
    rawExif?: Record<string, unknown> | null,
    probeResult?: FFprobeAudioResult | null
): RawTagItem[] {
    const rawTags: RawTagItem[] = [];

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
