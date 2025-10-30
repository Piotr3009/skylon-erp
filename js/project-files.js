// ========== PROJECT FILES MANAGEMENT SYSTEM ==========

let currentProjectFiles = {
    index: null,
    stage: null, // 'pipeline' | 'production' | 'archive'
    projectNumber: null,
    projectId: null,
    currentFolder: null
};

const projectFolders = ['quotes', 'drawings', 'photos', 'emails', 'notes', 'others'];

// ========== OPEN FILES MODAL ==========
async function openProjectFilesModal(projectIndex, stage) {
    let project;
    let projectNumber;
    let projectId;
    
    if (stage === 'pipeline') {
        project = pipelineProjects[projectIndex];
        projectNumber = project.projectNumber;
        projectId = project.id;
    } else if (stage === 'production') {
        project = projects[projectIndex];
        projectNumber = project.projectNumber;
        projectId = project.id;
    }
    
    if (!project) {
        alert('Project not found');
        return;
    }
    
    currentProjectFiles = {
        index: projectIndex,
        stage: stage,
        projectNumber: projectNumber,
        projectId: projectId,
        currentFolder: null
    };
    
    const modal = document.createElement('div');
    modal.id = 'projectFilesModal';
    modal.className = 'modal active';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; height: 80vh; background: #1a1a1a; border: 1px solid #404040; display: flex; flex-direction: column;">
            <div class="modal-header" style="background: #252525; border-bottom: 1px solid #404040; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 16px 20px;">
                <div>
                    <div style="font-size: 18px; font-weight: 600; color: #fff;">📁 Project Files</div>
                    <div style="font-size: 14px; color: #999; margin-top: 4px;">
                        ${projectNumber} - ${project.name}
                    </div>
                </div>
                <button onclick="closeProjectFilesModal()" style="
                    background: #333;
                    border: 1px solid #555;
                    color: #fff;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#ff4444'; this.style.borderColor='#ff4444'" onmouseout="this.style.background='#333'; this.style.borderColor='#555'">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px; overflow: hidden; background: #1a1a1a; flex: 1; padding: 16px;">
                <!-- Breadcrumb -->
                <div id="filesBreadcrumb" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #252525; border-radius: 6px; border: 1px solid #404040;">
                    <span style="cursor: pointer; color: #4a9eff;" onclick="showFolderList()">📁 Folders</span>
                </div>
                
                <!-- Content Area -->
                <div id="filesContent" style="flex: 1; overflow-y: auto; padding: 0 4px;">
                    <!-- Folders or Files will be rendered here -->
                </div>
            </div>
            <div style="padding: 16px 20px; background: #252525; border-top: 1px solid #404040; display: flex; justify-content: flex-end;">
                <button class="modal-btn" onclick="closeProjectFilesModal()" style="
                    background: #333;
                    border: 1px solid #555;
                    color: #e0e0e0;
                    padding: 10px 24px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#404040'; this.style.borderColor='#666'" onmouseout="this.style.background='#333'; this.style.borderColor='#555'">
                    Close
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    showFolderList();
}

function closeProjectFilesModal() {
    const modal = document.getElementById('projectFilesModal');
    if (modal) modal.remove();
    currentProjectFiles = { index: null, stage: null, projectNumber: null, projectId: null, currentFolder: null };
}

