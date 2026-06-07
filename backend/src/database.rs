use sqlx::sqlite::{SqlitePoolOptions, SqlitePool};
use serde::{Serialize, Deserialize};
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub fingerprint_hash: String,
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
            fingerprint_hash TEXT NOT NULL, duration_sec INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        )
    "#).execute(pool).await.expect("Failed to init db");
}

pub async fn insert_song(
    pool: &SqlitePool,
    id: &str,
    title: &str,
    artist: Option<&str>,
    fingerprint_hash: &str,
    duration_sec: Option<i64>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO songs (id, title, artist, fingerprint_hash, duration_sec, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(title)
    .bind(artist)
    .bind(fingerprint_hash)
    .bind(duration_sec)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_all_songs(pool: &SqlitePool) -> Result<Vec<Song>, sqlx::Error> {
    let songs = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, duration_sec, created_at FROM songs ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(songs)
}

pub async fn get_song_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Song>, sqlx::Error> {
    let song = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, duration_sec, created_at FROM songs WHERE id = ?"
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
