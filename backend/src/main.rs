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

use database::{Song, RecognitionHistory, RankedSong, TrendingSong, FailedSample, SimilarSong, Playlist, PlaylistSongDetail, ReviewTask, Tag, PracticeRecord, PracticeSummary, get_pending_songs};

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
    similar_songs: Vec<SimilarSong>,
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

#[derive(Serialize)]
struct SimilarSongsResponse {
    total: usize,
    songs: Vec<SimilarSong>,
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

#[derive(Deserialize)]
struct CreatePlaylistRequest {
    name: String,
    description: Option<String>,
}

#[derive(Deserialize)]
struct UpdatePlaylistRequest {
    name: String,
    description: Option<String>,
}

#[derive(Serialize)]
struct PlaylistResponse {
    id: String,
    name: String,
    description: Option<String>,
    created_at: String,
    song_count: i64,
}

#[derive(Serialize)]
struct PlaylistsResponse {
    total: usize,
    playlists: Vec<PlaylistResponse>,
}

#[derive(Serialize)]
struct PlaylistSongsResponse {
    total: usize,
    songs: Vec<PlaylistSongDetail>,
}

#[derive(Deserialize)]
struct AddSongToPlaylistRequest {
    song_id: String,
}

#[derive(Deserialize)]
struct CreateReviewTaskRequest {
    history_id: String,
    note: Option<String>,
}

#[derive(Serialize)]
struct ReviewTasksResponse {
    total: usize,
    tasks: Vec<ReviewTask>,
}

#[derive(Deserialize)]
struct ReRecognizeRequest {
    task_id: String,
}

#[derive(Deserialize)]
struct CreateTagRequest {
    name: String,
    category: String,
}

#[derive(Deserialize)]
struct UpdateTagRequest {
    name: String,
}

#[derive(Serialize)]
struct TagsResponse {
    total: usize,
    tags: Vec<Tag>,
}

#[derive(Serialize)]
struct SongTagsResponse {
    total: usize,
    tags: Vec<Tag>,
}

#[derive(Deserialize)]
struct AddTagToSongRequest {
    tag_id: String,
}

#[derive(Deserialize)]
struct BatchAddTagsRequest {
    tag_ids: Vec<String>,
}

#[derive(Serialize)]
struct SongsByTagsResponse {
    total: usize,
    songs: Vec<Song>,
}

#[derive(Deserialize)]
struct RecordPracticeRequest {
    user_id: Option<String>,
    practice_date: Option<String>,
    is_hit: bool,
}

#[derive(Serialize)]
struct PracticeRecordsResponse {
    total: usize,
    records: Vec<PracticeRecord>,
}

#[derive(Serialize)]
struct PracticeSummaryResponse {
    summary: PracticeSummary,
}

fn convert_playlist(p: Playlist) -> PlaylistResponse {
    PlaylistResponse {
        id: p.id,
        name: p.name,
        description: p.description,
        created_at: p.created_at,
        song_count: p.song_count.unwrap_or(0),
    }
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

            let similar_songs = database::get_similar_songs(&pool, &song.id, 5)
                .await
                .unwrap_or_default();

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
                similar_songs,
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
                similar_songs: Vec::new(),
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

async fn get_similar_songs(
    song_id: web::Path<String>,
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(5);

    match database::get_similar_songs(&pool, &song_id, limit).await {
        Ok(songs) => HttpResponse::Ok().json(SimilarSongsResponse {
            total: songs.len(),
            songs,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch similar songs: {}", e),
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

async fn list_playlists(pool: web::Data<SqlitePool>) -> HttpResponse {
    match database::get_all_playlists(&pool).await {
        Ok(playlists) => HttpResponse::Ok().json(PlaylistsResponse {
            total: playlists.len(),
            playlists: playlists.into_iter().map(convert_playlist).collect(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch playlists: {}", e),
        }),
    }
}

async fn create_playlist(
    body: web::Json<CreatePlaylistRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    if body.name.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "missing_name".to_string(),
            message: "Playlist name is required".to_string(),
        });
    }

    let playlist_id = Uuid::new_v4().to_string();
    match database::create_playlist(&pool, &playlist_id, &body.name, body.description.as_deref()).await {
        Ok(_) => match database::get_playlist_by_id(&pool, &playlist_id).await {
            Ok(Some(playlist)) => HttpResponse::Ok().json(convert_playlist(playlist)),
            _ => HttpResponse::InternalServerError().json(ErrorResponse {
                error: "create_error".to_string(),
                message: "Failed to create playlist".to_string(),
            }),
        },
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to create playlist: {}", e),
        }),
    }
}

async fn get_playlist(
    playlist_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_playlist_by_id(&pool, &playlist_id).await {
        Ok(Some(playlist)) => HttpResponse::Ok().json(convert_playlist(playlist)),
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "playlist_not_found".to_string(),
            message: "Playlist not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch playlist: {}", e),
        }),
    }
}

