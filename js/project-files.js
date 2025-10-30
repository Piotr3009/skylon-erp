// ========== PROJECT FILES MANAGEMENT SYSTEM ==========

let currentProjectFiles = {
    index: null,
    stage: null, // 'pipeline' | 'production' | 'archive'
    projectNumber: null,
    projectId: null,
    currentFolder: null
};

const projectFolders = ['quotes', 'drawings', 'photos', 'emails', 'notes'];

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
        <div class="modal-content" style="max-width: 900px; height: 80vh;">
            <div class="modal-header">
                <div>
                    <div style="font-size: 18px; font-weight: 600;">📁 Project Files</div>
                    <div style="font-size: 14px; color: #666; margin-top: 4px;">
                        ${projectNumber} - ${project.name}
                    </div>
                </div>
                <button class="modal-close" onclick="closeProjectFilesModal()">✕</button>
            </div>
            <div class="modal-body" style="display: flex; flex-direction: column; gap: 16px; overflow: hidden;">
                <!-- Breadcrumb -->
                <div id="filesBreadcrumb" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f5f5f5; border-radius: 6px;">
                    <span style="cursor: pointer; color: #0066cc;" onclick="showFolderList()">📁 Folders</span>
                </div>
                
                <!-- Content Area -->
                <div id="filesContent" style="flex: 1; overflow-y: auto; padding: 0 4px;">
                    <!-- Folders or Files will be rendered here -->
                </div>
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
        <span style="color: #333; font-weight: 500;">📁 Folders</span>
    `;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px;">
            ${projectFolders.map(folder => `
                <div class="folder-card" onclick="openFolder('${folder}')" style="
                    padding: 24px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                    background: white;
                " onmouseover="this.style.borderColor='#0066cc'; this.style.transform='translateY(-2px)'" 
                   onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
                    <div style="font-size: 48px; margin-bottom: 8px;">
                        ${getFolderIcon(folder)}
                    </div>
                    <div style="font-weight: 500; text-transform: capitalize;">
                        ${folder}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getFolderIcon(folderName) {
    const icons = {
        quotes: '💼',
        drawings: '📐',
        photos: '📸',
        emails: '📧',
        notes: '📝'
    };
    return icons[folderName] || '📁';
}

// ========== OPEN FOLDER ==========
async function openFolder(folderName) {
    currentProjectFiles.currentFolder = folderName;
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = `
        <span style="cursor: pointer; color: #0066cc;" onclick="showFolderList()">📁 Folders</span>
        <span style="color: #999;"> / </span>
        <span style="color: #333; font-weight: 500;">${getFolderIcon(folderName)} ${folderName}</span>
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
                <div style="font-size: 18px; color: #666; margin-bottom: 24px;">No files yet</div>
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
            <div style="font-weight: 500; color: #666;">${files.length} file(s)</div>
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
                    padding: 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    background: white;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='white'">
                    <div style="font-size: 24px;">
                        ${getFileIcon(file.file_type)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${file.file_name}
                        </div>
                        <div style="font-size: 12px; color: #999;">
                            ${formatFileSize(file.file_size)} • ${formatDate(file.uploaded_at)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="action-btn" onclick="downloadFile('${file.id}', '${file.file_path}', '${file.file_name}')" title="Download">
                            ⬇️
                        </button>
                        <button class="action-btn" onclick="deleteFile('${file.id}', '${file.file_path}')" title="Delete" style="color: #dc3545;">
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
    if (type.includes('pdf')) return '📕';
    if (type.includes('image') || type.includes('jpg') || type.includes('png')) return '🖼️';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('word') || type.includes('document')) return '📘';
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