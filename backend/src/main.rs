use actix_web::{web, App, HttpServer, HttpResponse};
use actix_cors::Cors;
use serde::Serialize;

mod fingerprint;
mod database;

#[derive(Serialize)]
struct HealthResponse { status: String, service: String }

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(), service: "Audio Fingerprint Service".to_string(),
    })
}

async fn recognize(data: web::Json<serde_json::Value>) -> HttpResponse {
    let audio_hash = data.get("audio_hash").and_then(|v| v.as_str()).unwrap_or("");
    HttpResponse::Ok().json(serde_json::json!({
        "match": audio_hash.is_empty() == false,
        "song": { "title": "Unknown Track", "artist": "Unknown", "confidence": 0.0 },
        "processing_time_ms": 42
    }))
}

async fn list_songs() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!([
        { "id": "1", "title": "Test Song A", "artist": "Artist A", "fingerprint_hash": "abc123", "duration_sec": 240 },
        { "id": "2", "title": "Test Song B", "artist": "Artist B", "fingerprint_hash": "def456", "duration_sec": 180 },
    ]))
}

async fn add_song(data: web::Json<serde_json::Value>) -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "status": "fingerprinting",
        "message": "Song added for fingerprint extraction"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    println!("Audio Fingerprint server on port 8080");
    HttpServer::new(|| {
        let cors = Cors::default().allow_any_origin().allow_any_method().allow_any_header();
        App::new().wrap(cors)
            .route("/api/health", web::get().to(health))
            .route("/api/recognize", web::post().to(recognize))
            .route("/api/songs", web::get().to(list_songs))
            .route("/api/songs", web::post().to(add_song))
    }).bind("127.0.0.1:8080")?.run().await
}
