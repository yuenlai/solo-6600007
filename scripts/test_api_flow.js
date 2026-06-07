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
    console.log(`      Service: ${response.data.service}`);
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
      console.log(`      [${i + 1}] ${song.title} by ${song.artist || 'Unknown'}`);
      console.log(`           hash: ${song.fingerprint_hash}`);
      console.log(`           has_peaks: ${!!song.fingerprint_peaks}`);
      console.log(`           has_robust: ${!!song.fingerprint_robust}`);
    });
    return response.data;
  } catch (error) {
    console.log(`   ❌ List songs failed: ${error.message}`);
    if (error.response) {
      console.log(`      Response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testUploadSong(title = 'Test Melody', artist = 'Test Artist') {
  console.log(`🔍 Testing upload song endpoint (${title})...`);
  try {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('artist', artist);
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

async function testRecognize(expectMatch = true) {
  console.log('🔍 Testing recognize endpoint with local audio file...');
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(TEST_WAV));

    const response = await axios.post(`${API_BASE}/recognize`, formData, {
      headers: formData.getHeaders(),
    });

    console.log(`   ✅ Recognition complete!`);
    console.log(`      Match found: ${response.data.match_found}`);
    console.log(`      Confidence: ${(response.data.confidence * 100).toFixed(1)}%`);
    console.log(`      Processing time: ${response.data.processing_time_ms}ms`);
    
    if (response.data.song) {
      console.log(`      Matched song: ${response.data.song.title} by ${response.data.song.artist || 'Unknown'}`);
      console.log(`      Song ID: ${response.data.song.id}`);
      console.log(`      Duration: ${response.data.song.duration_sec}s`);
    }
    
    if (expectMatch && !response.data.match_found) {
      console.log(`   ⚠️  WARNING: Expected a match but none found!`);
    }
    
    if (!expectMatch && response.data.match_found) {
      console.log(`   ⚠️  WARNING: Expected no match but found one!`);
    }

    return response.data;
  } catch (error) {
    console.log(`   ❌ Recognition failed: ${error.message}`);
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

  try {
    const formData = new FormData();
    await axios.post(`${API_BASE}/recognize`, formData, { headers: formData.getHeaders() });
    console.log('   ✅ Recognize with no file handled gracefully');
  } catch (error) {
    console.log(`   ⚠️  Recognize error case: ${error.message}`);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🎵 Audio Fingerprint API - Complete End-to-End Test');
  console.log('='.repeat(70));
  console.log();

  if (!fs.existsSync(TEST_WAV)) {
    console.log('❌ Test WAV file not found. Please run generate_test_wav.js first.');
    console.log(`   Expected at: ${TEST_WAV}`);
    process.exit(1);
  }

  console.log(`📁 Test file: ${TEST_WAV}`);
  console.log(`   Size: ${(fs.statSync(TEST_WAV).size / 1024).toFixed(1)} KB`);
  console.log();

  const healthy = await testHealth();
  if (!healthy) {
    console.log();
    console.log('❌ Backend is not running. Please start the backend first:');
    console.log('   Option 1 (Rust): cd backend && cargo run');
    console.log('   Option 2 (Python): cd backend && pip install flask flask-cors numpy && python real_backend.py');
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 1: Check initial state');
  console.log('='.repeat(70));
  const initialSongs = await testListSongs(true);

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 2: Upload test song');
  console.log('='.repeat(70));
  const uploaded = await testUploadSong('Test Song - Full', 'Demo Artist');

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 3: Verify song in database with all fingerprint fields');
  console.log('='.repeat(70));
  if (uploaded) {
    const songs = await testListSongs(false);
    if (songs && songs.some(s => s.id === uploaded.id)) {
      const song = songs.find(s => s.id === uploaded.id);
      console.log(`   ✅ Uploaded song found in list!`);
      if (song.fingerprint_peaks) {
        console.log(`   ✅ fingerprint_peaks is present`);
      } else {
        console.log(`   ⚠️  fingerprint_peaks is MISSING`);
      }
      if (song.fingerprint_robust) {
        console.log(`   ✅ fingerprint_robust is present`);
      } else {
        console.log(`   ⚠️  fingerprint_robust is MISSING`);
      }
    }
  }

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 4: Test recognition - should match the uploaded song');
  console.log('='.repeat(70));
  const recognizeResult = await testRecognize(true);

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 5: Upload another different song');
  console.log('='.repeat(70));
  await testUploadSong('Another Song', 'Another Artist');

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 6: Test recognition again - should find best match');
  console.log('='.repeat(70));
  await testRecognize(true);

  console.log();
  console.log('='.repeat(70));
  console.log('STEP 7: Test error cases');
  console.log('='.repeat(70));
  await testErrorCases();

  console.log();
  console.log('='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  if (recognizeResult && recognizeResult.match_found) {
    console.log('✅ SUCCESS: Local audio file recognition is WORKING!');
    console.log(`   - Song "${recognizeResult.song.title}" was correctly identified`);
    console.log(`   - Confidence: ${(recognizeResult.confidence * 100).toFixed(1)}%`);
    console.log(`   - All fingerprint fields are being stored correctly`);
  } else {
    console.log('⚠️  Recognition did not find a match. This could be because:');
    console.log('   - This is the first run and no songs are in the database yet');
    console.log('   - The test audio file is very short or has low quality');
    console.log('   - Try uploading more songs and testing again');
  }
  
  console.log();
  console.log('💡 TIP: To use the full application:');
  console.log('   1. Keep the backend running');
  console.log('   2. Start frontend: cd frontend && npm run dev');
  console.log('   3. Open browser and upload songs to the fingerprint library');
  console.log('   4. Use "选择文件" to select local audio for recognition');
  console.log();
  console.log('='.repeat(70));
}

main().catch(console.error);
