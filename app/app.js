// Music Player - Android Version with MediaSession
// ใช้ IndexedDB, MediaSession API, SVG icons
// Version: 3.1 - เพิ่ม Queue State Persistence

const audio = document.getElementById('audio');
const playPauseBtn = document.getElementById('playPause');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const loopBtn = document.getElementById('loopBtn');
const trackName = document.getElementById('trackName');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const progressBar = document.getElementById('progressBar');
const progress = document.getElementById('progress');
const playlist = document.getElementById('playlist');
const queueList = document.getElementById('queueList');
const queueCount = document.getElementById('queueCount');
const queueCount2 = document.getElementById('queueCount2');
const clearQueueBtn = document.getElementById('clearQueue');
const shuffleQueueBtn = document.getElementById('shuffleQueue');
const selectAllBtn = document.getElementById('selectAll');
const addSelectedBtn = document.getElementById('addSelected');
const selectedCount = document.getElementById('selectedCount');
const apiUrlInput = document.getElementById('apiUrl');
const youtubeUrlInput = document.getElementById('youtubeUrl');
const downloadBtn = document.getElementById('downloadBtn');
const downloadBtnText = document.getElementById('downloadBtnText');
const statusList = document.getElementById('statusList');

// SVG Icons
const SVG_ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 4l10 8-10 8V4zm12 0h2v16h-2V4z"/></svg>',
  previous: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 4h2v16H6V4zm4 8l10-8v16l-10-8z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
  playing: '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'
};

// ตัวแปร
let musicFiles = [];
let queue = [];
let currentTrackIndex = -1;
let currentPlayingFile = null;
let selectedTracks = new Set();
let draggedElement = null;
let draggedIndex = null;
let wave = null;
let isLoopEnabled = false;

// IndexedDB
const DB_NAME = 'TATMusicDB';
const DB_VERSION = 1;
const STORE_NAME = 'musicFiles';
let db = null;

// Initialize IndexedDB
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
      }
    };
  });
}

