const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

let songs = [];

function generateFingerprintHash(buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex').substring(0, 16);
}

function calculateDuration(buffer) {
  if (buffer.length < 44) return 5;
  const sampleRate = buffer.readUInt32LE(24);
  const dataSize = buffer.readUInt32LE(40);
  const bitsPerSample = buffer.readUInt16LE(34);
  const numChannels = buffer.readUInt16LE(22);
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = dataSize / (numChannels * bytesPerSample);
  return Math.round(totalSamples / sampleRate);
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Audio Fingerprint Service (Mock)' });
});

app.get('/api/songs', (req, res) => {
  res.json(songs);
});

app.post('/api/songs/upload', upload.single('file'), (req, res) => {
  const { title, artist } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({
      error: 'missing_title',
      message: 'Song title is required',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: 'missing_file',
      message: 'Audio file is required',
    });
  }

  try {
    const fingerprintHash = generateFingerprintHash(req.file.buffer);
    const durationSec = calculateDuration(req.file.buffer);
    const songId = uuidv4();
    const now = new Date().toISOString();

    const newSong = {
      id: songId,
      title: title.trim(),
      artist: artist ? artist.trim() : null,
      fingerprint_hash: fingerprintHash,
      duration_sec: durationSec,
      created_at: now,
    };

    songs.unshift(newSong);

    console.log(`✅ Song uploaded: ${newSong.title} (ID: ${songId})`);
    console.log(`   Fingerprint: ${fingerprintHash}`);
    console.log(`   Duration: ${durationSec}s`);

    res.json({
      id: songId,
      title: newSong.title,
      artist: newSong.artist,
      fingerprint_hash: fingerprintHash,
      duration_sec: durationSec,
      status: 'success',
      message: 'Song uploaded and fingerprinted successfully',
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(400).json({
      error: 'audio_processing_error',
      message: `Failed to process audio file: ${error.message}`,
    });
  }
});

app.post('/api/recognize', (req, res) => {
  const audioHash = req.body.audio_hash || '';
  res.json({
    match: audioHash !== '',
    song: { title: 'Unknown Track', artist: 'Unknown', confidence: 0.0 },
    processing_time_ms: 42,
  });
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🎵 Mock Audio Fingerprint Server');
  console.log('='.repeat(60));
  console.log(`Server running on http://127.0.0.1:${PORT}`);
  console.log();
  console.log('Available endpoints:');
  console.log('  GET  /api/health       - Health check');
  console.log('  GET  /api/songs        - List all songs');
  console.log('  POST /api/songs/upload - Upload a new song (multipart/form-data)');
  console.log('  POST /api/recognize    - Recognize audio');
  console.log();
  console.log('Upload fields:');
  console.log('  title  - Song title (required)');
  console.log('  artist - Artist name (optional)');
  console.log('  file   - WAV audio file (required)');
  console.log();
  console.log('💡 This is a MOCK backend for testing the full flow.');
  console.log('   For production, use the Rust backend.');
  console.log('='.repeat(60));
});
