import { sql } from 'drizzle-orm';

import { db } from './client';

/**
 * Ensures all SQLite tables and columns exist in the database.
 * Run automatically before database queries.
 */
let isInitialized = false;

export async function ensureDatabaseInitialized(): Promise<void> {
    if (isInitialized) return;

    try {
        await db.run(sql`
            CREATE TABLE IF NOT EXISTS audio_files (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                filename TEXT NOT NULL,
                directory TEXT NOT NULL,
                extension TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                mtime_ms INTEGER NOT NULL,
                ctime_ms INTEGER,
                birthtime_ms INTEGER,
                file_hash TEXT,
                audio_hash TEXT,
                is_missing INTEGER NOT NULL DEFAULT 0,
                is_read_only INTEGER NOT NULL DEFAULT 0,
                is_locked INTEGER NOT NULL DEFAULT 0,
                is_corrupt INTEGER NOT NULL DEFAULT 0,
                is_symlink INTEGER NOT NULL DEFAULT 0,
                scan_status TEXT,
                scan_error TEXT,
                last_scanned_at INTEGER,
                last_verified_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        await db.run(sql`
            CREATE TABLE IF NOT EXISTS canonical_audio_metadata (
                file_id TEXT PRIMARY KEY REFERENCES audio_files(id),
                title TEXT,
                artist TEXT,
                album_artist TEXT,
                album TEXT,
                track_number INTEGER,
                total_tracks INTEGER,
                disc_number INTEGER,
                total_discs INTEGER,
                release_date INTEGER,
                original_release_date TEXT,
                compilation INTEGER,
                genre TEXT,
                composer TEXT,
                conductor TEXT,
                lyricist TEXT,
                publisher TEXT,
                label TEXT,
                catalog_number TEXT,
                barcode TEXT,
                copyright TEXT,
                isrc TEXT,
                mood TEXT,
                comment TEXT,
                lyrics TEXT,
                lyrics_type TEXT,
                bpm REAL,
                initial_key TEXT,
                rating INTEGER,
                duration_seconds REAL,
                container_format TEXT,
                codec TEXT,
                encoder TEXT,
                bitrate_kbps INTEGER,
                variable_bitrate INTEGER,
                sample_rate_hz INTEGER,
                channels INTEGER,
                channel_layout TEXT,
                bit_depth INTEGER,
                lossless INTEGER,
                has_cover_art INTEGER,
                cover_art_mime TEXT,
                cover_art_type TEXT,
                cover_art_description TEXT,
                cover_art_width INTEGER,
                cover_art_height INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        await db.run(sql`
            CREATE TABLE IF NOT EXISTS raw_audio_metadata (
                file_id TEXT PRIMARY KEY REFERENCES audio_files(id),
                exiftool_json TEXT,
                ffprobe_json TEXT,
                extraction_status TEXT,
                extraction_error TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        // Migrate canonical_audio_metadata table columns safely
        try {
            await db.run(sql`ALTER TABLE canonical_audio_metadata ADD COLUMN lyrics_type TEXT;`);
        } catch {}

        try {
            const tableInfo = await db.all<{ name: string; type: string }>(
                sql`PRAGMA table_info(canonical_audio_metadata);`
            );
            const releaseDateCol = tableInfo.find((c) => c.name === 'release_date');
            if (releaseDateCol && releaseDateCol.type.toUpperCase() === 'TEXT') {
                await db.run(sql`
                    CREATE TABLE canonical_audio_metadata_migrated (
                        file_id TEXT PRIMARY KEY REFERENCES audio_files(id),
                        title TEXT, artist TEXT, album_artist TEXT, album TEXT,
                        track_number INTEGER, total_tracks INTEGER, disc_number INTEGER, total_discs INTEGER,
                        release_date INTEGER, original_release_date TEXT, compilation INTEGER, genre TEXT,
                        composer TEXT, conductor TEXT, lyricist TEXT, publisher TEXT, label TEXT,
                        catalog_number TEXT, barcode TEXT, copyright TEXT, isrc TEXT, mood TEXT,
                        comment TEXT, lyrics TEXT, lyrics_type TEXT, bpm REAL, initial_key TEXT,
                        rating INTEGER, duration_seconds REAL, container_format TEXT, codec TEXT,
                        encoder TEXT, bitrate_kbps INTEGER, variable_bitrate INTEGER, sample_rate_hz INTEGER,
                        channels INTEGER, channel_layout TEXT, bit_depth INTEGER, lossless INTEGER,
                        has_cover_art INTEGER, cover_art_mime TEXT, cover_art_type TEXT,
                        cover_art_description TEXT, cover_art_width INTEGER, cover_art_height INTEGER,
                        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
                    );
                `);
                await db.run(sql`
                    INSERT INTO canonical_audio_metadata_migrated
                    SELECT
                        file_id, title, artist, album_artist, album,
                        track_number, total_tracks, disc_number, total_discs,
                        CASE
                            WHEN release_date IS NULL THEN NULL
                            WHEN CAST(ROUND(release_date) AS INTEGER) > 0 THEN CAST(ROUND(release_date) AS INTEGER)
                            ELSE NULL
                        END,
                        original_release_date, compilation, genre,
                        composer, conductor, lyricist, publisher, label,
                        catalog_number, barcode, copyright, isrc, mood,
                        comment, lyrics, lyrics_type, bpm, initial_key,
                        rating, duration_seconds, container_format, codec,
                        encoder, bitrate_kbps, variable_bitrate, sample_rate_hz,
                        channels, channel_layout, bit_depth, lossless,
                        has_cover_art, cover_art_mime, cover_art_type,
                        cover_art_description, cover_art_width, cover_art_height,
                        created_at, updated_at
                    FROM canonical_audio_metadata;
                `);
                await db.run(sql`DROP TABLE canonical_audio_metadata;`);
                await db.run(sql`ALTER TABLE canonical_audio_metadata_migrated RENAME TO canonical_audio_metadata;`);
            }
        } catch (e) {
            console.error('Migration error for release_date:', e);
        }

        await db.run(sql`
            CREATE TABLE IF NOT EXISTS remote_track_matches (
                id TEXT PRIMARY KEY,
                local_track_id TEXT NOT NULL REFERENCES audio_files(id),
                provider_url TEXT NOT NULL,
                remote_track_id TEXT NOT NULL,
                title TEXT,
                artist TEXT,
                album TEXT,
                duration REAL,
                artwork_url TEXT,
                format TEXT,
                audio_quality TEXT,
                is_dolby INTEGER DEFAULT 0,
                has_dolby INTEGER DEFAULT 0,
                quality_score INTEGER,
                stream_url TEXT,
                raw_search_json TEXT,
                raw_stream_json TEXT,
                download_status TEXT DEFAULT 'idle',
                download_error TEXT,
                download_path TEXT,
                downloaded_at INTEGER,
                last_checked_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
        `);

        await db.run(sql`
            CREATE INDEX IF NOT EXISTS idx_remote_matches_local ON remote_track_matches(local_track_id);
        `);
        await db.run(sql`
            CREATE INDEX IF NOT EXISTS idx_remote_matches_provider_remote ON remote_track_matches(provider_url, remote_track_id);
        `);

        isInitialized = true;
    } catch (err) {
        console.error('Failed to initialize database tables:', err);
    }
}
