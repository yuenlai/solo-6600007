use actix_web::{web, App, HttpServer, HttpResponse, Error, ResponseError};
use actix_cors::Cors;
use actix_multipart::Multipart;
use serde::{Serialize, Deserialize};
use serde_json;
use futures_util::StreamExt;
use uuid::Uuid;
use sqlx::SqlitePool;
use std::fmt;

mod fingerprint;
mod database;

use database::{Song, RecognitionHistory, RankedSong, TrendingSong, FailedSample, get_pending_songs};

#[derive(Serialize)]
struct HealthResponse { status: String, service: String }

#[derive(Serialize, Deserialize)]
struct RecognizeRequest { audio_hash: String }

#[derive(Serialize, Clone)]
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

#[derive(Serialize, Clone)]
struct BatchUploadProgress {
    file_index: usize,
    file_name: String,
    status: String,
    progress: u32,
    song: Option<UploadResponse>,
    error: Option<String>,
}

#[derive(Serialize)]
struct BatchUploadResult {
    total: usize,
    success: usize,
    failed: usize,
    results: Vec<BatchUploadProgress>,
}

#[derive(Serialize)]
struct TopSongsResponse {
    total: usize,
    songs: Vec<RankedSong>,
}

#[derive(Serialize)]
struct TrendingSongsResponse {
    total: usize,
    days: i32,
    songs: Vec<TrendingSong>,
}

#[derive(Serialize)]
struct FailedSamplesResponse {
    total: usize,
    samples: Vec<FailedSample>,
}

#[derive(Deserialize)]
struct PromoteSampleRequest {
    title: String,
    artist: Option<String>,
}

#[derive(Serialize)]
struct PromoteSampleResponse {
    status: String,
    song_id: String,
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

    let (input_hash, _, input_peaks, input_robust) = match fingerprint::process_audio_and_generate_fingerprint(&audio_bytes) {
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
        let mut max_similarity = 0.0f32;

        if let Some(robust_str) = &song.fingerprint_robust {
            if let Ok(stored_robust) = serde_json::from_str::<Vec<u64>>(robust_str) {
                let sim = fingerprint::calculate_robust_similarity(&input_robust, &stored_robust);
                max_similarity = max_similarity.max(sim * 1.2);
            }
        }

        if let Some(peaks_str) = &song.fingerprint_peaks {
            if let Ok(stored_peaks) = serde_json::from_str::<Vec<(usize, f32)>>(peaks_str) {
                let sim = fingerprint::calculate_similarity(&input_peaks, &stored_peaks);
                max_similarity = max_similarity.max(sim);
            }
        }

        if max_similarity < 0.05 {
            let hash_sim = fingerprint::calculate_hash_similarity(&input_hash, &song.fingerprint_hash);
            max_similarity = max_similarity.max(hash_sim * 0.8);
        }

        match &best_match {
            Some((_, best_sim)) if max_similarity > *best_sim => {
                best_match = Some((song, max_similarity));
            }
            None => {
                best_match = Some((song, max_similarity));
            }
            _ => {}
        }
    }

    let processing_time_ms = start.elapsed().as_millis() as u64;
    let confidence_threshold = 0.15;

    let response = match best_match {
        Some((song, confidence)) if confidence >= confidence_threshold => {
            let history_id = Uuid::new_v4().to_string();
            let _ = database::insert_recognition_history(
                &pool,
                &history_id,
                true,
                Some(&song.id),
                Some(&song.title),
                song.artist.as_deref(),
                confidence.min(1.0),
                processing_time_ms as i64,
            ).await;

            RecognizeResponse {
                match_found: true,
                song: Some(SongMatch {
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    duration_sec: song.duration_sec,
                }),
                confidence: confidence.min(1.0),
                processing_time_ms,
            }
        }
        _ => {
            let history_id = Uuid::new_v4().to_string();
            let _ = database::insert_recognition_history(
                &pool,
                &history_id,
                false,
                None,
                None,
                None,
                0.0,
                processing_time_ms as i64,
            ).await;

            let sample_id = Uuid::new_v4().to_string();
            let peaks_json = serde_json::to_string(&input_peaks).ok();
            let robust_json = serde_json::to_string(&input_robust).ok();
            let best_confidence = best_match.as_ref().map(|(_, c)| *c).unwrap_or(0.0);
            
            let _ = database::insert_failed_sample(
                &pool,
                &sample_id,
                Some(&audio_bytes),
                &input_hash,
                peaks_json.as_deref(),
                robust_json.as_deref(),
                None,
                best_confidence,
            ).await;

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

async fn list_pending_songs(pool: web::Data<SqlitePool>) -> HttpResponse {
    match get_pending_songs(&pool).await {
        Ok(songs) => HttpResponse::Ok().json(songs),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch pending songs: {}", e),
        }),
    }
}

async fn get_history(pool: web::Data<SqlitePool>) -> HttpResponse {
    match database::get_recognition_history(&pool, 100).await {
        Ok(history) => HttpResponse::Ok().json(history),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch history: {}", e),
        }),
    }
}

