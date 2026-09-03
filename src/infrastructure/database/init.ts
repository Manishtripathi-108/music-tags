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
                release_title TEXT,
                release_date TEXT,
                original_release_date TEXT,
                release_country TEXT,
                release_type TEXT,
                media_type TEXT,
                compilation INTEGER,
                genre TEXT,
                genres_json TEXT,
                composer TEXT,
                conductor TEXT,
                lyricist TEXT,
                arranger TEXT,
                remixer TEXT,
                engineer TEXT,
                producer TEXT,
                mixer TEXT,
                mastering_engineer TEXT,
                grouping TEXT,
                series TEXT,
                series_part TEXT,
                work TEXT,
                movement TEXT,
                movement_number INTEGER,
                movement_total INTEGER,
                year INTEGER,
                original_year INTEGER,
                publisher TEXT,
                label TEXT,
                catalog_number TEXT,
                barcode TEXT,
                copyright TEXT,
                production_copyright TEXT,
                language TEXT,
                script TEXT,
                country TEXT,
                mood TEXT,
                moods_json TEXT,
                description TEXT,
                comment TEXT,
                lyrics TEXT,
                lyrics_language TEXT,
                lyrics_unsynced TEXT,
                lyrics_synced_json TEXT,
                isrc TEXT,
                musicbrainz_recording_id TEXT,
                musicbrainz_track_id TEXT,
                musicbrainz_release_id TEXT,
                musicbrainz_release_group_id TEXT,
                musicbrainz_artist_id TEXT,
                musicbrainz_album_artist_id TEXT,
                musicbrainz_work_id TEXT,
                acoustid TEXT,
                bpm REAL,
                initial_key TEXT,
                key_signature TEXT,
                time_signature TEXT,
                rating INTEGER,
                duration_seconds REAL,
                duration_milliseconds INTEGER,
                container_format TEXT,
                format_profile TEXT,
                codec TEXT,
                codec_long_name TEXT,
                codec_profile TEXT,
                codec_level TEXT,
                encoder TEXT,
                encoder_version TEXT,
                encoding_settings TEXT,
                bitrate_kbps INTEGER,
                average_bitrate_kbps INTEGER,
                max_bitrate_kbps INTEGER,
                variable_bitrate INTEGER,
                sample_rate_hz INTEGER,
                channels INTEGER,
                channel_layout TEXT,
                bit_depth INTEGER,
                bits_per_sample INTEGER,
                sample_format TEXT,
                sample_format_long TEXT,
                lossless INTEGER,
                compression_mode TEXT,
                compression_level REAL,
                gapless INTEGER,
                encoder_delay_samples INTEGER,
                encoder_padding_samples INTEGER,
                replaygain_track_db REAL,
                replaygain_track_peak REAL,
                replaygain_album_db REAL,
                replaygain_album_peak REAL,
                has_cover_art INTEGER,
                cover_art_mime TEXT,
                cover_art_type TEXT,
                cover_art_description TEXT,
                cover_art_width INTEGER,
                cover_art_height INTEGER,
                has_chapters INTEGER,
                chapter_count INTEGER,
                chapters_json TEXT,
                custom_tags_json TEXT,
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