async fn update_playlist(
    playlist_id: web::Path<String>,
    body: web::Json<UpdatePlaylistRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    if body.name.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "missing_name".to_string(),
            message: "Playlist name is required".to_string(),
        });
    }

    match database::update_playlist(&pool, &playlist_id, &body.name, body.description.as_deref()).await {
        Ok(_) => match database::get_playlist_by_id(&pool, &playlist_id).await {
            Ok(Some(playlist)) => HttpResponse::Ok().json(convert_playlist(playlist)),
            _ => HttpResponse::NotFound().json(ErrorResponse {
                error: "playlist_not_found".to_string(),
                message: "Playlist not found".to_string(),
            }),
        },
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to update playlist: {}", e),
        }),
    }
}

async fn delete_playlist(
    playlist_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::delete_playlist(&pool, &playlist_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Playlist deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to delete playlist: {}", e),
        }),
    }
}

async fn get_playlist_songs(
    playlist_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_playlist_songs(&pool, &playlist_id).await {
        Ok(songs) => HttpResponse::Ok().json(PlaylistSongsResponse {
            total: songs.len(),
            songs,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch playlist songs: {}", e),
        }),
    }
}

async fn add_song_to_playlist(
    playlist_id: web::Path<String>,
    body: web::Json<AddSongToPlaylistRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::add_song_to_playlist(&pool, &playlist_id, &body.song_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Song added to playlist successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to add song to playlist: {}", e),
        }),
    }
}

async fn remove_song_from_playlist(
    path: web::Path<(String, String)>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let (playlist_id, song_id) = path.into_inner();
    match database::remove_song_from_playlist(&pool, &playlist_id, &song_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Song removed from playlist successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to remove song from playlist: {}", e),
        }),
    }
}

async fn get_song_playlists(
    song_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_song_playlists(&pool, &song_id).await {
        Ok(playlist_ids) => HttpResponse::Ok().json(serde_json::json!({
            "total": playlist_ids.len(),
            "playlist_ids": playlist_ids
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch song playlists: {}", e),
        }),
    }
}

async fn create_review_task(
    body: web::Json<CreateReviewTaskRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let history_id = &body.history_id;

    let history = match database::get_recognition_history_by_id(&pool, history_id).await {
        Ok(Some(h)) => h,
        _ => {
            return HttpResponse::NotFound().json(ErrorResponse {
                error: "history_not_found".to_string(),
                message: "Recognition history not found".to_string(),
            });
        }
    };

    if !history.match_found || history.song_id.is_none() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "invalid_history".to_string(),
            message: "Cannot create review task for non-match history".to_string(),
        });
    }

    let existing = match database::get_review_task_by_history_id(&pool, history_id).await {
        Ok(Some(_)) => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "task_exists".to_string(),
                message: "Review task already exists for this history".to_string(),
            });
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(ErrorResponse {
                error: "database_error".to_string(),
                message: format!("Failed to check existing task: {}", e),
            });
        }
        _ => {}
    };

    let task_id = Uuid::new_v4().to_string();
    match database::insert_review_task(
        &pool,
        &task_id,
        history_id,
        history.song_id.as_deref(),
        history.song_title.as_deref(),
        history.song_artist.as_deref(),
        history.confidence,
        body.note.as_deref(),
    ).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "task_id": task_id,
            "message": "Review task created successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to create review task: {}", e),
        }),
    }
}

async fn list_review_tasks(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(100);
    let status = query.get("status").map(|s| s.as_str());

    match database::get_review_tasks(&pool, status, limit).await {
        Ok(tasks) => HttpResponse::Ok().json(ReviewTasksResponse {
            total: tasks.len(),
            tasks,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch review tasks: {}", e),
        }),
    }
}

