// ========== PROJECT FILES MANAGEMENT SYSTEM ==========

let currentProjectFiles = {
    index: null,
    stage: null, // 'pipeline' | 'production' | 'archive'
    projectNumber: null,
    projectId: null,
    currentFolder: null
};

const projectFolders = ['estimates', 'drawings', 'photos', 'emails', 'notes', 'others'];

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
async function showFolderList() {
    currentProjectFiles.currentFolder = null;
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = `
        <span style="color: #fff; font-weight: 500;">📁 Folders</span>
    `;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #999;">
            <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
            <div style="font-size: 14px;">Loading folders...</div>
        </div>
    `;
    
    // Get file counts for each folder
    const folderCounts = await getFolderFileCounts();
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding: 8px;">
            ${projectFolders.map(folder => {
                const count = folderCounts[folder] || 0;
                return `
                <div class="folder-card" onclick="openFolder('${folder}')" style="
                    padding: 18px 16px;
                    border: 1px solid #404040;
                    border-radius: 8px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                    background: linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    position: relative;
                " onmouseover="this.style.borderColor='#4a9eff'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(74,158,255,0.3)'" 
                   onmouseout="this.style.borderColor='#404040'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.3)'">
                    ${count > 0 ? `
                        <div style="
                            position: absolute;
                            top: 8px;
                            right: 8px;
                            background: linear-gradient(135deg, #88d498 0%, #6fb880 100%);
                            color: #1a1a1a;
                            font-size: 11px;
                            font-weight: 700;
                            padding: 3px 7px;
                            border-radius: 10px;
                            min-width: 20px;
                            text-align: center;
                            box-shadow: 0 2px 4px rgba(136,212,152,0.4);
                        ">${count}</div>
                    ` : ''}
                    <div style="margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));">
                        ${getFolderIcon(folder)}
                    </div>
                    <div style="font-weight: 600; text-transform: capitalize; color: #e0e0e0; font-size: 13px; letter-spacing: 0.3px;">
                        ${folder}
                    </div>
                </div>
            `}).join('')}
            
            <!-- Add New Folder Button -->
            <div class="folder-card" onclick="createNewFolder()" style="
                padding: 18px 16px;
                border: 2px dashed #555;
                border-radius: 8px;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s;
                background: transparent;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            " onmouseover="this.style.borderColor='#88d498'; this.style.background='rgba(136,212,152,0.05)'" 
               onmouseout="this.style.borderColor='#555'; this.style.background='transparent'">
                <div style="margin-bottom: 8px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 5V19M5 12H19" stroke="#666" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div style="font-weight: 600; color: #888; font-size: 13px; letter-spacing: 0.3px;">
                    New Folder
                </div>
            </div>
        </div>
    `;
}

// ========== GET FILE COUNTS FOR FOLDERS ==========
async function getFolderFileCounts() {
    try {
        let query = supabaseClient
            .from('project_files')
            .select('folder_name');
        
        if (currentProjectFiles.stage === 'pipeline') {
            query = query.eq('pipeline_project_id', currentProjectFiles.projectId);
        } else if (currentProjectFiles.stage === 'production') {
            query = query.eq('production_project_id', currentProjectFiles.projectId);
        }
        
        const { data: files, error } = await query;
        
        if (error) throw error;
        
        // Count files per folder
        const counts = {};
        projectFolders.forEach(folder => counts[folder] = 0);
        
        if (files) {
            files.forEach(file => {
                if (file.folder_name && counts.hasOwnProperty(file.folder_name)) {
                    counts[file.folder_name]++;
                }
            });
        }
        
        return counts;
    } catch (err) {
        console.error('Error getting folder counts:', err);
        return {};
    }
}

function getFolderIcon(folderName) {
    const icons = {
        estimates: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#059669" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 12H16M10 14H14" stroke="#059669" stroke-width="0.9" stroke-linecap="round"/>
            <circle cx="9" cy="12" r="0.5" fill="#059669"/>
            <circle cx="9" cy="14" r="0.5" fill="#059669"/>
            <text x="12" y="17.5" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#059669">£</text>
        </svg>`,
        
        drawings: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#2563EB" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 11L16 16M16 11L8 16" stroke="#2563EB" stroke-width="0.9" stroke-linecap="round"/>
            <circle cx="12" cy="13.5" r="2.8" stroke="#2563EB" stroke-width="0.9"/>
        </svg>`,
        
        photos: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#DB2777" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="11" width="7" height="5" rx="0.8" stroke="#DB2777" stroke-width="0.85"/>
            <circle cx="12" cy="13.5" r="1.3" stroke="#DB2777" stroke-width="0.85"/>
            <circle cx="14" cy="12.3" r="0.5" fill="#DB2777"/>
        </svg>`,
        
        emails: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#D97706" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="11.5" width="7" height="4.5" rx="0.5" stroke="#D97706" stroke-width="0.85"/>
            <path d="M8.5 11.5L12 14L15.5 11.5" stroke="#D97706" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        
        notes: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#7C3AED" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <rect x="8.5" y="11.5" width="7" height="4.5" rx="0.5" stroke="#7C3AED" stroke-width="0.85"/>
            <path d="M10 13H14M10 14.5H13" stroke="#7C3AED" stroke-width="0.7" stroke-linecap="round"/>
        </svg>`,
        
        others: `<svg width="35" height="35" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" stroke="#64748B" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="10" cy="13.5" r="0.8" fill="#64748B"/>
            <circle cx="12" cy="13.5" r="0.8" fill="#64748B"/>
            <circle cx="14" cy="13.5" r="0.8" fill="#64748B"/>
        </svg>`
    };
    return icons[folderName] || icons.others;
}

