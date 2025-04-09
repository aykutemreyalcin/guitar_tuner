// Global sabitler
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A4 = 440;
const noteStabilityDelay = 300; // ms
const requiredConsistency = 3;

// Global değişkenler
let noteBuffer = [];
let audioCtx, analyser, byteData, floatData;
let lastNote = "-";
let lastNoteChangeTime = 0;
let clampedDb = 0;


// Mikrofondan ses al ve analiz için hazırlık yap
async function setupAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;

  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);

  byteData = new Uint8Array(analyser.fftSize);
  floatData = new Float32Array(analyser.fftSize);
}

// RMS kullanarak desibel hesapla ve güncelle
function updateDecibelUI() {
  analyser.getByteTimeDomainData(byteData);
  let sum = 0;
  for (let i = 0; i < byteData.length; i++) {
    const sample = (byteData[i] - 128) / 128;
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / byteData.length);
  const db = 20 * Math.log10(rms);
  const clampedDb = Math.max(0, Math.round(db + 100));

  document.getElementById("dbLevel").style.height = clampedDb + "%";

}

// Sıfır geçişlerine göre temel frekansı tahmin et
function estimateFrequency(data, sampleRate) {
  let crossings = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1] < 0 && data[i] >= 0) crossings++;
  }
  const duration = data.length / sampleRate;
  return crossings / duration / 2;
}

function getRMS(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  }

// Frekansı nota ismine dönüştür
function frequencyToNote(freq) {
  const semitones = 12 * Math.log2(freq / A4);
  const index = Math.round(semitones) + 57;
  const noteName = noteNames[index % 12];
  const octave = Math.floor(index / 12);
  return noteName + octave;
}

function getNoteFrequency(note) {
    const noteName = note.replace(/[0-9]/g, ""); // nota harfi (örneğin "A#")
    const octave = parseInt(note.replace(/[^0-9]/g, ""), 10); // oktav (örneğin 4)
  
    const noteIndex = noteNames.indexOf(noteName);
    const midiNumber = noteIndex + 12 * (octave + 1); // MIDI numarası
    return A4 * Math.pow(2, (midiNumber - 69) / 12); // frekans
  }
  

// Notayı belirli bir süreden önce değiştirme
function updateNoteUI() {
    analyser.getFloatTimeDomainData(floatData);
    const freq = estimateFrequency(floatData, audioCtx.sampleRate);
    const now = performance.now();
    const floatRMS = getRMS(floatData); // yeni bir RMS fonksiyonu kullanacağız
    if (floatRMS < 0.01) return; // çok zayıfsa atla


  
    if (freq > 50 && freq < 1500) {
      const detectedNote = frequencyToNote(freq);
      noteBuffer.push(detectedNote);
  
      if (noteBuffer.length > requiredConsistency) {
        noteBuffer.shift(); // en eskiyi at
      }
  
      const allSame = noteBuffer.every(n => n === detectedNote);
  
      if (allSame && detectedNote !== lastNote) {
        lastNote = detectedNote;
        document.getElementById("note").textContent = detectedNote;
  
        // Tuner bar
        const targetFreq = getNoteFrequency(detectedNote);
        const deviation = freq - targetFreq;
        const percent = 50 + Math.max(-50, Math.min(50, (deviation / targetFreq) * 100 * 15));
        if (!isNaN(percent)) {
          document.getElementById("tunerBar").style.width = percent + "%";
          document.getElementById("targetNote").textContent = detectedNote;
        }
      }
    }
}

// Animasyon döngüsü içinde sürekli analiz yap
function startAnalyzing() {
  function loop() {
    updateDecibelUI();
    updateNoteUI();
    requestAnimationFrame(loop);
  }
  loop();
}

// Ana fonksiyon – her şeyi başlatır
async function main() {
  try {
    await setupAudio();
    startAnalyzing();
  } catch (err) {
    console.error("Mikrofona erişilemedi:", err);
  }
}

// Sayfa yüklendiğinde başlat
window.onload = main;