async fn get_review_task_detail(
    task_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_review_task_by_id(&pool, &task_id).await {
        Ok(Some(task)) => HttpResponse::Ok().json(task),
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "task_not_found".to_string(),
            message: "Review task not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch review task: {}", e),
        }),
    }
}

async fn delete_review_task(
    task_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::delete_review_task(&pool, &task_id).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Review task deleted successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to delete review task: {}", e),
        }),
    }
}

async fn update_review_task_status(
    task_id: web::Path<String>,
    body: web::Json<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let status = match body.get("status") {
        Some(s) => s.as_str(),
        None => {
            return HttpResponse::BadRequest().json(ErrorResponse {
                error: "missing_status".to_string(),
                message: "Status is required".to_string(),
            });
        }
    };

    if !["pending", "reviewing", "completed", "rejected"].contains(&status) {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "invalid_status".to_string(),
            message: "Invalid status. Must be one of: pending, reviewing, completed, rejected".to_string(),
        });
    }

    match database::update_review_task_status(&pool, &task_id, status).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Review task status updated successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to update review task status: {}", e),
        }),
    }
}

async fn re_recognize_review_task(
    task_id: web::Path<String>,
    mut payload: Multipart,
    pool: web::Data<SqlitePool>,
) -> Result<HttpResponse, Error> {
    let task = match database::get_review_task_by_id(&pool, &task_id).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            return Ok(HttpResponse::NotFound().json(ErrorResponse {
                error: "task_not_found".to_string(),
                message: "Review task not found".to_string(),
            }));
        }
        Err(e) => {
            return Ok(HttpResponse::InternalServerError().json(ErrorResponse {
                error: "database_error".to_string(),
                message: format!("Failed to fetch review task: {}", e),
            }));
        }
    };

    let _ = database::update_review_task_status(&pool, &task_id, "reviewing").await;

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
            let _ = database::update_review_task_status(&pool, &task_id, "pending").await;
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "missing_file".to_string(),
                message: "Audio file is required for re-recognition".to_string(),
            }));
        }
    };

    let (input_hash, _, input_peaks, input_robust) = match fingerprint::process_audio_and_generate_fingerprint(&audio_bytes) {
        Ok(result) => result,
        Err(e) => {
            let _ = database::update_review_task_status(&pool, &task_id, "pending").await;
            return Ok(HttpResponse::BadRequest().json(ErrorResponse {
                error: "audio_processing_error".to_string(),
                message: format!("Failed to process audio file: {:?}", e),
            }));
        }
    };

    let songs = match database::get_all_songs(&pool).await {
        Ok(s) => s,
        Err(e) => {
            let _ = database::update_review_task_status(&pool, &task_id, "pending").await;
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

    let (response, result_str, result_confidence) = match best_match {
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

            let similar_songs = database::get_similar_songs(&pool, &song.id, 5)
                .await
                .unwrap_or_default();

            (
                RecognizeResponse {
                    match_found: true,
                    song: Some(SongMatch {
                        id: song.id.clone(),
                        title: song.title.clone(),
                        artist: song.artist.clone(),
                        duration_sec: song.duration_sec,
                    }),
                    confidence: confidence.min(1.0),
                    processing_time_ms,
                    similar_songs,
                },
                Some(format!("{}|{}", song.id, song.title)),
                Some(confidence.min(1.0)),
            )
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

            (
                RecognizeResponse {
                    match_found: false,
                    song: None,
                    confidence: 0.0,
                    processing_time_ms,
                    similar_songs: Vec::new(),
                },
                Some("no_match".to_string()),
                Some(0.0),
            )
        }
    };

    let _ = database::update_review_task_result(
        &pool,
        &task_id,
        result_str.as_deref(),
        result_confidence,
    ).await;
    let _ = database::update_review_task_status(&pool, &task_id, "completed").await;

    Ok(HttpResponse::Ok().json(response))
}

