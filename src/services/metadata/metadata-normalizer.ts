import { type RawTag } from '@/domain/media/track';
import { type FFprobeAudioResult } from '@/infrastructure/media-tools/ffprobe';
import { canonicalAudioMetadataInputSchema, type CanonicalAudioMetadataInput } from '@/schemas/audio-metadata.schema';

import { createTagLookup } from './metadata-lookup';
import { buildRawTagList } from './raw-tags';
import { hasLrcTimestamps } from '@/domain/media/lyrics';
import { normalizeReleaseDate, parseReleaseDate } from '@/domain/media/date';

export { buildRawTagList };

/**
 * Normalizes raw extractor metadata from ExifTool and FFprobe into the canonical audio schema.
 * All values pass through canonicalAudioMetadataInputSchema to coerce, trim, and set safe defaults.
 */
export function normalizeAudioMetadata(
    fileId: string,
    rawExif: Record<string, unknown>,
    probeResult?: FFprobeAudioResult | null
): {
    canonical: CanonicalAudioMetadataInput;
    rawTags: RawTag[];
} {
    const lookup = createTagLookup(rawExif, probeResult);

    const title = lookup.getString('title', 'id3:title', 'vorbis:title', 'quicktime:title', 'riff:title');

    const artist = lookup.getString('artist', 'id3:artist', 'vorbis:artist', 'quicktime:artist', 'riff:artist');

    const albumArtist = lookup.getString(
        'albumartist',
        'album_artist',
        'id3:albumartist',
        'id3:band',
        'vorbis:albumartist',
        'quicktime:albumartist',
        'band'
    );

    const album = lookup.getString('album', 'id3:album', 'vorbis:album', 'quicktime:album');

    // Track numbering
    const trackNumber = lookup.getNumber('tracknumber', 'track', 'id3:track');
    const totalTracks = lookup.getTotalNumber('tracknumber', 'track', 'totaltracks', 'tracktotal', 'id3:totaltracks');

    // Disc numbering
    const discNumber = lookup.getNumber('discnumber', 'partofset', 'disc', 'disknumber', 'id3:partofset');
    const totalDiscs = lookup.getTotalNumber('discnumber', 'partofset', 'disctotal', 'totaldiscs', 'id3:partofset');

    // Release date extraction
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

    const releaseDate = parseReleaseDate(rawDate);
    const rawOriginalDate = lookup.get('originalreleaseyear', 'originalyear', 'originaldate');
    const originalReleaseDate = normalizeReleaseDate(rawOriginalDate);

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

    // Publishing / Label / Identifiers
    const publisher = lookup.getString('publisher', 'organization', 'label', 'id3:publisher', 'vorbis:publisher', 'vorbis:organization', 'tpub');
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

    const containerFormat = probeResult?.format?.format_name || lookup.getString('containerformat', 'filetype');
    const encoder = lookup.getString('encoder', 'lavf', 'id3:encoder', 'vorbis:encoder');

    const bitrateKbps =
        (probeResult?.format?.bit_rate ? Math.round(parseFloat(probeResult.format.bit_rate) / 1000) : null) ||
        (stream?.bit_rate ? Math.round(parseFloat(stream.bit_rate) / 1000) : null) ||
        lookup.getNumber('audiobitrate', 'avgbitrate');

    const sampleRateHz = (stream?.sample_rate ? parseInt(stream.sample_rate, 10) : null) || lookup.getNumber('audiosamplerate', 'samplerate');

    const channels = stream?.channels || lookup.getNumber('audiochannels', 'channels');
    const channelLayout = stream?.channel_layout || (channels === 2 ? 'stereo' : channels === 1 ? 'mono' : null);
    const bitDepth =
        (stream?.bits_per_raw_sample ? parseInt(stream.bits_per_raw_sample, 10) : null) ||
        stream?.bits_per_sample ||
        lookup.getNumber('bitspersample', 'audiobitspersample');

    const codec = stream?.codec_name || String(lookup.get('audiocodec', 'audioformat', 'filetype') || '').toLowerCase() || null;

    const lossless = codec === 'flac' || codec === 'alac' || codec === 'pcm_s16le' || codec === 'pcm_s24le' || codec === 'wav' || codec === 'aiff';

    // Cover Art Detection across containers
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
            (s) => s.disposition?.attached_pic === 1 || s.codec_name === 'mjpeg' || s.codec_name === 'png' || s.codec_type === 'video'
        )
    );

    const videoStream = probeResult?.streams?.find(
        (s) => s.disposition?.attached_pic === 1 || s.codec_name === 'mjpeg' || s.codec_name === 'png' || s.codec_type === 'video'
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
            (videoStream && (videoStream as Record<string, unknown>).width ? Number((videoStream as Record<string, unknown>).width) : null);

        coverArtHeight =
            lookup.getNumber('pictureheight', 'flac:pictureheight', 'imageheight') ||
            (videoStream && (videoStream as Record<string, unknown>).height ? Number((videoStream as Record<string, unknown>).height) : null);

        coverArtType = lookup.getString('picturetype', 'flac:picturetype', 'id3:picturetype') || 'Front Cover';

        coverArtDescription =
            lookup.getString('picturedescription', 'flac:picturedescription', 'id3:picturedescription') ||
            videoStream?.tags?.title ||
            videoStream?.tags?.comment ||
            null;
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

    let lyrics: string | null = null;
    let lyricsType: 'synced' | 'unsynced' | null = null;

    if (rawLyrics && hasLrcTimestamps(rawLyrics)) {
        lyrics = rawLyrics;
        lyricsType = 'synced';
    } else if (rawSyncedLyrics && hasLrcTimestamps(rawSyncedLyrics)) {
        lyrics = rawSyncedLyrics;
        lyricsType = 'synced';
    } else if (rawLyrics) {
        lyrics = rawLyrics;
        lyricsType = 'unsynced';
    } else if (rawSyncedLyrics) {
        lyrics = rawSyncedLyrics;
        lyricsType = 'unsynced';
    }

    // Mutate and validate through input schema
    const canonical = canonicalAudioMetadataInputSchema.parse({
        fileId,
        title,
        artist,
        albumArtist,
        album,
        trackNumber,
        totalTracks,
        discNumber,
        totalDiscs,
        releaseDate,
        originalReleaseDate,
        compilation: false,
        genre,
        composer,
        conductor,
        lyricist,
        publisher,
        label,
        catalogNumber,
        barcode,
        copyright,
        isrc,
        mood,
        comment,
        lyrics,
        lyricsType,
        bpm,
        initialKey,
        rating,
        durationSeconds,
        containerFormat,
        codec,
        encoder,
        bitrateKbps,
        sampleRateHz,
        channels,
        channelLayout,
        bitDepth,
        lossless,
        hasCoverArt,
        coverArtMime,
        coverArtWidth,
        coverArtHeight,
        coverArtType,
        coverArtDescription,
    });

    const rawTags = buildRawTagList(rawExif, probeResult);

    return { canonical, rawTags };
}
