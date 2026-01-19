// ========== MUSIC FILE LOADER FROM MUSIC FOLDER ==========
// Version 2.4: ลบ Select All header, ใช้ icon เหมือนหน้า player

// ตรวจสอบว่าอยู่ใน Electron หรือ Android
function isElectron() {
  return typeof window.electronAPI !== 'undefined' && window.electronAPI.loadMusicFiles;
}

function isAndroid() {
  return typeof window.AndroidMediaController !== 'undefined' && window.AndroidMediaController.loadMusicFiles;
}

// โหลดรายการไฟล์จากโฟลเดอร์ Music
async function loadMusicFilesFromFolder() {
  try {
    if (isElectron()) {
      const result = await window.electronAPI.loadMusicFiles();
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.files;
    } else if (isAndroid()) {
      const resultStr = window.AndroidMediaController.loadMusicFiles();
      const result = JSON.parse(resultStr);
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.files;
    } else {
      throw new Error('Platform not supported');
    }
  } catch (error) {
    console.error('Error loading music files from folder:', error);
    throw error;
  }
}

// โหลดไฟล์เพลงเดี่ยว
async function loadSingleMusicFile(filePath) {
  try {
    if (isElectron()) {
      const result = await window.electronAPI.readMusicFile(filePath);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      const uint8Array = new Uint8Array(result.buffer);
      const blob = new Blob([uint8Array], { type: 'audio/mpeg' });
      
      return {
        blob: blob,
        filename: result.filename
      };
    } else if (isAndroid()) {
      const resultStr = window.AndroidMediaController.readMusicFile(filePath);
      const result = JSON.parse(resultStr);
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      
      return {
        blob: blob,
        filename: result.filename
      };
    } else {
      throw new Error('Platform not supported');
    }
  } catch (error) {
    console.error('Error loading single music file:', error);
    throw error;
  }
}

// แสดง UI สำหรับโหลดไฟล์จากโฟลเดอร์
async function showMusicFolderLoader() {
  try {
    document.querySelector('.tab[data-page="playerPage"]').click();
    
    window.addDownloadStatus('Loading files from Music folder...', 'info');
    
    const files = await loadMusicFilesFromFolder();
    
    if (files.length === 0) {
      window.addDownloadStatus('No music files found in Music folder', 'warning');
      return;
    }
    
    showFileSelectionDialog(files);
    
  } catch (error) {
    window.addDownloadStatus(`Error: ${error.message}`, 'error');
  }
}