async fn get_low_confidence_recognitions(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let threshold: f32 = query.get("threshold")
        .and_then(|t| t.parse().ok())
        .unwrap_or(0.3);
    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(100);

    match database::get_low_confidence_history(&pool, threshold, limit).await {
        Ok(history) => HttpResponse::Ok().json(serde_json::json!({
            "total": history.len(),
            "items": history
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch low confidence history: {}", e),
        }),
    }
}

async fn create_tag(
    body: web::Json<CreateTagRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    if body.name.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "missing_name".to_string(),
            message: "Tag name is required".to_string(),
        });
    }

    if !["style", "scene", "mood"].contains(&body.category.as_str()) {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "invalid_category".to_string(),
            message: "Invalid category. Must be one of: style, scene, mood".to_string(),
        });
    }

    if let Ok(Some(_)) = database::get_tag_by_name_and_category(&pool, &body.name, &body.category).await {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "tag_exists".to_string(),
            message: "Tag with this name and category already exists".to_string(),
        });
    }

    let tag_id = Uuid::new_v4().to_string();
    match database::create_tag(&pool, &tag_id, &body.name, &body.category).await {
        Ok(_) => match database::get_tag_by_id(&pool, &tag_id).await {
            Ok(Some(tag)) => HttpResponse::Ok().json(tag),
            _ => HttpResponse::InternalServerError().json(ErrorResponse {
                error: "create_error".to_string(),
                message: "Failed to create tag".to_string(),
            }),
        },
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to create tag: {}", e),
        }),
    }
}

async fn list_tags(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let category = query.get("category").map(|c| c.as_str());

    match database::get_all_tags(&pool, category).await {
        Ok(tags) => HttpResponse::Ok().json(TagsResponse {
            total: tags.len(),
            tags,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch tags: {}", e),
        }),
    }
}

async fn get_tag(
    tag_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_tag_by_id(&pool, &tag_id).await {
        Ok(Some(tag)) => HttpResponse::Ok().json(tag),
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "tag_not_found".to_string(),
            message: "Tag not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch tag: {}", e),
        }),
    }
}

async fn update_tag(
    tag_id: web::Path<String>,
    body: web::Json<UpdateTagRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    if body.name.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "missing_name".to_string(),
            message: "Tag name is required".to_string(),
        });
    }

    match database::get_tag_by_id(&pool, &tag_id).await {
        Ok(Some(tag)) => {
            if let Ok(Some(existing)) = database::get_tag_by_name_and_category(&pool, &body.name, &tag.category).await {
                if existing.id != tag.id {
                    return HttpResponse::BadRequest().json(ErrorResponse {
                        error: "tag_exists".to_string(),
                        message: "Tag with this name and category already exists".to_string(),
                    });
                }
            }

            match database::update_tag(&pool, &tag_id, &body.name).await {
                Ok(_) => match database::get_tag_by_id(&pool, &tag_id).await {
                    Ok(Some(updated_tag)) => HttpResponse::Ok().json(updated_tag),
                    _ => HttpResponse::InternalServerError().json(ErrorResponse {
                        error: "update_error".to_string(),
                        message: "Failed to update tag".to_string(),
                    }),
                },
                Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: format!("Failed to update tag: {}", e),
                }),
            }
        }
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "tag_not_found".to_string(),
            message: "Tag not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch tag: {}", e),
        }),
    }
}

async fn delete_tag(
    tag_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_tag_by_id(&pool, &tag_id).await {
        Ok(Some(_)) => {
            match database::delete_tag(&pool, &tag_id).await {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "message": "Tag deleted successfully"
                })),
                Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: format!("Failed to delete tag: {}", e),
                }),
            }
        }
        Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
            error: "tag_not_found".to_string(),
            message: "Tag not found".to_string(),
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch tag: {}", e),
        }),
    }
}

async fn get_song_tags(
    song_id: web::Path<String>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_song_by_id(&pool, &song_id).await {
        Ok(Some(_)) => {
            match database::get_song_tags(&pool, &song_id).await {
                Ok(tags) => HttpResponse::Ok().json(SongTagsResponse {
                    total: tags.len(),
                    tags,
                }),
                Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: format!("Failed to fetch song tags: {}", e),
                }),
            }
        }
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

