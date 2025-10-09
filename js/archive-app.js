// ========== ARCHIVE APP ==========

let archivedProjects = [];
let allClients = {};
let allWorkers = {};
let filteredProjects = [];
let currentEditingProject = null;

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadClients();
    await loadWorkers();
    await loadArchivedProjects();
    setupFilters();
    renderProjects();
});

// Check authentication
async function checkAuth() {
    if (typeof supabaseClient !== 'undefined') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
    }
}

// Load clients for filter and display
async function loadClients() {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('id, client_number, company_name, contact_person');
        
        if (error) throw error;
        
        data.forEach(client => {
            allClients[client.id] = client;
        });
        
        // Populate client filter
        const clientFilter = document.getElementById('clientFilter');
        data.sort((a, b) => (a.company_name || '').localeCompare(b.company_name || ''));
        data.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.client_number} - ${client.company_name || client.contact_person}`;
            clientFilter.appendChild(option);
        });
        
        console.log('✅ Loaded', data.length, 'clients');
    } catch (err) {
        console.error('Error loading clients:', err);
    }
}

// Load workers for display
async function loadWorkers() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('id, name, color');
        
        if (error) throw error;
        
        data.forEach(worker => {
            allWorkers[worker.id] = worker;
        });
        
        console.log('✅ Loaded', data.length, 'workers');
    } catch (err) {
        console.error('Error loading workers:', err);
    }
}

// Load archived projects
async function loadArchivedProjects() {
    try {
        const { data, error } = await supabaseClient
            .from('archived_projects')
            .select('*')
            .order('archived_date', { ascending: false });
        
        if (error) throw error;
        
        archivedProjects = data || [];
        filteredProjects = [...archivedProjects];
        
        console.log('✅ Loaded', archivedProjects.length, 'archived projects');
        
        // Update stats
        updateStats();
        
        // Populate year filter
        populateYearFilter();
        
    } catch (err) {
        console.error('Error loading archived projects:', err);
        archivedProjects = [];
        filteredProjects = [];
    }
}

// Update statistics
function updateStats() {
    const total = archivedProjects.length;
    const completed = archivedProjects.filter(p => p.archive_reason === 'completed').length;
    const failed = archivedProjects.filter(p => p.archive_reason === 'failed').length;
    
    document.getElementById('totalCount').textContent = total;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('failedCount').textContent = failed;
}

// Populate year filter
function populateYearFilter() {
    const years = new Set();
    archivedProjects.forEach(project => {
        if (project.archived_date) {
            const year = new Date(project.archived_date).getFullYear();
            years.add(year);
        }
    });
    
    const yearFilter = document.getElementById('yearFilter');
    Array.from(years).sort((a, b) => b - a).forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

// Setup filters
function setupFilters() {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('sourceFilter').addEventListener('change', applyFilters);
    document.getElementById('reasonFilter').addEventListener('change', applyFilters);
    document.getElementById('clientFilter').addEventListener('change', applyFilters);
    document.getElementById('yearFilter').addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sourceFilter = document.getElementById('sourceFilter').value;
    const reasonFilter = document.getElementById('reasonFilter').value;
    const clientFilter = document.getElementById('clientFilter').value;
    const yearFilter = document.getElementById('yearFilter').value;
    
    filteredProjects = archivedProjects.filter(project => {
        // Search filter
        if (searchTerm) {
            const matchesSearch = 
                (project.project_number || '').toLowerCase().includes(searchTerm) ||
                (project.name || '').toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;
        }
        
        // Source filter
        if (sourceFilter && project.source !== sourceFilter) {
            return false;
        }
        
        // Reason filter
        if (reasonFilter && project.archive_reason !== reasonFilter) {
            return false;
        }
        
        // Client filter
        if (clientFilter && project.client_id !== clientFilter) {
            return false;
        }
        
        // Year filter
        if (yearFilter) {
            const projectYear = new Date(project.archived_date).getFullYear();
            if (projectYear.toString() !== yearFilter) {
                return false;
            }
        }
        
        return true;
    });
    
    renderProjects();
}

// Render projects
function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    const noProjects = document.getElementById('noProjects');
    
    if (filteredProjects.length === 0) {
        grid.style.display = 'none';
        noProjects.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    noProjects.style.display = 'none';
    
    grid.innerHTML = filteredProjects.map(project => createProjectCard(project)).join('');
}

// Create project card HTML
function createProjectCard(project) {
    const client = allClients[project.client_id];
    const clientName = client ? (client.company_name || client.contact_person) : 'Unknown Client';
    const clientNumber = client ? client.client_number : '-';
    
    const timberWorker = allWorkers[project.timber_worker_id];
    const sprayWorker = allWorkers[project.spray_worker_id];
    
    const reasonClass = project.archive_reason || 'completed';
    const reasonIcon = {
        'completed': '✅',
        'failed': '❌',
        'cancelled': '⚠️',
        'onHold': '⏸️'
    }[reasonClass] || '📦';
    
    const reasonText = (project.archive_reason || 'completed').charAt(0).toUpperCase() + 
                       (project.archive_reason || 'completed').slice(1).replace(/([A-Z])/g, ' $1');
    
    const sourceIcon = project.source === 'pipeline' ? '📄' : '🏭';
    const sourceText = project.source === 'pipeline' ? 'Pipeline' : 'Production';
    const sourceBg = project.source === 'pipeline' ? '#2c5a8f' : '#5a4632';
    
    const archivedDate = project.archived_date ? 
        new Date(project.archived_date).toLocaleDateString('en-GB') : '-';
    
    const deadlineDate = project.deadline ? 
        new Date(project.deadline).toLocaleDateString('en-GB') : '-';
    
    const gdLink = project.google_drive_url ? 
        `<a href="${project.google_drive_url}" target="_blank" style="color: #4a9eff; text-decoration: none;">📁 Open Folder</a>` : 
        '<span style="color: #666;">No GD Link</span>';
    
    return `
        <div class="project-card ${reasonClass}">
            <div class="project-header-row">
                <div class="project-main-info">
                    <div class="project-number">${project.project_number || '-'}</div>
                    <div class="project-name">${project.name || 'Unnamed Project'}</div>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                        <span class="project-type-badge">${project.type || 'other'}</span>
                        <span class="project-type-badge" style="background: ${sourceBg};">${sourceIcon} ${sourceText}</span>
                    </div>
                </div>
                <div class="project-dates">
                    <div style="margin-bottom: 8px;">
                        <div class="archive-reason reason-${reasonClass}">
                            ${reasonIcon} ${reasonText}
                        </div>
                    </div>
                    <div style="margin-bottom: 10px;">Archived: ${archivedDate}</div>
                    <div style="display: flex; gap: 8px;">
                        <button class="toolbar-btn" style="padding: 6px 12px; font-size: 12px;" onclick="openEditModal('${project.id}')">✏️ Edit</button>
                        <button class="toolbar-btn danger" style="padding: 6px 12px; font-size: 12px;" onclick="openDeleteModal('${project.id}')">🗑️ Delete</button>
                    </div>
                </div>
            </div>
            
            <div class="project-details">
                <div class="detail-item">
                    <div class="detail-label">Client</div>
                    <div class="detail-value">${clientNumber} - ${clientName}</div>
                </div>
                
                ${project.source === 'production' ? `
                <div class="detail-item">
                    <div class="detail-label">Deadline</div>
                    <div class="detail-value">${deadlineDate}</div>
                </div>
                ` : ''}
                
                <div class="detail-item">
                    <div class="detail-label">${project.source === 'production' ? 'Contract Value' : 'Estimated Value'}</div>
                    <div class="detail-value">£${(project.contract_value || 0).toLocaleString()}</div>
                </div>
                
                <div class="detail-item">
                    <div class="detail-label">Google Drive</div>
                    <div class="detail-value">${gdLink}</div>
                </div>
                
                ${timberWorker ? `
                <div class="detail-item">
                    <div class="detail-label">Timber Worker</div>
                    <div class="detail-value">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${timberWorker.color}; border-radius: 50%; margin-right: 6px;"></span>
                        ${timberWorker.name}
                    </div>
                </div>
                ` : ''}
                
                ${sprayWorker ? `
                <div class="detail-item">
                    <div class="detail-label">Spray Worker</div>
                    <div class="detail-value">
                        <span style="display: inline-block; width: 12px; height: 12px; background: ${sprayWorker.color}; border-radius: 50%; margin-right: 6px;"></span>
                        ${sprayWorker.name}
                    </div>
                </div>
                ` : ''}
                
                ${project.archive_notes ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Notes</div>
                    <div class="detail-value">${project.archive_notes}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// ========== EDIT FUNCTIONALITY ==========

function openEditModal(projectId) {
    currentEditingProject = archivedProjects.find(p => p.id === projectId);
    
    if (!currentEditingProject) {
        alert('Project not found');
        return;
    }
    
    // Populate form
    document.getElementById('editContractValue').value = currentEditingProject.contract_value || 0;
    document.getElementById('editArchiveReason').value = currentEditingProject.archive_reason || 'completed';
    document.getElementById('editArchiveNotes').value = currentEditingProject.archive_notes || '';
    
    // Show modal
    document.getElementById('editArchiveModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editArchiveModal').style.display = 'none';
    currentEditingProject = null;
}

async function saveArchiveEdit() {
    if (!currentEditingProject) return;
    
    const contractValue = parseFloat(document.getElementById('editContractValue').value) || 0;
    const archiveReason = document.getElementById('editArchiveReason').value;
    const archiveNotes = document.getElementById('editArchiveNotes').value.trim();
    
    try {
        const { error } = await supabaseClient
            .from('archived_projects')
            .update({
                contract_value: contractValue,
                archive_reason: archiveReason,
                archive_notes: archiveNotes
            })
            .eq('id', currentEditingProject.id);
        
        if (error) throw error;
        
        console.log('✅ Project updated successfully');
        
        // Update local data
        currentEditingProject.contract_value = contractValue;
        currentEditingProject.archive_reason = archiveReason;
        currentEditingProject.archive_notes = archiveNotes;
        
        // Refresh display
        renderProjects();
        updateStats();
        closeEditModal();
        
        alert('Project updated successfully!');
        
    } catch (err) {
        console.error('Error updating project:', err);
        alert('Error updating project: ' + err.message);
    }
}

// ========== DELETE FUNCTIONALITY ==========

function openDeleteModal(projectId) {
    currentEditingProject = archivedProjects.find(p => p.id === projectId);
    
    if (!currentEditingProject) {
        alert('Project not found');
        return;
    }
    
    // Show project name in modal
    document.getElementById('deleteProjectName').textContent = 
        `${currentEditingProject.project_number} - ${currentEditingProject.name}`;
    
    // Show modal
    document.getElementById('deleteArchiveModal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('deleteArchiveModal').style.display = 'none';
    currentEditingProject = null;
}

async function confirmDeleteArchive() {
    if (!currentEditingProject) return;
    
    try {
        const { error } = await supabaseClient
            .from('archived_projects')
            .delete()
            .eq('id', currentEditingProject.id);
        
        if (error) throw error;
        
        console.log('✅ Project deleted successfully');
        
        // Remove from local arrays
        archivedProjects = archivedProjects.filter(p => p.id !== currentEditingProject.id);
        filteredProjects = filteredProjects.filter(p => p.id !== currentEditingProject.id);
        
        // Refresh display
        renderProjects();
        updateStats();
        closeDeleteModal();
        
        alert('Project deleted successfully!');
        
    } catch (err) {
        console.error('Error deleting project:', err);
        alert('Error deleting project: ' + err.message);
    }
}

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeEditModal();
        closeDeleteModal();
    }
});