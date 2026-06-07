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
    #[sqlx(default)]
    pub status: String,
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
            audio_sample BLOB,
            status TEXT DEFAULT 'completed'
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
    
    sqlx::query(r#"
        ALTER TABLE songs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed'
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
    status: Option<&str>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    let status_val = status.unwrap_or("completed");
    sqlx::query(
        "INSERT INTO songs (id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at, audio_sample, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
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
    .bind(status_val)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_all_songs(pool: &SqlitePool) -> Result<Vec<Song>, sqlx::Error> {
    let songs = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at, status FROM songs ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(songs)
}

pub async fn get_song_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Song>, sqlx::Error> {
    let song = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at, status FROM songs WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(song)
}

pub async fn get_pending_songs(pool: &SqlitePool) -> Result<Vec<Song>, sqlx::Error> {
    let songs = sqlx::query_as::<_, Song>(
        "SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, created_at, status FROM songs WHERE status IN ('pending', 'processing') ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await?;
    Ok(songs)
}

pub async fn update_song_status(pool: &SqlitePool, id: &str, status: &str) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE songs SET status = ? WHERE id = ?")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
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

pub async fn get_recognition_history_by_id(pool: &SqlitePool, id: &str) -> Result<Option<RecognitionHistory>, sqlx::Error> {
    let history = sqlx::query_as::<_, RecognitionHistory>(
        "SELECT id, match_found, song_id, song_title, song_artist, confidence, processing_time_ms, created_at FROM recognition_history WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
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

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SimilarSong {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub duration_sec: Option<i64>,
    pub similarity_score: f32,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct FailedSample {
    pub id: String,
    pub audio_data: Option<Vec<u8>>,
    pub fingerprint_hash: String,
    pub fingerprint_peaks: Option<String>,
    pub fingerprint_robust: Option<String>,
    pub duration_sec: Option<i64>,
    pub best_confidence: f32,
    pub note: Option<String>,
    pub created_at: String,
}

pub async fn init_failed_samples_table(pool: &SqlitePool) {
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS failed_samples (
            id TEXT PRIMARY KEY,
            audio_data BLOB,
            fingerprint_hash TEXT NOT NULL,
            fingerprint_peaks TEXT,
            fingerprint_robust TEXT,
            duration_sec INTEGER,
            best_confidence REAL NOT NULL DEFAULT 0,
            note TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    "#).execute(pool).await.expect("Failed to init failed_samples table");
}

pub async fn insert_failed_sample(
    pool: &SqlitePool,
    id: &str,
    audio_data: Option<&[u8]>,
    fingerprint_hash: &str,
    fingerprint_peaks: Option<&str>,
    fingerprint_robust: Option<&str>,
    duration_sec: Option<i64>,
    best_confidence: f32,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO failed_samples (id, audio_data, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, best_confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id)
    .bind(audio_data)
    .bind(fingerprint_hash)
    .bind(fingerprint_peaks)
    .bind(fingerprint_robust)
    .bind(duration_sec)
    .bind(best_confidence)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_failed_samples(pool: &SqlitePool, limit: i32) -> Result<Vec<FailedSample>, sqlx::Error> {
    let samples = sqlx::query_as::<_, FailedSample>(
        "SELECT id, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, best_confidence, note, created_at FROM failed_samples ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(samples)
}

pub async fn get_failed_sample_audio(pool: &SqlitePool, id: &str) -> Result<Option<Vec<u8>>, sqlx::Error> {
    let sample: Option<(Vec<u8>,)> = sqlx::query_as(
        "SELECT audio_data FROM failed_samples WHERE id = ? AND audio_data IS NOT NULL"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(sample.map(|s| s.0))
}

pub async fn delete_failed_sample(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM failed_samples WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_failed_sample_by_id(pool: &SqlitePool, id: &str) -> Result<Option<FailedSample>, sqlx::Error> {
    let sample = sqlx::query_as::<_, FailedSample>(
        "SELECT id, audio_data, fingerprint_hash, fingerprint_peaks, fingerprint_robust, duration_sec, best_confidence, note, created_at FROM failed_samples WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(sample)
}

pub async fn get_similar_songs(
    pool: &SqlitePool,
    song_id: &str,
    limit: i32,
) -> Result<Vec<SimilarSong>, sqlx::Error> {
    let current_song = match get_song_by_id(pool, song_id).await? {
        Some(s) => s,
        None => return Ok(Vec::new()),
    };

    let all_songs = get_all_songs(pool).await?;
    let mut similar_songs: Vec<SimilarSong> = Vec::new();

    for song in all_songs {
        if song.id == song_id {
            continue;
        }

        let mut score: f32 = 0.0;
        let mut reasons: Vec<String> = Vec::new();

        if let (Some(ref curr_artist), Some(ref song_artist)) = (&current_song.artist, &song.artist) {
            if curr_artist.to_lowercase() == song_artist.to_lowercase() {
                score += 0.6;
                reasons.push("同一艺术家".to_string());
            }
        }

        let hash_sim = calculate_hash_similarity_score(&current_song.fingerprint_hash, &song.fingerprint_hash);
        score += hash_sim * 0.4;
        if hash_sim > 0.3 {
            reasons.push("风格相似".to_string());
        }

        if let (Some(curr_dur), Some(song_dur)) = (current_song.duration_sec, song.duration_sec) {
            let diff = (curr_dur - song_dur).abs();
            if diff < 30 {
                score += 0.1;
            }
        }

        if score > 0.15 {
            similar_songs.push(SimilarSong {
                id: song.id,
                title: song.title,
                artist: song.artist,
                duration_sec: song.duration_sec,
                similarity_score: score.min(1.0),
                reason: if reasons.is_empty() { "风格接近".to_string() } else { reasons.join("、") },
            });
        }
    }

    similar_songs.sort_by(|a, b| b.similarity_score.partial_cmp(&a.similarity_score).unwrap_or(std::cmp::Ordering::Equal));
    similar_songs.truncate(limit as usize);

    Ok(similar_songs)
}

fn calculate_hash_similarity_score(hash1: &str, hash2: &str) -> f32 {
    let bytes1 = hash1.as_bytes();
    let bytes2 = hash2.as_bytes();
    let min_len = bytes1.len().min(bytes2.len());
    let mut matches = 0;

    for i in 0..min_len {
        if bytes1[i] == bytes2[i] {
            matches += 1;
        }
    }

    if min_len == 0 {
        0.0
    } else {
        matches as f32 / min_len as f32
    }
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    #[sqlx(default)]
    pub song_count: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlaylistSong {
    pub playlist_id: String,
    pub song_id: String,
    pub added_at: String,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PlaylistSongDetail {
    pub song_id: String,
    pub title: String,
    pub artist: Option<String>,
    pub duration_sec: Option<i64>,
    pub added_at: String,
}

pub async fn init_playlists_tables(pool: &SqlitePool) {
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    "#).execute(pool).await.expect("Failed to init playlists table");
    
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS playlist_songs (
            playlist_id TEXT NOT NULL,
            song_id TEXT NOT NULL,
            added_at TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (playlist_id, song_id),
            FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
            FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
        )
    "#).execute(pool).await.expect("Failed to init playlist_songs table");
}

pub async fn create_playlist(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO playlists (id, name, description, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(id)
    .bind(name)
    .bind(description)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_all_playlists(pool: &SqlitePool) -> Result<Vec<Playlist>, sqlx::Error> {
    let playlists = sqlx::query_as::<_, Playlist>(r#"
        SELECT p.id, p.name, p.description, p.created_at, COUNT(ps.song_id) as song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        GROUP BY p.id, p.name, p.description, p.created_at
        ORDER BY p.created_at DESC
    "#)
    .fetch_all(pool)
    .await?;
    Ok(playlists)
}

pub async fn get_playlist_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Playlist>, sqlx::Error> {
    let playlist = sqlx::query_as::<_, Playlist>(r#"
        SELECT p.id, p.name, p.description, p.created_at, COUNT(ps.song_id) as song_count
        FROM playlists p
        LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
        WHERE p.id = ?
        GROUP BY p.id, p.name, p.description, p.created_at
    "#)
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(playlist)
}

pub async fn update_playlist(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE playlists SET name = ?, description = ? WHERE id = ?"
    )
    .bind(name)
    .bind(description)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_playlist(pool: &SqlitePool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM playlists WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn add_song_to_playlist(
    pool: &SqlitePool,
    playlist_id: &str,
    song_id: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, added_at) VALUES (?, ?, ?)"
    )
    .bind(playlist_id)
    .bind(song_id)
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove_song_from_playlist(
    pool: &SqlitePool,
    playlist_id: &str,
    song_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?"
    )
    .bind(playlist_id)
    .bind(song_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_playlist_songs(
    pool: &SqlitePool,
    playlist_id: &str,
) -> Result<Vec<PlaylistSongDetail>, sqlx::Error> {
    let songs = sqlx::query_as::<_, PlaylistSongDetail>(r#"
        SELECT s.id as song_id, s.title, s.artist, s.duration_sec, ps.added_at
        FROM playlist_songs ps
        JOIN songs s ON ps.song_id = s.id
        WHERE ps.playlist_id = ?
        ORDER BY ps.added_at DESC
    "#)
    .bind(playlist_id)
    .fetch_all(pool)
    .await?;
    Ok(songs)
}

pub async fn get_song_playlists(
    pool: &SqlitePool,
    song_id: &str,
) -> Result<Vec<String>, sqlx::Error> {
    let playlist_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT playlist_id FROM playlist_songs WHERE song_id = ?"
    )
    .bind(song_id)
    .fetch_all(pool)
    .await?;
    Ok(playlist_ids.into_iter().map(|(id,)| id).collect())
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ReviewTask {
    pub id: String,
    pub history_id: String,
    pub song_id: Option<String>,
    pub song_title: Option<String>,
    pub song_artist: Option<String>,
    pub original_confidence: f32,
    pub review_status: String,
    pub review_count: i64,
    pub last_review_result: Option<String>,
    pub last_review_confidence: Option<f32>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn init_review_tasks_table(pool: &SqlitePool) {
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS review_tasks (
            id TEXT PRIMARY KEY,
            history_id TEXT NOT NULL,
            song_id TEXT,
            song_title TEXT,
            song_artist TEXT,
            original_confidence REAL NOT NULL,
            review_status TEXT NOT NULL DEFAULT 'pending',
            review_count INTEGER NOT NULL DEFAULT 0,
            last_review_result TEXT,
            last_review_confidence REAL,
            note TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    "#).execute(pool).await.expect("Failed to init review_tasks table");

    sqlx::query(r#"
        CREATE UNIQUE INDEX IF NOT EXISTS idx_review_tasks_history_id ON review_tasks(history_id)
    "#).execute(pool).await.ok();
}

pub async fn insert_review_task(
    pool: &SqlitePool,
    id: &str,
    history_id: &str,
    song_id: Option<&str>,
    song_title: Option<&str>,
    song_artist: Option<&str>,
    original_confidence: f32,
    note: Option<&str>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT OR IGNORE INTO review_tasks (id, history_id, song_id, song_title, song_artist, original_confidence, review_status, review_count, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)"
    )
    .bind(id)
    .bind(history_id)
    .bind(song_id)
    .bind(song_title)
    .bind(song_artist)
    .bind(original_confidence)
    .bind(note)
    .bind(now.clone())
    .bind(now)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_review_tasks(
    pool: &SqlitePool,
    status: Option<&str>,
    limit: i32,
) -> Result<Vec<ReviewTask>, sqlx::Error> {
    let tasks = match status {
        Some(s) => sqlx::query_as::<_, ReviewTask>(
            "SELECT * FROM review_tasks WHERE review_status = ? ORDER BY created_at DESC LIMIT ?"
        )
        .bind(s)
        .bind(limit)
        .fetch_all(pool)
        .await?,
        None => sqlx::query_as::<_, ReviewTask>(
            "SELECT * FROM review_tasks ORDER BY created_at DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(pool)
        .await?,
    };
    Ok(tasks)
}

pub async fn get_review_task_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<ReviewTask>, sqlx::Error> {
    let task = sqlx::query_as::<_, ReviewTask>(
        "SELECT * FROM review_tasks WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(task)
}

pub async fn get_review_task_by_history_id(
    pool: &SqlitePool,
    history_id: &str,
) -> Result<Option<ReviewTask>, sqlx::Error> {
    let task = sqlx::query_as::<_, ReviewTask>(
        "SELECT * FROM review_tasks WHERE history_id = ?"
    )
    .bind(history_id)
    .fetch_optional(pool)
    .await?;
    Ok(task)
}

pub async fn update_review_task_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE review_tasks SET review_status = ?, updated_at = ? WHERE id = ?"
    )
    .bind(status)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_review_task_result(
    pool: &SqlitePool,
    id: &str,
    result: Option<&str>,
    confidence: Option<f32>,
) -> Result<(), sqlx::Error> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE review_tasks SET review_count = review_count + 1, last_review_result = ?, last_review_confidence = ?, updated_at = ? WHERE id = ?"
    )
    .bind(result)
    .bind(confidence)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_review_task(
    pool: &SqlitePool,
    id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM review_tasks WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_low_confidence_history(
    pool: &SqlitePool,
    threshold: f32,
    limit: i32,
) -> Result<Vec<RecognitionHistory>, sqlx::Error> {
    let history = sqlx::query_as::<_, RecognitionHistory>(
        "SELECT * FROM recognition_history WHERE match_found = 1 AND confidence < ? ORDER BY confidence ASC, created_at DESC LIMIT ?"
    )
    .bind(threshold)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    Ok(history)
}