async fn add_tag_to_song(
    song_id: web::Path<String>,
    body: web::Json<AddTagToSongRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_song_by_id(&pool, &song_id).await {
        Ok(Some(_)) => {
            match database::get_tag_by_id(&pool, &body.tag_id).await {
                Ok(Some(_)) => {
                    match database::add_tag_to_song(&pool, &song_id, &body.tag_id).await {
                        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                            "status": "success",
                            "message": "Tag added to song successfully"
                        })),
                        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
                            error: "database_error".to_string(),
                            message: format!("Failed to add tag to song: {}", e),
                        }),
                    }
                }
                Ok(None) => HttpResponse::NotFound().json(ErrorResponse {
                    error: "tag_not_found".to_string(),
                    message: "Tag not found".to_string(),
                }),
                Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: format!("Failed to fetch tag: {}", e),
                }),
            }
        }
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

async fn batch_add_tags_to_song(
    song_id: web::Path<String>,
    body: web::Json<BatchAddTagsRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    match database::get_song_by_id(&pool, &song_id).await {
        Ok(Some(_)) => {
            let mut success_count = 0;
            let mut failed_tags = Vec::new();

            for tag_id in &body.tag_ids {
                match database::get_tag_by_id(&pool, tag_id).await {
                    Ok(Some(_)) => {
                        if database::add_tag_to_song(&pool, &song_id, tag_id).await.is_ok() {
                            success_count += 1;
                        } else {
                            failed_tags.push(tag_id.clone());
                        }
                    }
                    _ => {
                        failed_tags.push(tag_id.clone());
                    }
                }
            }

            HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "success_count": success_count,
                "failed_tags": failed_tags,
                "message": format!("Added {} tags to song", success_count)
            }))
        }
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

async fn remove_tag_from_song(
    path: web::Path<(String, String)>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let (song_id, tag_id) = path.into_inner();

    match database::get_song_by_id(&pool, &song_id).await {
        Ok(Some(_)) => {
            match database::remove_tag_from_song(&pool, &song_id, &tag_id).await {
                Ok(_) => HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "message": "Tag removed from song successfully"
                })),
                Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
                    error: "database_error".to_string(),
                    message: format!("Failed to remove tag from song: {}", e),
                }),
            }
        }
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

async fn get_songs_by_tags(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let empty = String::new();
    let tag_ids_str = query.get("tag_ids").unwrap_or(&empty);
    let tag_ids: Vec<String> = tag_ids_str
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if tag_ids.is_empty() {
        return HttpResponse::BadRequest().json(ErrorResponse {
            error: "missing_tag_ids".to_string(),
            message: "At least one tag_id is required".to_string(),
        });
    }

    let limit: i32 = query.get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(50);

    let match_all = query.get("match_all")
        .and_then(|m| m.parse().ok())
        .unwrap_or(true);

    let result = if match_all {
        database::get_songs_by_tags(&pool, &tag_ids, limit).await
    } else {
        database::get_songs_by_any_tags(&pool, &tag_ids, limit).await
    };

    match result {
        Ok(songs) => HttpResponse::Ok().json(SongsByTagsResponse {
            total: songs.len(),
            songs,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch songs by tags: {}", e),
        }),
    }
}

async fn record_practice(
    body: web::Json<RecordPracticeRequest>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let user_id = body.user_id.as_deref().unwrap_or("default");
    let practice_date = body.practice_date.clone().unwrap_or_else(|| {
        chrono::Utc::now().format("%Y-%m-%d").to_string()
    });

    match database::record_practice(&pool, user_id, &practice_date, body.is_hit).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": "Practice recorded successfully"
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to record practice: {}", e),
        }),
    }
}

async fn get_practice_record(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let user_id = query.get("user_id").map(|s| s.as_str()).unwrap_or("default");
    let default_date = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let practice_date = query.get("date")
        .map(|s| s.as_str())
        .unwrap_or(&default_date);

    match database::get_practice_record_by_date(&pool, user_id, practice_date).await {
        Ok(Some(record)) => HttpResponse::Ok().json(record),
        Ok(None) => HttpResponse::Ok().json(serde_json::json!({
            "user_id": user_id,
            "practice_date": practice_date,
            "total_practices": 0,
            "hit_count": 0,
            "miss_count": 0
        })),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch practice record: {}", e),
        }),
    }
}

