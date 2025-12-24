// Production Sheet Generator
let currentProject = null;
let currentMaterials = [];
let currentPhases = [];
let currentNotes = '';
let teamMembers = [];

// Get project ID from URL
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('project_id');
const projectStage = urlParams.get('stage') || 'production';

// Load everything on page load
window.addEventListener('DOMContentLoaded', async () => {
    if (!projectId) {
        showToast('No project ID provided!', 'info');
        window.history.back();
        return;
    }
    
    await loadProjectData();
    await loadTeamMembers();
    await generatePreview();
});

async function loadProjectData() {
    try {
        // Load project
        const { data: project, error: projectError } = await supabaseClient
            .from(projectStage === 'pipeline' ? 'pipeline_projects' : 'production_projects')
            .select('*')
            .eq('id', projectId)
            .single();
        
        if (projectError) throw projectError;
        currentProject = project;
        
        // Load materials
        const { data: materials, error: materialsError } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    item_number,
                    size,
                    thickness,
                    image_url,
                    current_quantity,
                    unit
                ),
                stock_categories (
                    name
                )
            `)
            .eq('project_id', projectId)
            .order('used_in_stage', { ascending: true });
        
        if (materialsError) throw materialsError;
        currentMaterials = materials || [];
        
        // Load phases
        const { data: phases, error: phasesError } = await supabaseClient
            .from('project_phases')
            .select('*')
            .eq('project_id', projectId)
            .order('start_date', { ascending: true });
        
        if (phasesError) throw phasesError;
        currentPhases = phases || [];
        
        currentNotes = project.notes || '';
        
    } catch (err) {
        console.error('Error loading project data:', err);
        showToast('Error loading: ' + err.message, 'error');
    }
}

async function loadTeamMembers() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('*');
        
        if (error) throw error;
        teamMembers = data || [];
    } catch (err) {
        console.error('Error loading team:', err);
    }
}

function toggleOption(optionId) {
    const checkbox = document.getElementById(optionId);
    checkbox.checked = !checkbox.checked;
}

async function regeneratePreview() {
    document.getElementById('previewContent').innerHTML = `
        <div style="text-align: center; padding: 60px; color: #999;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <div>Regenerating...</div>
        </div>
    `;
    await generatePreview();
}

async function generatePreview() {
    const includeGantt = document.getElementById('includeGantt').checked;
    const includePhotos = document.getElementById('includePhotos').checked;
    const allNotes = document.getElementById('allNotes').checked;
    const includeDeadlines = document.getElementById('includeDeadlines').checked;
    
    let html = '<div style="font-family: Arial, sans-serif;">';
    
    // 1. PROJECT HEADER
    html += generateHeader(includeDeadlines);
    
    // 2. GANTT TIMELINE
    if (includeGantt) {
        html += await generateGanttSection();
    }
    
    // 3-5. MATERIALS LISTS
    html += generateMaterialsSection('Production', includePhotos);
    html += generateMaterialsSection('Spraying', includePhotos);
    html += generateMaterialsSection('Installation', includePhotos);
    
    // 6. NOTES
    html += generateNotesSection(allNotes);
    
    // 7. OTHER DOCUMENTS
    html += generateOtherDocumentsSection();
    
    // 8. SIGN-OFF
    html += generateSignOffSection();
    
    html += '</div>';
    
    document.getElementById('previewContent').innerHTML = html;
}

function generateHeader(includeDeadlines) {
    let html = `
        <div style="border-bottom: 3px solid #4a90e2; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #333; font-size: 32px;">${currentProject.project_number || 'N/A'}</h1>
            <h2 style="margin: 10px 0; color: #666; font-size: 20px;">${currentProject.name || 'Untitled Project'}</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                <div>
                    <strong>Client:</strong> ${currentProject.client_name || 'N/A'}<br>
                    <strong>Project Type:</strong> ${currentProject.type || 'N/A'}<br>
                    <strong>Status:</strong> ${currentProject.status || 'N/A'}
                </div>
                <div>
                    <strong>Production Deadline:</strong> ${currentProject.deadline ? new Date(currentProject.deadline).toLocaleDateString('en-GB') : 'N/A'}<br>
                    <strong>Installation Date:</strong> ${currentProject.installation_date ? new Date(currentProject.installation_date).toLocaleDateString('en-GB') : 'N/A'}
                </div>
            </div>
    `;
    
    if (includeDeadlines && currentPhases.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 4px;">';
        html += '<strong style="color: #333;">Phase Deadlines:</strong><br>';
        currentPhases.forEach(phase => {
            const endDate = phase.end_date ? new Date(phase.end_date).toLocaleDateString('en-GB') : 'TBD';
            html += `<div style="margin-top: 5px;">• ${phase.phase_name}: ${endDate}</div>`;
        });
        html += '</div>';
    }
    
    html += '</div>';
    return html;
}

async function generateGanttSection() {
    // Render mini Gantt chart for this project
    let html = `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">Project Timeline</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 4px; overflow-x: auto;">
    `;
    
    if (currentPhases.length === 0) {
        html += '<div style="color: #999;">No phases defined</div>';
    } else {
        // Simple timeline visualization
        html += '<div style="display: flex; gap: 10px; margin-bottom: 10px;">';
        currentPhases.forEach(phase => {
            const statusColor = phase.status === 'completed' ? '#4caf50' : 
                              phase.status === 'inProgress' ? '#ff9800' : '#999';
            html += `
                <div style="flex: 1; text-align: center;">
                    <div style="background: ${statusColor}; color: white; padding: 10px; border-radius: 4px; font-weight: bold;">
                        ${phase.phase_name}
                    </div>
                    <div style="font-size: 11px; margin-top: 5px; color: #666;">
                        ${phase.start_date ? new Date(phase.start_date).toLocaleDateString('en-GB') : 'TBD'}
                        ${phase.end_date ? ' - ' + new Date(phase.end_date).toLocaleDateString('en-GB') : ''}
                    </div>
                    ${phase.assigned_workers ? `<div style="font-size: 10px; color: #999; margin-top: 5px;">👤 ${getWorkerNames(phase.assigned_workers)}</div>` : ''}
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += '</div></div>';
    return html;
}

