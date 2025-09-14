// ========== PIPELINE PROJECT MANAGEMENT ==========
function addPipelineProject() {
    currentEditProject = null;
    document.getElementById('projectModalTitle').textContent = 'Add Pipeline Project';
    document.getElementById('projectName').value = '';
    document.getElementById('projectClient').value = '';
    document.getElementById('projectStartDate').value = formatDate(new Date());
    
    // Generate new pipeline number
    document.getElementById('projectNumber').value = getNextPipelineNumber();
    
    // Reset type selection
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.type-option[data-type="other"]').classList.add('selected');
    
    // For new pipeline project all phases are checked by default
    updatePipelinePhasesList(null, true);
    openModal('projectModal');
}

function editPipelineProject(index) {
    currentEditProject = index;
    const project = pipelineProjects[index];
    
    document.getElementById('projectModalTitle').textContent = 'Edit Pipeline Project';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectClient').value = project.client || '';
    document.getElementById('projectStartDate').value = project.phases[0]?.start || formatDate(new Date());
    document.getElementById('projectNumber').value = project.projectNumber || '';
    
    // Set selected type
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const selectedType = project.type || 'other';
    document.querySelector(`.type-option[data-type="${selectedType}"]`).classList.add('selected');
    
    updatePipelinePhasesList(project.phases, false);
    openModal('projectModal');
}

