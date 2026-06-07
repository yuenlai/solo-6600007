use actix_web::{web, App, HttpServer, HttpResponse, Error};
use actix_cors::Cors;
use actix_multipart::Multipart;
use serde::{Serialize, Deserialize};
use futures_util::StreamExt;
use uuid::Uuid;
use sqlx::SqlitePool;

mod fingerprint;
mod database;

use database::Song;

#[derive(Serialize)]
struct HealthResponse { status: String, service: String }

#[derive(Serialize, Deserialize)]
struct RecognizeRequest { audio_hash: String }

#[derive(Serialize)]
struct UploadResponse {
    id: String,
    title: String,
    artist: Option<String>,
    fingerprint_hash: String,
    duration_sec: Option<i64>,
    status: String,
    message: String,
}

#[derive(Serialize)]
struct RecognizeResponse {
    match_found: bool,
    song: Option<SongMatch>,
    confidence: f32,
    processing_time_ms: u64,
}

#[derive(Serialize)]
struct SongMatch {
    id: String,
    title: String,
    artist: Option<String>,
    duration_sec: Option<i64>,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(HealthResponse {
        status: "ok".to_string(), service: "Audio Fingerprint Service".to_string(),
    })
}

async fn recognize_audio(
    mut payload: Multipart,
    pool: web::Data<SqlitePool>,
) -> Result<HttpResponse, Error> {
    let start = std::time::Instant::now();
    let mut audio_bytes: Option<Vec<u8>> = None;

    while let Some(item) = payload.next().await {
        let mut field = item?;
        let content_disposition = field.content_disposition();

        let name = content_disposition.get_name().unwrap_or("");

        if name == "file" {
            let mut bytes = web::BytesMut::new();
            while let Some(chunk) = field.next().await {
                bytes.extend_from_slice(&chunk?);
            }
            audio_bytes = Some(bytes.to_vec());
        }
    }

    let audio_bytes = match audio_bytes {
        Some(b) if !b.is_empty() => b,
        _ => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "missing_file".to_string(),
                message: "Audio file is required".to_string(),
            }));
        }
    };

    let (_, _, input_peaks) = match fingerprint::process_audio_and_generate_fingerprint(&audio_bytes) {
        Ok(result) => result,
        Err(e) => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "audio_processing_error".to_string(),
                message: format!("Failed to process audio file: {:?}", e),
            }));
        }
    };

    let songs = match database::get_all_songs(&pool).await {
        Ok(s) => s,
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "database_error".to_string(),
                message: format!("Failed to fetch songs: {}", e),
            }));
        }
    };

    let mut best_match: Option<(database::Song, f32)> = None;

    for song in songs {
        if let Some(peaks_str) = &song.fingerprint_peaks {
            if let Ok(stored_peaks) = serde_json::from_str::<Vec<(usize, f32)>>(peaks_str) {
                let similarity = fingerprint::calculate_similarity(&input_peaks, &stored_peaks);
                match &best_match {
                    Some((_, best_sim)) if similarity > *best_sim => {
                        best_match = Some((song, similarity));
                    }
                    None => {
                        best_match = Some((song, similarity));
                    }
                    _ => {}
                }
            }
        }
    }

    let processing_time_ms = start.elapsed().as_millis() as u64;
    let confidence_threshold = 0.1;

    let response = match best_match {
        Some((song, confidence)) if confidence >= confidence_threshold => {
            RecognizeResponse {
                match_found: true,
                song: Some(SongMatch {
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    duration_sec: song.duration_sec,
                }),
                confidence,
                processing_time_ms,
            }
        }
        _ => {
            RecognizeResponse {
                match_found: false,
                song: None,
                confidence: 0.0,
                processing_time_ms,
            }
        }
    };

    Ok(HttpResponse::Ok().json(response))
}

async fn list_songs(pool: web::Data<SqlitePool>) -> HttpResponse {
    match database::get_all_songs(&pool).await {
        Ok(songs) => HttpResponse::Ok().json(songs),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch songs: {}", e),
        }),
    }
}

async fn upload_song(
    mut payload: Multipart,
    pool: web::Data<SqlitePool>,
) -> Result<HttpResponse, Error> {
    let mut title = String::new();
    let mut artist: Option<String> = None;
    let mut audio_bytes: Option<Vec<u8>> = None;

    while let Some(item) = payload.next().await {
        let mut field = item?;
        let content_disposition = field.content_disposition();

        let name = content_disposition
            .get_name()
            .unwrap_or("");

        match name {
            "title" => {
                let mut bytes = web::BytesMut::new();
                while let Some(chunk) = field.next().await {
                    bytes.extend_from_slice(&chunk?);
                }
                title = String::from_utf8_lossy(&bytes).to_string();
            }
            "artist" => {
                let mut bytes = web::BytesMut::new();
                while let Some(chunk) = field.next().await {
                    bytes.extend_from_slice(&chunk?);
                }
                let value = String::from_utf8_lossy(&bytes).to_string();
                if !value.is_empty() {
                    artist = Some(value);
                }
            }
            "file" => {
                let mut bytes = web::BytesMut::new();
                while let Some(chunk) = field.next().await {
                    bytes.extend_from_slice(&chunk?);
                }
                audio_bytes = Some(bytes.to_vec());
            }
            _ => {}
        }
    }

    if title.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: "missing_title".to_string(),
            message: "Song title is required".to_string(),
        }));
    }

    let audio_bytes = match audio_bytes {
        Some(b) if !b.is_empty() => b,
        _ => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "missing_file".to_string(),
                message: "Audio file is required".to_string(),
            }));
        }
    };

    let (fingerprint_hash, duration_sec, peaks) = match fingerprint::process_audio_and_generate_fingerprint(&audio_bytes) {
        Ok((hash, duration, peaks)) => (hash, duration as i64, peaks),
        Err(e) => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "audio_processing_error".to_string(),
                message: format!("Failed to process audio file: {:?}", e),
            }));
        }
    };

    let peaks_json = serde_json::to_string(&peaks).ok();

    let song_id = Uuid::new_v4().to_string();

    match database::insert_song(
        &pool,
        &song_id,
        &title,
        artist.as_deref(),
        &fingerprint_hash,
        peaks_json.as_deref(),
        Some(duration_sec),
    ).await {
        Ok(_) => {
            Ok(HttpResponse::Ok().json(UploadResponse {
                id: song_id,
                title,
                artist,
                fingerprint_hash,
                duration_sec: Some(duration_sec),
                status: "success".to_string(),
                message: "Song uploaded and fingerprinted successfully".to_string(),
            }))
        }
        Err(e) => {
            Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "database_error".to_string(),
                message: format!("Failed to save song: {}", e),
            }))
        }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    println!("Audio Fingerprint server on port 8080");

    let pool = database::create_pool().await;
    database::init_db(&pool).await;
    println!("Database initialized");

    HttpServer::new(move || {
        let cors = Cors::default().allow_any_origin().allow_any_method().allow_any_header();
        App::new()
            .wrap(cors)
            .app_data(web::Data::new(pool.clone()))
            .route("/api/health", web::get().to(health))
            .route("/api/recognize", web::post().to(recognize_audio))
            .route("/api/songs", web::get().to(list_songs))
            .route("/api/songs/upload", web::post().to(upload_song))
    }).bind("127.0.0.1:8080")?.run().await
}
