const fs = require('fs');
const path = require('path');

function generateWavFile(outputPath, durationSec = 5, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = durationSec * sampleRate;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = numSamples * numChannels * bitsPerSample / 8;
  const chunkSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const frequency = 440;
  const amplitude = 0.5;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767;
    buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Test WAV file generated: ${outputPath}`);
  console.log(`   Duration: ${durationSec}s, Sample Rate: ${sampleRate}Hz`);
  return outputPath;
}

const outputPath = path.join(__dirname, '..', 'test_data', 'test_song.wav');
generateWavFile(outputPath, 5, 44100);