async function saveMusicToDB(name, blob) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.add({ name: name, blob: blob, addedAt: Date.now() });

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadMusicFromDB() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => {
      const files = request.result.map(item => {
        const url = URL.createObjectURL(item.blob);
        return {
          id: item.id,
          name: item.name,
          url: url,
          // ⭐ ไม่เก็บ blob ใน memory - เอาไว้แค่ใน IndexedDB
          blob: null
        };
      });
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteMusicFromDB(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== QUEUE STATE PERSISTENCE ====================

// บันทึก Queue State
function saveQueueState() {
  try {
    const queueState = {
      queue: queue,
      currentTrackIndex: currentTrackIndex,
      currentPlayingFile: currentPlayingFile,
      currentTime: audio.currentTime || 0,
      isPlaying: !audio.paused,
      timestamp: Date.now()
    };

    localStorage.setItem('queueState', JSON.stringify(queueState));
    console.log('Queue state saved:', queueState);
  } catch (e) {
    console.error('Error saving queue state:', e);
  }
}

// โหลด Queue State
function loadQueueState() {
  try {
    const saved = localStorage.getItem('queueState');
    if (!saved) return null;

    const queueState = JSON.parse(saved);

    // ตรวจสอบว่าข้อมูลไม่เก่าเกิน 7 วัน
    const daysSinceLastSave = (Date.now() - queueState.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSave > 7) {
      console.log('Queue state expired (older than 7 days)');
      localStorage.removeItem('queueState');
      return null;
    }

    console.log('Queue state loaded:', queueState);
    return queueState;
  } catch (e) {
    console.error('Error loading queue state:', e);
    return null;
  }
}

// กู้คืน Queue State
async function restoreQueueState() {
  const savedState = loadQueueState();
  if (!savedState) return false;

  try {
    // ตรวจสอบว่าไฟล์ในคิวยังมีอยู่
    const validQueue = savedState.queue.filter(fileIndex =>
      fileIndex >= 0 && fileIndex < musicFiles.length
    );

    if (validQueue.length === 0) {
      console.log('No valid tracks in saved queue');
      return false;
    }

    // กู้คืนคิว
    queue = validQueue;

    // กู้คืนตำแหน่งปัจจุบัน
    if (savedState.currentTrackIndex >= 0 && savedState.currentTrackIndex < queue.length) {
      currentTrackIndex = savedState.currentTrackIndex;
      const fileIndex = queue[currentTrackIndex];
      const file = musicFiles[fileIndex];

      currentPlayingFile = file.name;
      trackName.textContent = file.name;
      audio.src = file.url;

      // กู้คืนตำแหน่งเพลง
      if (savedState.currentTime > 0) {
        audio.addEventListener('loadedmetadata', function onLoaded() {
          audio.removeEventListener('loadedmetadata', onLoaded);

          // ตั้งเวลาให้ตรงกับที่บันทึกไว้
          if (savedState.currentTime < audio.duration) {
            audio.currentTime = savedState.currentTime;
          }

          updateMediaSession();
        });
      }

      // เล่นต่อถ้ากำลังเล่นอยู่
      if (savedState.isPlaying) {
        audio.play().catch(e => console.log('Auto-play prevented:', e));
      }
    }

    renderQueue();
    updateMediaSession();

    console.log('Queue state restored successfully');
    return true;
  } catch (e) {
    console.error('Error restoring queue state:', e);
    return false;
  }
}

// ล้าง Queue State
function clearQueueState() {
  try {
    localStorage.removeItem('queueState');
    console.log('Queue state cleared');
  } catch (e) {
    console.error('Error clearing queue state:', e);
  }
}

// ================================================================

// Load settings
function loadSettings() {
  const saved = localStorage.getItem('loopEnabled');
  if (saved !== null) {
    isLoopEnabled = JSON.parse(saved);
    updateLoopButton();
  }

  // โหลด API URL
  const savedApiUrl = localStorage.getItem('apiUrl');
  if (savedApiUrl) {
    apiUrlInput.value = savedApiUrl;
  }
}

function saveApiUrl() {
  const apiUrl = apiUrlInput.value.trim();
  if (apiUrl) {
    localStorage.setItem('apiUrl', apiUrl);
  }
}

function saveLoopSetting() {
  localStorage.setItem('loopEnabled', JSON.stringify(isLoopEnabled));
}

function updateLoopButton() {
  if (isLoopEnabled) {
    loopBtn.classList.add('active');
    loopBtn.title = 'Loop: ON';
  } else {
    loopBtn.classList.remove('active');
    loopBtn.title = 'Loop: OFF';
  }

  // ส่งสถานะไปยัง notification
  if (typeof AndroidMediaController !== 'undefined') {
    AndroidMediaController.updateLoopState(isLoopEnabled);
  }
}

// Update MediaSession
function updateMediaSession() {
  if (typeof AndroidMediaController !== 'undefined') {
    const title = currentPlayingFile || 'No track playing';
    const artist = 'TATMusic';
    const playing = !audio.paused;

    AndroidMediaController.updateMetadata(title, artist, playing);
    AndroidMediaController.updatePlaybackState(playing);

    // ส่ง duration ทันทีถ้ามี
    if (!isNaN(audio.duration) && audio.duration > 0) {
      const position = Math.floor(audio.currentTime * 1000);
      const totalDuration = Math.floor(audio.duration * 1000);
      AndroidMediaController.updateProgress(position, totalDuration);
    }
  }
}

// Global functions สำหรับควบคุมเพลง
window.handlePlayPause = function() {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
};

window.handleNext = function() {
  if (currentTrackIndex < queue.length - 1) {
    playFromQueue(currentTrackIndex + 1);
  } else if (isLoopEnabled && queue.length > 0) {
    playFromQueue(0);
  }
};

window.handlePrevious = function() {
  if (currentTrackIndex > 0) {
    playFromQueue(currentTrackIndex - 1);
  } else if (isLoopEnabled && queue.length > 0) {
    playFromQueue(queue.length - 1);
  }
};

window.handleStop = function() {
  audio.pause();
  audio.currentTime = 0;
};

window.handleLoop = function() {
  isLoopEnabled = !isLoopEnabled;
  saveLoopSetting();
  updateLoopButton();
};

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.page).classList.add('active');
  });
});

// Initialize Wave.js
function initWave() {
  try {
    const canvasElement = document.getElementById('waveform');
    canvasElement.width = 800;
    canvasElement.height = 400;

    if (typeof Wave === 'undefined') {
      console.warn('Wave.js not loaded');
      canvasElement.parentElement.innerHTML = '<div style="color:#ff6b35;padding:20px;text-align:center;font-size:12px;">Wave.js loading...</div>';
      return;
    }

    wave = new Wave(audio, canvasElement);

    wave.addAnimation(new wave.animations.Wave({
      count: 50,
      fillColor: '#ff6b35',
      rounded: true
    }));

    console.log('Wave.js initialized successfully');
  } catch (e) {
    console.error('Wave.js error:', e);
    const container = document.querySelector('.waveform-container');
    if (container) {
      container.innerHTML = '<div style="color:#ff4444;padding:20px;text-align:center;font-size:11px;">Visualizer error</div>';
    }
  }
}

