const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();

// ====== เพิ่ม CORS ======
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Expose-Headers', 'Content-Disposition');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const YTDLP_PATH = path.join(__dirname, 'yt-dlp');

// เก็บ progress ของแต่ละ download
const downloadProgress = new Map();

// ==========================
// Utils
// ==========================
function isPlaylistOrMixURL(url) {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;
    
    if (params.has('list')) {
      return true;
    }
    
    if (url.includes('/playlist') || url.includes('&list=') || url.includes('?list=')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

async function checkFFmpeg() {
  try {
    await execPromise('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}

async function ensureYtDlp() {
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;

  const url =
    'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

  await execPromise(`wget -O "${YTDLP_PATH}" "${url}"`);
  fs.chmodSync(YTDLP_PATH, 0o755);
  return YTDLP_PATH;
}

function encodeRFC5987(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
}

// ==========================
// API
// ==========================

// SSE endpoint สำหรับรับ progress updates
app.get('/progress/:id', (req, res) => {
  const { id } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  console.log(`📡 Client connected for progress: ${id}`);
  
  // ส่ง progress ทุก 500ms
  const interval = setInterval(() => {
    const progress = downloadProgress.get(id);
    if (progress) {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
      
      if (progress.status === 'completed' || progress.status === 'error') {
        clearInterval(interval);
        res.end();
      }
    }
  }, 500);
  
  req.on('close', () => {
    clearInterval(interval);
    console.log(`📡 Client disconnected: ${id}`);
  });
});

// Endpoint สำหรับดาวน์โหลดไฟล์ที่เสร็จแล้ว
app.get('/file/:id', (req, res) => {
  const { id } = req.params;
  const filePath = downloadProgress.get(`file_${id}`);
  
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const filename = path.basename(filePath);
  const encodedFilename = encodeRFC5987(filename);
  const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_');
  
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`
  );
  res.setHeader('Content-Type', 'audio/mpeg');
  
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Error sending file:', err);
    } else {
      // ลบไฟล์หลังส่ง
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            downloadProgress.delete(`file_${id}`);
            downloadProgress.delete(id);
            console.log(`🗑️ File deleted: ${filename}`);
          }
        } catch (cleanupErr) {
          console.error('Cleanup error:', cleanupErr);
        }
      }, 1000);
    }
  });
});

app.post('/download', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  // สร้าง unique ID สำหรับ download นี้
  const downloadId = Date.now().toString() + Math.random().toString(36).substring(7);
  
  console.log(`🆕 New download request: ${downloadId}`);
  console.log(`🔗 URL: ${url}`);
  
  // ส่ง download ID กลับไปให้ client
  res.json({ downloadId, message: 'Download started' });
  
  // เริ่ม download แบบ async
  downloadFile(url, downloadId);
});

async function downloadFile(url, downloadId) {
  // ตั้งค่า progress เริ่มต้น
  downloadProgress.set(downloadId, {
    status: 'preparing',
    progress: 0,
    message: 'Preparing download...'
  });

  // ตรวจสอบว่าเป็น playlist หรือ mix หรือไม่
  if (isPlaylistOrMixURL(url)) {
    downloadProgress.set(downloadId, {
      status: 'error',
      progress: 0,
      message: 'ไม่สามารถดาวน์โหลด Playlist หรือ Mix ได้'
    });
    console.log(`❌ [${downloadId}] Playlist detected`);
    return;
  }

  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  try {
    if (!(await checkFFmpeg())) {
      downloadProgress.set(downloadId, {
        status: 'error',
        progress: 0,
        message: 'FFmpeg not installed'
      });
      console.log(`❌ [${downloadId}] FFmpeg not found`);
      return;
    }

    const ytDlp = await ensureYtDlp();

    const outputTemplate = path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s');

    const args = [
      '--js-runtimes', 'node',
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--newline',
      '-o', outputTemplate,
      url
    ];

    let downloadedFile = null;

    downloadProgress.set(downloadId, {
      status: 'downloading',
      progress: 0,
      message: 'Starting download...'
    });

    const proc = spawn(ytDlp, args);

    proc.stdout.on('data', data => {
      const text = data.toString();
      
      // ตรวจจับ progress
      const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        downloadProgress.set(downloadId, {
          status: 'downloading',
          progress: percent,
          message: `Downloading: ${percent.toFixed(1)}%`
        });
        console.log(`📥 [${downloadId}] ${percent.toFixed(1)}%`);
      }
    });

    proc.stderr.on('data', data => {
      const text = data.toString();
      
      // หาชื่อไฟล์
      let match = text.match(/\[ExtractAudio\] Destination: (.+\.mp3)/);
      if (match) {
        downloadedFile = match[1].trim();
        downloadProgress.set(downloadId, {
          status: 'converting',
          progress: 95,
          message: 'Converting to MP3...'
        });
        console.log(`🎵 [${downloadId}] Converting...`);
      }
      
      if (!downloadedFile) {
        match = text.match(/Destination: (.+\.mp3)/);
        if (match) downloadedFile = match[1].trim();
      }
      
      if (!downloadedFile) {
        match = text.match(/Merging formats into "(.+\.mp3)"/);
        if (match) {
          downloadedFile = match[1].trim();
          downloadProgress.set(downloadId, {
            status: 'converting',
            progress: 90,
            message: 'Merging audio...'
          });
          console.log(`🔄 [${downloadId}] Merging...`);
        }
      }
      
      const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        downloadProgress.set(downloadId, {
          status: 'downloading',
          progress: percent,
          message: `Downloading: ${percent.toFixed(1)}%`
        });
      }
    });

    proc.on('close', code => {
      if (code !== 0) {
        console.error(`❌ [${downloadId}] Failed (code ${code})`);
        downloadProgress.set(downloadId, {
          status: 'error',
          progress: 0,
          message: 'Download failed'
        });
        return;
      }

      // หาไฟล์ล่าสุดถ้ายังไม่เจอ
      if (!downloadedFile) {
        try {
          const files = fs.readdirSync(DOWNLOAD_DIR)
            .filter(f => f.endsWith('.mp3'))
            .map(f => ({
              name: f,
              path: path.join(DOWNLOAD_DIR, f),
              time: fs.statSync(path.join(DOWNLOAD_DIR, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

          if (files.length > 0) {
            downloadedFile = files[0].path;
          }
        } catch (e) {
          console.error(`[${downloadId}] Error finding file:`, e);
        }
      }

      if (!downloadedFile || !fs.existsSync(downloadedFile)) {
        console.error(`❌ [${downloadId}] File not found`);
        downloadProgress.set(downloadId, {
          status: 'error',
          progress: 0,
          message: 'File not found'
        });
        return;
      }

      const filename = path.basename(downloadedFile);
      
      downloadProgress.set(downloadId, {
        status: 'completed',
        progress: 100,
        message: 'Download completed!',
        filename: filename,
        downloadUrl: `/file/${downloadId}`
      });
      
      // เก็บ mapping
      downloadProgress.set(`file_${downloadId}`, downloadedFile);
      
      console.log(`✅ [${downloadId}] Completed: ${filename}`);
    });

  } catch (err) {
    console.error(`❌ [${downloadId}] Error:`, err.message);
    downloadProgress.set(downloadId, {
      status: 'error',
      progress: 0,
      message: err.message
    });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API running on http://0.0.0.0:${PORT}`);
  console.log('✅ CORS enabled');
  console.log('✅ Progress tracking enabled');
  console.log('✅ UTF-8 filenames supported');
});