// แสดง dialog สำหรับเลือกไฟล์
function showFileSelectionDialog(files) {
  const selectedFiles = new Set();
  
  // CSS สำหรับ checkbox ทั้งสองหน้า (Player + Dialog)
  const style = document.createElement('style');
  style.textContent = `
    /* Custom Checkbox - ใช้ทั้งหน้า Player และ Dialog */
    .custom-checkbox,
    .checkbox {
      appearance: none;
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border: 2px solid var(--border);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      position: relative;
      transition: all 0.2s ease;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .custom-checkbox:hover,
    .checkbox:hover {
      border-color: #ff6b35;
    }
    
    .custom-checkbox:checked,
    .checkbox.checked {
      background: var(--primary);
      border-color: var(--primary);
    }
    
    .custom-checkbox:checked::after,
    .checkbox.checked::after {
      content: '✓';
      color: white;
      font-size: 12px;
    }
    
    .custom-checkbox:indeterminate {
      background: var(--primary);
      border-color: var(--primary);
    }
    
    .custom-checkbox:indeterminate::after {
      content: '−';
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loading-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #2a2a2a;
      border-top: 2px solid #ff6b35;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `;
  document.head.appendChild(style);
  
  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  overlay.addEventListener('remove', () => style.remove());
  
  // Dialog
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background: var(--bg-card);
    border-radius: 12px;
    border: 1px solid var(--border);
    width: 100%;
    max-width: 380px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;
  
  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;
  
  const titleContainer = document.createElement('div');
  
  const title = document.createElement('h3');
  title.textContent = `Music Folder`;
  title.style.cssText = `
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  `;
  
  const subtitle = document.createElement('div');
  subtitle.textContent = `${files.length} files available`;
  subtitle.style.cssText = `
    font-size: 12px;
    color: var(--text-secondary);
  `;
  
  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);
  
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = SVG_ICONS.close;
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
  `;
  closeBtn.onmouseover = () => closeBtn.style.background = 'var(--bg-hover)';
  closeBtn.onmouseout = () => closeBtn.style.background = 'transparent';
  closeBtn.onclick = () => overlay.remove();
  
  header.appendChild(titleContainer);
  header.appendChild(closeBtn);
  
  // Select All header
  const selectAllHeader = document.createElement('div');
  selectAllHeader.style.cssText = `
    padding: 10px 16px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-dark);
  `;
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.className = 'custom-checkbox';
  selectAllCheckbox.style.alignSelf = 'center';
  
  const selectAllLabel = document.createElement('label');
  selectAllLabel.textContent = 'Select All';
  selectAllLabel.style.cssText = `
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    flex: 1;
  `;
  selectAllLabel.onclick = () => selectAllCheckbox.click();
  
  const selectedCountLabel = document.createElement('span');
  selectedCountLabel.textContent = '0 selected';
  selectedCountLabel.style.cssText = `
    font-size: 12px;
    color: #ff6b35;
    font-weight: 600;
  `;
  
  selectAllHeader.appendChild(selectAllCheckbox);
  selectAllHeader.appendChild(selectAllLabel);
  selectAllHeader.appendChild(selectedCountLabel);
  
  // File list
  const listContainer = document.createElement('div');
  listContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  `;
  
  // Update selected count
  const updateSelectedCount = () => {
    selectedCountLabel.textContent = `${selectedFiles.size} selected`;
    
    addSelectedBtn.textContent = selectedFiles.size === 0 
      ? 'Add Selected' 
      : `Add Selected (${selectedFiles.size})`;
    
    addSelectedBtn.disabled = selectedFiles.size === 0;
    addSelectedBtn.style.opacity = addSelectedBtn.disabled ? '0.5' : '1';
    addSelectedBtn.style.cursor = addSelectedBtn.disabled ? 'not-allowed' : 'pointer';
    
    // Update Select All checkbox
    selectAllCheckbox.checked = selectedFiles.size === files.length && files.length > 0;
    selectAllCheckbox.indeterminate = selectedFiles.size > 0 && selectedFiles.size < files.length;
  };
  
  // Select All functionality
  selectAllCheckbox.onchange = () => {
    const allCheckboxes = listContainer.querySelectorAll('.custom-checkbox');
    
    if (selectAllCheckbox.checked) {
      selectedFiles.clear();
      files.forEach(file => selectedFiles.add(file));
      
      allCheckboxes.forEach(cb => cb.checked = true);
      
      document.querySelectorAll('.file-item').forEach(item => {
        item.style.background = 'rgba(255, 107, 53, 0.1)';
        item.style.borderColor = '#ff6b35';
      });
    } else {
      selectedFiles.clear();
      
      allCheckboxes.forEach(cb => cb.checked = false);
      
      document.querySelectorAll('.file-item').forEach(item => {
        item.style.background = 'var(--bg-dark)';
        item.style.borderColor = 'var(--border)';
      });
    }
    updateSelectedCount();
  };
  
  // File items
  files.forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.style.cssText = `
      padding: 12px;
      background: var(--bg-dark);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      border: 1px solid var(--border);
      transition: all 0.2s ease;
      display: flex;
      gap: 12px;
      align-items: center;
    `;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'custom-checkbox';
    checkbox.style.alignSelf = 'center';
    
    checkbox.onclick = (e) => e.stopPropagation();
    
    checkbox.onchange = () => {
      if (checkbox.checked) {
        selectedFiles.add(file);
        fileItem.style.background = 'rgba(255, 107, 53, 0.1)';
        fileItem.style.borderColor = '#ff6b35';
      } else {
        selectedFiles.delete(file);
        fileItem.style.background = 'var(--bg-dark)';
        fileItem.style.borderColor = 'var(--border)';
      }
      updateSelectedCount();
    };
    
    const fileInfoContainer = document.createElement('div');
    fileInfoContainer.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      gap: 10px;
      align-items: center;
    `;
    
    const fileTextContainer = document.createElement('div');
    fileTextContainer.style.cssText = `flex: 1; min-width: 0;`;
    
    const fileName = document.createElement('div');
    fileName.textContent = file.name;
    fileName.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
      word-break: break-word;
    `;
    
    const fileInfo = document.createElement('div');
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    const date = new Date(file.modified).toLocaleDateString();
    fileInfo.textContent = `${sizeInMB} MB • ${date}`;
    fileInfo.style.cssText = `font-size: 11px; color: var(--text-secondary);`;
    
    fileTextContainer.appendChild(fileName);
    fileTextContainer.appendChild(fileInfo);
    fileInfoContainer.appendChild(fileTextContainer);
    
    fileItem.onclick = () => {
      checkbox.checked = !checkbox.checked;
      checkbox.onchange();
    };
    
    fileItem.appendChild(checkbox);
    fileItem.appendChild(fileInfoContainer);
    listContainer.appendChild(fileItem);
  });
  
  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: center;
    gap: 8px;
  `;
  
  const addSelectedBtn = document.createElement('button');
  addSelectedBtn.disabled = true;
  addSelectedBtn.textContent = 'Add Selected';
  addSelectedBtn.style.cssText = `
    flex: 1;
    max-width: 200px;
    padding: 10px 16px;
    background: var(--primary);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: not-allowed;
    opacity: 0.5;
  `;
  
  addSelectedBtn.onclick = async () => {
    if (selectedFiles.size === 0) return;
    overlay.remove();
    await loadSelectedMusicFiles(Array.from(selectedFiles));
  };
  
  const loadAllBtn = document.createElement('button');
  loadAllBtn.textContent = `Add All (${files.length})`;
  loadAllBtn.style.cssText = `
    flex: 1;
    max-width: 200px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  `;
  
  loadAllBtn.onclick = async () => {
    overlay.remove();
    await loadAllMusicFiles(files);
  };
  
  footer.appendChild(addSelectedBtn);
  footer.appendChild(loadAllBtn);
  
  dialog.appendChild(header);
  dialog.appendChild(selectAllHeader);
  dialog.appendChild(listContainer);
  dialog.appendChild(footer);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

// โหลดไฟล์ที่เลือก
async function loadSelectedMusicFiles(selectedFiles) {
  let loaded = 0;
  let failed = 0;
  let skipped = 0;
  const total = selectedFiles.length;
  
  document.querySelector('.tab[data-page="playerPage"]').click();
  
  const loadingOverlay = createLoadingOverlay();
  document.body.appendChild(loadingOverlay);
  
  const updateLoading = (current, total, filename) => {
    const progress = Math.round((current / total) * 100);
    const progressBar = loadingOverlay.querySelector('.progress-fill');
    const progressText = loadingOverlay.querySelector('.progress-text');
    const fileText = loadingOverlay.querySelector('.file-text');
    
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `${progress}%`;
    if (fileText) fileText.textContent = filename;
  };
  
  try {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      
      try {
        updateLoading(i + 1, total, file.name);
        
        const existingFile = musicFiles.find(f => f.name === file.name);
        if (existingFile) {
          console.log(`Skipping ${file.name} - already in library`);
          skipped++;
          await new Promise(resolve => setTimeout(resolve, 20));
          continue;
        }
        
        const result = await loadSingleMusicFile(file.path);
        await addMusicFile(result.filename, result.blob);
        loaded++;
        await new Promise(resolve => setTimeout(resolve, 30));
        
      } catch (error) {
        console.error(`Failed to load ${file.name}:`, error);
        failed++;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
    
    loadingOverlay.remove();
    
    let summary = '';
    if (loaded > 0) summary += `${loaded} loaded`;
    if (skipped > 0) summary += ` • ${skipped} skipped`;
    if (failed > 0) summary += ` • ${failed} failed`;
    
    const statusType = failed > 0 ? 'warning' : 'success';
    window.addDownloadStatus(summary || 'No files loaded', statusType);
    
  } catch (error) {
    loadingOverlay.remove();
    window.addDownloadStatus(`Error: ${error.message}`, 'error');
  }
}

// โหลดทั้งหมด
async function loadAllMusicFiles(files) {
  await loadSelectedMusicFiles(files);
}

// สร้าง Loading Overlay
function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  const container = document.createElement('div');
  container.style.cssText = `
    background: var(--bg-card);
    border-radius: 12px;
    border: 1px solid var(--border);
    padding: 24px;
    max-width: 320px;
    width: 100%;
    text-align: center;
  `;
  
  const spinner = document.createElement('div');
  spinner.className = 'loading-spinner';
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 3px solid #2a2a2a;
    border-top: 3px solid #ff6b35;
    border-radius: 50%;
    margin: 0 auto 16px;
  `;
  
  const title = document.createElement('div');
  title.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
  `;
  
  const loadingIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  loadingIcon.setAttribute('width', '18');
  loadingIcon.setAttribute('height', '18');
  loadingIcon.setAttribute('viewBox', '0 0 24 24');
  loadingIcon.setAttribute('fill', 'none');
  loadingIcon.setAttribute('stroke', '#ff6b35');
  loadingIcon.setAttribute('stroke-width', '2');
  loadingIcon.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>';
  
  const titleText = document.createElement('span');
  titleText.textContent = 'Loading Files';
  
  title.appendChild(loadingIcon);
  title.appendChild(titleText);
  
  const fileText = document.createElement('div');
  fileText.className = 'file-text';
  fileText.textContent = 'Preparing...';
  fileText.style.cssText = `
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;
  
  const progressContainer = document.createElement('div');
  progressContainer.style.cssText = `
    width: 100%;
    height: 6px;
    background: var(--bg-dark);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  `;
  
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  progressFill.style.cssText = `
    height: 100%;
    background: linear-gradient(90deg, #ff6b35, #ff8c61);
    width: 0%;
    transition: width 0.3s ease;
    border-radius: 3px;
  `;
  
  const progressText = document.createElement('div');
  progressText.className = 'progress-text';
  progressText.textContent = '0%';
  progressText.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    color: #ff6b35;
  `;
  
  progressContainer.appendChild(progressFill);
  container.appendChild(spinner);
  container.appendChild(title);
  container.appendChild(fileText);
  container.appendChild(progressContainer);
  container.appendChild(progressText);
  overlay.appendChild(container);
  
  return overlay;
}

// เพิ่มปุ่ม Player
function addLoadFromFolderButton() {
  if (!isElectron() && !isAndroid()) return;
  
  const playlistHeader = document.querySelector('.playlist-header');
  if (!playlistHeader) return;
  
  // หาปุ่ม Select All ที่มีอยู่แล้ว
  const existingSelectAllBtn = document.getElementById('selectAll');
  if (!existingSelectAllBtn) return;
  
  // ลบปุ่ม Select All ออกจากตำแหน่งเดิม
  existingSelectAllBtn.remove();
  
  // สร้าง container สำหรับปุ่มทั้งสอง
  const btnGroup = document.createElement('div');
  btnGroup.style.cssText = `display: flex; gap: 8px;`;
  
  // ปุ่ม Load from Music
  const loadBtn = document.createElement('button');
  loadBtn.className = 'select-all-btn';
  loadBtn.onclick = showMusicFolderLoader;
  loadBtn.textContent = 'Load from Music';
  
  // เพิ่มปุ่มทั้งสองเข้า container
  btnGroup.appendChild(loadBtn);
  btnGroup.appendChild(existingSelectAllBtn);
  
  // เพิ่ม container เข้า header
  playlistHeader.appendChild(btnGroup);
}

window.loadMusicFilesFromFolder = loadMusicFilesFromFolder;
window.showMusicFolderLoader = showMusicFolderLoader;
window.addLoadFromFolderButton = addLoadFromFolderButton;