// Load music files
async function loadMusicFiles() {
  try {
    await initDB();
    musicFiles = await loadMusicFromDB();
    console.log('Loaded', musicFiles.length, 'music files from IndexedDB');
    renderPlaylist();

    // 🔥 กู้คืน Queue State หลังจากโหลดไฟล์เสร็จ
    await restoreQueueState();
  } catch (e) {
    console.error('Error loading music files:', e);
    musicFiles = [];
    renderPlaylist();
  }
}

// ฟังก์ชันบีบอัดไฟล์เสียงเพื่อลดขนาด (ใช้ Web Audio API)
async function compressAudio(blob) {
  try {
    // ถ้าไฟล์เล็กกว่า 5MB ไม่ต้องบีบอัด
    if (blob.size < 5 * 1024 * 1024) {
      return blob;
    }

    window.addDownloadStatus('🔄 Compressing audio to save space...', 'info');

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // ลด sample rate และ channels เพื่อลดขนาด
    const targetSampleRate = 22050; // ลดจาก 44100 เหลือ 22050 Hz (ประหยัด 50%)
    const targetChannels = 1; // แปลงเป็น mono (ประหยัด 50%)

    // สร้าง offline context สำหรับ re-encode
    const offlineContext = new OfflineAudioContext(
      targetChannels,
      audioBuffer.duration * targetSampleRate,
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    const renderedBuffer = await offlineContext.startRendering();

    // แปลง AudioBuffer เป็น WAV (ชั่วคราว)
    const wav = audioBufferToWav(renderedBuffer);
    const compressedBlob = new Blob([wav], { type: 'audio/wav' });

    const compressionRatio = ((1 - compressedBlob.size / blob.size) * 100).toFixed(1);
    window.addDownloadStatus(`✓ Compressed: ${compressionRatio}% smaller`, 'success');

    return compressedBlob;
  } catch (e) {
    console.error('Compression error:', e);
    window.addDownloadStatus('⚠ Using original file (compression failed)', 'warning');
    return blob; // ถ้าบีบอัดไม่ได้ ใช้ไฟล์เดิม
  }
}

// แปลง AudioBuffer เป็น WAV
function audioBufferToWav(buffer) {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  view.setUint16(32, buffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  // Audio data
  const offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset + (i * buffer.numberOfChannels + channel) * 2, sample * 0x7FFF, true);
    }
  }

  return arrayBuffer;
}

async function addMusicFile(filename, blob) {
  try {
    // บีบอัดไฟล์ก่อนบันทึก
    const compressedBlob = await compressAudio(blob);

    const id = await saveMusicToDB(filename, compressedBlob);
    const url = URL.createObjectURL(compressedBlob);
    musicFiles.push({
      id: id,
      name: filename,
      url: url,
      blob: null // ⭐ ไม่เก็บ blob ใน memory
    });
    renderPlaylist();
  } catch (e) {
    console.error('Error saving music file:', e);
  }
}
// ฟังก์ชันทำความสะอาด Memory
function cleanupMemory() {
  // ลบ Object URLs ที่ไม่ได้ใช้แล้ว
  musicFiles.forEach(file => {
    if (file.blob) {
      file.blob = null;
      delete file.blob;
    }
  });

  // Force garbage collection hint
  if (window.gc) {
    window.gc();
  }

  console.log('Memory cleanup completed');
}

// เรียกทำความสะอาดทุกๆ 30 วินาที
setInterval(cleanupMemory, 30000);
async function removeMusicFile(index) {
  try {
    const file = musicFiles[index];

    // ❌ หยุดการใช้งานไฟล์ก่อน
    // ถ้าเป็นเพลงที่กำลังเล่น ต้องหยุดก่อน
    if (audio.src === file.url) {
      audio.pause();
      audio.src = '';
      audio.load(); // บังคับให้ปล่อย resource
    }

    // ✅ ปล่อย Object URL ก่อน
    if (file.url) {
      URL.revokeObjectURL(file.url);
      file.url = null;
    }

    // ✅ ลบ Blob reference
    if (file.blob) {
      file.blob = null;
      delete file.blob;
    }

    // ✅ ลบจาก IndexedDB
    if (file.id) {
      await deleteMusicFromDB(file.id);
    }

    // ลบจาก array
    musicFiles.splice(index, 1);

    // Force garbage collection hint
    if (window.gc) window.gc();

    renderPlaylist();

    console.log('File deleted, remaining files:', musicFiles.length);
  } catch (e) {
    console.error('Error removing music file:', e);
  }
}

