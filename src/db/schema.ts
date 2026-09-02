import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Physical audio file and filesystem state.
 */
export const audioFiles = sqliteTable('audio_files', {
    id: text('id').primaryKey(),

    path: text('path').notNull().unique(),
    filename: text('filename').notNull(),
    directory: text('directory').notNull(),
    extension: text('extension').notNull(),

    /**
     * File system information.
     */
    sizeBytes: integer('size_bytes').notNull(),
    mtimeMs: integer('mtime_ms').notNull(),
    ctimeMs: integer('ctime_ms'),
    birthtimeMs: integer('birthtime_ms'),

    /**
     * File integrity and availability.
     */
    fileHash: text('file_hash'),
    audioHash: text('audio_hash'),
    isMissing: integer('is_missing', { mode: 'boolean' }).notNull().default(false),
    isReadOnly: integer('is_read_only', { mode: 'boolean' }).notNull().default(false),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    isCorrupt: integer('is_corrupt', { mode: 'boolean' }).notNull().default(false),
    isSymlink: integer('is_symlink', { mode: 'boolean' }).notNull().default(false),

    /**
     * File scanning state.
     */
    scanStatus: text('scan_status'),
    scanError: text('scan_error'),
    lastScannedAt: integer('last_scanned_at'),
    lastVerifiedAt: integer('last_verified_at'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});

/**
 * Audio metadata directly extractable from the file using ExifTool
 * and FFprobe/FFmpeg.
 */
export const canonicalAudioMetadata = sqliteTable('canonical_audio_metadata', {
    fileId: text('file_id')
        .primaryKey()
        .references(() => audioFiles.id),

    /**
     * Basic track metadata.
     */
    title: text('title'),
    artist: text('artist'),

    albumArtist: text('album_artist'),
    album: text('album'),

    /**
     * Track / disc information.
     */
    trackNumber: integer('track_number'),
    totalTracks: integer('total_tracks'),

    discNumber: integer('disc_number'),
    totalDiscs: integer('total_discs'),

    /**
     * Release information.
     */
    releaseTitle: text('release_title'),

    releaseDate: text('release_date'),
    originalReleaseDate: text('original_release_date'),

    releaseCountry: text('release_country'),
    releaseType: text('release_type'),

    mediaType: text('media_type'),
    compilation: integer('compilation', { mode: 'boolean' }),

    /**
     * Musical metadata.
     */
    genre: text('genre'),
    genresJson: text('genres_json'),

    composer: text('composer'),
    conductor: text('conductor'),
    lyricist: text('lyricist'),
    arranger: text('arranger'),
    remixer: text('remixer'),
    engineer: text('engineer'),
    producer: text('producer'),
    mixer: text('mixer'),
    masteringEngineer: text('mastering_engineer'),

    /**
     * Track grouping / work information.
     */
    grouping: text('grouping'),
    series: text('series'),
    seriesPart: text('series_part'),

    work: text('work'),
    movement: text('movement'),
    movementNumber: integer('movement_number'),
    movementTotal: integer('movement_total'),

    /**
     * Date / publication information.
     */
    year: integer('year'),
    originalYear: integer('original_year'),

    publisher: text('publisher'),
    label: text('label'),

    catalogNumber: text('catalog_number'),
    barcode: text('barcode'),

    copyright: text('copyright'),
    productionCopyright: text('production_copyright'),

    /**
     * Language and descriptive metadata.
     */
    language: text('language'),
    script: text('script'),
    country: text('country'),

    mood: text('mood'),
    moodsJson: text('moods_json'),

    description: text('description'),
    comment: text('comment'),

    /**
     * Lyrics.
     */
    lyrics: text('lyrics'),
    lyricsLanguage: text('lyrics_language'),
    lyricsUnsynced: text('lyrics_unsynced'),
    lyricsSyncedJson: text('lyrics_synced_json'),

    /**
     * Embedded music identifiers.
     */
    isrc: text('isrc'),

    musicBrainzRecordingId: text('musicbrainz_recording_id'),
    musicBrainzTrackId: text('musicbrainz_track_id'),
    musicBrainzReleaseId: text('musicbrainz_release_id'),
    musicBrainzReleaseGroupId: text('musicbrainz_release_group_id'),
    musicBrainzArtistId: text('musicbrainz_artist_id'),
    musicBrainzAlbumArtistId: text('musicbrainz_album_artist_id'),
    musicBrainzWorkId: text('musicbrainz_work_id'),

    acoustId: text('acoustid'),

    /**
     * Musical properties.
     *
     * These are retained only when present as embedded metadata.
     */
    bpm: real('bpm'),
    initialKey: text('initial_key'),
    keySignature: text('key_signature'),
    timeSignature: text('time_signature'),

    rating: integer('rating'),

    /**
     * Audio duration.
     */
    durationSeconds: real('duration_seconds'),
    durationMilliseconds: integer('duration_milliseconds'),

    /**
     * Container / format information.
     */
    containerFormat: text('container_format'),
    formatProfile: text('format_profile'),

    codec: text('codec'),
    codecLongName: text('codec_long_name'),
    codecProfile: text('codec_profile'),
    codecLevel: text('codec_level'),

    encoder: text('encoder'),
    encoderVersion: text('encoder_version'),
    encodingSettings: text('encoding_settings'),

    /**
     * Bitrate.
     */
    bitrateKbps: integer('bitrate_kbps'),
    averageBitrateKbps: integer('average_bitrate_kbps'),
    maxBitrateKbps: integer('max_bitrate_kbps'),

    variableBitrate: integer('variable_bitrate', { mode: 'boolean' }),

    /**
     * Audio stream properties.
     */
    sampleRateHz: integer('sample_rate_hz'),
    channels: integer('channels'),
    channelLayout: text('channel_layout'),

    bitDepth: integer('bit_depth'),
    bitsPerSample: integer('bits_per_sample'),

    sampleFormat: text('sample_format'),
    sampleFormatLong: text('sample_format_long'),

    /**
     * Compression properties.
     */
    lossless: integer('lossless', { mode: 'boolean' }),
    compressionMode: text('compression_mode'),
    compressionLevel: real('compression_level'),

    /**
     * Gapless playback information when encoded in the file.
     */
    gapless: integer('gapless', { mode: 'boolean' }),
    encoderDelaySamples: integer('encoder_delay_samples'),
    encoderPaddingSamples: integer('encoder_padding_samples'),

    /**
     * Embedded ReplayGain metadata.
     */
    replayGainTrackDb: real('replaygain_track_db'),
    replayGainTrackPeak: real('replaygain_track_peak'),
    replayGainAlbumDb: real('replaygain_album_db'),
    replayGainAlbumPeak: real('replaygain_album_peak'),

    /**
     * Cover artwork embedded in the file.
     */
    hasCoverArt: integer('has_cover_art', { mode: 'boolean' }),
    coverArtMime: text('cover_art_mime'),
    coverArtType: text('cover_art_type'),
    coverArtDescription: text('cover_art_description'),
    coverArtWidth: integer('cover_art_width'),
    coverArtHeight: integer('cover_art_height'),

    /**
     * Chapters / navigation.
     */
    hasChapters: integer('has_chapters', { mode: 'boolean' }),
    chapterCount: integer('chapter_count'),
    chaptersJson: text('chapters_json'),

    /**
     * Raw/unrecognized metadata preserved from the extractors.
     */
    customTagsJson: text('custom_tags_json'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});

/**
 * Original metadata returned by extraction tools.
 */
export const rawAudioMetadata = sqliteTable('raw_audio_metadata', {
    fileId: text('file_id')
        .primaryKey()
        .references(() => audioFiles.id),

    /**
     * Raw extractor output.
     */
    exiftoolJson: text('exiftool_json'),
    ffprobeJson: text('ffprobe_json'),

    /**
     * Extraction state.
     */
    extractionStatus: text('extraction_status'),
    extractionError: text('extraction_error'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});
