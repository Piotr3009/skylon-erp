// ============================================
// PRODUCTION SHEET BUILDER
// Joinery Core by Skylon Development LTD
// ============================================

// ========== HELPER FUNCTIONS ==========
// Parse project notes from JSON string
function parseProjectNotesPS(notesString) {
    if (!notesString || notesString.trim() === '') {
        return [];
    }
    try {
        const parsed = JSON.parse(notesString);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// ========== GLOBAL STATE ==========
let currentProject = null;
let currentSheet = null;
let checklistItems = [];
let checklistStatus = {};
let scopeDescription = ''; // Production manager's description
let sprayDescription = ''; // Spray instructions
let editedNotes = {}; // Edited copies of important notes (key = note index)
let originalImportantNotes = []; // Cache of original important notes for edit modal
let selectedPhotos = []; // Selected photos for PS (multi-select)
let projectData = {
    project: null,
    client: null,
    phases: [],
    materials: [],
    elements: [],
    blockers: [],
    files: [],
    attachments: []
};

// URL params
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('project_id');
const projectStage = urlParams.get('stage') || 'production';

// ========== CHECKLIST DEFINITION ==========
const CHECKLIST_SECTIONS = [
    {
        key: 'CORE',
        title: 'Core Info',
        icon: '📋',
        items: [
            { key: 'CORE_PROJECT_NUMBER', label: 'Project Number', source: 'AUTO', required: true },
            { key: 'CORE_PROJECT_NAME', label: 'Project Name', source: 'AUTO', required: true },
            { key: 'CORE_CLIENT', label: 'Client', source: 'AUTO', required: true },
            { key: 'CORE_DEADLINE', label: 'Production Deadline', source: 'AUTO', required: true }
        ]
    },
    {
        key: 'SCOPE',
        title: 'Scope & Notes',
        icon: '📝',
        items: [
            { key: 'SCOPE_TYPE', label: 'Project Type', source: 'AUTO', required: true },
            { key: 'SCOPE_DESCRIPTION', label: 'Production Description', source: 'MANUAL', required: false, isTextArea: true },
            { key: 'SCOPE_URGENT_NOTES', label: 'Important Notes (from project)', source: 'AUTO', required: false, showContent: true }
        ]
    },
    {
        key: 'BOM',
        title: 'Elements List',
        icon: '🪟',
        items: [
            { key: 'BOM_HAS_ELEMENTS', label: 'At least 1 element defined', source: 'AUTO', required: true, goTo: 'elements' }
        ]
    },
    {
        key: 'DRAWINGS',
        title: 'Drawings',
        icon: '📐',
        items: [
            { key: 'ATT_DRAWINGS_MAIN', label: 'Main Drawings (PDF)', source: 'SELECT_FILE', required: true, fileFolder: 'drawings' }
        ]
    },
    {
        key: 'MATERIALS',
        title: 'Materials',
        icon: '🪵',
        items: [
            { key: 'MAT_LIST', label: 'Materials List', source: 'AUTO', required: true }
        ]
    },
    {
        key: 'SPRAY',
        title: 'Spray Pack',
        icon: '🎨',
        conditional: true, // tylko jeśli projekt ma fazę spray
        items: [
            { key: 'SPRAY_DESCRIPTION', label: 'Spray Instructions', source: 'MANUAL', required: false, isSprayText: true },
            { key: 'SPRAY_COLORS', label: 'Colour Reference', source: 'SELECT_FILE', required: false, fileFolder: 'spray' },
            { key: 'SPRAY_DISCLAIMER', label: 'Spraying Manager Notice', source: 'INFO', required: false, isDisclaimer: true }
        ]
    },
    {
        key: 'ROUTING',
        title: 'Phases / Timeline',
        icon: '📅',
        items: [
            { key: 'ROUTING_HAS_PHASES', label: 'At least 1 phase defined', source: 'AUTO', required: true, goTo: 'phases' },
            { key: 'ROUTING_DEADLINES', label: 'Phase deadlines set', source: 'AUTO', required: false },
            { key: 'ROUTING_ASSIGNED', label: 'Workers assigned', source: 'AUTO', required: false }
        ]
    },
    {
        key: 'PHOTOS',
        title: 'Photos',
        icon: '📷',
        items: [
            { key: 'ATT_PHOTOS', label: 'Reference Photos', source: 'SELECT_FILE', required: false, fileFolder: 'photos' }
        ]
    },
    {
        key: 'QC',
        title: 'QC Checklist',
        icon: '✅',
        items: [
            { key: 'QC_TEMPLATE', label: 'QC Template included', source: 'AUTO', required: true }
        ]
    }
];

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', async () => {
    if (!projectId) {
        showToast('No project ID provided!', 'error');
        setTimeout(() => window.history.back(), 2000);
        return;
    }
    
    await loadAllData();
    buildChecklist();
    updateDescriptionUI(); // Update description button if text exists
    updateSprayUI(); // Update spray button if text exists
    await checkAllItems();
    updateProgress();
    generatePreview();
});

// ========== DATA LOADING ==========
async function loadAllData() {
    try {
        // 1. Load project
        const { data: project, error: projectError } = await supabaseClient
            .from(projectStage === 'pipeline' ? 'pipeline_projects' : 'projects')
            .select('*')
            .eq('id', projectId)
            .single();
        
        if (projectError) throw projectError;
        projectData.project = project;
        currentProject = project;
        
        // Update header
        document.getElementById('psProjectTitle').textContent = 
            `${project.project_number || 'N/A'} - ${project.name || 'Untitled'}`;
        document.getElementById('psProjectSubtitle').textContent = 
            project.type || 'Project';
        
        // 2. Load client
        if (project.client_id) {
            const { data: client } = await supabaseClient
                .from('clients')
                .select('*')
                .eq('id', project.client_id)
                .single();
            projectData.client = client;
        }
        
        // 3. Load phases
        const phasesTable = projectStage === 'pipeline' ? 'pipeline_phases' : 'project_phases';
        const phasesFK = projectStage === 'pipeline' ? 'pipeline_project_id' : 'project_id';
        
        const { data: phases } = await supabaseClient
            .from(phasesTable)
            .select('*, team_members(name)')
            .eq(phasesFK, projectId)
            .order('order_position', { ascending: true });
        projectData.phases = phases || [];
        
        // 4. Load materials
        const { data: materials, error: materialsError } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items(name, item_number, size, thickness, image_url, current_quantity, reserved_quantity, unit)
            `)
            .eq('project_id', projectId)
            .order('used_in_stage')
            .order('created_at');
        
        if (materialsError) {
            console.error('Materials load error:', materialsError);
        }
        projectData.materials = materials || [];
        
        // 5. Load elements (BOM)
        const { data: elements, error: elementsError } = await supabaseClient
            .from('project_elements')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');
        projectData.elements = elements || [];
        
        // 6. Load blockers
        const { data: blockers } = await supabaseClient
            .from('project_blockers')
            .select('*, team_members(name)')
            .eq('project_id', projectId)
            .eq('status', 'active');
        projectData.blockers = blockers || [];
        
        // 7. Load project files (drawings, photos from project_files)
        const filesFK = projectStage === 'pipeline' ? 'pipeline_project_id' : 'production_project_id';
        const { data: files } = await supabaseClient
            .from('project_files')
            .select('*')
            .eq(filesFK, projectId);
        projectData.files = files || [];
        
        // 8. Check for existing production sheet (draft)
        const { data: existingSheet, error: sheetError } = await supabaseClient
            .from('production_sheets')
            .select('*')
            .eq('project_id', projectId)
            .eq('status', 'draft')
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (existingSheet) {
            currentSheet = existingSheet;
            
            // Load attachments separately
            const { data: attachments } = await supabaseClient
                .from('production_sheet_attachments')
                .select('*')
                .eq('sheet_id', existingSheet.id);
            
            projectData.attachments = attachments || [];
            
            // Load scopeDescription from snapshot if exists
            if (existingSheet.snapshot_json?.scopeDescription) {
                scopeDescription = existingSheet.snapshot_json.scopeDescription;
            }
            // Load sprayDescription from snapshot if exists
            if (existingSheet.snapshot_json?.sprayDescription) {
                sprayDescription = existingSheet.snapshot_json.sprayDescription;
            }
            // Load editedNotes from snapshot if exists
            if (existingSheet.snapshot_json?.editedNotes) {
                editedNotes = existingSheet.snapshot_json.editedNotes;
            }
        }
        
    } catch (err) {
        console.error('Error loading data:', err);
        showToast('Error loading project data: ' + err.message, 'error');
    }
}

// ========== CHECKLIST BUILDING ==========
function buildChecklist() {
    const container = document.getElementById('psChecklist');
    container.innerHTML = '';
    
    // Czyścimy listę - zapobiega duplikatom
    checklistItems = [];
    
    // Check if spray section should be visible
    const hasSprayPhase = projectData.phases.some(p => 
        p.phase_key && p.phase_key.toLowerCase().includes('spray')
    );
    
    CHECKLIST_SECTIONS.forEach(section => {
        // Skip conditional sections if condition not met
        if (section.conditional && section.key === 'SPRAY' && !hasSprayPhase) {
            return;
        }
        
        const sectionEl = document.createElement('div');
        sectionEl.className = 'ps-section';
        sectionEl.id = `section-${section.key}`;
        
        // Section header
        const headerEl = document.createElement('div');
        headerEl.className = 'ps-section-header';
        headerEl.innerHTML = `
            <div class="ps-section-title">
                <span>${section.icon}</span>
                <span>${section.title}</span>
            </div>
            <span class="ps-section-badge" id="badge-${section.key}">...</span>
        `;
        sectionEl.appendChild(headerEl);
        
        // Section items
        const itemsEl = document.createElement('div');
        itemsEl.className = 'ps-section-items';
        
        section.items.forEach(item => {
            const itemEl = createChecklistItem(item, section.key);
            itemsEl.appendChild(itemEl);
            checklistItems.push({ ...item, sectionKey: section.key });
        });
        
        sectionEl.appendChild(itemsEl);
        container.appendChild(sectionEl);
    });
}

function createChecklistItem(item, sectionKey) {
    const div = document.createElement('div');
    div.className = 'ps-item';
    div.id = `item-${item.key}`;
    
    // Special handling for textarea items (opens modal)
    if (item.isTextArea) {
        div.innerHTML = `
            <div class="ps-item-icon" id="icon-${item.key}">✏️</div>
            <div class="ps-item-content">
                <div class="ps-item-label">${item.label}</div>
                <div class="ps-item-meta" id="meta-${item.key}">Click to add${!item.required ? ' • Optional' : ''}</div>
            </div>
            <button class="ps-item-action go" id="btn-${item.key}" onclick="openDescriptionModal()">+ Add</button>
        `;
        return div;
    }
    
    // Special handling for showing content (Important Notes)
    if (item.showContent) {
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                <div class="ps-item-icon" id="icon-${item.key}">⏳</div>
                <div class="ps-item-content">
                    <div class="ps-item-label">${item.label}</div>
                    <div class="ps-item-meta" id="meta-${item.key}">${item.source}${!item.required ? ' • Optional' : ''}</div>
                </div>
            </div>
            <div id="content-${item.key}" style="background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 6px; padding: 10px; font-size: 11px; color: #888; max-height: 150px; overflow-y: auto;">
                <em>Loading notes...</em>
            </div>
            <div style="font-size: 10px; color: #666; margin-top: 5px; font-style: italic;">
                📌 Notes added during project preparation
            </div>
        `;
        return div;
    }
    
    // Special handling for Spray Instructions (opens modal)
    if (item.isSprayText) {
        div.innerHTML = `
            <div class="ps-item-icon" id="icon-${item.key}">✏️</div>
            <div class="ps-item-content">
                <div class="ps-item-label">${item.label}</div>
                <div class="ps-item-meta" id="meta-${item.key}">Click to add • Optional</div>
            </div>
            <button class="ps-item-action go" id="btn-${item.key}" onclick="openSprayModal()">+ Add</button>
        `;
        return div;
    }
    
    // Special handling for Disclaimer
    if (item.isDisclaimer) {
        div.style.background = '#2d2d30';
        div.style.borderLeft = '3px solid #f59e0b';
        div.innerHTML = `
            <div class="ps-item-icon">⚠️</div>
            <div class="ps-item-content">
                <div class="ps-item-label" style="color: #f59e0b;">${item.label}</div>
                <div class="ps-item-meta" style="color: #888; font-size: 11px; line-height: 1.4; margin-top: 5px;">
                    Please review ALL project documentation - there may be important information for spraying in other sections.
                </div>
            </div>
        `;
        return div;
    }
    
    // Determine action button (standard items)
    let actionBtn = '';
    if (item.source === 'UPLOAD') {
        actionBtn = `<button class="ps-item-action upload" onclick="openUploadModal('${item.key}', '${item.uploadType}', '${item.accept || ''}')">📁 Upload</button>`;
    } else if (item.source === 'SELECT_FILE') {
        // Special handling for photos - use multi-select modal
        if (item.fileFolder === 'photos') {
            actionBtn = `<button class="ps-item-action upload" id="btn-${item.key}" onclick="openPhotosSelectModal()">📷 Select</button>`;
        } else {
            actionBtn = `<button class="ps-item-action upload" id="btn-${item.key}" onclick="openSelectFilesModal('${item.key}', '${item.fileFolder}')">📁 Select</button>`;
        }
    } else if (item.goTo) {
        actionBtn = `<button class="ps-item-action go" onclick="goToSection('${item.goTo}')">→ Go</button>`;
    }
    
    div.innerHTML = `
        <div class="ps-item-icon" id="icon-${item.key}">⏳</div>
        <div class="ps-item-content">
            <div class="ps-item-label">${item.label}</div>
            <div class="ps-item-meta" id="meta-${item.key}">${item.source}${!item.required ? ' • Optional' : ''}</div>
        </div>
        ${actionBtn}
    `;
    
    if (!item.required) {
        div.classList.add('optional');
    }
    
    return div;
}

