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
            created_at TEXT DEFAULT (datetime('now'))
        )
    "#).execute(pool).await.expect("Failed to init db");
    
    sqlx::query(r#"
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS fingerprint_peaks TEXT
    "#).execute(pool).await.ok();
    
    sqlx::query(r#"
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS fingerprint_robust TEXT
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
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO songs (id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(title)
    .bind(artist)
    .bind(fingerprint_hash)
    .bind(fingerprint_peaks)
    .bind(fingerprint_robust)
    .bind(duration_sec)
    .bind(now)
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
