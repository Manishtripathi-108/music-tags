import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Physical audio file and filesystem state.
 */
export const audioFiles = sqliteTable('audio_files', {
    // Identity and path
    id: text('id').primaryKey(),
    path: text('path').notNull().unique(),
    filename: text('filename').notNull(),
    directory: text('directory').notNull(),
    extension: text('extension').notNull(),

    // File timestamps and size
    sizeBytes: integer('size_bytes').notNull(),
    mtimeMs: integer('mtime_ms').notNull(),
    ctimeMs: integer('ctime_ms'),
    birthtimeMs: integer('birthtime_ms'),

    // File hashes
    fileHash: text('file_hash'),
    audioHash: text('audio_hash'),

    // File state
    isMissing: integer('is_missing', { mode: 'boolean' }).notNull().default(false),
    isReadOnly: integer('is_read_only', { mode: 'boolean' }).notNull().default(false),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    isCorrupt: integer('is_corrupt', { mode: 'boolean' }).notNull().default(false),
    isSymlink: integer('is_symlink', { mode: 'boolean' }).notNull().default(false),

    // Scan state
    scanStatus: text('scan_status'),
    scanError: text('scan_error'),
    lastScannedAt: integer('last_scanned_at', { mode: 'timestamp_ms' }),
    lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp_ms' }),

    // Record timestamps
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * Clean canonical audio metadata schema persisted in SQLite.
 * Trimmed to essential tags and useful technical specs actually present in music files.
 */
export const canonicalAudioMetadata = sqliteTable('canonical_audio_metadata', {
    // File relationship
    fileId: text('file_id')
        .primaryKey()
        .references(() => audioFiles.id),

    // Track identity
    title: text('title'),
    artist: text('artist'),
    albumArtist: text('album_artist'),
    album: text('album'),

    // Track and disc numbering
    trackNumber: integer('track_number'),
    totalTracks: integer('total_tracks'),
    discNumber: integer('disc_number'),
    totalDiscs: integer('total_discs'),

    // Release & compilation
    releaseDate: integer('release_date', { mode: 'timestamp_ms' }),
    originalReleaseDate: text('original_release_date'),
    compilation: integer('compilation', { mode: 'boolean' }),

    // Genre
    genre: text('genre'),

    // Credits
    composer: text('composer'),
    conductor: text('conductor'),
    lyricist: text('lyricist'),

    // Publishing and identifiers
    publisher: text('publisher'),
    label: text('label'),
    catalogNumber: text('catalog_number'),
    barcode: text('barcode'),
    copyright: text('copyright'),
    isrc: text('isrc'),

    // Mood and comment
    mood: text('mood'),
    comment: text('comment'),

    // Lyrics
    lyrics: text('lyrics'),
    lyricsType: text('lyrics_type', { enum: ['synced', 'unsynced'] }),

    // Playback metadata
    bpm: real('bpm'),
    initialKey: text('initial_key'),
    rating: integer('rating'),

    // Technical audio stream specs
    durationSeconds: real('duration_seconds'),
    containerFormat: text('container_format'),
    codec: text('codec'),
    encoder: text('encoder'),
    bitrateKbps: integer('bitrate_kbps'),
    variableBitrate: integer('variable_bitrate', { mode: 'boolean' }),
    sampleRateHz: integer('sample_rate_hz'),
    channels: integer('channels'),
    channelLayout: text('channel_layout'),
    bitDepth: integer('bit_depth'),
    lossless: integer('lossless', { mode: 'boolean' }),

    // Cover art
    hasCoverArt: integer('has_cover_art', { mode: 'boolean' }),
    coverArtMime: text('cover_art_mime'),
    coverArtType: text('cover_art_type'),
    coverArtDescription: text('cover_art_description'),
    coverArtWidth: integer('cover_art_width'),
    coverArtHeight: integer('cover_art_height'),

    // Record timestamps
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

/**
 * Original metadata returned by extraction tools (cached raw JSON).
 */
export const rawAudioMetadata = sqliteTable('raw_audio_metadata', {
    // File relationship
    fileId: text('file_id')
        .primaryKey()
        .references(() => audioFiles.id),

    // Raw extraction results
    exiftoolJson: text('exiftool_json'),
    ffprobeJson: text('ffprobe_json'),

    // Extraction state
    extractionStatus: text('extraction_status'),
    extractionError: text('extraction_error'),

    // Record timestamps
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});
