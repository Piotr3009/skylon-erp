// ========== PROJECT MANAGEMENT ==========
function addProject() {
    currentEditProject = null;
    document.getElementById('projectModalTitle').textContent = 'Add Project';
    document.getElementById('projectName').value = '';
    document.getElementById('projectClient').value = '';
    document.getElementById('projectStartDate').value = formatDate(new Date());
    document.getElementById('projectDeadline').value = '';
    
    // Generate new project number
    document.getElementById('projectNumber').value = getNextProjectNumber();
    
    // Reset type selection
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.type-option[data-type="other"]').classList.add('selected');
    
    // For new project all phases are checked by default
    updatePhasesList(null, true);
    openModal('projectModal');
}

function editProject(index) {
    currentEditProject = index;
    const project = projects[index];
    
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectClient').value = project.client || '';
    document.getElementById('projectStartDate').value = project.phases[0]?.start || formatDate(new Date());
    document.getElementById('projectNumber').value = project.projectNumber || '';
    document.getElementById('projectDeadline').value = project.deadline || '';
    
    // Set selected type
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const selectedType = project.type || 'other';
    document.querySelector(`.type-option[data-type="${selectedType}"]`).classList.add('selected');
    
    updatePhasesList(project.phases, false);
    openModal('projectModal');
}

