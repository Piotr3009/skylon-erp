// ============================================
// PRODUCTION SHEET BUILDER
// Joinery Core by Skylon Development LTD
// ============================================

// ========== GLOBAL STATE ==========
let currentProject = null;
let currentSheet = null;
let checklistItems = [];
let checklistStatus = {};
let scopeDescription = ''; // Production manager's description
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
        title: 'Elements (BOM)',
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
            { key: 'ATT_DRAWINGS_MAIN', label: 'Main Drawings (PDF)', source: 'UPLOAD', required: true, uploadType: 'DRAWINGS_MAIN', accept: '.pdf' }
        ]
    },
    {
        key: 'PHOTOS',
        title: 'Photos',
        icon: '📷',
        items: [
            { key: 'ATT_PHOTOS', label: 'Reference Photos', source: 'UPLOAD', required: false, uploadType: 'PHOTOS', accept: '.jpg,.jpeg,.png,.pdf' }
        ]
    },
    {
        key: 'MATERIALS',
        title: 'Materials',
        icon: '🪵',
        items: [
            { key: 'MAT_PRODUCTION', label: 'Production Materials', source: 'AUTO', required: true, goTo: 'materials' },
            { key: 'MAT_SPRAYING', label: 'Spraying Materials', source: 'AUTO', required: false },
            { key: 'MAT_INSTALLATION', label: 'Installation Materials', source: 'AUTO', required: false }
        ]
    },
    {
        key: 'SPRAY',
        title: 'Spray Pack',
        icon: '🎨',
        conditional: true, // tylko jeśli projekt ma fazę spray
        items: [
            { key: 'SPRAY_COLORS', label: 'Colour Codes', source: 'UPLOAD', required: true, uploadType: 'SPRAY_COLORS', accept: '.pdf,.jpg,.jpeg,.png' }
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
        key: 'BLOCKERS',
        title: 'Blockers',
        icon: '⚠️',
        items: [
            { key: 'BLOCKERS_NONE_CRITICAL', label: 'No critical blockers', source: 'AUTO', required: true }
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
        const { data: materials } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items(name, item_number, size, thickness, image_url),
                stock_categories(name)
            `)
            .eq('project_id', projectId)
            .order('used_in_stage');
        projectData.materials = materials || [];
        
        // 5. Load elements (BOM)
        const { data: elements } = await supabaseClient
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
        const { data: existingSheet } = await supabaseClient
            .from('production_sheets')
            .select('*, production_sheet_attachments(*)')
            .eq('project_id', projectId)
            .eq('status', 'draft')
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (existingSheet) {
            currentSheet = existingSheet;
            projectData.attachments = existingSheet.production_sheet_attachments || [];
            
            // Load scopeDescription from snapshot if exists
            if (existingSheet.snapshot_json?.scopeDescription) {
                scopeDescription = existingSheet.snapshot_json.scopeDescription;
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
    
    // Determine action button (standard items)
    let actionBtn = '';
    if (item.source === 'UPLOAD') {
        actionBtn = `<button class="ps-item-action upload" onclick="openUploadModal('${item.key}', '${item.uploadType}', '${item.accept || ''}')">📁 Upload</button>`;
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

function closeDescriptionModal() {
    document.getElementById('psDescriptionModal').classList.remove('active');
}

function saveDescription() {
    scopeDescription = document.getElementById('descriptionModalText').value;
    closeDescriptionModal();
    
    // Update UI
    updateDescriptionUI();
    checkAllItems();
    updateProgress();
    generatePreview();
    
    showToast('Description saved!', 'success');
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
            const notes = projectData.project?.notes || '';
            const importantLines = notes.split('\n')
                .filter(line => line.includes('IMPORTANT') || line.includes('URGENT') || line.includes('⚠️'));
            
            result.done = true; // Always done, just informational
            result.meta = importantLines.length > 0 ? `${importantLines.length} important note(s)` : 'No urgent notes';
            
            // Update content display
            const contentEl = document.getElementById('content-SCOPE_URGENT_NOTES');
            if (contentEl) {
                if (importantLines.length > 0) {
                    contentEl.innerHTML = importantLines.map(line => 
                        `<div style="margin-bottom: 8px; padding: 8px; background: #2d2d30; border-left: 3px solid #f59e0b; color: #e8e2d5;">${line}</div>`
                    ).join('');
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
            const hasPhotos = projectData.attachments.some(a => a.attachment_type === 'PHOTOS') ||
                             projectData.files.some(f => f.folder_name === 'photos');
            result.done = hasPhotos;
            result.meta = hasPhotos ? 'Uploaded' : 'Optional';
            break;
            
        // MATERIALS
        case 'MAT_PRODUCTION':
            const prodMats = projectData.materials.filter(m => m.used_in_stage === 'Production');
            result.done = prodMats.length > 0;
            result.meta = `${prodMats.length} item(s)`;
            break;
            
        case 'MAT_SPRAYING':
            const sprayMats = projectData.materials.filter(m => m.used_in_stage === 'Spraying');
            result.done = true; // Optional
            result.meta = `${sprayMats.length} item(s)`;
            break;
            
        case 'MAT_INSTALLATION':
            const instMats = projectData.materials.filter(m => m.used_in_stage === 'Installation');
            result.done = true; // Optional
            result.meta = `${instMats.length} item(s)`;
            break;
            
        // SPRAY
        case 'SPRAY_COLORS':
            const hasSprayColors = projectData.attachments.some(a => a.attachment_type === 'SPRAY_COLORS');
            result.done = hasSprayColors;
            result.meta = hasSprayColors ? 'Uploaded' : 'Required for spray projects';
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
            
        // BLOCKERS
        case 'BLOCKERS_NONE_CRITICAL':
            const criticalBlockers = projectData.blockers.filter(b => b.severity === 'critical');
            result.done = criticalBlockers.length === 0;
            result.blocked = criticalBlockers.length > 0;
            result.meta = criticalBlockers.length > 0 
                ? `${criticalBlockers.length} critical blocker(s)!`
                : 'No critical blockers';
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
            .from('project-files')
            .upload(filePath, selectedFile);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('project-files')
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
            scopeDescription: scopeDescription
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
function openBomModal() {
    document.getElementById('psBomModal').classList.add('active');
    renderBomTable();
}

function closeBomModal() {
    document.getElementById('psBomModal').classList.remove('active');
    // Re-check checklist after closing
    checkAllItems();
    updateProgress();
    generatePreview();
}

function renderBomTable() {
    const tbody = document.getElementById('bomTableBody');
    const emptyMsg = document.getElementById('bomEmpty');
    
    if (projectData.elements.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    
    emptyMsg.style.display = 'none';
    
    tbody.innerHTML = projectData.elements.map((el, index) => `
        <tr style="border-bottom: 1px solid #3e3e42;">
            <td style="padding: 10px; color: #4a9eff; font-weight: 600;">${el.element_id || '-'}</td>
            <td style="padding: 10px;">
                <div style="color: #e8e2d5;">${el.name}</div>
                ${el.notes ? `<div style="font-size: 10px; color: #888; margin-top: 2px;">${el.notes}</div>` : ''}
            </td>
            <td style="padding: 10px; text-align: center;">${el.qty}</td>
            <td style="padding: 10px; text-align: center;">
                ${el.width && el.height ? `${el.width} x ${el.height}` : '-'}
            </td>
            <td style="padding: 10px;">${el.finish_name || '-'}</td>
            <td style="padding: 10px;">${el.glass_spec || '-'}</td>
            <td style="padding: 10px; text-align: center;">
                <button onclick="deleteBomElement('${el.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    Delete
                </button>
            </td>
        </tr>
    `).join('');
}

async function addBomElement() {
    const name = document.getElementById('bomNewName').value.trim();
    
    if (!name) {
        showToast('Name is required', 'warning');
        return;
    }
    
    const newElement = {
        project_id: projectId,
        element_id: document.getElementById('bomNewId').value.trim() || null,
        name: name,
        qty: parseInt(document.getElementById('bomNewQty').value) || 1,
        width: parseInt(document.getElementById('bomNewWidth').value) || null,
        height: parseInt(document.getElementById('bomNewHeight').value) || null,
        finish_name: document.getElementById('bomNewFinish').value.trim() || null,
        glass_spec: document.getElementById('bomNewGlass').value.trim() || null,
        has_glazing: !!document.getElementById('bomNewGlass').value.trim(),
        notes: document.getElementById('bomNewNotes').value.trim() || null,
        sort_order: projectData.elements.length
    };
    
    try {
        const { data, error } = await supabaseClient
            .from('project_elements')
            .insert(newElement)
            .select()
            .single();
        
        if (error) throw error;
        
        projectData.elements.push(data);
        renderBomTable();
        clearBomForm();
        showToast('Element added!', 'success');
        
    } catch (err) {
        console.error('Error adding element:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteBomElement(elementId) {
    if (!confirm('Delete this element?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('project_elements')
            .delete()
            .eq('id', elementId);
        
        if (error) throw error;
        
        projectData.elements = projectData.elements.filter(e => e.id !== elementId);
        renderBomTable();
        showToast('Element deleted', 'success');
        
    } catch (err) {
        console.error('Error deleting element:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

function clearBomForm() {
    document.getElementById('bomNewId').value = '';
    document.getElementById('bomNewName').value = '';
    document.getElementById('bomNewQty').value = '1';
    document.getElementById('bomNewWidth').value = '';
    document.getElementById('bomNewHeight').value = '';
    document.getElementById('bomNewFinish').value = '';
    document.getElementById('bomNewGlass').value = '';
    document.getElementById('bomNewNotes').value = '';
}

// ========== PREVIEW GENERATION ==========
let pdfSectionNumber = 0; // Global section counter for PDF

async function generatePreview() {
    const container = document.getElementById('psPdfPreview');
    pdfSectionNumber = 0; // Reset counter
    
    let html = `<div style="font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5;">`;
    
    // COVER PAGE
    html += generateCoverPage();
    
    // TABLE OF CONTENTS
    html += generateTOC();
    
    // SCOPE & NOTES
    html += generateScopeSection();
    
    // BOM
    html += generateBOMSection();
    
    // CUT LIST
    html += generateCutListSection();
    
    // MATERIALS
    html += generateMaterialsSection();
    
    // SPRAY PACK
    html += generateSprayPackSection();
    
    // ROUTING
    html += generateRoutingSection();
    
    // BLOCKERS
    html += generateBlockersSection();
    
    // QC + SIGN-OFF
    html += generateQCSection();
    
    html += `</div>`;
    
    container.innerHTML = html;
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
    
    // Budujemy TOC zgodnie z kolejnością sekcji
    const sections = [
        'Scope & Notes',
        'Elements (BOM)',
        'Cut List',
        'Materials'
    ];
    
    if (hasSprayPhase) {
        sections.push('Spray / Finish Pack');
    }
    
    sections.push('Phases / Timeline');
    sections.push('Blockers');
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
    const notes = project?.notes || '';
    const sectionNum = ++pdfSectionNumber;
    
    // Extract important notes
    const importantNotes = notes.split('\n')
        .filter(line => line.includes('IMPORTANT') || line.includes('URGENT') || line.includes('⚠️'))
        .join('\n');
    
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
            
            ${importantNotes ? `
                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px;">
                    <strong style="color: #856404;">⚠️ Important Notes (from project preparation):</strong>
                    <div style="white-space: pre-wrap; margin-top: 10px;">${importantNotes}</div>
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
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Elements (BOM)</h2>
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
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <!-- Colour Codes -->
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Colour Codes</h3>
                    ${colours.length > 0 ? `
                        <ul style="margin: 0; padding-left: 20px;">
                            ${colours.map(c => `<li style="margin-bottom: 5px;"><strong>${c}</strong></li>`).join('')}
                        </ul>
                    ` : `<div style="color: #666; font-style: italic;">No colours specified in elements</div>`}
                </div>
                
                <!-- Finish Instructions -->
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #333;">Finish Instructions</h3>
                    <div style="background: #ffffcc; padding: 10px; border-radius: 4px; min-height: 60px;">
                        <div style="color: #666; font-size: 10px;">Notes / instructions:</div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                        <div style="border-bottom: 1px solid #ccc; margin-top: 15px;"></div>
                    </div>
                </div>
            </div>
            
            ${sprayAttachment ? `
                <div style="background: #e8f5e9; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
                    <strong>📎 Colour Reference:</strong> ${sprayAttachment.file_name}
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
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: left;">Item</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Needed</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Reserved</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">Used</th>
                        <th style="border: 1px solid #ddd; padding: 6px; text-align: center;">✓</th>
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
                    <td style="border: 1px solid #ddd; padding: 6px;">${itemName}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${m.quantity_needed} ${unit}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${m.quantity_reserved || 0}</td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center; background: #ffffcc;">
                        <div style="border-bottom: 1px solid #999; width: 40px; height: 16px; margin: 0 auto;"></div>
                    </td>
                    <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">
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

function generateBlockersSection() {
    const blockers = projectData.blockers;
    const sectionNum = ++pdfSectionNumber;
    
    let html = `
        <div style="margin-bottom: 30px;">
            <h2 style="color: #333; border-bottom: 2px solid #4a9eff; padding-bottom: 10px;">${sectionNum}. Blockers</h2>
    `;
    
    if (blockers.length === 0) {
        html += `<div style="color: #22c55e;">✅ No active blockers</div>`;
    } else {
        blockers.forEach(b => {
            const severityColor = b.severity === 'critical' ? '#ef4444' : 
                                 b.severity === 'high' ? '#f59e0b' : '#666';
            
            html += `
                <div style="background: #fff5f5; border-left: 4px solid ${severityColor}; padding: 12px; margin-bottom: 10px;">
                    <div style="font-weight: bold; color: ${severityColor}; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">
                        ${b.severity || 'normal'}
                    </div>
                    <div style="margin-bottom: 5px;">${b.reason}</div>
                    <div style="font-size: 10px; color: #666;">
                        Owner: ${b.team_members?.name || b.owner_name || 'Unassigned'} 
                        ${b.eta ? `• ETA: ${new Date(b.eta).toLocaleDateString('en-GB')}` : ''}
                    </div>
                </div>
            `;
        });
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

function extractImportantNotes(notes) {
    if (!notes) return [];
    return notes.split('\n')
        .filter(line => line.includes('IMPORTANT') || line.includes('URGENT') || line.includes('⚠️'));
}

// ========== PDF GENERATION ==========
async function generateAndUploadPDF() {
    const previewEl = document.getElementById('psPdfPreview');
    
    try {
        const canvas = await html2canvas(previewEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }
        
        // Upload to storage
        const pdfBlob = pdf.output('blob');
        const fileName = `PS_${projectData.project?.project_number || 'unknown'}_v${currentSheet?.version || 1}.pdf`;
        const filePath = `production-sheets/${currentSheet.id}/${fileName}`;
        
        const { error: uploadError } = await supabaseClient.storage
            .from('project-files')
            .upload(filePath, pdfBlob, { contentType: 'application/pdf' });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabaseClient.storage
            .from('project-files')
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
        const previewEl = document.getElementById('psPdfPreview');
        
        const canvas = await html2canvas(previewEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });
        
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        let heightLeft = imgHeight;
        let position = 0;
        
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
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