// ฟังก์ชันดาวน์โหลด Blob ไฟล์ลงเครื่อง
async function downloadTrackToDevice(index) {
  const file = musicFiles[index];

  try {
    // ดึง Blob จาก IndexedDB
    const blob = await new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.get(file.id);

      request.onsuccess = () => {
        if (request.result && request.result.blob) {
          resolve(request.result.blob);
        } else {
          reject(new Error('Blob not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });

    if (typeof AndroidMediaController !== 'undefined') {
      // ===== Android (Java Interface) =====
      const reader = new FileReader();
      reader.onload = function () {
        const base64 = reader.result.split(',')[1];
        AndroidMediaController.downloadToDevice(file.name, base64);
      };
      reader.readAsDataURL(blob);

    } else if (window.electronAPI && window.electronAPI.saveFile) {
      // ===== Electron =====
      blob.arrayBuffer().then(buf => {
        window.electronAPI.saveFile(buf, file.name);

        // แจ้งสถานะ (ใช้ของเดิมคุณ)
        window.addDownloadStatus(`✓ Saved to Music: ${file.name}`, 'success');
      });

    } else {
      // ===== Web / Android WebView ปกติ =====
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      // แสดงข้อความยืนยันบน web
      window.addDownloadStatus(`✓ Downloaded: ${file.name}`, 'success');
    }

  } catch (error) {
    console.error('Download error:', error);
    window.addDownloadStatus(`✗ Error: ${error.message}`, 'error');
  }
}

// ฟังก์ชันแสดงสถานะการดาวน์โหลด (เรียกจาก Android และ Web)
window.addDownloadStatus = function(message, type = 'info') {
  // ไม่เปลี่ยนแท็บ - แสดงเฉพาะในหน้า Status เท่านั้น

  if (typeof window.showActionStatus === 'function') {
    window.showActionStatus(message, type);
  }
  // เพิ่มสถานะใน status list
  if (statusList.querySelector('.no-status')) {
    statusList.innerHTML = '';
  }

  const statusItem = document.createElement('div');
  statusItem.className = `status-item status-${type}`;

  const icon = type === 'success' ? '✓' :
               type === 'error' ? '✗' :
               type === 'warning' ? '⚠' : 'ℹ';

  statusItem.innerHTML = `
    <span class="status-icon">${icon}</span>
    <span class="status-text">${message}</span>
  `;

  statusList.insertBefore(statusItem, statusList.firstChild);

  while (statusList.children.length > 10) {
    statusList.removeChild(statusList.lastChild);
  }
};

async function deleteTrack(index) {
  const file = musicFiles[index];

  try {
    // เก็บสถานะว่ากำลังเล่นอยู่หรือไม่
    const wasPlaying = !audio.paused;
    const wasCurrentTrack = currentPlayingFile === file.name;

    // ✅ หยุดเพลงและปล่อย resource ทันที
    if (wasCurrentTrack) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.load(); // ⭐ สำคัญมาก - บังคับให้ปล่อย resource
    }

    // ลบออกจาก selectedTracks
    if (selectedTracks.has(index)) {
      selectedTracks.delete(index);
    }

    // ปรับ selectedTracks index
    const newSelected = new Set();
    selectedTracks.forEach(i => {
      if (i < index) newSelected.add(i);
      else if (i > index) newSelected.add(i - 1);
    });
    selectedTracks = newSelected;

    // ✅ ลบไฟล์ (จะ revoke URL และลบ blob ใน removeMusicFile)
    await removeMusicFile(index);

    // ปรับ queue
    const oldQueueIndex = queue.indexOf(index);
    queue = queue.filter(i => i !== index).map(i => i > index ? i - 1 : i);

    // ตรวจสอบว่าต้องเล่นเพลงใหม่หรือไม่
    if (wasCurrentTrack) {
      if (queue.length > 0) {
        let nextIndex = oldQueueIndex;

        if (nextIndex >= queue.length) {
          nextIndex = queue.length - 1;
        }

        currentTrackIndex = nextIndex;
        const fileIndex = queue[currentTrackIndex];
        const newFile = musicFiles[fileIndex];

        currentPlayingFile = newFile.name;
        trackName.textContent = newFile.name;
        audio.src = newFile.url;

        audio.addEventListener('loadedmetadata', function onLoaded() {
          audio.removeEventListener('loadedmetadata', onLoaded);
          updateMediaSession();
        });

        if (wasPlaying) {
          audio.play().catch(e => console.error('Play error:', e));
        }

        updateMediaSession();
      } else {
        trackName.textContent = 'No track playing';
        currentPlayingFile = null;
        currentTrackIndex = -1;

        currentTimeEl.textContent = '0:00';
        durationEl.textContent = '0:00';
        progress.style.width = '0%';
        playPauseBtn.innerHTML = SVG_ICONS.play;

        updateMediaSession();
      }
    } else {
      if (oldQueueIndex !== -1 && oldQueueIndex < currentTrackIndex) {
        currentTrackIndex--;
      }
    }

    renderQueue();
    updateSelectedCount();

    window.addDownloadStatus(`Deleted: ${file.name}`, 'success');

    saveQueueState();

  } catch (e) {
    console.error('Error deleting track:', e);
    window.addDownloadStatus(`Error deleting: ${file.name}`, 'error');
  }
}
function renderPlaylist() {
  if (musicFiles.length === 0) {
    playlist.innerHTML = '<div class="empty-queue">No music files<br>Download from YouTube</div>';
    return;
  }

  playlist.innerHTML = musicFiles.map((file, index) =>
    `<div class="track-item ${selectedTracks.has(index) ? 'selected' : ''}" data-index="${index}">
      <div class="checkbox ${selectedTracks.has(index) ? 'checked' : ''}" data-index="${index}"></div>
      <div class="track-item-name">${file.name}</div>
      <button class="track-item-download" data-index="${index}" title="Download to Device">${SVG_ICONS.download}</button>
      <button class="track-item-delete" data-index="${index}" title="Delete">${SVG_ICONS.trash}</button>
    </div>`
  ).join('');

  // Event listeners
  document.querySelectorAll('.track-item').forEach(item => {
    const index = parseInt(item.dataset.index);

    item.addEventListener('click', (e) => {
      // ตรวจสอบว่ากดที่ปุ่มดาวน์โหลดหรือไม่
      if (e.target.closest('.track-item-download')) {
        e.stopPropagation();
        downloadTrackToDevice(index);
      }
      // ตรวจสอบว่ากดที่ปุ่มลบหรือไม่
      else if (e.target.closest('.track-item-delete')) {
        e.stopPropagation();
        deleteTrack(index);
      }
      // ตรวจสอบว่ากดที่ checkbox หรือไม่
      else if (e.target.classList.contains('checkbox')) {
        toggleSelection(index);
      }
      // ถ้าไม่ใช่ทั้ง 2 อย่าง ให้เล่นเพลง
      else {
        playTrack(index);
      }
    });
  });
}

function toggleSelection(index) {
  if (selectedTracks.has(index)) {
    selectedTracks.delete(index);
  } else {
    selectedTracks.add(index);
  }
  updateSelectedCount();
  renderPlaylist();
}

function updateSelectedCount() {
  const count = selectedTracks.size;
  selectedCount.textContent = count;
  addSelectedBtn.disabled = count === 0;
}

function playTrack(index) {
  if (!queue.includes(index)) {
    queue.push(index);
    renderQueue();
  }

  currentTrackIndex = queue.indexOf(index);
  const file = musicFiles[index];
  currentPlayingFile = file.name;

  trackName.textContent = file.name;
  audio.src = file.url;

  audio.addEventListener('loadedmetadata', function onLoaded() {
    audio.removeEventListener('loadedmetadata', onLoaded);
    updateMediaSession();
  });

  audio.play().catch(e => console.error('Play error:', e));

  renderQueue();
  updateMediaSession();

  // 🔥 บันทึก Queue State
  saveQueueState();
}

function playFromQueue(queueIndex) {
  if (queueIndex < 0 || queueIndex >= queue.length) return;

  currentTrackIndex = queueIndex;
  const fileIndex = queue[queueIndex];
  const file = musicFiles[fileIndex];
  currentPlayingFile = file.name;

  trackName.textContent = file.name;
  audio.src = file.url;

  audio.addEventListener('loadedmetadata', function onLoaded() {
    audio.removeEventListener('loadedmetadata', onLoaded);
    updateMediaSession();
  });

  audio.play().catch(e => console.error('Play error:', e));

  renderQueue();
  updateMediaSession();

  // 🔥 บันทึก Queue State
  saveQueueState();
}

function removeFromQueue(queueIndex) {
  if (queueIndex === currentTrackIndex) {
    audio.pause();
    audio.src = '';
    trackName.textContent = 'No track playing';
    currentPlayingFile = null;
  }

  queue.splice(queueIndex, 1);

  if (queueIndex < currentTrackIndex) {
    currentTrackIndex--;
  } else if (queueIndex === currentTrackIndex) {
    currentTrackIndex = -1;
  }

  renderQueue();
  updateMediaSession();

  // 🔥 บันทึก Queue State
  saveQueueState();
}

selectAllBtn.addEventListener('click', () => {
  if (selectedTracks.size === musicFiles.length) {
    selectedTracks.clear();
  } else {
    musicFiles.forEach((_, i) => selectedTracks.add(i));
  }
  updateSelectedCount();
  renderPlaylist();
});

addSelectedBtn.addEventListener('click', () => {
  selectedTracks.forEach(index => {
    if (!queue.includes(index)) {
      queue.push(index);
    }
  });

  renderQueue();

  if (queue.length > 0 && currentTrackIndex === -1) {
    playFromQueue(0);
  }

  selectedTracks.clear();
  updateSelectedCount();
  renderPlaylist();

  // 🔥 บันทึก Queue State
  saveQueueState();
});

function renderQueue() {
  queueCount.textContent = queue.length;
  queueCount2.textContent = queue.length;

  if (queue.length === 0) {
    queueList.innerHTML = '<div class="empty-queue">No tracks in queue<br>Add some from the player</div>';
    return;
  }

  queueList.innerHTML = queue.map((fileIndex, queueIndex) => `
    <div class="queue-item ${queueIndex === currentTrackIndex ? 'playing' : ''}" draggable="true" data-queue-index="${queueIndex}">
      <div class="drag-handle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </div>
      <div class="queue-number">${queueIndex === currentTrackIndex ? SVG_ICONS.playing : queueIndex + 1}</div>
      <div class="queue-name">${musicFiles[fileIndex].name}</div>
      <button class="queue-remove" data-queue-index="${queueIndex}">${SVG_ICONS.close}</button>
    </div>
  `).join('');

  // Queue item click
  document.querySelectorAll('.queue-item').forEach(item => {
    const queueIndex = parseInt(item.dataset.queueIndex);

    item.addEventListener('click', (e) => {
      if (e.target.closest('.queue-remove')) {
        removeFromQueue(queueIndex);
      } else if (!e.target.closest('.drag-handle')) {
        playFromQueue(queueIndex);
      }
    });

    // Drag events
    item.addEventListener('dragstart', (e) => {
      draggedElement = item;
      draggedIndex = queueIndex;
      item.style.opacity = '0.4';
    });

    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      draggedElement = null;
      draggedIndex = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(queueList, e.clientY);
      if (afterElement == null) {
        queueList.appendChild(draggedElement);
      } else {
        queueList.insertBefore(draggedElement, afterElement);
      }
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropIndex = parseInt(item.dataset.queueIndex);

      if (draggedIndex !== null && draggedIndex !== dropIndex) {
        const [removed] = queue.splice(draggedIndex, 1);
        queue.splice(dropIndex, 0, removed);

        if (currentTrackIndex === draggedIndex) {
          currentTrackIndex = dropIndex;
        } else if (draggedIndex < currentTrackIndex && dropIndex >= currentTrackIndex) {
          currentTrackIndex--;
        } else if (draggedIndex > currentTrackIndex && dropIndex <= currentTrackIndex) {
          currentTrackIndex++;
        }

        renderQueue();

        // 🔥 บันทึก Queue State
        saveQueueState();
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.queue-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Player Controls
playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

prevBtn.addEventListener('click', () => {
  window.handlePrevious();
});

nextBtn.addEventListener('click', () => {
  window.handleNext();
});

loopBtn.addEventListener('click', () => {
  isLoopEnabled = !isLoopEnabled;
  saveLoopSetting();
  updateLoopButton();
});

// Audio Events
audio.addEventListener('play', () => {
  playPauseBtn.innerHTML = SVG_ICONS.pause;
  updateMediaSession();

  // 🔥 บันทึก Queue State เมื่อเริ่มเล่น
  saveQueueState();
});

audio.addEventListener('pause', () => {
  playPauseBtn.innerHTML = SVG_ICONS.play;
  updateMediaSession();

  // 🔥 บันทึก Queue State เมื่อหยุดเล่น
  saveQueueState();
});

audio.addEventListener('ended', () => {
  if (currentTrackIndex < queue.length - 1) {
    playFromQueue(currentTrackIndex + 1);
  } else if (isLoopEnabled && queue.length > 0) {
    playFromQueue(0);
  }
});

audio.addEventListener('timeupdate', () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  const percent = (audio.currentTime / audio.duration) * 100;
  progress.style.width = `${percent}%`;

  // ส่ง progress ไปยัง notification
  if (typeof AndroidMediaController !== 'undefined' && !isNaN(audio.duration)) {
    const position = Math.floor(audio.currentTime * 1000);
    const totalDuration = Math.floor(audio.duration * 1000);
    AndroidMediaController.updateProgress(position, totalDuration);
  }

  // 🔥 บันทึก Queue State ทุกๆ 5 วินาที
  if (Math.floor(audio.currentTime) % 5 === 0) {
    saveQueueState();
  }
});

audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = formatTime(audio.duration);
  updateMediaSession();
});

// 🔥 บันทึก Queue State เมื่อ seek
progressBar.addEventListener('click', (e) => {
  const rect = progressBar.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audio.currentTime = percent * audio.duration;

  saveQueueState();
});

// Queue Controls
clearQueueBtn.addEventListener('click', () => {
  queue = [];
  currentTrackIndex = -1;
  currentPlayingFile = null;
  audio.pause();
  audio.src = '';
  trackName.textContent = 'No track playing';
  renderQueue();
  updateMediaSession();

  // 🔥 ล้าง Queue State
  clearQueueState();
});

shuffleQueueBtn.addEventListener('click', () => {
  if (queue.length === 0) return;

  const currentFile = currentTrackIndex >= 0 ? queue[currentTrackIndex] : null;

  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  if (currentFile !== null) {
    currentTrackIndex = queue.indexOf(currentFile);
  }

  renderQueue();

  // 🔥 บันทึก Queue State
  saveQueueState();
});

// Download Functionality
apiUrlInput.addEventListener('change', saveApiUrl);
apiUrlInput.addEventListener('blur', saveApiUrl);

downloadBtn.addEventListener('click', async () => {
  const url = youtubeUrlInput.value.trim();
  const apiUrl = apiUrlInput.value.trim();

  // ตรวจสอบ API URL ก่อน
  if (!apiUrl) {
    window.addDownloadStatus('Please enter API URL', 'error');
    apiUrlInput.focus();
    return;
  }

  if (!url) {
    window.addDownloadStatus('Please enter a URL', 'error');
    youtubeUrlInput.focus();
    return;
  }

  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    window.addDownloadStatus('Invalid URL. Please enter a YouTube link', 'error');
    youtubeUrlInput.focus();
    return;
  }

  if (!navigator.onLine) {
    window.addDownloadStatus('No internet connection. Please connect to download.', 'error');
    return;
  }

  downloadBtn.disabled = true;
  downloadBtnText.textContent = 'Starting...';

  window.addDownloadStatus(`Starting download...`, 'info');

  // บันทึก API URL ก่อนใช้งาน
  saveApiUrl();

  try {
    // 1. เริ่มดาวน์โหลด
    const startResponse = await fetch(`${apiUrl}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: url })
    });

    if (!startResponse.ok) {
      // ตรวจสอบว่าเป็น JSON หรือไม่
      const contentType = startResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || 'Download failed to start');
      } else {
        throw new Error(`Server error: ${startResponse.status} ${startResponse.statusText}`);
      }
    }

    const responseData = await startResponse.json();
    
    if (!responseData.downloadId) {
      throw new Error('Server did not return download ID');
    }
    
    const { downloadId } = responseData;
    console.log('Download ID:', downloadId);

    // 2. เชื่อมต่อ SSE เพื่อรับ progress
    const eventSource = new EventSource(`${apiUrl}/progress/${downloadId}`);
    
    eventSource.onmessage = (event) => {
      const progress = JSON.parse(event.data);
      
      console.log(`[${progress.status}] ${progress.progress}% - ${progress.message}`);
      
      // อัพเดท UI
      downloadBtnText.textContent = `${progress.message}`;
      
      // แสดง status
      if (progress.status === 'downloading') {
        window.addDownloadStatus(`📥 ${progress.message}`, 'info');
      } else if (progress.status === 'converting') {
        window.addDownloadStatus(`🎵 ${progress.message}`, 'info');
      }
      
      // เมื่อเสร็จสมบูรณ์
      if (progress.status === 'completed') {
        eventSource.close();
        console.log('✅ Download completed!');
        console.log('File:', progress.filename);
        
        // ดาวน์โหลดไฟล์
        downloadCompletedFile(apiUrl, downloadId, progress.filename);
      }
      
      // เมื่อเกิด error
      if (progress.status === 'error') {
        eventSource.close();
        console.error('❌ Error:', progress.message);
        window.addDownloadStatus(`✗ Error: ${progress.message}`, 'error');
        downloadBtn.disabled = false;
        downloadBtnText.textContent = 'Download';
      }
    };
    
    eventSource.onerror = (error) => {
      eventSource.close();
      console.error('SSE Error:', error);
      window.addDownloadStatus('✗ Connection error. Check if server is running.', 'error');
      downloadBtn.disabled = false;
      downloadBtnText.textContent = 'Download';
    };

  } catch (error) {
    console.error('Download error:', error);
    
    // ปรับข้อความ error ให้เข้าใจง่าย
    let errorMsg = error.message;
    if (errorMsg.includes('Failed to fetch')) {
      errorMsg = 'Cannot connect to server. Please check API URL and server status.';
    } else if (errorMsg.includes('<!DOCTYPE')) {
      errorMsg = 'Server returned HTML instead of JSON. Check API URL endpoint.';
    }
    
    window.addDownloadStatus(`✗ Error: ${errorMsg}`, 'error');
    downloadBtn.disabled = false;
    downloadBtnText.textContent = 'Download';
  }
});

// ฟังก์ชันดาวน์โหลดไฟล์จาก server หลังจากที่ดาวน์โหลดเสร็จแล้ว
async function downloadCompletedFile(apiUrl, downloadId, filename) {
  try {
    downloadBtnText.textContent = 'Saving to app...';
    
    const response = await fetch(`${apiUrl}/file/${downloadId}`);
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    const blob = await response.blob();
    
    if (!blob || blob.size === 0) {
      throw new Error('Downloaded file is empty');
    }
    
    // เก็บเป็น Blob ใน IndexedDB
    await addMusicFile(filename, blob);
    window.addDownloadStatus(`✓ Downloaded to App: ${filename}`, 'success');
    
    youtubeUrlInput.value = '';
    document.querySelector('.tab[data-page="playerPage"]').click();
    
  } catch (error) {
    console.error('Download file error:', error);
    window.addDownloadStatus(`✗ Error: ${error.message}`, 'error');
  } finally {
    downloadBtn.disabled = false;
    downloadBtnText.textContent = 'Download';
  }
}


// Network status
window.addEventListener('online', () => {
  window.addDownloadStatus('Internet connected', 'success');
});

window.addEventListener('offline', () => {
  window.addDownloadStatus('Internet disconnected', 'warning');
});

// 🔥 บันทึก Queue State ก่อนปิดแอป
window.addEventListener('beforeunload', () => {
  saveQueueState();
});

// 🔥 บันทึก Queue State เมื่อ app เข้าสู่ background (mobile)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveQueueState();
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    initWave();
    await loadMusicFiles();
    loadSettings();

    playPauseBtn.innerHTML = SVG_ICONS.play;
    prevBtn.innerHTML = SVG_ICONS.previous;
    nextBtn.innerHTML = SVG_ICONS.next;
    loopBtn.innerHTML = SVG_ICONS.loop;
    
    // เพิ่มปุ่ม Load from Music (สำหรับ Electron/Android)
    if (typeof addLoadFromFolderButton === 'function') {
      addLoadFromFolderButton();
    }
  });
} else {
  (async () => {
    initWave();
    await loadMusicFiles();
    loadSettings();

    playPauseBtn.innerHTML = SVG_ICONS.play;
    prevBtn.innerHTML = SVG_ICONS.previous;
    nextBtn.innerHTML = SVG_ICONS.next;
    loopBtn.innerHTML = SVG_ICONS.loop;
    
    // เพิ่มปุ่ม Load from Music (สำหรับ Electron/Android)
    if (typeof addLoadFromFolderButton === 'function') {
      addLoadFromFolderButton();
    }
  })();
}

window.showActionStatus = function (message, type = 'info', duration = 2000) {
  const el = document.getElementById('actionStatus');
  if (!el) return;

  el.textContent = message;
  el.className = `action-status show ${type}`;

  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove('show');
  }, duration);
};