function saveProject() {
    const name = document.getElementById('projectName').value.trim();
    const client = document.getElementById('projectClient').value.trim();
    const startDate = document.getElementById('projectStartDate').value;
    const projectNumber = document.getElementById('projectNumber').value.trim();
    const deadline = document.getElementById('projectDeadline').value;
    
    // Get selected type
    const selectedTypeElement = document.querySelector('.type-option.selected');
    const projectType = selectedTypeElement ? selectedTypeElement.dataset.type : 'other';
    
    if (!name) {
        alert('Please enter a project name');
        return;
    }
    
    if (!projectNumber) {
        alert('Please enter a project number');
        return;
    }
    
    const selectedPhases = [];
    const checkboxes = document.querySelectorAll('#phasesList input[type="checkbox"]:checked');
    
    let currentDate = new Date(startDate);
    
    // Sort phases according to productionPhaseOrder
    const sortedCheckboxes = Array.from(checkboxes).sort((a, b) => {
        return productionPhaseOrder.indexOf(a.value) - productionPhaseOrder.indexOf(b.value);
    });
    
    sortedCheckboxes.forEach(cb => {
        const phaseKey = cb.value;
        const phaseDuration = parseInt(cb.dataset.duration) || 4; // Default 4 working days
        
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
            workDays: phaseDuration, // Save working days
            status: 'notStarted'
        };
        
        // Preserve existing assignments and notes
        if (currentEditProject !== null) {
            const existingPhase = projects[currentEditProject].phases?.find(p => p.key === phaseKey);
            if (existingPhase) {
                if (existingPhase.assignedTo) newPhase.assignedTo = existingPhase.assignedTo;
                if (existingPhase.notes) newPhase.notes = existingPhase.notes;
                if (existingPhase.status) newPhase.status = existingPhase.status;
                if (existingPhase.materials) newPhase.materials = existingPhase.materials;
                if (existingPhase.customMaterials) newPhase.customMaterials = existingPhase.customMaterials;
                if (existingPhase.sprayMaterials) newPhase.sprayMaterials = existingPhase.sprayMaterials;
                if (existingPhase.glazingMaterials) newPhase.glazingMaterials = existingPhase.glazingMaterials;
                if (existingPhase.orderComplete) newPhase.orderComplete = existingPhase.orderComplete;
                if (existingPhase.orderConfirmed) newPhase.orderConfirmed = existingPhase.orderConfirmed;
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
        deadline: deadline || null,
        phases: selectedPhases
    };
    
    // Jeśli jest deadline, auto-dopasuj fazy
    if (deadline && selectedPhases.length > 0) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const deadlineDate = new Date(deadline);
        
        // Sprawdź czy deadline jest wystarczający
        const availableWorkDays = workingDaysBetween(today, deadlineDate);
        
        if (availableWorkDays < selectedPhases.length) {
            alert(`Deadline too short! Need at least ${selectedPhases.length} working days for ${selectedPhases.length} phases.`);
            return;
        }
        
        // Auto-dopasuj fazy do deadline
        autoAdjustPhasesToDeadline(projectData, today, deadlineDate);
    }
    
    if (currentEditProject !== null) {
        projects[currentEditProject] = projectData;
    } else {
        projects.push(projectData);
    }
    
    saveData();
    render();
    closeModal('projectModal');
}

async function deleteProject(index) {
    if (confirm('Delete project "' + projects[index].name + '"?')) {
        const projectNumber = projects[index].projectNumber;
        
        // Usuń z Supabase jeśli jest połączenie
        if (projectNumber && typeof supabaseClient !== 'undefined') {
            try {
                const { error } = await supabaseClient
                    .from('projects')
                    .delete()
                    .eq('project_number', projectNumber);
                    
                if (error) {
                    console.error('Błąd usuwania z DB:', error);
                } else {
                    console.log('✅ Usunięte z bazy');
                }
            } catch (err) {
                console.log('Brak połączenia z DB, usuwam tylko lokalnie');
            }
        }
        
        // Usuń lokalnie
        projects.splice(index, 1);
        saveData();
        render();
    }
}

function updatePhasesList(projectPhases = [], checkAll = false) {
    const list = document.getElementById('phasesList');
    list.innerHTML = '';
    
    const projectPhaseKeys = projectPhases ? projectPhases.map(p => p.key) : [];
    
    // Sort phases according to productionPhaseOrder
    const sortedPhases = Object.entries(productionPhases).sort((a, b) => {
        return productionPhaseOrder.indexOf(a[0]) - productionPhaseOrder.indexOf(b[0]);
    });
    
    sortedPhases.forEach(([key, phase]) => {
        const div = document.createElement('div');
        div.className = 'phase-checkbox';
        
        // For new project (checkAll = true) all are checked
        // For edit check which phases project has
        const isChecked = checkAll || projectPhaseKeys.includes(key);
        
        // ALL PHASES DEFAULT 4 DAYS
        let duration = 4; // Default 4 days for all phases
        
        div.innerHTML = `
            <input type="checkbox" id="phase_${key}" value="${key}" 
                   data-duration="${duration}" ${isChecked ? 'checked' : ''}>
            <div class="phase-color" style="background: ${phase.color}; width: 20px; height: 15px; border-radius: 2px;"></div>
            <label for="phase_${key}">${phase.name} (${duration} days)</label>
        `;
        
        list.appendChild(div);
    });
}

// Handle type selection
function selectProjectType(type) {
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

// Auto-arrange all phases in project (remove overlaps)
function autoArrangePhases(projectIndex) {
    const project = projects[projectIndex];
    if (!project.phases || project.phases.length === 0) return;
    
    // Sort phases by order
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    // Start from first phase
    let currentDate = new Date(project.phases[0].start);
    
    project.phases.forEach((phase, index) => {
        if (index === 0) {
            // First phase stays where it is
            currentDate = new Date(phase.end);
            currentDate.setDate(currentDate.getDate() + 1);
        } else {
            // Calculate duration in days
            const start = new Date(phase.start);
            const end = new Date(phase.end);
            const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            // Set new start
            phase.start = formatDate(currentDate);
            
            // Calculate new end
            const newEnd = new Date(currentDate);
            newEnd.setDate(newEnd.getDate() + days - 1);
            phase.end = formatDate(newEnd);
            
            // Reset adjustedEnd
            delete phase.adjustedEnd;
            
            // Next phase starts after this one ends
            currentDate = new Date(newEnd);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    saveData();
    render();
}

// Auto-adjust phases to fit deadline
function autoAdjustPhasesToDeadline(project, startDate, deadlineDate) {
    if (!project.phases || project.phases.length === 0) return;
    
    // Oblicz dostępne dni robocze
    const availableWorkDays = workingDaysBetween(startDate, deadlineDate);
    const phasesCount = project.phases.length;
    
    // Rozłóż dni równomiernie
    const baseDaysPerPhase = Math.floor(availableWorkDays / phasesCount);
    const extraDays = availableWorkDays % phasesCount;
    
    // Sortuj fazy według kolejności
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    let currentStart = new Date(startDate);
    
    // Pomiń niedzielę jeśli startujemy w niedzielę
    while (isWeekend(currentStart)) {
        currentStart.setDate(currentStart.getDate() + 1);
    }
    
    // Przypisz dni każdej fazie
    project.phases.forEach((phase, index) => {
        // Oblicz dni dla tej fazy (niektóre dostaną +1 dzień)
        const phaseDays = baseDaysPerPhase + (index < extraDays ? 1 : 0);
        
        // Ustaw start fazy
        phase.start = formatDate(currentStart);
        
        // Ustaw workDays
        phase.workDays = Math.max(1, phaseDays);
        
        // Oblicz koniec fazy
        const phaseEnd = phaseDays <= 1 ? 
            new Date(currentStart) : 
            addWorkingDays(currentStart, phaseDays - 1);
        
        // Następna faza zaczyna się dzień po końcu tej
        currentStart = new Date(phaseEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        
        // Pomiń niedziele
        while (isWeekend(currentStart)) {
            currentStart.setDate(currentStart.getDate() + 1);
        }
    });
}

// ========== MOVE TO ARCHIVE ==========
function openMoveToArchiveModal() {
    updateCompletedProjectSelect();
    openModal('moveToArchiveModal');
}

function updateCompletedProjectSelect() {
    const select = document.getElementById('completedProjectSelect');
    select.innerHTML = '<option value="">Select project...</option>';
    
    projects.forEach((project, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${project.projectNumber} - ${project.name}`;
        select.appendChild(option);
    });
}

function confirmMoveToArchive() {
    const selectedIndex = document.getElementById('completedProjectSelect').value;
    const reason = document.getElementById('archiveReason').value;
    const notes = document.getElementById('archiveNotes').value.trim();
    
    if (!selectedIndex) {
        alert('Please select a project to archive');
        return;
    }
    
    const projectIndex = parseInt(selectedIndex);
    if (!projects[projectIndex]) {
        alert('Project not found');
        return;
    }
    
    const project = projects[projectIndex];
    
    // Add to completed archive
    project.archivedDate = new Date().toISOString();
    project.archiveReason = reason;
    if (notes) project.archiveNotes = notes;
    
    completedArchive.push(project);
    
    // Remove from active projects
    projects.splice(projectIndex, 1);
    
    saveData();
    render();
    closeModal('moveToArchiveModal');
    
    const reasonText = document.querySelector(`#archiveReason option[value="${reason}"]`).textContent;
    alert(`Project archived: ${project.projectNumber}\nReason: ${reasonText}`);
}