function savePipelineProject() {
    const name = document.getElementById('projectName').value.trim();
    const client = document.getElementById('projectClient').value.trim();
    const startDate = document.getElementById('projectStartDate').value;
    const projectNumber = document.getElementById('projectNumber').value.trim();
    
    // Get selected type
    const selectedTypeElement = document.querySelector('.type-option.selected');
    const projectType = selectedTypeElement ? selectedTypeElement.dataset.type : 'other';
    
    if (!name) {
        alert('Please enter a project name');
        return;
    }
    
    if (!projectNumber) {
        alert('Please enter a pipeline number');
        return;
    }
    
    const selectedPhases = [];
    const checkboxes = document.querySelectorAll('#phasesList input[type="checkbox"]:checked');
    
    let currentDate = new Date(startDate);
    
    // Sort phases according to pipelinePhaseOrder
    const sortedCheckboxes = Array.from(checkboxes).sort((a, b) => {
        return pipelinePhaseOrder.indexOf(a.value) - pipelinePhaseOrder.indexOf(b.value);
    });
    
    sortedCheckboxes.forEach(cb => {
        const phaseKey = cb.value;
        const phaseDuration = parseInt(cb.dataset.duration) || 3; // Default 3 days for pipeline
        
        const phaseStart = new Date(currentDate);
        
        // Snap to Monday if start on Sunday
        while (isWeekend(phaseStart)) {
            phaseStart.setDate(phaseStart.getDate() + 1);
        }
        
        // Calculate end using working days
        const phaseEnd = phaseDuration <= 1 ? 
            new Date(phaseStart) : 
            addWorkingDays(phaseStart, phaseDuration - 1);
        
        const newPhase = {
            key: phaseKey,
            start: formatDate(phaseStart),
            workDays: phaseDuration,
            status: 'notStarted'
        };
        
        // Preserve existing data when editing
        if (currentEditProject !== null) {
            const existingPhase = pipelineProjects[currentEditProject].phases?.find(p => p.key === phaseKey);
            if (existingPhase) {
                if (existingPhase.notes) newPhase.notes = existingPhase.notes;
                if (existingPhase.status) newPhase.status = existingPhase.status;
            }
        }
        
        selectedPhases.push(newPhase);
        
        // Next phase starts day after previous ends
        currentDate = new Date(phaseEnd);
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Skip Sundays for next phase
        while (isWeekend(currentDate)) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    const projectData = {
        projectNumber,
        type: projectType,
        name,
        client,
        phases: selectedPhases
    };
    
    if (currentEditProject !== null) {
        pipelineProjects[currentEditProject] = projectData;
    } else {
        pipelineProjects.push(projectData);
    }
    
    saveData();
    renderPipeline();
    closeModal('projectModal');
}

function deletePipelineProject(index) {
    if (confirm('Delete pipeline project "' + pipelineProjects[index].name + '"?')) {
        pipelineProjects.splice(index, 1);
        saveData();
        renderPipeline();
    }
}

function updatePipelinePhasesList(projectPhases = [], checkAll = false) {
    const list = document.getElementById('phasesList');
    list.innerHTML = '';
    
    const projectPhaseKeys = projectPhases ? projectPhases.map(p => p.key) : [];
    
    // Sort phases according to pipelinePhaseOrder
    const sortedPhases = Object.entries(pipelinePhases).sort((a, b) => {
        return pipelinePhaseOrder.indexOf(a[0]) - pipelinePhaseOrder.indexOf(b[0]);
    });
    
    sortedPhases.forEach(([key, phase]) => {
        const div = document.createElement('div');
        div.className = 'phase-checkbox';
        
        // For new project (checkAll = true) all are checked
        // For edit check which phases project has
        const isChecked = checkAll || projectPhaseKeys.includes(key);
        
        // Default 3 days for pipeline phases
        let duration = 3;
        
        div.innerHTML = `
            <input type="checkbox" id="phase_${key}" value="${key}" 
                   data-duration="${duration}" ${isChecked ? 'checked' : ''}>
            <div class="phase-color" style="background: ${phase.color}; width: 20px; height: 15px; border-radius: 2px;"></div>
            <label for="phase_${key}">${phase.name} (${duration} days)</label>
        `;
        
        list.appendChild(div);
    });
}

// Handle type selection - ADDED
function selectProjectType(type) {
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

// Clear all pipeline projects
function clearAllPipeline() {
    if (confirm('Clear all pipeline projects? This cannot be undone!')) {
        pipelineProjects = [];
        lastPipelineNumber = 0;
        saveData();
        renderPipeline();
    }
}

// ========== PIPELINE FINISHED MODAL ==========
function openPipelineFinishedModal() {
    updatePipelineProjectSelect();
    openModal('pipelineFinishedModal');
}

function updatePipelineProjectSelect() {
    const select = document.getElementById('pipelineProjectSelect');
    select.innerHTML = '<option value="">Select project...</option>';
    
    pipelineProjects.forEach((project, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${project.projectNumber} - ${project.name}`;
        select.appendChild(option);
    });
}

// FIXED convertToProduction function with deadline
function convertToProduction() {
    const selectedIndex = document.getElementById('pipelineProjectSelect').value;
    const deadline = document.getElementById('productionDeadline').value;
    
    if (!selectedIndex) {
        alert('Please select a pipeline project');
        return;
    }
    
    if (!deadline) {
        alert('Please set production deadline from contract!');
        return;
    }
    
    const pipelineProject = pipelineProjects[parseInt(selectedIndex)];
    
    // Check if deadline is not in past
    const today = new Date();
    today.setHours(0,0,0,0);
    const deadlineDate = new Date(deadline);
    
    if (deadlineDate < today) {
        alert('Deadline cannot be in the past!');
        return;
    }
    
    // Properly increment lastProjectNumber
    let currentLastNumber = parseInt(localStorage.getItem('joineryLastProjectNumber') || '0');
    currentLastNumber++;
    localStorage.setItem('joineryLastProjectNumber', currentLastNumber);
    
    // Create production project with incremented number
    const year = new Date().getFullYear();
    const number = String(currentLastNumber).padStart(3, '0');
    const productionProjectNumber = `${number}/${year}`;
    
    // Create phases
    const phases = createProductionPhases(new Date());
    
    // Check if we have enough days for all phases
    const availableWorkDays = workingDaysBetween(today, deadlineDate);
    if (availableWorkDays < phases.length) {
        alert(`Deadline too short! Need at least ${phases.length} working days for ${phases.length} phases.`);
        return;
    }
    
    const productionProject = {
        projectNumber: productionProjectNumber,
        type: pipelineProject.type,
        name: pipelineProject.name,
        client: pipelineProject.client,
        deadline: deadline,  // ADD DEADLINE
        phases: phases
    };
    
    // Auto-adjust phases to deadline
    autoAdjustPhasesToDeadline(productionProject, today, deadlineDate);
    
    // Add to production projects (cross-page save)
    let productionProjects = JSON.parse(localStorage.getItem('joineryProjects') || '[]');
    productionProjects.push(productionProject);
    localStorage.setItem('joineryProjects', JSON.stringify(productionProjects));
    
    // Remove from pipeline
    pipelineProjects.splice(parseInt(selectedIndex), 1);
    localStorage.setItem('joineryPipelineProjects', JSON.stringify(pipelineProjects));
    
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    alert(`Project converted to production: ${productionProject.projectNumber}\nDeadline: ${deadline}\nPhases auto-adjusted to fit deadline.\nPlease go to Production page to see it.`);
}

// Auto-adjust phases to fit deadline (copy from projects.js)
function autoAdjustPhasesToDeadline(project, startDate, deadlineDate) {
    if (!project.phases || project.phases.length === 0) return;
    
    // Calculate available working days
    const availableWorkDays = workingDaysBetween(startDate, deadlineDate);
    const phasesCount = project.phases.length;
    
    // Distribute days evenly
    const baseDaysPerPhase = Math.floor(availableWorkDays / phasesCount);
    const extraDays = availableWorkDays % phasesCount;
    
    // Sort phases by order
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    let currentStart = new Date(startDate);
    
    // Skip Sunday if starting on Sunday
    while (currentStart.getDay() === 0) {
        currentStart.setDate(currentStart.getDate() + 1);
    }
    
    // Assign days to each phase
    project.phases.forEach((phase, index) => {
        // Calculate days for this phase (some get +1 day)
        const phaseDays = baseDaysPerPhase + (index < extraDays ? 1 : 0);
        
        // Set phase start
        phase.start = formatDate(currentStart);
        
        // Set workDays
        phase.workDays = Math.max(1, phaseDays);
        
        // Calculate phase end
        const phaseEnd = phaseDays <= 1 ? 
            new Date(currentStart) : 
            addWorkingDays(currentStart, phaseDays - 1);
        
        // Next phase starts day after this ends
        currentStart = new Date(phaseEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        
        // Skip Sundays
        while (currentStart.getDay() === 0) {
            currentStart.setDate(currentStart.getDate() + 1);
        }
    });
}

// Helper function for working days calculation
function workingDaysBetween(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        if (current.getDay() !== 0) { // not Sunday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// Helper function to add working days
function addWorkingDays(startDate, days) {
    let result = new Date(startDate);
    let added = 0;
    while (added < days) {
        result.setDate(result.getDate() + 1);
        if (result.getDay() !== 0) { // not Sunday
            added++;
        }
    }
    return result;
}

function archiveAsFailed() {
    const selectedIndex = document.getElementById('pipelineProjectSelect').value;
    
    if (!selectedIndex) {
        alert('Please select a pipeline project');
        return;
    }
    
    const pipelineProject = pipelineProjects[parseInt(selectedIndex)];
    
    // Add to failed archive
    pipelineProject.archivedDate = new Date().toISOString();
    pipelineProject.archiveReason = 'Failed negotiation';
    failedArchive.push(pipelineProject);
    
    // Remove from pipeline
    pipelineProjects.splice(parseInt(selectedIndex), 1);
    
    saveData();
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    alert(`Project archived as failed: ${pipelineProject.projectNumber}`);
}

// FIXED createProductionPhases without dependencies
function createProductionPhases(startDate) {
    const phases = [];
    let currentDate = new Date(startDate);
    
    // Production phases (without deliveryGlazing)
    const productionPhaseKeys = ['siteSurvey', 'md', 'order', 'timber', 'orderGlazing', 'orderSpray', 'spray', 'glazing', 'qc', 'dispatch'];
    
    productionPhaseKeys.forEach(phaseKey => {
        const phaseDuration = 4; // Default 4 days for all phases
        
        const phaseStart = new Date(currentDate);
        
        // Snap to Monday if Sunday
        while (phaseStart.getDay() === 0) { // Simple Sunday check
            phaseStart.setDate(phaseStart.getDate() + 1);
        }
        
        const newPhase = {
            key: phaseKey,
            start: formatDate(phaseStart),
            workDays: phaseDuration,
            status: 'notStarted'
        };
        
        phases.push(newPhase);
        
        // Next phase starts after 4 days
        currentDate = new Date(phaseStart);
        currentDate.setDate(currentDate.getDate() + phaseDuration + 1);
        
        // Skip Sundays
        while (currentDate.getDay() === 0) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    return phases;
}

// Helper function if missing
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}