async fn get_song_detail(
    song_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_song_by_id(&pool, &song_id).await {
        Ok(Some(song)) => HttpResponse::Ok().json(song),
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "song_not_found".to_string(),
            message: "Song not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch song: {}", e),
        }),
    }
}

async fn get_song_history(
    song_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_recognition_history_by_song_id(&pool, &song_id, 50).await {
        Ok(history) => HttpResponse::Ok().json(history),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch song history: {}", e),
        }),
    }
}

async fn get_top_songs(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(20);

    match database::get_top_songs(&pool, limit).await {
        Ok(songs) => HttpResponse::Ok().json(TopSongsResponse {
            total: songs.len(),
            songs,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch top songs: {}", e),
        }),
    }
}

async fn get_trending_songs(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(20);
    let days: i32 = query.get("days")
        .and_then(|d| d.parse().ok())
        .unwrap_or(7);

    match database::get_trending_songs(&pool, limit, days).await {
        Ok(songs) => HttpResponse::Ok().json(TrendingSongsResponse {
            total: songs.len(),
            days,
            songs,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch trending songs: {}", e),
        }),
    }
}

async fn get_song_preview(
    song_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_song_audio_sample(&pool, &song_id).await {
        Ok(Some(sample)) => {
            HttpResponse::Ok()
                .content_type("audio/wav")
                .append_header(("Content-Disposition", format!("inline; filename=\"preview_{}.wav\"", song_id)))
                .body(sample)
        }
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "preview_not_found".to_string(),
            message: "Audio preview not available for this song".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch audio preview: {}", e),
        }),
    }
}

async fn delete_song(
    song_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::delete_song(&pool, &song_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Song deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to delete song: {}", e),
        }),
    }
}

async fn list_failed_samples(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(100);

    match database::get_failed_samples(&pool, limit).await {
        Ok(samples) => HttpResponse::Ok().json(FailedSamplesResponse {
            total: samples.len(),
            samples,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch failed samples: {}", e),
        }),
    }
}

async fn get_failed_sample_preview(
    sample_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_failed_sample_audio(&pool, &sample_id).await {
        Ok(Some(sample)) => {
            HttpResponse::Ok()
                .content_type("audio/wav")
                .append_header(("Content-Disposition", format!("inline; filename=\"failed_sample_{}.wav\"", sample_id)))
                .body(sample)
        }
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "sample_not_found".to_string(),
            message: "Failed sample audio not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch sample audio: {}", e),
        }),
    }
}

async fn delete_failed_sample(
    sample_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::delete_failed_sample(&pool, &sample_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Failed sample deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to delete sample: {}", e),
        }),
    }
}