async fn get_practice_records(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let user_id = query.get("user_id").map(|s| s.as_str()).unwrap_or("default");
    
    let result = if let (Some(start_date), Some(end_date)) = (query.get("start_date"), query.get("end_date")) {
        database::get_practice_records_range(&pool, user_id, start_date, end_date).await
    } else {
        let limit: i32 = query.get("limit")
            .and_then(|l| l.parse().ok())
            .unwrap_or(30);
        database::get_recent_practice_records(&pool, user_id, limit).await
    };

    match result {
        Ok(records) => HttpResponse::Ok().json(PracticeRecordsResponse {
            total: records.len(),
            records,
        }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch practice records: {}", e),
        }),
    }
}

async fn get_practice_summary(
    query: web::Query<std::collections::HashMap<String, String>>,
    pool: web::Data<SqlitePool>,
) -> HttpResponse {
    let user_id = query.get("user_id").map(|s| s.as_str()).unwrap_or("default");

    match database::get_practice_summary(&pool, user_id).await {
        Ok(summary) => HttpResponse::Ok().json(PracticeSummaryResponse { summary }),
        Err(e) => HttpResponse::InternalServerError().json(ErrorResponse {
            error: "database_error".to_string(),
            message: format!("Failed to fetch practice summary: {}", e),
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
    database::init_playlists_tables(&pool).await;
    database::init_review_tasks_table(&pool).await;
    database::init_tags_tables(&pool).await;
    database::init_practice_records_table(&pool).await;
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
            .route("/api/songs/{id}/similar", web::get().to(get_similar_songs))
            .route("/api/songs/{id}", web::delete().to(delete_song))
            .route("/api/history", web::get().to(get_history))
            .route("/api/rankings/top", web::get().to(get_top_songs))
            .route("/api/rankings/trending", web::get().to(get_trending_songs))
            .route("/api/failed-samples", web::get().to(list_failed_samples))
            .route("/api/failed-samples/{id}/preview", web::get().to(get_failed_sample_preview))
            .route("/api/failed-samples/{id}", web::delete().to(delete_failed_sample))
            .route("/api/failed-samples/{id}/promote", web::post().to(promote_failed_sample))
            .route("/api/playlists", web::get().to(list_playlists))
            .route("/api/playlists", web::post().to(create_playlist))
            .route("/api/playlists/{id}", web::get().to(get_playlist))
            .route("/api/playlists/{id}", web::put().to(update_playlist))
            .route("/api/playlists/{id}", web::delete().to(delete_playlist))
            .route("/api/playlists/{id}/songs", web::get().to(get_playlist_songs))
            .route("/api/playlists/{id}/songs", web::post().to(add_song_to_playlist))
            .route("/api/playlists/{playlist_id}/songs/{song_id}", web::delete().to(remove_song_from_playlist))
            .route("/api/songs/{id}/playlists", web::get().to(get_song_playlists))
            .route("/api/review-tasks", web::post().to(create_review_task))
            .route("/api/review-tasks", web::get().to(list_review_tasks))
            .route("/api/review-tasks/low-confidence", web::get().to(get_low_confidence_recognitions))
            .route("/api/review-tasks/{id}", web::get().to(get_review_task_detail))
            .route("/api/review-tasks/{id}", web::delete().to(delete_review_task))
            .route("/api/review-tasks/{id}/status", web::put().to(update_review_task_status))
            .route("/api/review-tasks/{id}/re-recognize", web::post().to(re_recognize_review_task))
            .route("/api/tags", web::post().to(create_tag))
            .route("/api/tags", web::get().to(list_tags))
            .route("/api/tags/{id}", web::get().to(get_tag))
            .route("/api/tags/{id}", web::put().to(update_tag))
            .route("/api/tags/{id}", web::delete().to(delete_tag))
            .route("/api/songs/{id}/tags", web::get().to(get_song_tags))
            .route("/api/songs/{id}/tags", web::post().to(add_tag_to_song))
            .route("/api/songs/{id}/tags/batch", web::post().to(batch_add_tags_to_song))
            .route("/api/songs/{song_id}/tags/{tag_id}", web::delete().to(remove_tag_from_song))
            .route("/api/songs/by-tags", web::get().to(get_songs_by_tags))
            .route("/api/practice/record", web::post().to(record_practice))
            .route("/api/practice/today", web::get().to(get_practice_record))
            .route("/api/practice/records", web::get().to(get_practice_records))
            .route("/api/practice/summary", web::get().to(get_practice_summary))
    }).bind("127.0.0.1:8080")?.run().await
}
