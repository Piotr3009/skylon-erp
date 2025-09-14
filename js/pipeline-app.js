// ========== PIPELINE INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    updatePipelinePhasesLegend();
    renderPipeline();
});

// Close modals on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});

// Update phases legend for pipeline
function updatePipelinePhasesLegend() {
    const legend = document.getElementById('phasesLegend');
    legend.innerHTML = '';
    
    // Sort pipeline phases according to pipelinePhaseOrder
    const sortedPhases = Object.entries(pipelinePhases).sort((a, b) => {
        return pipelinePhaseOrder.indexOf(a[0]) - pipelinePhaseOrder.indexOf(b[0]);
    });
    
    sortedPhases.forEach(([key, phase]) => {
        const item = document.createElement('div');
        item.className = 'phase-item';
        item.innerHTML = `
            <div class="phase-color" style="background: ${phase.color}"></div>
            <span>${phase.name}</span>
        `;
        legend.appendChild(item);
    });
}

// Export functions for pipeline
function exportPipelineJSON() {
    const data = {
        version: '1.8',
        pipelineProjects,
        failedArchive,
        pipelinePhases,
        teamMembers,
        daysOff,
        lastPipelineNumber,
        exportDate: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-projects-${formatDate(new Date())}.json`;
    a.click();
}

function exportPipelineCSV() {
    const data = [['No.', 'Type', 'Project', 'Client', 'Phase', 'Status', 'Start', 'End', 'Days']];
    
    pipelineProjects.forEach(project => {
        if (project.phases) {
            project.phases.forEach(phase => {
                const phaseConfig = pipelinePhases[phase.key];
                const start = new Date(phase.start);
                const end = new Date(phase.adjustedEnd || phase.end);
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                
                const projectType = projectTypes[project.type] || projectTypes.other;
                const status = phaseStatuses[phase.status] || phaseStatuses.notStarted;
                
                data.push([
                    project.projectNumber || '',
                    projectType.name,
                    project.name,
                    project.client || '',
                    phaseConfig ? phaseConfig.name : phase.key,
                    status.name,
                    phase.start,
                    phase.adjustedEnd || phase.end,
                    days
                ]);
            });
        }
    });
    
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-projects-${formatDate(new Date())}.csv`;
    a.click();
}

function importPipelineJSON() {
    const input = document.getElementById('fileInput');
    input.click();
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                pipelineProjects = data.pipelineProjects || [];
                failedArchive = data.failedArchive || [];
                if (data.pipelinePhases) {
                    pipelinePhases = { ...pipelinePhases, ...data.pipelinePhases };
                }
                teamMembers = data.teamMembers || teamMembers;
                daysOff = data.daysOff || daysOff;
                lastPipelineNumber = data.lastPipelineNumber || 0;
                
                // Migrate old projects
                pipelineProjects.forEach(project => {
                    if (!project.type) project.type = 'other';
                    if (!project.projectNumber) project.projectNumber = getNextPipelineNumber();
                    if (project.phases) {
                        // Sort phases according to pipeline order
                        project.phases.sort((a, b) => {
                            return pipelinePhaseOrder.indexOf(a.key) - pipelinePhaseOrder.indexOf(b.key);
                        });
                        project.phases.forEach(phase => {
                            if (!phase.status) phase.status = 'notStarted';
                        });
                    }
                });
                
                saveData();
                updatePipelinePhasesLegend();
                renderPipeline();
                alert('Pipeline data imported successfully');
            } catch (err) {
                alert('Error importing file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
}

// Save pipeline phase changes (modified for pipeline projects)
function savePipelinePhaseChanges() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = pipelineProjects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Get new duration
    const newDuration = parseInt(document.getElementById('phaseDuration').value);
    const notes = document.getElementById('phaseNotes').value.trim();
    const status = document.getElementById('phaseStatus').value;
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // Calculate new end date with work days
    const start = new Date(phase.start);
    const newEnd = addWorkDays(start, newDuration - 1);
    
    phase.end = formatDate(newEnd);
    phase.workDays = newDuration;
    
    // Save notes
    if (notes) {
        phase.notes = notes;
    } else {
        delete phase.notes;
    }
    
    // Save status
    phase.status = status;
    
    // Auto-arrange phases after change
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, 0);
    }
    
    saveData();
    renderPipeline();
    closeModal('phaseEditModal');
    currentEditPhase = null;
}

// Override savePhaseChanges for pipeline
window.savePhaseChanges = savePipelinePhaseChanges;

// Delete current pipeline phase
function deletePipelineCurrentPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = pipelineProjects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = pipelinePhases[phase.key];
    
    if (confirm(`Delete phase "${phaseConfig.name}" from this pipeline project?`)) {
        // Remove phase
        project.phases.splice(phaseIndex, 1);
        
        // Auto-arrange remaining phases
        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, 0);
        }
        
        saveData();
        renderPipeline();
        closeModal('phaseEditModal');
        currentEditPhase = null;
    }
}

// Override deleteCurrentPhase for pipeline
window.deleteCurrentPhase = deletePipelineCurrentPhase;