function getWorkerNames(workerIds) {
    if (!workerIds || workerIds.length === 0) return 'Unassigned';
    return workerIds.map(id => {
        const worker = teamMembers.find(w => w.id === id);
        return worker ? worker.name : 'Unknown';
    }).join(', ');
}

function generateMaterialsSection(stage, includePhotos) {
    const stageMaterials = currentMaterials.filter(m => m.used_in_stage === stage);
    
    if (stageMaterials.length === 0) return '';
    
    let html = `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">${stage.toUpperCase()} STAGE MATERIALS</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 15px;">
                <thead>
                    <tr style="background: #f0f0f0;">
                        ${includePhotos ? '<th style="padding: 8px; border: 1px solid #ddd;">Photo</th>' : ''}
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Material</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Item #</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Size</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Needed</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">Reserved</th>
                        <th style="padding: 8px; border: 1px solid #ddd;">In Stock</th>
                        <th style="padding: 8px; border: 1px solid #ddd; background: #ffffcc;">Used: ____</th>
                        <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">☐</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    stageMaterials.forEach(m => {
        const stockItem = m.stock_items;
        html += `
            <tr>
                ${includePhotos ? `
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                        ${stockItem?.image_url ? 
                            `<img src="${stockItem.image_url}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 3px;">` : 
                            '📦'}
                    </td>
                ` : ''}
                <td style="padding: 8px; border: 1px solid #ddd;">
                    <strong>${m.item_name}</strong><br>
                    <span style="color: #666; font-size: 10px;">${m.stock_categories?.name || ''}</span>
                </td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${stockItem?.item_number || (m.is_bespoke ? 'BESPOKE' : '-')}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                    ${stockItem ? `${stockItem.size || '-'}${stockItem.thickness ? ' / ' + stockItem.thickness : ''}` : '-'}
                </td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.quantity_needed.toFixed(2)} ${m.unit}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${m.quantity_reserved.toFixed(2)} ${m.unit}</td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                    ${m.is_bespoke ? '-' : `${(stockItem?.current_quantity || 0).toFixed(2)} ${m.unit}`}
                </td>
                <td style="padding: 8px; border: 1px solid #ddd; background: #ffffcc; text-align: center;">
                    <div style="border-bottom: 1px solid #999; height: 20px; width: 60px; margin: 0 auto;"></div>
                </td>
                <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">
                    <div style="width: 18px; height: 18px; border: 2px solid #333; margin: 0 auto;"></div>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    return html;
}

function generateNotesSection(allNotes) {
    if (!currentNotes) return '';
    
    let html = `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">${allNotes ? 'PROJECT NOTES' : 'IMPORTANT NOTES'}</h3>
            <div style="background: #fff9e6; padding: 15px; border-left: 4px solid #ff9800; border-radius: 4px; white-space: pre-wrap; font-size: 12px;">
    `;
    
    if (allNotes) {
        html += currentNotes;
    } else {
        // Filter only important notes (containing ⚠️ IMPORTANT:)
        const lines = currentNotes.split('\n');
        const importantLines = [];
        let capturing = false;
        
        lines.forEach(line => {
            if (line.includes('⚠️ IMPORTANT:')) {
                capturing = true;
            }
            if (capturing) {
                importantLines.push(line);
                if (line.trim() === '') capturing = false;
            }
        });
        
        html += importantLines.length > 0 ? importantLines.join('\n') : 'No important notes marked.';
    }
    
    html += '</div></div>';
    return html;
}

function generateOtherDocumentsSection() {
    return `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
            <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">OTHER DOCUMENTS</h3>
            <div style="background: #f9f9f9; padding: 15px; border-radius: 4px;">
                <p style="color: #666; font-size: 12px; margin: 0;">
                    Installation site photos, additional requirements, and other uploaded documents can be found in the project files folder.
                </p>
                <div style="margin-top: 10px; padding: 10px; border: 2px dashed #ccc; text-align: center; color: #999; font-size: 11px;">
                    Space for additional documents/photos
                </div>
            </div>
        </div>
    `;
}

function generateSignOffSection() {
    return `
        <div style="margin-top: 40px; page-break-inside: avoid;">
            <h3 style="color: #333; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">SIGN-OFF SECTIONS</h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>Production Stage Completed</strong><br>
                    <div style="margin-top: 10px;">
                        Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                    <div style="margin-top: 10px;">
                        Sign: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>Spraying Completed</strong><br>
                    <div style="margin-top: 10px;">
                        Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                    <div style="margin-top: 10px;">
                        Sign: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>Glazing/Assembly Completed</strong><br>
                    <div style="margin-top: 10px;">
                        Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                    <div style="margin-top: 10px;">
                        Sign: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                </div>
                
                <div style="border: 1px solid #ddd; padding: 15px; border-radius: 4px;">
                    <strong>Final QC</strong><br>
                    <div style="margin-top: 10px;">
                        Date: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                    <div style="margin-top: 10px;">
                        Sign: <span style="border-bottom: 1px solid #333; display: inline-block; width: 120px;"></span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function downloadPDF() {
    showToast('PDF download will be implemented with jsPDF library to convert the preview to PDF format.', 'info');
    // TODO: Implement jsPDF conversion
}