// ========== DESCRIPTION MODAL ==========
function openDescriptionModal() {
    document.getElementById('descriptionModalText').value = scopeDescription;
    document.getElementById('psDescriptionModal').classList.add('active');
}

// ========== EDIT NOTE MODAL ==========
let currentEditNoteIndex = null;
let currentEditNoteOriginal = '';

function openEditNoteModal(idx) {
    const note = originalImportantNotes[idx];
    if (!note) {
        showToast('Note not found', 'error');
        return;
    }
    
    currentEditNoteIndex = idx;
    currentEditNoteOriginal = note.text || '';
    
    document.getElementById('editNoteIndex').value = idx;
    document.getElementById('editNoteAuthor').textContent = `Original by: ${note.author || 'Unknown'}`;
    document.getElementById('editNoteText').value = editedNotes[idx] !== undefined ? editedNotes[idx] : currentEditNoteOriginal;
    document.getElementById('psEditNoteModal').classList.add('active');
}

function closeEditNoteModal() {
    document.getElementById('psEditNoteModal').classList.remove('active');
    currentEditNoteIndex = null;
    currentEditNoteOriginal = '';
}

async function saveEditedNote() {
    const idx = parseInt(document.getElementById('editNoteIndex').value);
    const newText = document.getElementById('editNoteText').value.trim();
    
    if (newText === currentEditNoteOriginal) {
        // Same as original - remove edit
        delete editedNotes[idx];
    } else {
        editedNotes[idx] = newText;
    }
    
    closeEditNoteModal();
    checkAllItems();
    generatePreview();
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Note updated for PS', 'success');
}

async function resetEditedNote() {
    const idx = parseInt(document.getElementById('editNoteIndex').value);
    delete editedNotes[idx];
    document.getElementById('editNoteText').value = currentEditNoteOriginal;
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Reset to original', 'info');
}

// ========== PRODUCTION DESCRIPTION MODAL ==========
function closeDescriptionModal() {
    document.getElementById('psDescriptionModal').classList.remove('active');
}

