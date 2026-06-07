use sqlx::sqlite::{SqlitePoolOptions, SqlitePool};
use serde::{Serialize, Deserialize};
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub fingerprint_hash: String,
    pub fingerprint_peaks: Option<String>,
    pub fingerprint_robust: Option<String>,
    pub duration_sec: Option<i64>,
    pub created_at: String,
    #[sqlx(default)]
    pub audio_sample: Option<Vec<u8>>,
}

pub async fn create_pool() -> SqlitePool {
    SqlitePoolOptions::new().max_connections(5)
        .connect("sqlite:fingerprints.db").await
        .expect("Failed to create pool")
}

pub async fn init_db(pool: &SqlitePool) {
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, artist TEXT,
            fingerprint_hash TEXT NOT NULL, fingerprint_peaks TEXT,
            fingerprint_robust TEXT,
            duration_sec INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            audio_sample BLOB
        )
    "#).execute(pool).await.expect("Failed to init db");
    
    sqlx::query(r#"
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS fingerprint_peaks TEXT
    "#).execute(pool).await.ok();
    
    sqlx::query(r#"
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS fingerprint_robust TEXT
    "#).execute(pool).await.ok();
    
    sqlx::query(r#"
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_sample BLOB
    "#).execute(pool).await.ok();
}

pub async fn insert_song(
    pool: &SqlitePool,
    id: &str,
    title: &str,
    artist: Option<&str>,
    fingerprint_hash: &str,
    fingerprint_peaks: Option<&str>,
    fingerprint_robust: Option<&str>,
    duration_sec: Option<i64>,
    audio_sample: Option<&[u8]>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO songs (id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at, audio_sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(title)
    .bind(artist)
    .bind(fingerprint_hash)
    .bind(fingerprint_peaks)
    .bind(fingerprint_robust)
    .bind(duration_sec)
    .bind(now)
    .bind(audio_sample)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_all_songs(pool: &SqlitePool) -> Result<Vec<Song>, sqlx::Error> {
    let songs = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at FROM songs ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(songs)
}

pub async fn get_song_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Song>, sqlx::Error> {
    let song = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at FROM songs WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(song)
}

pub async fn get_song_audio_sample(pool: &SqlitePool, id: &str) -> Result<Option<Vec<u8>>, sqlx::Error> {
    let sample: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT audio_sample FROM songs WHERE id = ? AND audio_sample IS NOT NULL"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(sample.map(|s| s.0))
}

pub async fn delete_song(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM songs WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecognitionHistory {
    pub id: String,
    pub match_found: bool,
    pub song_id: Option<String>,
    pub song_title: Option<String>,
    pub song_artist: Option<String>,
    pub confidence: f32,
    pub processing_time_ms: i64,
    pub created_at: String,
}

pub async fn init_history_table(pool: &SqlitePool) {
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS recognition_history (
            id TEXT PRIMARY KEY,
            match_found INTEGER NOT NULL,
            song_id TEXT,
            song_title TEXT,
            song_artist TEXT,
            confidence REAL NOT NULL,
            processing_time_ms INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    "#).execute(pool).await.expect("Failed to init history table");
}

pub async fn insert_recognition_history(
    pool: &SqlitePool,
    id: &str,
    match_found: bool,
    song_id: Option<&str>,
    song_title: Option<&str>,
    song_artist: Option<&str>,
    confidence: f32,
    processing_time_ms: i64,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO recognition_history (id, match_found, song_id, song_title, song_artist, confidence, processing_time_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(match_found)
    .bind(song_id)
    .bind(song_title)
    .bind(song_artist)
    .bind(confidence)
    .bind(processing_time_ms)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_recognition_history(pool: &SqlitePool, limit: i32) -> Result<Vec<RecognitionHistory>, sqlx::Error> {
    let history = sqlx::query_as::<_, RecognitionHistory>(
        "SELECT id, match_found, song_id, song_title, song_artist, confidence, processing_time_ms, created_at FROM recognition_history ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(history)
}

pub async fn get_recognition_history_by_song_id(pool: &SqlitePool, song_id: &str, limit: i32) -> Result<Vec<RecognitionHistory>, sqlx::Error> {
    let history = sqlx::query_as::<_, RecognitionHistory>(
        "SELECT id, match_found, song_id, song_title, song_artist, confidence, processing_time_ms, created_at FROM recognition_history WHERE song_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(song_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(history)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct RankedSong {
    pub song_id: String,
    pub song_title: String,
    pub song_artist: Option<String>,
    pub recognition_count: i64,
    pub rank: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TrendingSong {
    pub song_id: String,
    pub song_title: String,
    pub song_artist: Option<String>,
    pub recent_count: i64,
    pub previous_count: i64,
    pub trend_score: f64,
    pub rank: i64,
}

pub async fn get_top_songs(pool: &SqlitePool, limit: i32) -> Result<Vec<RankedSong>, sqlx::Error> {
    let songs = sqlx::query_as::<_, RankedSong>(r#"
        SELECT 
            song_id,
            song_title,
            song_artist,
            COUNT(*) as recognition_count,
            ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
        FROM recognition_history
        WHERE match_found = 1 AND song_id IS NOT NULL
        GROUP BY song_id, song_title, song_artist
        ORDER BY recognition_count DESC
        LIMIT ?
    "#)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(songs)
}

pub async fn get_trending_songs(pool: &SqlitePool, limit: i32, days: i32) -> Result<Vec<TrendingSong>, sqlx::Error> {
    let songs = sqlx::query_as::<_, TrendingSong>(r#"
        WITH recent AS (
            SELECT 
                song_id,
                song_title,
                song_artist,
                COUNT(*) as recent_count
            FROM recognition_history
            WHERE match_found = 1 
                AND song_id IS NOT NULL
                AND datetime(created_at) >= datetime('now', '-' || ? || ' days')
            GROUP BY song_id, song_title, song_artist
        ),
        previous AS (
            SELECT 
                song_id,
                COUNT(*) as previous_count
            FROM recognition_history
            WHERE match_found = 1 
                AND song_id IS NOT NULL
                AND datetime(created_at) >= datetime('now', '-' || (? * 2) || ' days')
                AND datetime(created_at) < datetime('now', '-' || ? || ' days')
            GROUP BY song_id
        )
        SELECT 
            r.song_id,
            r.song_title,
            r.song_artist,
            r.recent_count,
            COALESCE(p.previous_count, 0) as previous_count,
            CASE 
                WHEN COALESCE(p.previous_count, 0) = 0 THEN r.recent_count * 2.0
                ELSE (r.recent_count - p.previous_count) * 1.0 / p.previous_count + r.recent_count * 0.1
            END as trend_score,
            ROW_NUMBER() OVER (
                ORDER BY 
                    CASE 
                        WHEN COALESCE(p.previous_count, 0) = 0 THEN r.recent_count * 2.0
                        ELSE (r.recent_count - p.previous_count) * 1.0 / p.previous_count + r.recent_count * 0.1
                    END DESC,
                    r.recent_count DESC
            ) as rank
        FROM recent r
        LEFT JOIN previous p ON r.song_id = p.song_id
        ORDER BY trend_score DESC, recent_count DESC
        LIMIT ?
    "#)
    .bind(days)
    .bind(days)
    .bind(days)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(songs)
}