// ========== OPEN FOLDER ==========
async function openFolder(folderName) {
    currentProjectFiles.currentFolder = folderName;
    
    // Update breadcrumb
    const parts = folderName.split('/');
    let breadcrumbHTML = `<span style="cursor: pointer; color: #4a9eff;" onclick="showFolderList()">📁 Folders</span>`;
    
    let pathSoFar = '';
    parts.forEach((part, index) => {
        pathSoFar += (index > 0 ? '/' : '') + part;
        const currentPath = pathSoFar;
        breadcrumbHTML += `<span style="color: #666;"> / </span>`;
        if (index === parts.length - 1) {
            breadcrumbHTML += `<span style="color: #e0e0e0; font-weight: 500;">${part}</span>`;
        } else {
            breadcrumbHTML += `<span style="cursor: pointer; color: #4a9eff;" onclick="openFolder('${currentPath}')">${part}</span>`;
        }
    });
    
    const breadcrumb = document.getElementById('filesBreadcrumb');
    breadcrumb.innerHTML = breadcrumbHTML;
    
    const content = document.getElementById('filesContent');
    content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
            <div>Loading...</div>
        </div>
    `;
    
    // Load subfolders and files
    await loadFolderContents(folderName);
}

// ========== LOAD FOLDER CONTENTS (SUBFOLDERS + FILES) ==========
async function loadFolderContents(folderName) {
    try {
        // Get all files and subfolders
        let query = supabaseClient
            .from('project_files')
            .select('*')
            .order('uploaded_at', { ascending: false });
        
        if (currentProjectFiles.stage === 'pipeline') {
            query = query.eq('pipeline_project_id', currentProjectFiles.projectId);
        } else if (currentProjectFiles.stage === 'production') {
            query = query.eq('production_project_id', currentProjectFiles.projectId);
        }
        
        const { data: allFiles, error } = await query;
        
        if (error) throw error;
        
        // Find subfolders and files in current folder
        const subfolders = new Set();
        const files = [];
        
        (allFiles || []).forEach(file => {
            const fileFolderName = file.folder_name || '';
            
            // Skip placeholder files
            if (file.file_name === '.folder') return;
            
            // Check if file is in current folder or subfolder
            if (fileFolderName === folderName) {
                // Direct file in this folder
                files.push(file);
            } else if (fileFolderName.startsWith(folderName + '/')) {
                // File in subfolder
                const remainder = fileFolderName.substring(folderName.length + 1);
                const nextFolder = remainder.split('/')[0];
                if (nextFolder) {
                    subfolders.add(nextFolder);
                }
            }
        });
        
        renderFolderContents(Array.from(subfolders), files, folderName);
        
    } catch (err) {
        console.error('Error loading folder contents:', err);
        const content = document.getElementById('filesContent');
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div>Error loading folder</div>
            </div>
        `;
    }
}

// ========== LOAD FILES FROM DATABASE (old function, keep for compatibility) ==========
async function loadFolderFiles(folderName) {
    await loadFolderContents(folderName);
}

