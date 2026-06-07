import os
import io
import uuid
import json
import struct
import sqlite3
import hashlib
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import wave
import numpy as np

DB_PATH = os.path.join(os.path.dirname(__file__), 'fingerprints.db')

app = Flask(__name__)
CORS(app)

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT,
            fingerprint_hash TEXT NOT NULL,
            fingerprint_peaks TEXT,
            fingerprint_robust TEXT,
            duration_sec INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ''')
    
    try:
        cursor.execute('ALTER TABLE songs ADD COLUMN fingerprint_peaks TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute('ALTER TABLE songs ADD COLUMN fingerprint_robust TEXT')
    except sqlite3.OperationalError:
        pass
    
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def read_wav_from_bytes(wav_bytes):
    try:
        wav_io = io.BytesIO(wav_bytes)
        with wave.open(wav_io, 'rb') as wav_file:
            n_channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            n_frames = wav_file.getnframes()
            
            raw_data = wav_file.readframes(n_frames)
            
            if sample_width == 2:
                dtype = np.int16
            elif sample_width == 4:
                dtype = np.int32
            else:
                dtype = np.int16
            
            samples = np.frombuffer(raw_data, dtype=dtype)
            
            if n_channels > 1:
                samples = samples[::n_channels]
            
            samples = samples.astype(np.float32)
            if np.max(np.abs(samples)) > 0:
                samples = samples / np.max(np.abs(samples))
            
            duration_sec = n_frames / sample_rate
            return samples, sample_rate, duration_sec
    except Exception as e:
        print(f"Warning: Could not parse WAV: {e}")
        return np.array([], dtype=np.float32), 44100, 5

def extract_spectral_peaks(samples, sample_rate):
    fft_size = 2048
    hop_size = 512
    peaks = []
    
    if len(samples) < fft_size:
        return peaks
    
    num_frames = (len(samples) - fft_size) // hop_size + 1
    
    for i in range(num_frames):
        offset = i * hop_size
        frame = samples[offset:offset + fft_size]
        
        windowed = frame * np.hanning(fft_size)
        fft_result = np.fft.rfft(windowed)
        magnitudes = np.abs(fft_result)
        
        for j in range(2, len(magnitudes) - 1):
            mag = magnitudes[j]
            prev = magnitudes[j - 1]
            next_mag = magnitudes[j + 1]
            if mag > prev and mag > next_mag and mag > 50.0:
                freq = j * sample_rate / fft_size
                time_ms = offset * 1000 / sample_rate
                peak_key = int(time_ms * 1000 + freq)
                peaks.append((peak_key, float(mag)))
    
    return peaks

def extract_robust_fingerprints(samples, sample_rate):
    fft_size = 2048
    hop_size = 512
    fingerprints = []
    
    if len(samples) < fft_size:
        return fingerprints
    
    freq_bands = [0, 40, 80, 120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 512]
    num_frames = (len(samples) - fft_size) // hop_size + 1
    
    for i in range(num_frames):
        if i % 4 != 0:
            continue
            
        offset = i * hop_size
        frame = samples[offset:offset + fft_size]
        windowed = frame * np.hanning(fft_size)
        fft_result = np.fft.rfft(windowed)
        magnitudes = np.abs(fft_result)
        
        band_energies = []
        for b in range(len(freq_bands) - 1):
            start = freq_bands[b]
            end = freq_bands[b + 1]
            if end > len(magnitudes):
                end = len(magnitudes)
            if start >= len(magnitudes):
                band_energies.append(0.0)
                continue
            energy = np.sum(magnitudes[start:end])
            band_energies.append(energy)
        
        bits = 0
        for b in range(len(band_energies) - 1):
            if band_energies[b] > band_energies[b + 1]:
                bits |= 1 << b
        
        fingerprints.append(bits)
    
    return fingerprints

def generate_hash_from_peaks(peaks):
    hash_obj = hashlib.sha256()
    for k, v in peaks[:200]:
        hash_obj.update(struct.pack('<Qf', k & 0xFFFFFFFFFFFFFFFF, v))
    return hash_obj.hexdigest()[:16]

def calculate_similarity(peaks1, peaks2):
    if not peaks1 or not peaks2:
        return 0.0
    
    freqs1 = set(k % 1000 for k, _ in peaks1)
    freqs2 = set(k % 1000 for k, _ in peaks2)
    
    intersection = len(freqs1 & freqs2)
    union = len(freqs1 | freqs2)
    
    if union == 0:
        return 0.0
    return intersection / union

def calculate_robust_similarity(fp1, fp2):
    if not fp1 or not fp2:
        return 0.0
    
    matches = 0
    window_size = 5
    
    for i in range(max(0, len(fp1) - window_size)):
        slice1 = set(fp1[i:i + window_size])
        for j in range(max(0, len(fp2) - window_size)):
            slice2 = set(fp2[j:j + window_size])
            common = len(slice1 & slice2)
            if common >= 3:
                matches += 1
                break
    
    total_windows = max(1, max(0, len(fp1) - window_size))
    return matches / total_windows

def calculate_hash_similarity(hash1, hash2):
    try:
        a = int(hash1, 16)
        b = int(hash2, 16)
        dist = bin(a ^ b).count('1')
        return 1.0 - (dist / 64.0)
    except:
        return 0.0

def process_audio(wav_bytes):
    samples, sample_rate, duration_sec = read_wav_from_bytes(wav_bytes)
    peaks = extract_spectral_peaks(samples, sample_rate)
    robust = extract_robust_fingerprints(samples, sample_rate)
    fingerprint_hash = generate_hash_from_peaks(peaks)
    return fingerprint_hash, duration_sec, peaks, robust

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'Audio Fingerprint Service (Python + SQLite)'
    })

@app.route('/api/songs', methods=['GET'])
def list_songs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust,
               duration_sec, created_at
        FROM songs ORDER BY created_at DESC
    ''')
    rows = cursor.fetchall()
    songs = []
    for row in rows:
        songs.append({
            'id': row['id'],
            'title': row['title'],
            'artist': row['artist'],
            'fingerprint_hash': row['fingerprint_hash'],
            'fingerprint_peaks': row['fingerprint_peaks'],
            'fingerprint_robust': row['fingerprint_robust'],
            'duration_sec': row['duration_sec'],
            'created_at': row['created_at']
        })
    conn.close()
    return jsonify(songs)

