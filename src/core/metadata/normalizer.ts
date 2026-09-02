import { CanonicalAudioMetadata, RawTagItem } from '@/types/audio';

import { FFprobeAudioResult } from '../binaries/ffprobe';

function parseFirstString(values: unknown[]): string | null {
    for (const v of values) {
        if (typeof v === 'string' && v.trim().length > 0) {
            return v.trim();
        }
        if (typeof v === 'number') {
            return String(v);
        }
    }
    return null;
}

function parseNumber(val: unknown): number | null {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
        // Check for "1/12" track formatting
        if (val.includes('/')) {
            const parts = val.split('/');
            const num = parseInt(parts[0], 10);
            if (!isNaN(num)) return num;
        }
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) return parsed;
    }
    return null;
}

function parseTotalNumber(val: unknown): number | null {
    if (typeof val === 'string' && val.includes('/')) {
        const parts = val.split('/');
        if (parts.length > 1) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num)) return num;
        }
    }
    return null;
}

export function normalizeAudioMetadata(
    fileId: string,
    rawExif: Record<string, unknown>,
    probeResult?: FFprobeAudioResult | null
): {
    canonical: CanonicalAudioMetadata;
    rawTags: RawTagItem[];
} {
    // Extract canonical fields with fallback hierarchy
    const title = parseFirstString([
        rawExif['ID3:Title'],
        rawExif['Vorbis:TITLE'],
        rawExif['QuickTime:Title'],
        rawExif['RIFF:Title'],
        rawExif['Title'],
        probeResult?.format?.tags?.title,
        probeResult?.format?.tags?.TITLE,
    ]);

    const artist = parseFirstString([
        rawExif['ID3:Artist'],
        rawExif['Vorbis:ARTIST'],
        rawExif['QuickTime:Artist'],
        rawExif['RIFF:Artist'],
        rawExif['Artist'],
        probeResult?.format?.tags?.artist,
        probeResult?.format?.tags?.ARTIST,
    ]);

    const albumArtist = parseFirstString([
        rawExif['ID3:Band'],
        rawExif['ID3:AlbumArtist'],
        rawExif['Vorbis:ALBUMARTIST'],
        rawExif['QuickTime:AlbumArtist'],
        rawExif['AlbumArtist'],
        probeResult?.format?.tags?.album_artist,
        probeResult?.format?.tags?.ALBUM_ARTIST,
    ]);

    const album = parseFirstString([
        rawExif['ID3:Album'],
        rawExif['Vorbis:ALBUM'],
        rawExif['QuickTime:Album'],
        rawExif['Album'],
        probeResult?.format?.tags?.album,
        probeResult?.format?.tags?.ALBUM,
    ]);

    const trackRaw = rawExif['ID3:Track'] || rawExif['Vorbis:TRACKNUMBER'] || rawExif['QuickTime:TrackNumber'] || rawExif['Track'];
    const trackNumber = parseNumber(trackRaw);
    const totalTracks = parseTotalNumber(trackRaw) || parseNumber(rawExif['Vorbis:TRACKTOTAL'] || rawExif['ID3:TotalTracks']);

    const discRaw = rawExif['ID3:PartOfSet'] || rawExif['Vorbis:DISCNUMBER'] || rawExif['QuickTime:DiscNumber'];
    const discNumber = parseNumber(discRaw);
    const totalDiscs = parseTotalNumber(discRaw) || parseNumber(rawExif['Vorbis:DISCTOTAL']);

    const yearRaw =
        rawExif['ID3:Year'] ||
        rawExif['ID3:RecordingTime'] ||
        rawExif['Vorbis:DATE'] ||
        rawExif['QuickTime:Year'] ||
        rawExif['Year'] ||
        probeResult?.format?.tags?.date;

    let year: number | null = null;
    let dateReleased: string | null = null;
    if (yearRaw) {
        const yearStr = String(yearRaw).trim();
        dateReleased = yearStr;
        const match = yearStr.match(/\b(19\d\d|20\d\d)\b/);
        if (match) {
            year = parseInt(match[1], 10);
        }
    }

    const genre = parseFirstString([
        rawExif['ID3:Genre'],
        rawExif['Vorbis:GENRE'],
        rawExif['QuickTime:Genre'],
        rawExif['Genre'],
        probeResult?.format?.tags?.genre,
    ]);

    const composer = parseFirstString([rawExif['ID3:Composer'], rawExif['Vorbis:COMPOSER'], rawExif['QuickTime:Composer'], rawExif['Composer']]);

    const bpmRaw = rawExif['ID3:BeatsPerMinute'] || rawExif['Vorbis:BPM'] || rawExif['QuickTime:BPM'] || rawExif['BPM'];
    const bpm = parseNumber(bpmRaw);

    const initialKey = parseFirstString([rawExif['ID3:InitialKey'], rawExif['Vorbis:KEY'], rawExif['InitialKey']]);

    const comment = parseFirstString([rawExif['ID3:Comment'], rawExif['Vorbis:COMMENT'], rawExif['QuickTime:Comment'], rawExif['Comment']]);

    // Technical Audio specs from FFprobe / ExifTool
    const stream = probeResult?.streams?.[0];
    const durationSeconds = parseNumber(probeResult?.format?.duration) || parseNumber(stream?.duration) || parseNumber(rawExif['Duration']) || 0;

    const bitrateKbps =
        (parseNumber(probeResult?.format?.bit_rate) ? Math.round(parseNumber(probeResult?.format?.bit_rate)! / 1000) : null) ||
        (parseNumber(stream?.bit_rate) ? Math.round(parseNumber(stream?.bit_rate)! / 1000) : null) ||
        parseNumber(rawExif['AudioBitrate']);

    const sampleRateHz = parseNumber(stream?.sample_rate) || parseNumber(rawExif['AudioSampleRate']);

    const channels = stream?.channels || parseNumber(rawExif['AudioChannels']);
    const channelLayout = stream?.channel_layout || (channels === 2 ? 'stereo' : channels === 1 ? 'mono' : null);
    const bitDepth = stream?.bits_per_raw_sample ? parseInt(stream.bits_per_raw_sample, 10) : stream?.bits_per_sample || null;
    const codec = stream?.codec_name || String(rawExif['AudioCodec'] || rawExif['AudioFormat'] || '').toLowerCase() || null;

    const lossless = codec === 'flac' || codec === 'alac' || codec === 'pcm_s16le' || codec === 'pcm_s24le' || codec === 'wav' || codec === 'aiff';

    // Check Cover Art presence
    const hasCoverArt = !!(
        rawExif['Picture'] ||
        rawExif['CoverArt'] ||
        rawExif['ID3:Picture'] ||
        rawExif['ID3:AttachedPicture'] ||
        rawExif['Vorbis:METADATA_BLOCK_PICTURE'] ||
        rawExif['QuickTime:CoverArt']
    );

    const coverArtMime = hasCoverArt ? 'image/jpeg' : null;

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
        conductor: parseFirstString([rawExif['ID3:Conductor'], rawExif['Vorbis:CONDUCTOR']]),
        lyricist: parseFirstString([rawExif['ID3:Lyricist'], rawExif['Vorbis:LYRICIST']]),
        remixer: parseFirstString([rawExif['ID3:Remixer'], rawExif['Vorbis:REMIXER']]),
        publisher: parseFirstString([rawExif['ID3:Publisher'], rawExif['Vorbis:PUBLISHER']]),
        label: parseFirstString([rawExif['ID3:Label'], rawExif['Vorbis:LABEL']]),
        copyright: parseFirstString([rawExif['ID3:Copyright'], rawExif['Vorbis:COPYRIGHT']]),
        isrc: parseFirstString([rawExif['ID3:ISRC'], rawExif['Vorbis:ISRC']]),
        bpm,
        initialKey,
        mood: parseFirstString([rawExif['ID3:Mood'], rawExif['Vorbis:MOOD']]),
        rating: parseNumber(rawExif['ID3:Rating'] || rawExif['Rating']),
        comment,
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
    };

    // Convert raw tag map to structured Tag Tree
    const rawTags: RawTagItem[] = [];
    for (const [key, val] of Object.entries(rawExif)) {
        if (key === 'SourceFile' || key === 'ExifToolVersion') continue;
        let group = 'General';
        let tag = key;
        if (key.includes(':')) {
            const parts = key.split(':');
            group = parts[0];
            tag = parts.slice(1).join(':');
        }

        rawTags.push({
            tag,
            group,
            description: tag.replace(/([A-Z])/g, ' $1').trim(),
            value: typeof val === 'object' ? JSON.stringify(val) : (val as string | number | boolean | null),
            isWritable: !['Duration', 'FileSize', 'FileModifyDate', 'FileAccessDate', 'AudioSampleRate', 'AudioBitrate'].includes(tag),
        });
    }

    return { canonical, rawTags };
}