// ========== RENDER FOLDER CONTENTS (SUBFOLDERS + FILES) ==========
function renderFolderContents(subfolders, files, folderName) {
    const content = document.getElementById('filesContent');
    
    let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    // Upload button
    html += `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-weight: 500; color: #999;">${subfolders.length} subfolder(s), ${files.length} file(s)</div>
            <div style="display: flex; gap: 8px;">
                <button class="modal-btn" onclick="createNewSubfolder('${folderName}')" style="
                    background: #333;
                    border: 1px solid #555;
                    color: #4a9eff;
                    padding: 8px 16px;
                    border-radius: 6px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#404040'" onmouseout="this.style.background='#333'">
                    ➕ New Subfolder
                </button>
                <button class="modal-btn primary" onclick="triggerFileUpload()">
                    📤 Upload Files
                </button>
            </div>
            <input type="file" id="fileUploadInput" multiple style="display: none;" onchange="handleFileUpload(event)">
        </div>
    `;
    
    // Subfolders
    if (subfolders.length > 0) {
        html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px;">';
        subfolders.forEach(subfolder => {
            html += `
                <div class="folder-card" onclick="openFolder('${folderName}/${subfolder}')" style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    background: #252525;
                    border: 1px solid #404040;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    gap: 10px;
                    text-align: center;
                " onmouseover="this.style.background='#2a2a2a'; this.style.borderColor='#4a9eff'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='#252525'; this.style.borderColor='#404040'; this.style.transform='translateY(0)'">
                    <div style="font-size: 32px;">📁</div>
                    <div style="font-size: 14px; font-weight: 500; color: #e0e0e0; word-break: break-word;">
                        ${subfolder}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Files
    if (files.length > 0) {
        html += '<div style="display: flex; flex-direction: column; gap: 6px;">';
        files.forEach(file => {
            html += `
                <div class="file-row" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    background: #252525;
                    transition: all 0.2s;
                    cursor: pointer;
                " onclick="previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')" onmouseover="this.style.background='#2a2a2a'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#252525'; this.style.borderColor='#404040'">
                    <div style="font-size: 22px;">
                        ${getFileIcon(file.file_name)}
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-weight: 500; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${file.file_name}
                        </div>
                        <div style="font-size: 12px; color: #999;">
                            ${formatFileSize(file.file_size)} • ${formatDate(file.uploaded_at)}
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); deleteFile('${file.id}')" style="
                        background: transparent;
                        border: 1px solid #ff4444;
                        color: #ff4444;
                        width: 32px;
                        height: 32px;
                        border-radius: 4px;
                        font-size: 16px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#ff4444'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='#ff4444'">🗑</button>
                </div>
            `;
        });
        html += '</div>';
    }
    
    // Empty state
    if (subfolders.length === 0 && files.length === 0) {
        html += `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 64px; margin-bottom: 16px;">📭</div>
                <div style="font-size: 18px; color: #999; margin-bottom: 24px;">This folder is empty</div>
                <div style="font-size: 14px; color: #666;">Create a subfolder or upload files to get started</div>
            </div>
        `;
    }
    
    html += '</div>';
    content.innerHTML = html;
}

// ========== CREATE NEW SUBFOLDER ==========
async function createNewSubfolder(parentFolder) {
    const subfolderName = prompt('Enter subfolder name:');
    
    if (!subfolderName || !subfolderName.trim()) {
        return;
    }
    
    const sanitized = subfolderName.trim().replace(/[^a-zA-Z0-9\s\-_]/g, '');
    
    if (!sanitized) {
        alert('Invalid folder name');
        return;
    }
    
    // Subfolder path
    const newFolderPath = `${parentFolder}/${sanitized}`;
    
    try {
        // Create a placeholder file in database to mark folder as existing
        const placeholderData = {
            file_name: '.folder',
            folder_name: newFolderPath,
            file_path: `${newFolderPath}/.folder`,
            file_type: 'folder',
            file_size: 0
        };
        
        if (currentProjectFiles.stage === 'pipeline') {
            placeholderData.pipeline_project_id = currentProjectFiles.projectId;
        } else if (currentProjectFiles.stage === 'production') {
            placeholderData.production_project_id = currentProjectFiles.projectId;
        }
        
        const { error } = await supabaseClient
            .from('project_files')
            .insert([placeholderData]);
        
        if (error) throw error;
        
        console.log(`✅ Subfolder created: ${newFolderPath}`);
        
        // Reload to show new subfolder
        await loadFolderContents(parentFolder);
        
    } catch (err) {
        console.error('Error creating subfolder:', err);
        alert('Error creating subfolder: ' + err.message);
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
        
        <div style="display: flex; flex-direction: column; gap: 6px;">
            ${files.map(file => `
                <div class="file-row" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 12px;
                    border: 1px solid #404040;
                    border-radius: 6px;
                    background: #252525;
                    transition: all 0.2s;
                    cursor: pointer;
                " onclick="previewFile('${file.file_path}', '${file.file_type}', '${file.file_name}')" onmouseover="this.style.background='#2a2a2a'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#252525'; this.style.borderColor='#404040'">
                    <div style="font-size: 22px;">
                        ${getFileIcon(file.file_type, file.file_name)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e0e0e0; font-size: 13px;">
                            ${file.file_name}
                        </div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">
                            ${formatFileSize(file.file_size)} • ${formatDate(file.uploaded_at)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px;" onclick="event.stopPropagation()">
                        <button class="action-btn" onclick="downloadFile('${file.id}', '${file.file_path}', '${file.file_name}')" title="Download" style="background: #2a2a2a; border: 1px solid #404040; color: #4a9eff; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 14px;" onmouseover="this.style.background='#333'; this.style.borderColor='#4a9eff'" onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#404040'">
                            ⬇️
                        </button>
                        <button class="action-btn" onclick="deleteFile('${file.id}', '${file.file_path}')" title="Delete" style="background: #2a2a2a; border: 1px solid #404040; color: #ff4444; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: all 0.2s; font-size: 14px;" onmouseover="this.style.background='#3a1a1a'; this.style.borderColor='#ff4444'" onmouseout="this.style.background='#2a2a2a'; this.style.borderColor='#404040'">
                            🗑️
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function getFileIcon(fileType, fileName = '') {
    // Najpierw sprawdź file_type
    let ext = '';
    
    if (fileType) {
        const type = fileType.toLowerCase();
        if (type.includes('pdf')) ext = 'pdf';
        else if (type.includes('image') || type.includes('jpg') || type.includes('png')) ext = 'image';
        else if (type.includes('excel') || type.includes('spreadsheet') || type.includes('sheet')) ext = 'excel';
        else if (type.includes('word') || type.includes('document')) ext = 'word';
        else if (type.includes('zip') || type.includes('rar')) ext = 'archive';
        else if (type.includes('video') || type.includes('mp4')) ext = 'video';
    }
    
    // Jeśli file_type puste, sprawdź rozszerzenie z nazwy pliku
    if (!ext && fileName) {
        const fileExt = fileName.toLowerCase().split('.').pop();
        if (fileExt === 'pdf') ext = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileExt)) ext = 'image';
        else if (['xls', 'xlsx', 'csv'].includes(fileExt)) ext = 'excel';
        else if (['doc', 'docx'].includes(fileExt)) ext = 'word';
        else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt)) ext = 'archive';
        else if (['mp4', 'avi', 'mov', 'wmv', 'mkv'].includes(fileExt)) ext = 'video';
        else if (['dwg', 'dxf', 'dwf'].includes(fileExt)) ext = 'dwg';
        else if (['skp'].includes(fileExt)) ext = 'sketchup';
    }
    
    // Zwróć SVG ikonę
    const icons = {
        pdf: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="#EF4444">PDF</text>
        </svg>`,
        
        dwg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="5" font-weight="bold" fill="#3B82F6">DWG</text>
        </svg>`,
        
        image: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#10B981" stroke-width="2"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="#10B981"/>
            <path d="M21 15L16 10L5 21" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`,
        
        excel: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 13L12 17M12 13L8 17" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
        </svg>`,
        
        word: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7 13H10M7 17H13" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`,
        
        archive: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="#F59E0B">ZIP</text>
        </svg>`,
        
        video: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 12L14 15L10 18V12Z" fill="#EC4899"/>
        </svg>`,
        
        sketchup: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M14 2V8H20" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="12" y="17" text-anchor="middle" font-size="5" font-weight="bold" fill="#8B5CF6">SKP</text>
        </svg>`
    };
    
    // Default generic file icon
    const defaultIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 2V8H20" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    
    return icons[ext] || defaultIcon;
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
    
    // Sanitize filename - remove invalid characters for Supabase Storage
    const sanitizedFileName = file.name
        .replace(/[\[\]{}<>*?\\|:#%]/g, '_')  // Replace invalid chars with underscore
        .replace(/\s+/g, '_')  // Replace spaces with underscore
        .replace(/_+/g, '_');  // Remove multiple underscores
    
    const filePath = `${folderPath}/${sanitizedFileName}`;
    
    console.log(`📤 Uploading: ${file.name} → ${sanitizedFileName}`);
    
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

// ========== CREATE NEW CUSTOM FOLDER ==========
async function createNewFolder() {
    const folderName = prompt('Enter new folder name (lowercase, no spaces):');
    
    if (!folderName) return;
    
    // Validate folder name
    const sanitized = folderName.toLowerCase().trim().replace(/\s+/g, '-');
    
    if (!sanitized) {
        alert('Invalid folder name');
        return;
    }
    
    // Check if folder already exists
    if (projectFolders.includes(sanitized)) {
        alert('Folder already exists!');
        return;
    }
    
    try {
        // Create folder in storage
        const folderPath = getFolderPath(currentProjectFiles.stage, currentProjectFiles.projectNumber, sanitized);
        const keepFilePath = `${folderPath}/.keep`;
        
        const { error } = await supabaseClient.storage
            .from('project-documents')
            .upload(keepFilePath, new Blob([''], { type: 'text/plain' }), {
                contentType: 'text/plain',
                upsert: false
            });
        
        if (error) throw error;
        
        // Add to projectFolders array
        projectFolders.push(sanitized);
        
        console.log(`✅ Folder created: ${sanitized}`);
        
        // Reload folder list
        await showFolderList();
        
    } catch (err) {
        console.error('Error creating folder:', err);
        alert('Error creating folder. Please try again.');
    }
}