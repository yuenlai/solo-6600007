use sqlx::sqlite::{SqlitePoolOptions, SqlitePool};

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
