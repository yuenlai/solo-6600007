const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:8080/api';
const TEST_WAV = path.join(__dirname, '..', 'test_data', 'test_song.wav');

async function testHealth() {
  console.log('🔍 Testing health endpoint...');
  try {
    const response = await axios.get(`${API_BASE}/health`);
    console.log(`   ✅ Health check passed: ${response.data.status}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function testListSongs(expectEmpty = true) {
  console.log('🔍 Testing list songs endpoint...');
  try {
    const response = await axios.get(`${API_BASE}/songs`);
    console.log(`   ✅ Got ${response.data.length} songs`);
    if (expectEmpty && response.data.length === 0) {
      console.log('   ✅ Database is empty as expected');
    }
    response.data.forEach((song, i) => {
      console.log(`      [${i + 1}] ${song.title} by ${song.artist || 'Unknown'} (hash: ${song.fingerprint_hash})`);
    });
    return response.data;
  } catch (error) {
    console.log(`   ❌ List songs failed: ${error.message}`);
    return null;
  }
}

async function testUploadSong() {
  console.log('🔍 Testing upload song endpoint...');
  try {
    const formData = new FormData();
    formData.append('title', 'Test Melody');
    formData.append('artist', 'Test Artist');
    formData.append('file', fs.createReadStream(TEST_WAV));

    const response = await axios.post(`${API_BASE}/songs/upload`, formData, {
      headers: formData.getHeaders(),
    });

    console.log(`   ✅ Upload successful!`);
    console.log(`      ID: ${response.data.id}`);
    console.log(`      Title: ${response.data.title}`);
    console.log(`      Artist: ${response.data.artist}`);
    console.log(`      Fingerprint: ${response.data.fingerprint_hash}`);
    console.log(`      Duration: ${response.data.duration_sec}s`);
    console.log(`      Status: ${response.data.status}`);
    return response.data;
  } catch (error) {
    console.log(`   ❌ Upload failed: ${error.message}`);
    if (error.response) {
      console.log(`      Response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testErrorCases() {
  console.log('🔍 Testing error cases...');

  try {
    const formData = new FormData();
    formData.append('title', '');
    formData.append('file', fs.createReadStream(TEST_WAV));
    await axios.post(`${API_BASE}/songs/upload`, formData, { headers: formData.getHeaders() });
    console.log('   ❌ Should have failed with empty title');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('   ✅ Correctly rejected empty title');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }

  try {
    const formData = new FormData();
    formData.append('title', 'No File');
    await axios.post(`${API_BASE}/songs/upload`, formData, { headers: formData.getHeaders() });
    console.log('   ❌ Should have failed with missing file');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('   ✅ Correctly rejected missing file');
    } else {
      console.log(`   ⚠️  Unexpected error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🎵 Audio Fingerprint API End-to-End Test');
  console.log('='.repeat(60));
  console.log();

  if (!fs.existsSync(TEST_WAV)) {
    console.log('❌ Test WAV file not found. Please run generate_test_wav.js first.');
    process.exit(1);
  }

  const healthy = await testHealth();
  if (!healthy) {
    console.log();
    console.log('❌ Backend is not running. Please start the backend first:');
    console.log('   cd backend && cargo run');
    process.exit(1);
  }

  console.log();
  await testListSongs(true);

  console.log();
  const uploaded = await testUploadSong();

  console.log();
  if (uploaded) {
    const songs = await testListSongs(false);
    if (songs && songs.some(s => s.id === uploaded.id)) {
      console.log('   ✅ Uploaded song found in list!');
    }
  }

  console.log();
  await testErrorCases();

  console.log();
  console.log('='.repeat(60));
  console.log('✅ All tests completed!');
  console.log('='.repeat(60));
}

main().catch(console.error);