// ========== SHOW FOLDER LIST ==========
function showFolderList() {
    currentProjectFiles.currentFolder = null;
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = `
        <span style="color: #fff; font-weight: 500;">📁 Folders</span>
    `;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; padding: 8px;">
            ${projectFolders.map(folder => `
                <div class="folder-card" onclick="openFolder('${folder}')" style="
                    padding: 24px 20px;
                    border: 2px solid #404040;
                    border-radius: 12px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                    background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                " onmouseover="this.style.borderColor='#0066cc'; this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 12px rgba(0,102,204,0.3)'" 
                   onmouseout="this.style.borderColor='#404040'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(0,0,0,0.3)'">
                    <div style="font-size: 56px; margin-bottom: 12px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                        ${getFolderIcon(folder)}
                    </div>
                    <div style="font-weight: 600; text-transform: capitalize; color: #e0e0e0; font-size: 15px; letter-spacing: 0.5px;">
                        ${folder}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getFolderIcon(folderName) {
    const icons = {
        quotes: '📋',
        drawings: '📐',
        photos: '🖼️',
        emails: '✉️',
        notes: '📄',
        others: '📁'
    };
    return icons[folderName] || '📁';
}

// ========== OPEN FOLDER ==========
async function openFolder(folderName) {
    currentProjectFiles.currentFolder = folderName;
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = `
        <span style="cursor: pointer; color: #4a9eff;" onclick="showFolderList()">📁 Folders</span>
        <span style="color: #666;"> / </span>
        <span style="color: #e0e0e0; font-weight: 500;">${getFolderIcon(folderName)} ${folderName}</span>
    `;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
            <div>Loading files...</div>
        </div>
    `;
    
    // Load files from database
    await loadFolderFiles(folderName);
}

// ========== LOAD FILES FROM DATABASE ==========
async function loadFolderFiles(folderName) {
    try {
        const folderPath = getFolderPath(currentProjectFiles.stage, currentProjectFiles.projectNumber, folderName);
        
        // Get files from database
        let query = supabaseClient
            .from('project_files')
            .select('*')
            .eq('folder_name', folderName)
            .order('uploaded_at', { ascending: false });
        
        if (currentProjectFiles.stage === 'pipeline') {
            query = query.eq('pipeline_project_id', currentProjectFiles.projectId);
        } else if (currentProjectFiles.stage === 'production') {
            query = query.eq('production_project_id', currentProjectFiles.projectId);
        }
        
        const { data: files, error } = await query;
        
        if (error) throw error;
        
        renderFilesList(files || [], folderName);
        
    } catch (err) {
        console.error('Error loading files:', err);
        const content = document.getElementById('filesContent');
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div>Error loading files</div>
            </div>
        `;
    }
}

// ========== RENDER FILES LIST ==========
function renderFilesList(files, folderName) {
    const content = document.getElementById('filesContent');
    
    if (files.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
                <div style="font-size: 18px; color: #999; margin-bottom: 24px;">No files yet</div>
                <button class="modal-btn primary" onclick="triggerFileUpload()">
                    📤 Upload Files
                </button>
                <input type="file" id="fileUploadInput" multiple style="display: none;" onchange="handleFileUpload(event)">
            </div>
        `;
        return;
    }
    
    content.innerHTML = `
        <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 500; color: #999;">${files.length} file(s)</div>
            <button class="modal-btn primary" onclick="triggerFileUpload()">
                📤 Upload Files
            </button>
            <input type="file" id="fileUploadInput" multiple style="display: none;" onchange="handleFileUpload(event)">
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${files.map(file => `
                <div class="file-row" style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 16px;
                    border: 1px solid #404040;
                    border-radius: 8px;
                    background: #252525;
                    transition: all 0.2s;
                    cursor: pointer;
                " onclick="previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')" onmouseover="this.style.background='#2a2a2a'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#252525'; this.style.borderColor='#404040'">
                    <div style="font-size: 28px;">
                        ${getFileIcon(file.file_type)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e0e0e0;">
                            ${file.file_name}
                        </div>
                        <div style="font-size: 12px; color: #888;">
                            ${formatFileSize(file.file_size)} • ${formatDate(file.uploaded_at)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;" onclick="event.stopPropagation()">
                        <button class="action-btn" onclick="downloadFile('${file.id}', '${file.file_path}', '${file.file_name}')" title="Download" style="background: #2a2a2a; border: 1px solid #404040; color: #4a9eff; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#333'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#404040'">
                            ⬇️
                        </button>
                        <button class="action-btn" onclick="deleteFile('${file.id}', '${file.file_path}')" title="Delete" style="background: #2a2a2a; border: 1px solid #404040; color: #ff4444; padding: 8px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#3a1a1a'; this.style.borderColor='#ff4444'" onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#404040'">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getFileIcon(fileType) {
    if (!fileType) return '📄';
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return '📄';
    if (type.includes('image') || type.includes('jpg') || type.includes('png')) return '🖼️';
    if (type.includes('excel') || type.includes('spreadsheet') || type.includes('sheet')) return '📊';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    if (type.includes('video') || type.includes('mp4')) return '🎬';
    return '📄';
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ========== FILE UPLOAD ==========
function triggerFileUpload() {
    document.getElementById('fileUploadInput').click();
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const folderName = currentProjectFiles.currentFolder;
    if (!folderName) {
        alert('Please select a folder first');
        return;
    }
    
    const uploadBtn = event.target.previousElementSibling;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Uploading...';
    
    try {
        for (let i = 0; i < files.length; i++) {
            await uploadSingleFile(files[i], folderName);
        }
        
        // Reload files list
        await loadFolderFiles(folderName);
        
        // Reset input
        event.target.value = '';
        
    } catch (err) {
        console.error('Upload error:', err);
        alert('Error uploading files. Please try again.');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📤 Upload Files';
    }
}

async function uploadSingleFile(file, folderName) {
    const folderPath = getFolderPath(currentProjectFiles.stage, currentProjectFiles.projectNumber, folderName);
    const filePath = `${folderPath}/${file.name}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('project-documents')
        .upload(filePath, file, {
            contentType: file.type,
            upsert: true
        });
    
    if (uploadError) throw uploadError;
    
    // Save metadata to database
    const fileRecord = {
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        folder_name: folderName
    };
    
    if (currentProjectFiles.stage === 'pipeline') {
        fileRecord.pipeline_project_id = currentProjectFiles.projectId;
    } else if (currentProjectFiles.stage === 'production') {
        fileRecord.production_project_id = currentProjectFiles.projectId;
    }
    
    const { error: dbError } = await supabaseClient
        .from('project_files')
        .insert([fileRecord]);
    
    if (dbError) throw dbError;
    
    console.log('✅ File uploaded:', file.name);
}

// ========== FILE PREVIEW ==========
async function previewFile(filePath, fileType, fileName) {
    try {
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(filePath);
        
        const publicUrl = urlData.publicUrl;
        
        // Check if file can be previewed in browser
        if (!fileType) {
            // Unknown type - download instead
            window.open(publicUrl, '_blank');
            return;
        }
        
        const type = fileType.toLowerCase();
        
        // PDF, images, text - open in new tab
        if (type.includes('pdf') || 
            type.includes('image') || 
            type.includes('jpg') || 
            type.includes('jpeg') || 
            type.includes('png') || 
            type.includes('gif') || 
            type.includes('webp') ||
            type.includes('text')) {
            window.open(publicUrl, '_blank');
        } else {
            // Other files - download
            window.open(publicUrl, '_blank');
        }
        
    } catch (err) {
        console.error('Preview error:', err);
        alert('Error opening file');
    }
}

// ========== FILE DOWNLOAD ==========
async function downloadFile(fileId, filePath, fileName) {
    try {
        const { data, error } = await supabaseClient.storage
            .from('project-documents')
            .download(filePath);
        
        if (error) throw error;
        
        // Create download link
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
    } catch (err) {
        console.error('Download error:', err);
        alert('Error downloading file');
    }
}

// ========== FILE DELETE ==========
async function deleteFile(fileId, filePath) {
    if (!confirm('Are you sure you want to delete this file?')) return;
    
    try {
        // Delete from Storage
        const { error: storageError } = await supabaseClient.storage
            .from('project-documents')
            .remove([filePath]);
        
        if (storageError) throw storageError;
        
        // Delete from Database
        const { error: dbError } = await supabaseClient
            .from('project_files')
            .delete()
            .eq('id', fileId);
        
        if (dbError) throw dbError;
        
        console.log('✅ File deleted');
        
        // Reload files list
        await loadFolderFiles(currentProjectFiles.currentFolder);
        
    } catch (err) {
        console.error('Delete error:', err);
        alert('Error deleting file');
    }
}

// ========== HELPER FUNCTIONS ==========
function getFolderPath(stage, projectNumber, folderName) {
    // Convert PL001/2025 → PL001-2025
    const folderSafeNumber = projectNumber.replace(/\//g, '-');
    return `${stage}/${folderSafeNumber}/${folderName}`;
}