// ========== PHOTOS MULTI-SELECT MODAL ==========
function openPhotosSelectModal() {
    const photosFromFiles = projectData.files.filter(f => f.folder_name === 'photos');
    
    if (photosFromFiles.length === 0) {
        showToast('No photos available in project. Upload photos first.', 'info');
        return;
    }
    
    // Build grid of photos with checkboxes
    let photosHtml = photosFromFiles.map((file, idx) => {
        const isSelected = selectedPhotos.some(p => p.id === file.id);
        return `
            <div class="ps-photo-item ${isSelected ? 'selected' : ''}" onclick="togglePhotoSelection(${idx})">
                <input type="checkbox" id="photo-check-${idx}" ${isSelected ? 'checked' : ''} style="position: absolute; top: 8px; left: 8px; width: 20px; height: 20px; cursor: pointer;">
                <img src="${file.public_url}" alt="${file.file_name}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px;">
                <div style="font-size: 10px; color: #888; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${file.file_name}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('psPhotosGrid').innerHTML = photosHtml;
    updatePhotosSelectionCount();
    document.getElementById('psPhotosModal').classList.add('active');
}

function togglePhotoSelection(idx) {
    const photosFromFiles = projectData.files.filter(f => f.folder_name === 'photos');
    const file = photosFromFiles[idx];
    
    const existingIdx = selectedPhotos.findIndex(p => p.id === file.id);
    if (existingIdx >= 0) {
        selectedPhotos.splice(existingIdx, 1);
    } else {
        selectedPhotos.push({
            id: file.id,
            url: file.public_url,
            name: file.file_name
        });
    }
    
    // Update UI
    const item = document.querySelectorAll('.ps-photo-item')[idx];
    const checkbox = document.getElementById(`photo-check-${idx}`);
    if (item && checkbox) {
        item.classList.toggle('selected');
        checkbox.checked = !checkbox.checked;
    }
    updatePhotosSelectionCount();
}

function updatePhotosSelectionCount() {
    const countEl = document.getElementById('psPhotosSelectedCount');
    if (countEl) {
        countEl.textContent = `${selectedPhotos.length} selected`;
    }
}

function confirmPhotosSelection() {
    closePhotosModal();
    checkAllItems();
    updateProgress();
    generatePreview();
    showToast(`${selectedPhotos.length} photos selected for PS`, 'success');
}

function selectAllPhotos() {
    const photosFromFiles = projectData.files.filter(f => f.folder_name === 'photos');
    selectedPhotos = photosFromFiles.map(file => ({
        id: file.id,
        url: file.public_url,
        name: file.file_name
    }));
    openPhotosSelectModal(); // Refresh UI
}

function deselectAllPhotos() {
    selectedPhotos = [];
    openPhotosSelectModal(); // Refresh UI
}

function closePhotosModal() {
    document.getElementById('psPhotosModal').classList.remove('active');
}

// ========== SELECT FILES MODAL ==========
let currentSelectKey = null;
let currentSelectFolder = null;

function openSelectFilesModal(key, folder) {
    currentSelectKey = key;
    currentSelectFolder = folder;
    
    // Set callback for file selection
    window.psFileSelectCallback = (file) => {
        selectProjectFile(file.file_path, file.public_url, file.file_name);
    };
    window.psFileSelectFolder = folder;
    
    // Open Project Files modal directly with project data
    openProjectFilesModalDirect(
        currentProject.id,
        currentProject.projectNumber,
        currentProject.name,
        'production'
    );
}

function closeSelectDrawingsModal() {
    // Legacy - now handled by closeProjectFilesModal
    window.psFileSelectCallback = null;
    window.psFileSelectFolder = null;
    currentSelectKey = null;
    currentSelectFolder = null;
}

async function selectProjectFile(filePath, fileUrl, fileName) {
    showToast('Linking file...', 'info');
    
    try {
        // Ensure we have a sheet
        if (!currentSheet) {
            await createDraftSheet();
        }
        
        const attachmentType = currentSelectFolder === 'drawings' ? 'DRAWINGS_MAIN' : 
                              currentSelectFolder === 'photos' ? 'PHOTOS' :
                              currentSelectFolder === 'spray' ? 'SPRAY_COLORS' : 'DRAWINGS_MAIN';
        
        // Remove old attachment of this type (for single types)
        if (['DRAWINGS_MAIN', 'SPRAY_COLORS'].includes(attachmentType)) {
            const oldAttachments = projectData.attachments.filter(a => a.attachment_type === attachmentType);
            for (const old of oldAttachments) {
                await supabaseClient
                    .from('production_sheet_attachments')
                    .delete()
                    .eq('id', old.id);
            }
            projectData.attachments = projectData.attachments.filter(a => a.attachment_type !== attachmentType);
        }
        
        // Create new attachment record (linking to existing file)
        const { data: attachment, error } = await supabaseClient
            .from('production_sheet_attachments')
            .insert({
                sheet_id: currentSheet.id,
                attachment_type: attachmentType,
                file_name: fileName,
                file_url: fileUrl,
                file_size: 0,
                file_type: 'linked'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        projectData.attachments.push(attachment);
        
        showToast('File linked!', 'success');
        
        // Update UI
        await checkAllItems();
        updateProgress();
        generatePreview();
        
    } catch (err) {
        console.error('Error linking file:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// File upload is now handled by project-files.js

async function saveDescription() {
    scopeDescription = document.getElementById('descriptionModalText').value;
    closeDescriptionModal();
    
    // Update UI
    updateDescriptionUI();
    checkAllItems();
    updateProgress();
    generatePreview();
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Description saved!', 'success');
}

// Auto-save function for immediate persistence
async function autoSaveSnapshot() {
    try {
        // Ensure we have a sheet (create draft if not exists)
        if (!currentSheet) {
            await createDraftSheet();
        }
        
        const partialSnapshot = {
            scopeDescription: scopeDescription,
            sprayDescription: sprayDescription,
            editedNotes: editedNotes
        };
        
        const { error } = await supabaseClient
            .from('production_sheets')
            .update({
                snapshot_json: partialSnapshot,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentSheet.id);
        
        if (error) {
            console.error('Auto-save error:', error);
        }
    } catch (err) {
        console.error('Auto-save failed:', err);
    }
}

// ========== SPRAY MODAL ==========
function openSprayModal() {
    document.getElementById('sprayModalText').value = sprayDescription;
    document.getElementById('psSprayModal').classList.add('active');
}

function closeSprayModal() {
    document.getElementById('psSprayModal').classList.remove('active');
}

async function saveSprayDescription() {
    sprayDescription = document.getElementById('sprayModalText').value;
    closeSprayModal();
    
    // Update UI
    updateSprayUI();
    checkAllItems();
    updateProgress();
    generatePreview();
    
    // Auto-save to database
    await autoSaveSnapshot();
    
    showToast('Spray instructions saved!', 'success');
}

function updateSprayUI() {
    const metaEl = document.getElementById('meta-SPRAY_DESCRIPTION');
    const btnEl = document.getElementById('btn-SPRAY_DESCRIPTION');
    const iconEl = document.getElementById('icon-SPRAY_DESCRIPTION');
    
    if (!metaEl || !btnEl || !iconEl) return; // May not exist if no spray phase
    
    if (sprayDescription.trim()) {
        metaEl.textContent = `${sprayDescription.trim().length} characters`;
        btnEl.textContent = '✎ Edit';
        iconEl.textContent = '✅';
    } else {
        metaEl.textContent = 'Click to add • Optional';
        btnEl.textContent = '+ Add';
        iconEl.textContent = '✏️';
    }
}

function updateDescriptionUI() {
    const metaEl = document.getElementById('meta-SCOPE_DESCRIPTION');
    const btnEl = document.getElementById('btn-SCOPE_DESCRIPTION');
    const iconEl = document.getElementById('icon-SCOPE_DESCRIPTION');
    
    if (scopeDescription.trim()) {
        metaEl.textContent = `${scopeDescription.trim().length} characters`;
        btnEl.textContent = '✎ Edit';
        btnEl.classList.remove('upload');
        iconEl.textContent = '✅';
    } else {
        metaEl.textContent = 'Click to add • Optional';
        btnEl.textContent = '+ Add';
        iconEl.textContent = '✏️';
    }
}

// Handle scope description change (legacy - keeping for compatibility)
function handleScopeDescriptionChange(value) {
    scopeDescription = value;
    checklistStatus['SCOPE_DESCRIPTION'] = {
        done: value.trim().length > 0,
        meta: value.trim().length > 0 ? `${value.trim().length} characters` : 'Optional'
    };
    updateProgress();
}

// ========== CHECKLIST VALIDATION ==========
async function checkAllItems() {
    checklistStatus = {};
    
    for (const item of checklistItems) {
        const status = await checkItem(item);
        checklistStatus[item.key] = status;
        updateItemUI(item.key, status);
    }
    
    // Update section badges
    updateSectionBadges();
}

async function checkItem(item) {
    const result = { done: false, meta: '', blocked: false };
    
    switch (item.key) {
        // CORE
        case 'CORE_PROJECT_NUMBER':
            result.done = !!projectData.project?.project_number;
            result.meta = projectData.project?.project_number || 'Not set';
            break;
            
        case 'CORE_PROJECT_NAME':
            result.done = !!projectData.project?.name;
            result.meta = projectData.project?.name || 'Not set';
            break;
            
        case 'CORE_CLIENT':
            result.done = !!projectData.client;
            result.meta = projectData.client?.company_name || 'Not assigned';
            break;
            
        case 'CORE_DEADLINE':
            result.done = !!projectData.project?.deadline;
            result.meta = projectData.project?.deadline 
                ? new Date(projectData.project.deadline).toLocaleDateString('en-GB')
                : 'Not set';
            break;
            
        // SCOPE
        case 'SCOPE_TYPE':
            result.done = !!projectData.project?.type;
            result.meta = projectData.project?.type || 'Not set';
            break;
        
        case 'SCOPE_DESCRIPTION':
            result.done = scopeDescription.trim().length > 0;
            result.meta = scopeDescription.trim().length > 0 ? `${scopeDescription.trim().length} characters` : 'Optional';
            break;
            
        case 'SCOPE_URGENT_NOTES':
            const notesRaw = projectData.project?.notes || '';
            const allNotes = parseProjectNotesPS(notesRaw);
            const importantNotes = allNotes.filter(n => n.important === true);
            
            // Cache for edit modal
            originalImportantNotes = importantNotes;
            
            result.done = true; // Always done, just informational
            result.meta = importantNotes.length > 0 ? `${importantNotes.length} important note(s)` : 'No urgent notes';
            
            // Update content display
            const contentEl = document.getElementById('content-SCOPE_URGENT_NOTES');
            if (contentEl) {
                if (importantNotes.length > 0) {
                    contentEl.innerHTML = importantNotes.map((note, idx) => {
                        const isEdited = editedNotes[idx] !== undefined;
                        const displayText = isEdited ? editedNotes[idx] : (note.text || '');
                        return `<div style="margin-bottom: 8px; padding: 10px; background: #2d2d30; border-left: 3px solid ${isEdited ? '#22c55e' : '#f59e0b'}; color: #e8e2d5;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span style="font-size: 11px; color: ${isEdited ? '#22c55e' : '#f59e0b'};">⚠️ ${note.author || 'Unknown'} • ${note.date || ''} ${isEdited ? '(edited for PS)' : ''}</span>
                                <button onclick="openEditNoteModal(${idx})" style="background: #3e3e42; border: none; color: #888; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">✏️ Edit</button>
                            </div>
                            <div style="white-space: pre-wrap;">${displayText}</div>
                        </div>`;
                    }).join('');
                } else {
                    contentEl.innerHTML = '<em style="color: #666;">No important notes flagged. Notes with "IMPORTANT", "URGENT" or ⚠️ will appear here.</em>';
                }
            }
            break;
            
        // BOM
        case 'BOM_HAS_ELEMENTS':
            result.done = projectData.elements.length > 0;
            result.meta = `${projectData.elements.length} element(s)`;
            break;
            
        // DRAWINGS
        case 'ATT_DRAWINGS_MAIN':
            const hasDrawings = projectData.attachments.some(a => a.attachment_type === 'DRAWINGS_MAIN') ||
                               projectData.files.some(f => f.folder_name === 'drawings');
            result.done = hasDrawings;
            result.meta = hasDrawings ? 'Uploaded' : 'Required';
            break;
            
        // PHOTOS
        case 'ATT_PHOTOS':
            const availablePhotos = projectData.files.filter(f => f.folder_name === 'photos').length;
            result.done = selectedPhotos.length > 0;
            result.meta = selectedPhotos.length > 0 
                ? `${selectedPhotos.length} selected (${availablePhotos} available)` 
                : `${availablePhotos} available • Optional`;
            break;
            
        // MATERIALS
        case 'MAT_LIST':
            const totalMats = projectData.materials.length;
            const prodMats = projectData.materials.filter(m => m.used_in_stage === 'Production').length;
            const sprayMats = projectData.materials.filter(m => m.used_in_stage === 'Spraying').length;
            const instMats = projectData.materials.filter(m => m.used_in_stage === 'Installation').length;
            result.done = totalMats > 0;
            result.meta = `${totalMats} total (Prod: ${prodMats}, Spray: ${sprayMats}, Install: ${instMats})`;
            break;
            
        // SPRAY
        case 'SPRAY_DESCRIPTION':
            result.done = sprayDescription.trim().length > 0;
            result.meta = sprayDescription.trim().length > 0 ? `${sprayDescription.trim().length} characters` : 'Optional';
            break;
            
        case 'SPRAY_COLORS':
            const hasSprayColors = projectData.attachments.some(a => a.attachment_type === 'SPRAY_COLORS') ||
                                   projectData.files.some(f => f.folder_name === 'spray');
            result.done = hasSprayColors;
            result.meta = hasSprayColors ? 'Selected' : 'Optional';
            break;
            
        case 'SPRAY_DISCLAIMER':
            result.done = true; // Always shown as info
            result.meta = 'Information';
            break;
            
        // ROUTING
        case 'ROUTING_HAS_PHASES':
            result.done = projectData.phases.length > 0;
            result.meta = `${projectData.phases.length} phase(s)`;
            break;
            
        case 'ROUTING_DEADLINES':
            const phasesWithDeadlines = projectData.phases.filter(p => p.end_date);
            result.done = phasesWithDeadlines.length === projectData.phases.length && projectData.phases.length > 0;
            result.meta = `${phasesWithDeadlines.length}/${projectData.phases.length} set`;
            break;
            
        case 'ROUTING_ASSIGNED':
            const phasesAssigned = projectData.phases.filter(p => p.assigned_to);
            result.done = phasesAssigned.length > 0;
            result.meta = `${phasesAssigned.length}/${projectData.phases.length} assigned`;
            break;
            
        // QC
        case 'QC_TEMPLATE':
            result.done = true; // Always included
            result.meta = 'Will be included';
            break;
            
        default:
            result.done = false;
            result.meta = 'Unknown item';
    }
    
    return result;
}

function updateItemUI(key, status) {
    const itemEl = document.getElementById(`item-${key}`);
    const iconEl = document.getElementById(`icon-${key}`);
    const metaEl = document.getElementById(`meta-${key}`);
    
    if (!itemEl) return;
    
    // Update classes
    itemEl.classList.remove('done', 'missing', 'blocked');
    
    if (status.blocked) {
        itemEl.classList.add('blocked');
        iconEl.textContent = '⚠️';
    } else if (status.done) {
        itemEl.classList.add('done');
        iconEl.textContent = '✅';
    } else {
        itemEl.classList.add('missing');
        iconEl.textContent = '⏳';
    }
    
    // Update meta
    if (metaEl && status.meta) {
        const item = checklistItems.find(i => i.key === key);
        metaEl.textContent = status.meta + (item && !item.required ? ' • Optional' : '');
    }
}

function updateSectionBadges() {
    CHECKLIST_SECTIONS.forEach(section => {
        const sectionItems = checklistItems.filter(i => i.sectionKey === section.key);
        const requiredItems = sectionItems.filter(i => i.required);
        
        let doneCount = 0;
        let blockedCount = 0;
        
        requiredItems.forEach(item => {
            const status = checklistStatus[item.key];
            if (status?.done) doneCount++;
            if (status?.blocked) blockedCount++;
        });
        
        const badgeEl = document.getElementById(`badge-${section.key}`);
        if (!badgeEl) return;
        
        if (blockedCount > 0) {
            badgeEl.textContent = 'BLOCKED';
            badgeEl.className = 'ps-section-badge blocked';
        } else if (doneCount === requiredItems.length) {
            badgeEl.textContent = 'DONE';
            badgeEl.className = 'ps-section-badge done';
        } else {
            badgeEl.textContent = `${doneCount}/${requiredItems.length}`;
            badgeEl.className = 'ps-section-badge missing';
        }
    });
}

// ========== PROGRESS ==========
function updateProgress() {
    const requiredItems = checklistItems.filter(i => i.required);
    const doneCount = requiredItems.filter(i => checklistStatus[i.key]?.done).length;
    const percent = Math.round((doneCount / requiredItems.length) * 100);
    
    document.getElementById('psProgressPercent').textContent = `${percent}%`;
    
    const fillEl = document.getElementById('psProgressFill');
    fillEl.style.width = `${percent}%`;
    fillEl.classList.toggle('incomplete', percent < 100);
    
    updateCreateButton();
}

function updateCreateButton() {
    const requiredItems = checklistItems.filter(i => i.required);
    const allDone = requiredItems.every(i => checklistStatus[i.key]?.done);
    const forceCreate = document.getElementById('psForceCreate').checked;
    
    const btn = document.getElementById('psCreateBtn');
    const btnText = document.getElementById('psCreateBtnText');
    
    if (allDone) {
        btn.classList.remove('not-ready');
        btn.classList.add('ready');
        btn.disabled = false;
        btnText.textContent = 'Create Production Sheet';
    } else if (forceCreate) {
        btn.classList.remove('not-ready');
        btn.classList.add('ready');
        btn.disabled = false;
        btnText.textContent = 'Create (Incomplete)';
    } else {
        btn.classList.remove('ready');
        btn.classList.add('not-ready');
        btn.disabled = true;
        btnText.textContent = 'Complete checklist first';
    }
}

// ========== UPLOAD MODAL ==========
let currentUploadType = '';
let currentUploadAccept = '';
let selectedFile = null;

function openUploadModal(key, uploadType, accept) {
    currentUploadType = uploadType;
    currentUploadAccept = accept;
    selectedFile = null;
    
    document.getElementById('psUploadTitle').textContent = `Upload ${uploadType.replace('_', ' ')}`;
    document.getElementById('psUploadHint').textContent = accept ? `Accepted: ${accept}` : 'Any file type';
    document.getElementById('psFileInput').accept = accept;
    document.getElementById('psUploadPreview').style.display = 'none';
    document.getElementById('psUploadConfirm').disabled = true;
    document.getElementById('psUploadModal').classList.add('active');
}

function closeUploadModal() {
    document.getElementById('psUploadModal').classList.remove('active');
    selectedFile = null;
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large. Max 10MB allowed.', 'error');
        return;
    }
    
    selectedFile = file;
    document.getElementById('psFileName').textContent = file.name;
    document.getElementById('psFileSize').textContent = formatFileSize(file.size);
    document.getElementById('psUploadPreview').style.display = 'block';
    document.getElementById('psUploadConfirm').disabled = false;
}

function clearFileSelection() {
    selectedFile = null;
    document.getElementById('psFileInput').value = '';
    document.getElementById('psUploadPreview').style.display = 'none';
    document.getElementById('psUploadConfirm').disabled = true;
}

async function confirmUpload() {
    if (!selectedFile) return;
    
    showToast('Uploading file...', 'info');
    
    try {
        // Ensure we have a sheet
        if (!currentSheet) {
            await createDraftSheet();
        }
        
        // Single attachment types - usuń stare przed dodaniem nowego
        const singleTypes = ['DRAWINGS_MAIN', 'SPRAY_COLORS', 'FINISH_SPECS'];
        if (singleTypes.includes(currentUploadType)) {
            // Znajdź i usuń stare załączniki tego typu
            const oldAttachments = projectData.attachments.filter(a => a.attachment_type === currentUploadType);
            for (const old of oldAttachments) {
                await supabaseClient
                    .from('production_sheet_attachments')
                    .delete()
                    .eq('id', old.id);
            }
            // Usuń z lokalnej tablicy
            projectData.attachments = projectData.attachments.filter(a => a.attachment_type !== currentUploadType);
        }
        
        // Upload to Supabase Storage
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${currentUploadType}_${Date.now()}.${fileExt}`;
        const filePath = `production-sheets/${currentSheet.id}/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('project-documents')
            .upload(filePath, selectedFile);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(filePath);
        
        // Save attachment record
        const { data: attachment, error: attachError } = await supabaseClient
            .from('production_sheet_attachments')
            .insert({
                sheet_id: currentSheet.id,
                attachment_type: currentUploadType,
                file_name: selectedFile.name,
                file_url: urlData.publicUrl,
                file_size: selectedFile.size,
                file_type: selectedFile.type
            })
            .select()
            .single();
        
        if (attachError) throw attachError;
        
        projectData.attachments.push(attachment);
        
        showToast('File uploaded successfully!', 'success');
        closeUploadModal();
        
        // Re-check items
        await checkAllItems();
        updateProgress();
        
    } catch (err) {
        console.error('Upload error:', err);
        showToast('Upload failed: ' + err.message, 'error');
    }
}

async function createDraftSheet() {
    // Get next version number
    const { data: existingSheets } = await supabaseClient
        .from('production_sheets')
        .select('version')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1);
    
    const nextVersion = (existingSheets?.[0]?.version || 0) + 1;
    
    const { data: newSheet, error } = await supabaseClient
        .from('production_sheets')
        .insert({
            project_id: projectId,
            version: nextVersion,
            status: 'draft'
        })
        .select()
        .single();
    
    if (error) throw error;
    
    currentSheet = newSheet;
    return newSheet;
}

// ========== SAVE & CLOSE ==========
async function saveAndClose() {
    showToast('Saving draft...', 'info');
    
    try {
        // Ensure we have a sheet (create draft if not exists)
        if (!currentSheet) {
            await createDraftSheet();
        }
        
        // Update checklist progress
        const requiredItems = checklistItems.filter(i => i.required);
        const doneCount = requiredItems.filter(i => checklistStatus[i.key]?.done).length;
        const progress = Math.round((doneCount / requiredItems.length) * 100);
        
        // Build partial snapshot with editable fields
        const partialSnapshot = {
            scopeDescription: scopeDescription,
            sprayDescription: sprayDescription,
            editedNotes: editedNotes
        };
        
        // Save current state to sheet
        const { error } = await supabaseClient
            .from('production_sheets')
            .update({
                checklist_total: requiredItems.length,
                checklist_done: doneCount,
                checklist_progress: progress,
                snapshot_json: partialSnapshot,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentSheet.id);
        
        if (error) throw error;
        
        showToast('Draft saved!', 'success');
        
        // Navigate back after short delay
        setTimeout(() => {
            window.history.back();
        }, 500);
        
    } catch (err) {
        console.error('Error saving draft:', err);
        showToast('Error saving: ' + err.message, 'error');
    }
}

// ========== NAVIGATION ==========
function goToSection(section) {
    switch (section) {
        case 'elements':
            openBomModal();
            break;
        case 'materials':
            showToast('Go to main project view to edit materials', 'info');
            break;
        case 'phases':
            showToast('Go to main project view to edit phases', 'info');
            break;
    }
}

// ========== BOM EDITOR ==========
// BOM functions moved to js/bom-editor.js

// ========== PREVIEW GENERATION ==========
let pdfSectionNumber = 0; // Global section counter for PDF

async function generatePreview() {
    const container = document.getElementById('psPdfPreview');
    pdfSectionNumber = 0; // Reset counter
    
    // Load company logo
    let logoUrl = null;
    try {
        const { data: settings } = await supabaseClient
            .from('company_settings')
            .select('logo_url')
            .single();
        logoUrl = settings?.logo_url || null;
    } catch (err) {
        console.log('No company logo found');
    }
    
    let pages = [];
    
    // PAGE 1: Cover + Contents
    pages.push(generateCoverPageNew(logoUrl));
    
    // PAGE 2: Scope & Notes
    pages.push(generateScopePage());
    
    // PAGE 3: Elements List
    pages.push(generateBOMPage());
    
    // PAGE 4+: Drawings (may be multiple pages)
    const drawingPages = await generateDrawingPages();
    pages.push(...drawingPages);
    
    // PAGE: Materials
    pages.push(generateMaterialsPage());
    
    // PAGE: Spraying
    pages.push(generateSprayingPage());
    
    // PAGE: Phases / Timeline
    pages.push(generatePhasesPage());
    
    // PAGE: Reference Photos (if any)
    const photoPages = await generatePhotoPages();
    pages.push(...photoPages);
    
    // PAGE: QC & Sign-off
    pages.push(generateQCPage());
    
    // Build HTML with all pages
    const totalPages = pages.length;
    let html = pages.map((pageContent, idx) => `
        <div class="ps-page" data-page="${idx + 1}">
            <div class="ps-page-header">Page ${idx + 1} of ${totalPages}</div>
            ${pageContent}
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// ========== PAGE 1: COVER + CONTENTS ==========
function generateCoverPageNew(logoUrl) {
    const project = projectData.project;
    const client = projectData.client;
    const isIncomplete = !checklistItems.filter(i => i.required).every(i => checklistStatus[i.key]?.done);
    
    // Build contents list - nowa kolejność
    const sections = [
        'Scope & Notes',
        'Elements List',
        'Drawings',
        'Materials',
        'Spraying',
        'Phases / Timeline',
        'Reference Photos',
        'QC Checklist & Sign-off'
    ];
    
    // Pre-construction checklist items
    const preConstructionItems = [
        'Drawings & Design accepted by Client',
        'Drawings & sizes checked by Joiner',
        'Bespoke tools ordered by Joiner (if needed)',
        'Timeline agreed with Client',
        'Spray colour & sheen confirmed',
        'All materials checked & ordered',
        'Production timeline agreed with Team',
        'Deposit received'
    ];
    
    return `
        ${isIncomplete ? '<div class="ps-incomplete-banner">⚠️ INCOMPLETE - Some required items are missing</div>' : ''}
        
        <div style="height: 45%; display: flex; padding: 15px; border-bottom: 3px solid #333;">
            <div class="ps-cover-logo">
                ${logoUrl ? `<img src="${logoUrl}" alt="Company Logo" crossorigin="anonymous" />` : '<div style="width:150px;height:150px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;border:2px dashed #ccc;">No Logo</div>'}
            </div>
            <div class="ps-cover-info">
                <div class="ps-cover-title">PRODUCTION SHEET</div>
                <div class="ps-cover-project">${project?.project_number || 'N/A'}</div>
                <div class="ps-cover-name">${project?.name || 'Untitled Project'}</div>
                
                <div class="ps-cover-details">
                    <div class="ps-cover-detail"><strong>Client:</strong> ${client?.company_name || 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Contact:</strong> ${project?.project_contact || client?.contact_person || 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Type:</strong> ${project?.type || 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Deadline:</strong> ${project?.deadline ? new Date(project.deadline).toLocaleDateString('en-GB') : 'N/A'}</div>
                    <div class="ps-cover-detail"><strong>Version:</strong> PS v${currentSheet?.version || 1}</div>
                    <div class="ps-cover-detail"><strong>Status:</strong> ${isIncomplete ? '<span style="color:#ef4444;">Incomplete</span>' : '<span style="color:#22c55e;">Complete</span>'}</div>
                </div>
                
                ${project?.site_address ? `
                <div style="margin-top: 15px; padding: 10px; background: #f0f9ff; border-left: 3px solid #0ea5e9; font-size: 12px;">
                    <strong style="color: #0369a1;">📍 Site Address:</strong><br>
                    <span style="white-space: pre-wrap;">${project.site_address}</span>
                </div>
                ` : ''}
                
                <div style="margin-top: 20px; font-size: 11px; color: #666;">
                    Generated: ${new Date().toLocaleString('en-GB')}<br>
                    Joinery Core by Skylon Development LTD
                </div>
            </div>
        </div>
        
        <div style="height: 55%; display: grid; grid-template-columns: 180px 1fr; gap: 0; padding: 15px;">
            <div style="padding-right: 25px;">
                <h2 style="font-size: 16px; color: #333; margin-bottom: 12px; border-bottom: 2px solid #4a9eff; padding-bottom: 6px;">Contents</h2>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
                    ${sections.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('')}
                </div>
            </div>
            
            <div style="border-left: 2px solid #ddd; padding-left: 25px;">
                <h2 style="font-size: 16px; color: #333; margin-bottom: 12px; border-bottom: 2px solid #f59e0b; padding-bottom: 6px;">Pre-Construction Checklist</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; width: 35px;">✓</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">Item</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: center; width: 120px;">Checked by</th>
                            <th style="border: 1px solid #ddd; padding: 10px; text-align: left; width: 200px;">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preConstructionItems.map(item => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">
                                    <div style="width: 20px; height: 20px; border: 2px solid #333; margin: 0 auto;"></div>
                                </td>
                                <td style="border: 1px solid #ddd; padding: 10px;">${item}</td>
                                <td style="border: 1px solid #ddd; padding: 10px;"></td>
                                <td style="border: 1px solid #ddd; padding: 10px;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ========== PAGE 2: SCOPE & NOTES ==========
function generateScopePage() {
    const project = projectData.project;
    const notesRaw = project?.notes || '';
    const allNotes = parseProjectNotesPS(notesRaw);
    const importantNotes = allNotes.filter(n => n.important === true);
    
    const importantNotesHtml = importantNotes.length > 0 
        ? importantNotes.map((note, idx) => {
            const isEdited = editedNotes[idx] !== undefined;
            const displayText = isEdited ? editedNotes[idx] : (note.text || '');
            return `<div style="margin-bottom: 15px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; overflow: hidden;">
                <div style="font-size: 12px; color: #856404; margin-bottom: 8px;">⚠️ ${note.author || 'Unknown'} • ${note.date || ''} ${isEdited ? '<span style="color: #22c55e;">(edited for PS)</span>' : ''}</div>
                <div style="white-space: pre-wrap; font-size: 14px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;">${displayText}</div>
            </div>`;
        }).join('')
        : '<div style="color: #666; font-style: italic; font-size: 14px;">No important notes flagged.</div>';
    
    return `
        <h1 class="ps-section-title">1. Scope & Notes</h1>
        
        <div style="display: flex; flex-direction: column; gap: 25px; overflow: hidden;">
            <div style="display: grid; grid-template-columns: 160px 1fr; gap: 30px; overflow: hidden;">
                <div>
                    <h3 style="color: #333; margin-bottom: 12px; font-size: 12px;">Project Type</h3>
                    <div style="font-size: 12px; padding: 12px; background: #f5f5f5; border-radius: 8px;">
                        ${project?.type || 'N/A'}
                    </div>
                </div>
                
                <div style="overflow: hidden;">
                    ${scopeDescription.trim() ? `
                        <h3 style="color: #333; margin-bottom: 12px; font-size: 16px;">Production Description</h3>
                        <div style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; overflow: hidden;">
                            <div style="white-space: pre-wrap; font-size: 16px; word-wrap: break-word; overflow-wrap: break-word; word-break: break-all;">${scopeDescription}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div style="border-top: 2px solid #ddd; padding-top: 20px; overflow: hidden;">
                <h3 style="color: #333; margin-bottom: 8px; font-size: 16px;">Important Notes</h3>
                <div style="font-size: 11px; color: #888; margin-bottom: 15px; font-style: italic;">📌 Notes added during project preparation</div>
                ${importantNotesHtml}
            </div>
        </div>
    `;
}

// ========== PAGE 3: BOM ==========
function generateBOMPage() {
    const elements = projectData.elements;
    
    if (elements.length === 0) {
        return `
            <h1 class="ps-section-title">2. Elements List</h1>
            <div style="padding: 40px; text-align: center; color: #666;">
                No elements defined. Add elements in the checklist.
            </div>
        `;
    }
    
    // Group elements by type
    const grouped = {};
    elements.forEach(el => {
        const type = el.element_type || 'other';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(el);
    });
    
    // Define columns for each type
    const typeColumns = {
        sash: {
            label: 'Sash Windows',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Box', 'Opening', 'Bars', 'Glass', 'Thick.', 'Trickle', 'Ironmongery', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.sash_box || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.opening_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.bars || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_thickness || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.trickle_vent || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.ironmongery || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        casement: {
            label: 'Casement Windows',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Opening', 'Bars', 'Glass', 'Thick.', 'Trickle', 'Ironmongery', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.opening_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.bars || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_thickness || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.trickle_vent || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.ironmongery || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        internalDoors: {
            label: 'Internal Doors',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Type', 'Hand', 'Fire', 'Intum', 'Closer', 'Glazed', 'Glass', 'Locks', 'Hinges', 'Colour', 'Notes'],
            render: (el, idx) => {
                const locks = [el.lock_1, el.lock_2, el.lock_3].filter(Boolean).join(', ') || '-';
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.door_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.door_handing || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.fire_rating || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.intumescent_set || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.self_closer || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.glazed || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${locks}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.ironmongery_hinges || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        externalDoors: {
            label: 'External Doors',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Type', 'Hand', 'Threshold', 'Glazed', 'Glass', 'Thick.', 'Locks', 'Hinges', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.external_door_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.door_handing || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.threshold || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.glazed || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_thickness || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.locks || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.ironmongery_hinges || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        kitchen: {
            label: 'Kitchen Units',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'D', 'Unit', 'Style', 'Front', 'Carcass', 'Handle', 'Soft', 'Worktop', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.depth || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.unit_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.front_style || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.front_material || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px;">${el.carcass_material || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.handle_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.soft_close || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px;">${el.worktop || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        wardrobe: {
            label: 'Wardrobes',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'D', 'Shape', 'Door', 'Style', 'Front', 'Carcass', 'Handle', 'Layout', 'Mirror', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.depth || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.wardrobe_shape || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.door_style || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.front_style || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.front_material || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px;">${el.carcass_material || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.handle_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px;">${el.internal_layout || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.mirror || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        partition: {
            label: 'Partitions',
            cols: ['#', 'ID', 'Name', 'W', 'H', 'Panel', 'Frame', 'Glass', 'Thick.', 'Door', 'Hand', 'Lock', 'Acoustic', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.panel_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.frame_material || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.glass_thickness || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.door_included || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.door_handing || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.door_lock || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.acoustic_rating || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        externalSpray: {
            label: 'External Spray',
            cols: ['#', 'ID', 'Name', 'Qty', 'Item', 'Substrate', 'Paint', 'Sheen', 'Coats', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.qty || 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.item_type || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.substrate || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.paint_system || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.sheen_level || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.num_coats || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        },
        other: {
            label: 'Other Items',
            cols: ['#', 'ID', 'Name', 'Qty', 'W', 'H', 'D', 'Material', 'Custom 1', 'Custom 2', 'Custom 3', 'Colour', 'Notes'],
            render: (el, idx) => {
                const colourStr = el.colour_type === 'Dual' ? `${el.colour} (Dual)` : (el.colour || '-');
                return `
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${idx + 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; color: #4a9eff;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; word-wrap: break-word; max-width: 80px;">${el.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.qty || 1}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.width || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.height || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.depth || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.material || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.custom_field_1 || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.custom_field_2 || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.custom_field_3 || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 100px;">${colourStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px; word-wrap: break-word; max-width: 120px;">${el.description || '-'}</td>
                `;
            }
        }
    };
    
    // Generate tables for each type
    let content = '<h1 class="ps-section-title">2. Elements List</h1>';
    
    Object.keys(grouped).forEach(type => {
        const items = grouped[type];
        const config = typeColumns[type] || typeColumns.other;
        
        content += `
            <div style="margin-bottom: 25px;">
                <h3 style="color: #4a9eff; margin: 15px 0 10px 0; font-size: 14px; border-bottom: 2px solid #4a9eff; padding-bottom: 5px;">
                    ${config.label} (${items.length})
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                        <tr style="background: #4a9eff; color: white;">
                            ${config.cols.map(col => `<th style="border: 1px solid #ddd; padding: 8px; text-align: center;">${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((el, idx) => `<tr>${config.render(el, idx)}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });
    
    content += `
        <div style="margin-top: 20px; font-size: 11px; color: #666;">
            Total elements: ${elements.length}
        </div>
    `;
    
    return content;
}

// Helper function to get readable type label
function getTypeLabel(type) {
    const labels = {
        'sash': 'Sash Window',
        'casement': 'Casement Window',
        'internalDoors': 'Internal Door',
        'externalDoors': 'External Door',
        'kitchen': 'Kitchen',
        'wardrobe': 'Wardrobe',
        'partition': 'Partition',
        'externalSpray': 'External Spray',
        'other': 'Other'
    };
    return labels[type] || type || 'Other';
}

// ========== CUT LIST - REMOVED ==========
// Cut List functionality moved to Production Support Documents
// Function generateCutListPage() removed

// ========== PAGE 3: MATERIALS ==========
function generateMaterialsPage() {
    const materials = projectData.materials;
    
    const byStage = {
        'Production': materials.filter(m => m.used_in_stage === 'Production'),
        'Spraying': materials.filter(m => m.used_in_stage === 'Spraying'),
        'Installation': materials.filter(m => m.used_in_stage === 'Installation')
    };
    
    let html = `<h1 class="ps-section-title">3. Materials</h1>`;
    
    if (materials.length === 0) {
        html += '<div style="color: #666; font-style: italic; padding: 20px;">No materials assigned to this project.</div>';
        return html;
    }
    
    // Process each stage
    Object.entries(byStage).forEach(([stage, mats]) => {
        if (mats.length === 0) return;
        
        const stageColor = stage === 'Production' ? '#4a9eff' : stage === 'Spraying' ? '#f59e0b' : '#22c55e';
        
        html += `
            <div style="margin-bottom: 25px;">
                <h3 style="color: #333; font-size: 14px; margin-bottom: 10px; padding: 8px 12px; background: linear-gradient(90deg, ${stageColor}22, transparent); border-left: 4px solid ${stageColor};">
                    ${stage.toUpperCase()} STAGE
                </h3>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 60px;">Photo</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Material</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">Reserved</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">Stock Left</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 150px;">Notes</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 40px;">✓</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        mats.forEach(m => {
            // Photo - only for stock items, not bespoke
            const imageUrl = !m.is_bespoke && m.stock_items?.image_url ? m.stock_items.image_url : null;
            const photoPlaceholder = m.is_bespoke ? 'Bespoke' : '-';
            const photoHtml = imageUrl 
                ? `<img src="${imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">`
                : `<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px;">${photoPlaceholder}</div>`;
            
            // Material description
            let materialDesc = m.item_name || m.stock_items?.name || 'Unknown';
            const size = m.stock_items?.size || '';
            const thickness = m.stock_items?.thickness || '';
            const sizeInfo = [size, thickness].filter(x => x).join(' / ');
            if (sizeInfo) {
                materialDesc += `<br><span style="color: #666; font-size: 11px;">${sizeInfo}</span>`;
            }
            if (m.item_notes) {
                materialDesc += `<br><span style="color: #888; font-size: 10px; font-style: italic;">${m.item_notes}</span>`;
            }
            
            // Reserved - quantity_reserved for stock, quantity_needed for bespoke
            const reserved = m.is_bespoke ? (m.quantity_needed || 0) : (m.quantity_reserved || 0);
            const unit = m.unit || m.stock_items?.unit || 'pcs';
            const reservedStr = `${reserved.toFixed(2)} ${unit}`;
            
            // Stock Left - available quantity (current - reserved from whole stock)
            let stockLeftHtml = '-';
            if (!m.is_bespoke && m.stock_items) {
                const stockLeft = (m.stock_items.current_quantity || 0) - (m.stock_items.reserved_quantity || 0);
                stockLeftHtml = `${stockLeft.toFixed(2)} ${unit}`;
                if (stockLeft < 0) {
                    stockLeftHtml += `<br><span style="color: #ef4444; font-size: 10px; font-weight: bold;">✗ NEGATIVE</span>`;
                }
            }
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${photoHtml}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${materialDesc}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${reservedStr}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${stockLeftHtml}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;"></td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 18px; height: 18px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>`;
    });
    
    return html;
}

// ========== PAGES: DRAWINGS ==========
async function generateDrawingPages() {
    const pages = [];
    
    const drawingsAttachment = projectData.attachments.find(a => a.attachment_type === 'DRAWINGS_MAIN');
    const drawingsFromFiles = projectData.files.filter(f => f.folder_name === 'drawings');
    
    let fileToEmbed = null;
    if (drawingsAttachment) {
        fileToEmbed = {
            url: drawingsAttachment.file_url,
            name: drawingsAttachment.file_name || 'drawing'
        };
    } else if (drawingsFromFiles.length > 0) {
        const firstFile = drawingsFromFiles[0];
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(firstFile.file_path);
        fileToEmbed = {
            url: urlData.publicUrl,
            name: firstFile.file_name
        };
    }
    
    if (!fileToEmbed) {
        // No drawings - show warning page
        pages.push(`
            <h1 class="ps-section-title">4. Drawings</h1>
            <div style="padding: 40px; text-align: center; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <div style="font-size: 18px;">No drawings attached</div>
                <div style="font-size: 14px; color: #666; margin-top: 10px;">This is a required item. Please add drawings before finalizing.</div>
            </div>
        `);
        return pages;
    }
    
    const fileName = fileToEmbed.name.toLowerCase();
    const isPdf = fileName.endsWith('.pdf');
    const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isImage) {
        pages.push(`
            <h1 class="ps-section-title">4. Drawings</h1>
            <div class="ps-drawing-full">
                <div style="font-size: 12px; color: #666; margin-bottom: 10px;">📄 ${fileToEmbed.name}</div>
                <img src="${fileToEmbed.url}" style="max-width: 100%; max-height: calc(297mm - 60mm); object-fit: contain;" crossorigin="anonymous" />
            </div>
        `);
    } else if (isPdf) {
        try {
            const images = await renderPdfToImages(fileToEmbed.url);
            if (images.length > 0) {
                images.forEach((imgData, i) => {
                    pages.push(`
                        <h1 class="ps-section-title">4. Drawings ${images.length > 1 ? `(${i + 1}/${images.length})` : ''}</h1>
                        <div class="ps-drawing-full">
                            <div style="font-size: 12px; color: #666; margin-bottom: 10px;">📄 ${fileToEmbed.name} - Page ${i + 1}</div>
                            <img src="${imgData}" style="max-width: 100%; max-height: calc(297mm - 60mm); object-fit: contain;" />
                        </div>
                    `);
                });
            } else {
                pages.push(`
                    <h1 class="ps-section-title">4. Drawings</h1>
                    <div style="padding: 40px; text-align: center; color: #f59e0b;">
                        <div style="font-size: 18px;">Could not render PDF</div>
                        <div style="margin-top: 15px;"><a href="${fileToEmbed.url}" target="_blank" style="color: #4a9eff;">Open PDF in new tab</a></div>
                    </div>
                `);
            }
        } catch (err) {
            console.error('PDF render error:', err);
            pages.push(`
                <h1 class="ps-section-title">4. Drawings</h1>
                <div style="padding: 40px; text-align: center; color: #f59e0b;">
                    <div style="font-size: 18px;">Error loading PDF</div>
                    <div style="margin-top: 15px;"><a href="${fileToEmbed.url}" target="_blank" style="color: #4a9eff;">Open PDF in new tab</a></div>
                </div>
            `);
        }
    } else {
        pages.push(`
            <h1 class="ps-section-title">4. Drawings</h1>
            <div style="padding: 40px; text-align: center;">
                <div style="font-size: 14px; color: #666;">File: ${fileToEmbed.name}</div>
                <div style="margin-top: 15px;"><a href="${fileToEmbed.url}" target="_blank" style="color: #4a9eff;">Download file</a></div>
            </div>
        `);
    }
    
    return pages;
}

// ========== PAGES: PHOTOS ==========
async function generatePhotoPages() {
    const pages = [];
    
    // Use only selected photos
    if (selectedPhotos.length === 0) {
        return pages; // No photos selected - skip section
    }
    
    // Create page with photos (max 4 per page in grid 2x2)
    const photosPerPage = 4;
    for (let i = 0; i < selectedPhotos.length; i += photosPerPage) {
        const pagePhotos = selectedPhotos.slice(i, i + photosPerPage);
        const pageNum = Math.floor(i / photosPerPage) + 1;
        const totalPhotoPages = Math.ceil(selectedPhotos.length / photosPerPage);
        
        let html = `<h1 class="ps-section-title">8. Reference Photos ${totalPhotoPages > 1 ? `(${pageNum}/${totalPhotoPages})` : ''}</h1>`;
        html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(2, 1fr); gap: 15px; height: calc(297mm - 80mm);">`;
        
        for (const photo of pagePhotos) {
            const isImage = photo.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i);
            html += `<div style="text-align: center; border: 1px solid #ddd; padding: 10px; display: flex; flex-direction: column; overflow: hidden;">
                <div style="font-size: 10px; color: #666; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📷 ${photo.name}</div>
                ${isImage 
                    ? `<img src="${photo.url}" style="flex: 1; width: 100%; height: 100%; object-fit: contain;" crossorigin="anonymous" />`
                    : `<a href="${photo.url}" target="_blank" style="color: #4a9eff;">View file</a>`
                }
            </div>`;
        }
        
        // Fill empty cells if less than 4 photos
        const emptySlots = photosPerPage - pagePhotos.length;
        for (let j = 0; j < emptySlots; j++) {
            html += `<div style="border: 1px dashed #ddd;"></div>`;
        }
        
        html += '</div>';
        pages.push(html);
    }
    
    return pages;
}

// ========== PAGE: SPRAY PACK ==========
function generateSprayingPage() {
    const elements = projectData.elements || [];
    const sprayAttachment = projectData.attachments.find(a => a.attachment_type === 'SPRAY_COLORS');
    
    // Get unique colours from BOM elements
    const colourMap = {};
    elements.forEach(el => {
        if (el.colour) {
            const key = el.colour;
            if (!colourMap[key]) {
                colourMap[key] = {
                    colour: el.colour,
                    colourType: el.colour_type || 'Single',
                    items: []
                };
            }
            colourMap[key].items.push({
                id: el.element_id,
                name: el.name,
                type: el.element_type
            });
        }
    });
    
    const colours = Object.values(colourMap);
    
    // Spray checklist items
    const sprayChecklist = [
        'All items sanded and prepared',
        'Primer applied',
        'First coat applied',
        'Second coat applied',
        'Final inspection completed',
        'Items ready for assembly'
    ];
    
    return `
        <h1 class="ps-section-title">5. Spraying</h1>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
            <div>
                <h3 style="color: #333; margin-bottom: 15px; font-size: 14px;">Colour Schedule</h3>
                ${colours.length > 0 ? `
                    <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                        <thead>
                            <tr style="background: #4a9eff; color: white;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Colour</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Type</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Items</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${colours.map(c => `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px; font-weight: 600;">${c.colour}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${c.colourType}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 10px;">${c.items.map(i => `${i.id}: ${i.name}`).join(', ')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<div style="color: #666; font-style: italic; padding: 15px; background: #f5f5f5;">No colours specified in BOM.</div>'}
                
                ${sprayAttachment ? `
                    <div style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; background: #f0f9ff;">
                        <strong style="color: #0369a1;">📎 Colour Reference:</strong>
                        <div style="font-size: 11px; color: #666; margin-top: 5px;">${sprayAttachment.file_name}</div>
                    </div>
                ` : ''}
                
                <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b;">
                    <strong style="color: #92400e;">⚠️ Spray Manager Notice</strong>
                    <div style="font-size: 11px; margin-top: 8px; color: #78350f;">
                        Review BOM section for complete specifications. Check Notes section for special instructions.
                    </div>
                </div>
            </div>
            
            <div>
                <h3 style="color: #333; margin-bottom: 15px; font-size: 14px;">Spray Checklist</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 30px;">✓</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Task</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">Date</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; width: 80px;">By</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sprayChecklist.map(item => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                    <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                                </td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${item}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;"></td>
                                <td style="border: 1px solid #ddd; padding: 8px;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <div style="margin-top: 20px;">
                    <h4 style="font-size: 12px; margin-bottom: 10px;">Notes:</h4>
                    <div style="border: 1px solid #ddd; min-height: 100px; padding: 10px;"></div>
                </div>
            </div>
        </div>
    `;
}

// ========== PAGE: PHASES / TIMELINE ==========
function generatePhasesPage() {
    const phases = projectData.phases;
    
    if (phases.length === 0) {
        return `
            <h1 class="ps-section-title">6. Phases / Timeline</h1>
            <div style="color: #666; font-style: italic; padding: 20px;">No phases defined for this project.</div>
        `;
    }
    
    // PLANNED section - data from system
    let plannedRows = phases.map(p => `
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px; font-weight: 500;">${p.phase_name || p.phase_key || 'N/A'}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '-'}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${p.end_date ? new Date(p.end_date).toLocaleDateString('en-GB') : '-'}</td>
            <td style="border: 1px solid #ccc; padding: 8px;">${p.team_members?.name || p.assigned_to || '-'}</td>
        </tr>
    `).join('');
    
    // ACTUAL section - empty rows for manual entry
    let actualRows = phases.map(p => `
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px; font-weight: 500; background: #f9f9f9;">${p.phase_name || p.phase_key || 'N/A'}</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center; min-width: 80px;"></td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center; min-width: 80px;"></td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center; min-width: 50px;"></td>
            <td style="border: 1px solid #ccc; padding: 8px; min-width: 100px;"></td>
            <td style="border: 1px solid #ccc; padding: 8px; min-width: 80px;"></td>
        </tr>
    `).join('');
    
    return `
        <h1 class="ps-section-title">6. Phases / Timeline</h1>
        
        <div style="display: flex; flex-direction: column; height: calc(100% - 40px); gap: 20px;">
            
            <!-- PLANNED - from system -->
            <div style="flex: 1;">
                <h3 style="color: #333; margin-bottom: 10px; font-size: 14px; border-bottom: 2px solid #4a9eff; padding-bottom: 5px;">
                    📋 PLANNED (from system)
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #4a9eff; color: white;">
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Phase</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Start Date</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">End Date</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Assigned To</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${plannedRows}
                    </tbody>
                </table>
            </div>
            
            <!-- ACTUAL - for manual entry -->
            <div style="flex: 1;">
                <h3 style="color: #333; margin-bottom: 10px; font-size: 14px; border-bottom: 2px solid #f59e0b; padding-bottom: 5px;">
                    ✏️ ACTUAL (to be filled by Production Manager / Joiner)
                </h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f59e0b; color: white;">
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Phase</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Actual Start</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Actual End</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Days</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Who Worked</th>
                            <th style="border: 1px solid #ccc; padding: 8px; text-align: center;">Sign</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actualRows}
                    </tbody>
                </table>
            </div>
            
        </div>
    `;
}

// ========== PAGE: QC & SIGN-OFF ==========
function generateQCPage() {
    return `
        <h1 class="ps-section-title">9. QC Checklist & Sign-off</h1>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
                <h3 style="color: #333; margin-bottom: 15px;">Quality Checks</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    ${['Dimensions verified', 'Glass spec correct', 'No damage', 'Finish quality OK', 'Hardware complete', 'Packaging ready'].map(item => `
                        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
                            <div style="width: 20px; height: 20px; border: 2px solid #333; flex-shrink: 0;"></div>
                            <span>${item}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top: 30px;">
                    <h3 style="color: #333; margin-bottom: 15px;">Additional Notes</h3>
                    <div style="border: 1px solid #ddd; min-height: 80px; padding: 10px;"></div>
                </div>
            </div>
            
            <div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div style="border: 2px solid #333; padding: 20px;">
                        <h4 style="margin: 0 0 20px 0; color: #333;">Production Sign-off</h4>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Name:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Date:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Signature:</div>
                            <div style="border-bottom: 1px solid #333; height: 40px;"></div>
                        </div>
                    </div>
                    
                    <div style="border: 2px solid #333; padding: 20px;">
                        <h4 style="margin: 0 0 20px 0; color: #333;">QC Sign-off</h4>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Name:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Date:</div>
                            <div style="border-bottom: 1px solid #333; height: 25px;"></div>
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Signature:</div>
                            <div style="border-bottom: 1px solid #333; height: 40px;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function regeneratePreview() {
    generatePreview();
    showToast('Preview refreshed', 'success');
}

function generateCoverPage() {
    const project = projectData.project;
    const client = projectData.client;
    const isIncomplete = !checklistItems.filter(i => i.required).every(i => checklistStatus[i.key]?.done);
    
    let html = `
        <div style="text-align: center; padding: 40px 0; border-bottom: 3px solid #333; margin-bottom: 30px; position: relative;">
            ${isIncomplete ? '<div style="position: absolute; top: 0; left: 0; right: 0; background: #ef4444; color: white; padding: 5px; font-weight: bold;">⚠️ INCOMPLETE</div>' : ''}
            
            <h1 style="font-size: 28px; margin: 0 0 10px 0; color: #333;">PRODUCTION SHEET</h1>
            <div style="font-size: 24px; font-weight: bold; color: #4a9eff; margin-bottom: 20px;">
                ${project?.project_number || 'N/A'}
            </div>
            <div style="font-size: 18px; color: #666; margin-bottom: 30px;">
                ${project?.name || 'Untitled Project'}
            </div>
            
            <div style="display: inline-block; text-align: left; background: #f5f5f5; padding: 20px 30px; border-radius: 8px;">
                <div style="margin-bottom: 8px;"><strong>Client:</strong> ${client?.company_name || 'N/A'}</div>
                <div style="margin-bottom: 8px;"><strong>Type:</strong> ${project?.type || 'N/A'}</div>
                <div style="margin-bottom: 8px;"><strong>Deadline:</strong> ${project?.deadline ? new Date(project.deadline).toLocaleDateString('en-GB') : 'N/A'}</div>
                <div><strong>Version:</strong> PS v${currentSheet?.version || 1}</div>
            </div>
            
            <div style="margin-top: 30px; font-size: 10px; color: #999;">
                Generated: ${new Date().toLocaleString('en-GB')}<br>
                Joinery Core by Skylon Development LTD
            </div>
        </div>
    `;
    
    return html;
}

function generateTOC() {
    const hasSprayPhase = projectData.phases.some(p => 
        p.phase_key && p.phase_key.toLowerCase().includes('spray')
    );
    
    const hasPhotos = projectData.attachments.some(a => a.attachment_type === 'PHOTOS') ||
                     projectData.files.some(f => f.folder_name === 'photos');
    
    // Budujemy TOC zgodnie z kolejnością sekcji
    const sections = [
        'Scope & Notes',
        'Elements List',
        'Cut List',
        'Materials',
        'Drawings'
    ];
    
    if (hasPhotos) {
        sections.push('Reference Photos');
    }
    
    if (hasSprayPhase) {
        sections.push('Spray / Finish Pack');
    }
    
    sections.push('Phases / Timeline');
    sections.push('QC Checklist & Sign-off');
    
    return `
        <div style="margin-bottom: 30px; page-break-after: always;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">Contents</h2>
            <div style="padding-left: 20px; line-height: 2;">
                ${sections.map((s, i) => `<div>${i + 1}. ${s}</div>`).join('')}
            </div>
        </div>
    `;
}

function generateScopeSection() {
    const project = projectData.project;
    const notesRaw = project?.notes || '';
    const sectionNum = ++pdfSectionNumber;
    
    // Extract important notes (parse JSON)
    const allNotes = parseProjectNotesPS(notesRaw);
    const importantNotes = allNotes.filter(n => n.important === true);
    
    const importantNotesHtml = importantNotes.length > 0 
        ? importantNotes.map((note, idx) => {
            const isEdited = editedNotes[idx] !== undefined;
            const displayText = isEdited ? editedNotes[idx] : (note.text || '');
            return `<div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #e0c36a;">
                <div style="font-size: 11px; color: #856404; margin-bottom: 4px;">⚠️ ${note.author || 'Unknown'} • ${note.date || ''} ${isEdited ? '<span style="color: #22c55e;">(edited for PS)</span>' : ''}</div>
                <div style="white-space: pre-wrap;">${displayText}</div>
            </div>`;
        }).join('')
        : '';
    
    return `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Scope & Notes</h2>
            
            <div style="margin-bottom: 15px;">
                <strong>Project Type:</strong> ${project?.type || 'N/A'}
            </div>
            
            ${scopeDescription.trim() ? `
                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin-bottom: 15px;">
                    <strong style="color: #1565c0;">📋 Production Description:</strong>
                    <div style="white-space: pre-wrap; margin-top: 10px;">${scopeDescription}</div>
                </div>
            ` : ''}
            
            ${importantNotesHtml ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px;">
                    <strong style="color: #856404;">⚠️ Important Notes (from project preparation):</strong>
                    <div style="margin-top: 10px;">${importantNotesHtml}</div>
                </div>
            ` : '<div style="color: #666;">No important notes flagged.</div>'}
        </div>
    `;
}

function generateBOMSection() {
    const elements = projectData.elements;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Elements List</h2>
    `;
    
    if (elements.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No elements defined. Add elements in the project settings.</div>`;
    } else {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">ID</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Name</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Dimensions</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Finish</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        elements.forEach(el => {
            const dims = el.width && el.height 
                ? `${el.width}x${el.height}${el.thickness ? 'x'+el.thickness : ''} ${el.dimensions_unit || 'mm'}`
                : '-';
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.element_id || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.qty}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${dims}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.finish_name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    }
    
    html += `</div>`;
    return html;
}

function generateCutListSection() {
    const elements = projectData.elements;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Cut List</h2>
    `;
    
    // Jeśli mamy elementy z wymiarami - generujemy cut list
    const elementsWithDims = elements.filter(el => el.width && el.height);
    
    if (elementsWithDims.length > 0) {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Element</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Width (mm)</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Height (mm)</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Thickness</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Cut ✓</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        elementsWithDims.forEach(el => {
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${el.element_id || ''} ${el.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.qty}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${el.width}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">${el.height}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${el.thickness || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    } else {
        // Placeholder - puste linie do ręcznego dopisania
        html += `
            <div style="color: #666; font-style: italic; margin-bottom: 15px;">
                Cut list not available. Add dimensions to elements or fill in manually below:
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Element</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Qty</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Width</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Height</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                    </tr>
                </thead>
                <tbody>
                    ${[1,2,3,4,5].map(() => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 12px; background: #ffffcc;"></td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                <div style="width: 16px; height: 16px; border: 2px solid #333; margin: 0 auto;"></div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    html += `</div>`;
    return html;
}

function generateSprayPackSection() {
    // Sprawdź czy projekt ma fazę spray
    const hasSprayPhase = projectData.phases.some(p => 
        p.phase_key && p.phase_key.toLowerCase().includes('spray')
    );
    
    if (!hasSprayPhase) {
        return ''; // Nie pokazuj sekcji jeśli brak fazy spray
    }
    
    const sectionNum = ++pdfSectionNumber;
    const sprayMaterials = projectData.materials.filter(m => m.used_in_stage === 'Spraying');
    const sprayAttachment = projectData.attachments.find(a => a.attachment_type === 'SPRAY_COLORS');
    
    // Zbierz kolory z elementów
    const colours = [...new Set(projectData.elements
        .filter(el => el.finish_name)
        .map(el => el.finish_name))];
    
    let html = `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h2 style="color: #333; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px;">${sectionNum}. 🎨 Spray / Finish Pack</h2>
            
            <!-- DISCLAIMER -->
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <strong style="color: #856404;">⚠️ SPRAYING MANAGER NOTICE:</strong>
                <p style="margin: 10px 0 0 0; color: #856404; font-size: 12px;">
                    Please review ALL project documentation - there may be important information for spraying in other sections (Scope, Notes, BOM, etc).
                </p>
            </div>
            
            ${sprayDescription.trim() ? `
                <div style="background: #e8f5e9; border-left: 4px solid #22c55e; padding: 15px; margin-bottom: 20px;">
                    <strong style="color: #1b5e20;">📋 Spray Instructions:</strong>
                    <div style="white-space: pre-wrap; margin-top: 10px; color: #333;">${sprayDescription}</div>
                </div>
            ` : ''}
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <!-- Colour Codes -->
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Colour Codes (from BOM)</h3>
                    ${colours.length > 0 ? `
                        <ul style="margin: 0; padding-left: 20px;">
                            ${colours.map(c => `<li style="margin-bottom: 5px;"><strong>${c}</strong></li>`).join('')}
                        </ul>
                    ` : `<div style="color: #666; font-style: italic;">No colours specified in elements</div>`}
                </div>
                
                <!-- Manual Notes Area -->
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Additional Notes</h3>
                    <div style="background: #ffffcc; padding: 10px; border-radius: 4px; min-height: 60px;">
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                    </div>
                </div>
            </div>
            
            ${sprayAttachment ? `
                <div style="background: #e3f2fd; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                    <strong>📎 Colour Reference File:</strong> ${sprayAttachment.file_name}
                    <span style="color: #666; font-size: 11px;">(see attached)</span>
                </div>
            ` : ''}
            
            ${sprayMaterials.length > 0 ? `
                <h3 style="font-size: 14px; color: #333; margin-bottom: 10px;">Spray Materials</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Material</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Needed</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Used</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sprayMaterials.map(m => {
                            const itemName = m.stock_items?.name || m.item_name || 'Unknown';
                            const unit = m.unit || m.stock_items?.unit || '';
                            return `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px;">${itemName}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.quantity_needed} ${unit}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #ffffcc;">
                                    <div style="border-bottom: 1px solid #999; width: 40px; height: 16px; margin: 0 auto;"></div>
                                </td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                                    <div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            ` : ''}
        </div>
    `;
    
    return html;
}

function generateMaterialsSection() {
    const materials = projectData.materials;
    const sectionNum = ++pdfSectionNumber;
    
    const byStage = {
        'Production': materials.filter(m => m.used_in_stage === 'Production'),
        'Spraying': materials.filter(m => m.used_in_stage === 'Spraying'),
        'Installation': materials.filter(m => m.used_in_stage === 'Installation')
    };
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Materials</h2>
    `;
    
    Object.entries(byStage).forEach(([stage, mats]) => {
        if (mats.length === 0) return;
        
        html += `
            <h3 style="color: #666; margin: 20px 0 10px 0;">${stage}</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Needed</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Reserved</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Used</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">✓</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        mats.forEach(m => {
            // Helper: nazwa materiału z różnych źródeł
            const itemName = m.stock_items?.name || m.item_name || 'Unknown';
            const unit = m.unit || m.stock_items?.unit || '';
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${itemName}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.quantity_needed} ${unit}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${m.quantity_reserved || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; background: #ffffcc;">
                        <div style="border-bottom: 1px solid #999; width: 40px; height: 16px; margin: 0 auto;"></div>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <div style="width: 14px; height: 14px; border: 2px solid #333; margin: 0 auto;"></div>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    });
    
    if (materials.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No materials assigned.</div>`;
    }
    
    html += `</div>`;
    return html;
}

async function generateDrawingsSection() {
    const sectionNum = ++pdfSectionNumber;
    
    // Find drawings attachment
    const drawingsAttachment = projectData.attachments.find(a => a.attachment_type === 'DRAWINGS_MAIN');
    const drawingsFromFiles = projectData.files.filter(f => f.folder_name === 'drawings');
    
    let html = `
        <div style="margin-bottom: 30px; page-break-before: always;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Drawings</h2>
    `;
    
    // Get file to embed
    let fileToEmbed = null;
    if (drawingsAttachment) {
        fileToEmbed = {
            url: drawingsAttachment.file_url,
            name: drawingsAttachment.file_name || 'drawing'
        };
    } else if (drawingsFromFiles.length > 0) {
        // Get public URL for first drawing file
        const firstFile = drawingsFromFiles[0];
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(firstFile.file_path);
        fileToEmbed = {
            url: urlData.publicUrl,
            name: firstFile.file_name
        };
    }
    
    if (fileToEmbed) {
        const fileName = fileToEmbed.name.toLowerCase();
        const isPdf = fileName.endsWith('.pdf');
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        html += `<div style="text-align: center; margin: 15px 0;">
            <div style="font-size: 11px; color: #666; margin-bottom: 10px;">📄 ${fileToEmbed.name}</div>`;
        
        if (isImage) {
            // Embed image directly
            html += `<img src="${fileToEmbed.url}" style="max-width: 100%; max-height: 800px; border: 1px solid #ddd;" crossorigin="anonymous" />`;
        } else if (isPdf) {
            // Render PDF pages as images
            try {
                const images = await renderPdfToImages(fileToEmbed.url);
                if (images.length > 0) {
                    html += images.map((imgData, i) => `
                        <div style="margin-bottom: 20px; ${i > 0 ? 'page-break-before: always;' : ''}">
                            <div style="font-size: 10px; color: #999; margin-bottom: 5px;">Page ${i + 1} of ${images.length}</div>
                            <img src="${imgData}" style="max-width: 100%; border: 1px solid #ddd;" />
                        </div>
                    `).join('');
                } else {
                    html += `<div style="color: #f59e0b;">⚠️ Could not render PDF. <a href="${fileToEmbed.url}" target="_blank">Open PDF</a></div>`;
                }
            } catch (err) {
                console.error('PDF render error:', err);
                html += `<div style="color: #f59e0b;">⚠️ Could not render PDF. <a href="${fileToEmbed.url}" target="_blank">Open PDF</a></div>`;
            }
        } else {
            // Unknown format - show link
            html += `<a href="${fileToEmbed.url}" target="_blank" style="color: #1976d2;">Download ${fileToEmbed.name}</a>`;
        }
        
        html += `</div>`;
        
        // Show additional files if more than one
        if (drawingsFromFiles.length > 1) {
            html += `
                <div style="background: #f5f5f5; padding: 10px; margin-top: 15px; font-size: 11px;">
                    <strong>Additional drawings in project:</strong>
                    <ul style="margin: 5px 0 0 20px;">
                        ${drawingsFromFiles.slice(1).map(f => `<li>${f.file_name}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    } else {
        html += `<div style="color: #ef4444; font-style: italic;">⚠️ No drawings attached - required!</div>`;
    }
    
    html += `</div>`;
    return html;
}

// Render PDF to array of base64 images
// Scale 4 = good quality for A3 print (~200 DPI)
async function renderPdfToImages(url, scale = 4) {
    const images = [];
    
    try {
        // Load PDF
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        
        // Render each page
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            
            // Create canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render page to canvas
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Convert to base64 image
            images.push(canvas.toDataURL('image/jpeg', 0.95));
        }
    } catch (err) {
        console.error('Error rendering PDF:', err);
    }
    
    return images;
}

async function generatePhotosSection() {
    const sectionNum = ++pdfSectionNumber;
    
    // Find photos attachment
    const photosAttachment = projectData.attachments.find(a => a.attachment_type === 'PHOTOS');
    const photosFromFiles = projectData.files.filter(f => f.folder_name === 'photos');
    
    // Photos are optional - if none, don't show section
    if (!photosAttachment && photosFromFiles.length === 0) {
        return ''; // No photos section if nothing uploaded
    }
    
    let html = `
        <div style="margin-bottom: 30px; page-break-before: always;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Reference Photos</h2>
    `;
    
    // Collect all photos to embed
    let photosToEmbed = [];
    
    if (photosAttachment) {
        photosToEmbed.push({
            url: photosAttachment.file_url,
            name: photosAttachment.file_name || 'photo'
        });
    }
    
    // Add photos from project files
    for (const file of photosFromFiles) {
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(file.file_path);
        photosToEmbed.push({
            url: urlData.publicUrl,
            name: file.file_name
        });
    }
    
    // Embed each photo
    for (const photo of photosToEmbed) {
        const fileName = photo.name.toLowerCase();
        const isImage = fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        
        html += `<div style="margin-bottom: 20px; text-align: center;">
            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">📷 ${photo.name}</div>`;
        
        if (isImage) {
            html += `<img src="${photo.url}" style="max-width: 100%; max-height: 600px; border: 1px solid #ddd;" crossorigin="anonymous" />`;
        } else {
            html += `<a href="${photo.url}" target="_blank" style="color: #1976d2;">View ${photo.name}</a>`;
        }
        
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}

function generateRoutingSection() {
    const phases = projectData.phases;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Phases / Timeline</h2>
    `;
    
    if (phases.length === 0) {
        html += `<div style="color: #666; font-style: italic;">No phases defined.</div>`;
    } else {
        html += `
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Phase</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Start</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">End</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Assigned To</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        phases.forEach(p => {
            const statusColor = p.status === 'completed' ? '#22c55e' : 
                               p.status === 'inProgress' ? '#f59e0b' : '#666';
            
            html += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;">${p.phase_key}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        ${p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        ${p.end_date ? new Date(p.end_date).toLocaleDateString('en-GB') : '-'}
                    </td>
                    <td style="border: 1px solid #ddd; padding: 8px;">${p.team_members?.name || '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <span style="color: ${statusColor}; font-weight: bold;">${p.status || 'notStarted'}</span>
                    </td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
    }
    
    html += `</div>`;
    return html;
}

function generateQCSection() {
    const sectionNum = ++pdfSectionNumber;
    
    return `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. QC Checklist & Sign-off</h2>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #666; font-size: 14px; margin-bottom: 10px;">Quality Checks</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    ${['Dimensions verified', 'Finish quality OK', 'Glass spec correct', 'Hardware complete', 'No damage', 'Packaging ready'].map(check => `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 16px; height: 16px; border: 2px solid #333;"></div>
                            <span>${check}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>Production Sign-off</strong>
                    <div style="margin-top: 15px;">
                        <div style="margin-bottom: 10px;">Name: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div style="margin-bottom: 10px;">Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div>Signature: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>QC Sign-off</strong>
                    <div style="margin-top: 15px;">
                        <div style="margin-bottom: 10px;">Name: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div style="margin-bottom: 10px;">Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                        <div>Signature: <span style="border-bottom: 1px solid #333; display: inline-block; width: 150px;"></span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========== CREATE PRODUCTION SHEET ==========
async function createProductionSheet() {
    const forceCreate = document.getElementById('psForceCreate').checked;
    const requiredItems = checklistItems.filter(i => i.required);
    const allDone = requiredItems.every(i => checklistStatus[i.key]?.done);
    
    if (!allDone && !forceCreate) {
        showToast('Complete all required items or check "Force create"', 'warning');
        return;
    }
    
    showToast('Creating Production Sheet...', 'info');
    
    try {
        // Ensure we have a sheet
        if (!currentSheet) {
            await createDraftSheet();
        }
        
        // Build snapshot
        const snapshot = buildSnapshot(forceCreate);
        
        // Generate PDF
        const pdfUrl = await generateAndUploadPDF();
        
        // Update sheet to FINAL
        const { error } = await supabaseClient
            .from('production_sheets')
            .update({
                status: 'final',
                snapshot_json: snapshot,
                pdf_url: pdfUrl,
                pdf_generated_at: new Date().toISOString(),
                is_force_created: forceCreate,
                missing_items: forceCreate ? getMissingItems() : [],
                finalized_at: new Date().toISOString(),
                checklist_progress: Math.round((requiredItems.filter(i => checklistStatus[i.key]?.done).length / requiredItems.length) * 100)
            })
            .eq('id', currentSheet.id);
        
        if (error) throw error;
        
        showToast('Production Sheet created successfully!', 'success');
        
        // Offer to download
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
        
    } catch (err) {
        console.error('Error creating PS:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

function buildSnapshot(isForceCreated) {
    return {
        meta: {
            sheet_id: currentSheet?.id,
            version: currentSheet?.version || 1,
            status: 'final',
            created_at: new Date().toISOString(),
            is_force_created: isForceCreated,
            missing_items: isForceCreated ? getMissingItems() : []
        },
        project: {
            project_id: projectData.project?.id,
            project_number: projectData.project?.project_number,
            project_name: projectData.project?.name,
            project_type: projectData.project?.type,
            deadline: projectData.project?.deadline,
            client: projectData.client ? {
                name: projectData.client.company_name,
                contact: projectData.client.contact_person,
                phone: projectData.client.phone,
                email: projectData.client.email
            } : null
        },
        // PM descriptions
        scopeDescription: scopeDescription,
        sprayDescription: sprayDescription,
        editedNotes: editedNotes,
        // Original notes
        notes: {
            all: projectData.project?.notes || '',
            important: extractImportantNotes(projectData.project?.notes)
        },
        elements: projectData.elements,
        materials: {
            production: projectData.materials.filter(m => m.used_in_stage === 'Production'),
            spraying: projectData.materials.filter(m => m.used_in_stage === 'Spraying'),
            installation: projectData.materials.filter(m => m.used_in_stage === 'Installation')
        },
        phases: projectData.phases,
        blockers: projectData.blockers,
        attachments: projectData.attachments
    };
}

function getMissingItems() {
    return checklistItems
        .filter(i => i.required && !checklistStatus[i.key]?.done)
        .map(i => ({
            key: i.key,
            label: i.label,
            section: i.sectionKey
        }));
}

function extractImportantNotes(notesRaw) {
    if (!notesRaw) return [];
    const allNotes = parseProjectNotesPS(notesRaw);
    return allNotes.filter(n => n.important === true);
}

// ========== PDF GENERATION ==========
async function generateAndUploadPDF() {
    const pages = document.querySelectorAll('.ps-page');
    
    if (pages.length === 0) {
        throw new Error('No pages to export');
    }
    
    try {
        const { jsPDF } = window.jspdf;
        // A3 landscape: 420mm x 297mm
        const pdf = new jsPDF('l', 'mm', 'a3');
        const pdfWidth = 420;
        const pdfHeight = 297;
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            
            // Temporarily reset transform for capture
            const originalTransform = page.style.transform;
            const originalMargin = page.style.marginBottom;
            page.style.transform = 'none';
            page.style.marginBottom = '0';
            
            const canvas = await html2canvas(page, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: page.scrollWidth,
                height: page.scrollHeight
            });
            
            // Restore transform
            page.style.transform = originalTransform;
            page.style.marginBottom = originalMargin;
            
            // Add page (not for first page)
            if (i > 0) {
                pdf.addPage();
            }
            
            // Calculate dimensions to fit A3
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(
                canvas.toDataURL('image/jpeg', 0.95), 
                'JPEG', 
                0, 
                0, 
                imgWidth, 
                Math.min(imgHeight, pdfHeight)
            );
        }
        
        // Upload to storage
        const pdfBlob = pdf.output('blob');
        const fileName = `PS_${projectData.project?.project_number || 'unknown'}_v${currentSheet?.version || 1}.pdf`;
        const filePath = `production-sheets/${currentSheet.id}/${fileName}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('project-documents')
            .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabaseClient.storage
            .from('project-documents')
            .getPublicUrl(filePath);
        
        return urlData.publicUrl;
        
    } catch (err) {
        console.error('PDF generation error:', err);
        throw err;
    }
}

async function downloadPDF() {
    showToast('Generating PDF...', 'info');
    
    try {
        const pages = document.querySelectorAll('.ps-page');
        
        if (pages.length === 0) {
            throw new Error('No pages to export');
        }
        
        const { jsPDF } = window.jspdf;
        // A3 landscape: 420mm x 297mm
        const pdf = new jsPDF('l', 'mm', 'a3');
        const pdfWidth = 420;
        const pdfHeight = 297;
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            
            // Temporarily reset transform for capture
            const originalTransform = page.style.transform;
            const originalMargin = page.style.marginBottom;
            page.style.transform = 'none';
            page.style.marginBottom = '0';
            
            const canvas = await html2canvas(page, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: page.scrollWidth,
                height: page.scrollHeight
            });
            
            // Restore transform
            page.style.transform = originalTransform;
            page.style.marginBottom = originalMargin;
            
            // Add page (not for first page)
            if (i > 0) {
                pdf.addPage();
            }
            
            // Calculate dimensions to fit A3
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(
                canvas.toDataURL('image/jpeg', 0.95), 
                'JPEG', 
                0, 
                0, 
                imgWidth, 
                Math.min(imgHeight, pdfHeight)
            );
        }
        
        const fileName = `PS_${projectData.project?.project_number || 'project'}_v${currentSheet?.version || 1}.pdf`;
        pdf.save(fileName);
        
        showToast('PDF downloaded!', 'success');
        
    } catch (err) {
        console.error('PDF error:', err);
        showToast('Error generating PDF: ' + err.message, 'error');
    }
}

// ========== UTILITIES ==========
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('psUploadZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                document.getElementById('psFileInput').files = e.dataTransfer.files;
                handleFileSelect({ target: { files: [file] } });
            }
        });
    }
});