import { db } from './client';
import { sql } from 'drizzle-orm';

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
                release_date TEXT,
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
                lyrics_unsynced TEXT,
                lyrics_synced_json TEXT,
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

        isInitialized = true;
    } catch (err) {
        console.error('Failed to initialize database tables:', err);
    }
}