async fn promote_failed_sample(
    sample_id: web::Path<String>,
    body: web::Json<PromoteSampleRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let sample = match database::get_failed_sample_by_id(&pool, &sample_id).await {
        Ok(Some(s)) => s,
        Ok(None) => return HttpResponse::NotFound().json(ErrorResponse {
            error: "sample_not_found".to_string(),
            message: "Failed sample not found".to_string(),
        }),
        Err(e) => return HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch sample: {}", e),
        }),
    };

    let song_id = Uuid::new_v4().to_string();
    let audio_sample = sample.audio_data.as_deref();

    match database::insert_song(
        &pool,
        &song_id,
        &body.title,
        body.artist.as_deref(),
        &sample.fingerprint_hash,
        sample.fingerprint_peaks.as_deref(),
        sample.fingerprint_robust.as_deref(),
        sample.duration_sec,
        audio_sample,
        Some("completed"),
    ).await {
        Ok(_) => {
            let _ = database::delete_failed_sample(&pool, &sample_id).await;
            HttpResponse::Ok().json(PromoteSampleResponse {
                status: "success".to_string(),
                song_id: song_id.clone(),
                message: "Sample promoted to song successfully".to_string(),
            })
        }
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to promote sample: {}", e),
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

    let (fingerprint_hash, duration_sec, peaks, robust) = match fingerprint::process_audio_and_generate_fingerprint(&audio_bytes) {
        Ok((hash, duration, peaks, robust)) => (hash, duration as i64, peaks, robust),
        Err(e) => {
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "audio_processing_error".to_string(),
                message: format!("Failed to process audio file: {:?}", e),
            }));
        }
    };

    let audio_sample = match fingerprint::extract_preview_sample(&audio_bytes, 30.0) {
        Ok(sample) => Some(sample),
        Err(e) => {
            eprintln!("Warning: Failed to extract preview sample: {:?}", e);
            None
        }
    };

    let peaks_json = serde_json::to_string(&peaks).ok();
    let robust_json = serde_json::to_string(&robust).ok();

    let song_id = Uuid::new_v4().to_string();

    match database::insert_song(
        &pool,
        &song_id,
        &title,
        artist.as_deref(),
        &fingerprint_hash,
        peaks_json.as_deref(),
        robust_json.as_deref(),
        Some(duration_sec),
        audio_sample.as_deref(),
        Some("completed"),
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

async fn batch_upload_songs(
    mut payload: Multipart,
    pool: web::Data<SqlitePool>,
) -> Result<HttpResponse, Error> {
    let mut files: Vec<(String, Vec<u8>)> = Vec::new();
    let mut titles: Vec<Option<String>> = Vec::new();
    let mut artists: Vec<Option<String>> = Vec::new();
    let mut current_file_index = 0;

    while let Some(item) = payload.next().await {
        let mut field = item?;
        let content_disposition = field.content_disposition();
        let name = content_disposition.get_name().unwrap_or("");

        if name.starts_with("file_") {
            let file_name = content_disposition.get_filename().unwrap_or("unknown.wav").to_string();
            let mut bytes = web::BytesMut::new();
            while let Some(chunk) = field.next().await {
                bytes.extend_from_slice(&chunk?);
            }
            files.push((file_name, bytes.to_vec()));
            current_file_index += 1;
        } else if name.starts_with("title_") {
            let mut bytes = web::BytesMut::new();
            while let Some(chunk) = field.next().await {
                bytes.extend_from_slice(&chunk?);
            }
            let value = String::from_utf8_lossy(&bytes).to_string();
            titles.push(if value.is_empty() { None } else { Some(value) });
        } else if name.starts_with("artist_") {
            let mut bytes = web::BytesMut::new();
            while let Some(chunk) = field.next().await {
                bytes.extend_from_slice(&chunk?);
            }
            let value = String::from_utf8_lossy(&bytes).to_string();
            artists.push(if value.is_empty() { None } else { Some(value) });
        }
    }

    if files.is_empty() {
        return Ok(HttpResponse::BadRequest().json(ErrorResponse {
            error: "no_files".to_string(),
            message: "No audio files provided".to_string(),
        }));
    }

    while titles.len() < files.len() {
        titles.push(None);
    }
    while artists.len() < files.len() {
        artists.push(None);
    }

    let mut results = Vec::new();
    let mut success_count = 0;
    let mut failed_count = 0;

    for (index, ((file_name, audio_bytes), title_opt)) in files.iter().zip(titles.iter()).enumerate() {
        let artist = artists.get(index).cloned().flatten();
        let title = title_opt.clone().unwrap_or_else(|| {
            file_name.rfind('.')
                .map(|pos| file_name[..pos].to_string())
                .unwrap_or_else(|| file_name.clone())
        });

        let mut progress = BatchUploadProgress {
            file_index: index,
            file_name: file_name.clone(),
            status: "processing".to_string(),
            progress: 25,
            song: None,
            error: None,
        };

        if audio_bytes.is_empty() {
            progress.status = "failed".to_string();
            progress.progress = 100;
            progress.error = Some("Empty audio file".to_string());
            failed_count += 1;
            results.push(progress);
            continue;
        }

        progress.progress = 50;

        let (fingerprint_hash, duration_sec, peaks, robust) = match fingerprint::process_audio_and_generate_fingerprint(audio_bytes) {
            Ok((hash, duration, peaks, robust)) => (hash, duration as i64, peaks, robust),
            Err(e) => {
                progress.status = "failed".to_string();
                progress.progress = 100;
                progress.error = Some(format!("Audio processing failed: {:?}", e));
                failed_count += 1;
                results.push(progress);
                continue;
            }
        };

        let audio_sample = match fingerprint::extract_preview_sample(audio_bytes, 30.0) {
            Ok(sample) => Some(sample),
            Err(e) => {
                eprintln!("Warning: Failed to extract preview sample for {}: {:?}", file_name, e);
                None
            }
        };

        progress.progress = 75;

        let peaks_json = serde_json::to_string(&peaks).ok();
        let robust_json = serde_json::to_string(&robust).ok();
        let song_id = Uuid::new_v4().to_string();

        match database::insert_song(
            &pool,
            &song_id,
            &title,
            artist.as_deref(),
            &fingerprint_hash,
            peaks_json.as_deref(),
            robust_json.as_deref(),
            Some(duration_sec),
            audio_sample.as_deref(),
            Some("completed"),
        ).await {
            Ok(_) => {
                progress.status = "completed".to_string();
                progress.progress = 100;
                progress.song = Some(UploadResponse {
                    id: song_id,
                    title: title.clone(),
                    artist: artist.clone(),
                    fingerprint_hash,
                    duration_sec: Some(duration_sec),
                    status: "success".to_string(),
                    message: "Song uploaded and fingerprinted successfully".to_string(),
                });
                success_count += 1;
            }
            Err(e) => {
                progress.status = "failed".to_string();
                progress.progress = 100;
                progress.error = Some(format!("Database error: {}", e));
                failed_count += 1;
            }
        }

        results.push(progress);
    }

    Ok(HttpResponse::Ok().json(BatchUploadResult {
        total: files.len(),
        success: success_count,
        failed: failed_count,
        results,
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    env_logger::init();
    println!("Audio Fingerprint server on port 8080");

    let pool = database::create_pool().await;
    database::init_db(&pool).await;
    database::init_history_table(&pool).await;
    database::init_failed_samples_table(&pool).await;
    println!("Database initialized");

    HttpServer::new(move || {
        let cors = Cors::default().allow_any_origin().allow_any_method().allow_any_header();
        App::new()
            .wrap(cors)
            .app_data(web::Data::new(pool.clone()))
            .route("/api/health", web::get().to(health))
            .route("/api/recognize", web::post().to(recognize_audio))
            .route("/api/songs", web::get().to(list_songs))
            .route("/api/songs/pending", web::get().to(list_pending_songs))
            .route("/api/songs/upload", web::post().to(upload_song))
            .route("/api/songs/batch-upload", web::post().to(batch_upload_songs))
            .route("/api/songs/{id}", web::get().to(get_song_detail))
            .route("/api/songs/{id}/history", web::get().to(get_song_history))
            .route("/api/songs/{id}/preview", web::get().to(get_song_preview))
            .route("/api/songs/{id}", web::delete().to(delete_song))
            .route("/api/history", web::get().to(get_history))
            .route("/api/rankings/top", web::get().to(get_top_songs))
            .route("/api/rankings/trending", web::get().to(get_trending_songs))
            .route("/api/failed-samples", web::get().to(list_failed_samples))
            .route("/api/failed-samples/{id}/preview", web::get().to(get_failed_sample_preview))
            .route("/api/failed-samples/{id}", web::delete().to(delete_failed_sample))
            .route("/api/failed-samples/{id}/promote", web::post().to(promote_failed_sample))
    }).bind("127.0.0.1:8080")?.run().await
}