@app.route('/api/songs/upload', methods=['POST'])
def upload_song():
    if 'title' not in request.form:
        return jsonify({
            'error': 'missing_title',
            'message': 'Song title is required'
        }), 400

    title = request.form['title'].strip()
    if not title:
        return jsonify({
            'error': 'missing_title',
            'message': 'Song title is required'
        }), 400

    artist = request.form.get('artist', '').strip() or None

    if 'file' not in request.files:
        return jsonify({
            'error': 'missing_file',
            'message': 'Audio file is required'
        }), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({
            'error': 'missing_file',
            'message': 'Audio file is required'
        }), 400

    try:
        wav_bytes = file.read()
        fingerprint_hash, duration_sec, peaks, robust = process_audio(wav_bytes)
        
        peaks_json = json.dumps(peaks) if peaks else None
        robust_json = json.dumps(robust) if robust else None
        duration_sec_int = max(1, int(duration_sec))
        
        song_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO songs (id, title, artist, fingerprint_hash, fingerprint_peaks, 
                              fingerprint_robust, duration_sec, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (song_id, title, artist, fingerprint_hash, peaks_json, robust_json, 
              duration_sec_int, created_at))
        conn.commit()
        conn.close()

        print(f"✅ Song uploaded: {title} (ID: {song_id})")
        print(f"   Fingerprint: {fingerprint_hash}")
        print(f"   Duration: {duration_sec_int}s")
        print(f"   Peaks: {len(peaks)}, Robust FPS: {len(robust)}")

        return jsonify({
            'id': song_id,
            'title': title,
            'artist': artist,
            'fingerprint_hash': fingerprint_hash,
            'duration_sec': duration_sec_int,
            'status': 'success',
            'message': 'Song uploaded and fingerprinted successfully'
        })

    except Exception as e:
        print(f"Error processing upload: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'audio_processing_error',
            'message': f'Failed to process audio file: {str(e)}'
        }), 400

@app.route('/api/recognize', methods=['POST'])
def recognize():
    if 'file' not in request.files:
        return jsonify({
            'match_found': False,
            'song': None,
            'confidence': 0.0,
            'processing_time_ms': 0
        })
    
    import time
    start = time.time()
    
    try:
        file = request.files['file']
        wav_bytes = file.read()
        
        input_hash, _, input_peaks, input_robust = process_audio(wav_bytes)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, title, artist, fingerprint_hash, fingerprint_peaks, fingerprint_robust,
                   duration_sec
            FROM songs
        ''')
        rows = cursor.fetchall()
        conn.close()
        
        best_match = None
        best_confidence = 0.0
        
        for row in rows:
            max_sim = 0.0
            
            if row['fingerprint_robust']:
                try:
                    stored_robust = json.loads(row['fingerprint_robust'])
                    sim = calculate_robust_similarity(input_robust, stored_robust)
                    max_sim = max(max_sim, sim * 1.2)
                except:
                    pass
            
            if row['fingerprint_peaks']:
                try:
                    stored_peaks = json.loads(row['fingerprint_peaks'])
                    sim = calculate_similarity(input_peaks, stored_peaks)
                    max_sim = max(max_sim, sim)
                except:
                    pass
            
            if max_sim < 0.05:
                hash_sim = calculate_hash_similarity(input_hash, row['fingerprint_hash'])
                max_sim = max(max_sim, hash_sim * 0.8)
            
            if max_sim > best_confidence:
                best_confidence = max_sim
                best_match = row
        
        processing_time_ms = int((time.time() - start) * 1000)
        confidence_threshold = 0.15
        
        if best_match and best_confidence >= confidence_threshold:
            return jsonify({
                'match_found': True,
                'song': {
                    'id': best_match['id'],
                    'title': best_match['title'],
                    'artist': best_match['artist'],
                    'duration_sec': best_match['duration_sec']
                },
                'confidence': min(best_confidence, 1.0),
                'processing_time_ms': processing_time_ms
            })
        else:
            return jsonify({
                'match_found': False,
                'song': None,
                'confidence': 0.0,
                'processing_time_ms': processing_time_ms
            })
            
    except Exception as e:
        print(f"Error in recognize: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'match_found': False,
            'song': None,
            'confidence': 0.0,
            'processing_time_ms': 0
        })

if __name__ == '__main__':
    init_db()
    print("=" * 60)
    print("🎵 Real Audio Fingerprint Server (Python + SQLite)")
    print("=" * 60)
    print("Server running on http://127.0.0.1:8080")
    print()
    print("Database:", DB_PATH)
    print()
    print("Available endpoints:")
    print("  GET  /api/health       - Health check")
    print("  GET  /api/songs        - List all songs from SQLite")
    print("  POST /api/songs/upload - Upload a new song (writes to SQLite)")
    print("  POST /api/recognize    - Recognize audio (multipart file upload)")
    print()
    print("💡 Features:")
    print("   - REAL FFT-based fingerprinting")
    print("   - 3-level matching: robust FPS -> peaks -> hash")
    print("   - SQLite persistence")
    print("=" * 60)
    app.run(host='127.0.0.1', port=8080, debug=False)
