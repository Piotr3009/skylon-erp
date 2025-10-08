// ========== PIPELINE PROJECT MANAGEMENT ==========

// Load clients for dropdown
async function loadClientsDropdown() {
    try {
        const { data, error } = await supabaseClient
            .from('clients')
            .select('id, client_number, company_name, contact_person')
            .order('company_name');
        
        const select = document.getElementById('projectClient');
        select.innerHTML = '<option value="">-- Wybierz klienta z bazy --</option>';
        
        data?.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = `${client.client_number} - ${client.company_name || client.contact_person}`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Błąd ładowania klientów:', err);
    }
}

// POPRAWIONA FUNKCJA - pobiera numerację z bazy
async function addPipelineProject() {
    currentEditProject = null;
    document.getElementById('projectModalTitle').textContent = 'Add Pipeline Project';
    document.getElementById('projectName').value = '';
    document.getElementById('projectStartDate').value = formatDate(new Date());
    
    // Load clients dropdown
    await loadClientsDropdown();
    
    // POBIERZ NUMERACJĘ Z BAZY DANYCH
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { data: lastProject, error } = await supabaseClient
                .from('pipeline_projects')
                .select('project_number')
                .order('project_number', { ascending: false })
                .limit(1);
            
            let nextNumber = 1;
            
            if (lastProject && lastProject.length > 0) {
                const projectNum = lastProject[0].project_number;
                console.log('Ostatni numer z bazy:', projectNum);
                
                // Format: "PL001/2025" - wyciągnij cyfry między "PL" a "/"
                const match = projectNum.match(/PL(\d{3})\//);
                if (match && match[1]) {
                    const lastNum = parseInt(match[1]);
                    if (!isNaN(lastNum)) {
                        nextNumber = lastNum + 1;
                    }
                }
            }
            
            const currentYear = new Date().getFullYear();
            const generatedNumber = `PL${String(nextNumber).padStart(3, '0')}/${currentYear}`;
            document.getElementById('projectNumber').value = generatedNumber;
            console.log('Wygenerowany numer:', generatedNumber);
            
        } catch (err) {
            console.error('Błąd pobierania numeracji:', err);
            // Fallback - jeśli błąd
            const currentYear = new Date().getFullYear();
            document.getElementById('projectNumber').value = `PL001/${currentYear}`;
        }
    } else {
        // Jeśli nie ma Supabase
        const currentYear = new Date().getFullYear();
        document.getElementById('projectNumber').value = `PL001/${currentYear}`;
    }
    
    // Reset type selection
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const defaultType = document.querySelector('.type-option[data-type="other"]');
    if (defaultType) {
        defaultType.classList.add('selected');
    }
    
    // For new pipeline project all phases are checked by default
    updatePipelinePhasesList(null, true);
    openModal('projectModal');
}

function editPipelineProject(index) {
    currentEditProject = index;
    const project = pipelineProjects[index];
    
    document.getElementById('projectModalTitle').textContent = 'Edit Pipeline Project';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectStartDate').value = project.phases[0]?.start || formatDate(new Date());
    document.getElementById('projectNumber').value = project.projectNumber || '';
    
    // Load clients and select current one
    loadClientsDropdown().then(() => {
        if (project.client_id) {
            document.getElementById('projectClient').value = project.client_id;
        }
    });
    
    // Set selected type
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const selectedType = project.type || 'other';
    document.querySelector(`.type-option[data-type="${selectedType}"]`).classList.add('selected');
    
    updatePipelinePhasesList(project.phases, false);
    openModal('projectModal');
}

// UPDATED WITH SUPABASE SAVE AND CLIENT_ID + PHASES
async function savePipelineProject() {
    const name = document.getElementById('projectName').value.trim();
    const clientId = document.getElementById('projectClient').value;
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
    
    if (!clientId) {
        alert('Please select a client from database!');
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
        const phaseDuration = parseInt(cb.dataset.duration) || 3;
        
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
        client_id: clientId,
        phases: selectedPhases
    };
    
    if (currentEditProject !== null) {
        pipelineProjects[currentEditProject] = projectData;
    } else {
        pipelineProjects.push(projectData);
    }
    
    // ========== SAVE TO SUPABASE WITH PHASES ==========
    if (typeof supabaseClient !== 'undefined') {
        try {
            const pipelineForDB = {
                project_number: projectData.projectNumber,
                name: projectData.name,
                type: projectData.type,
                client_id: projectData.client_id,
                estimated_value: 0,
                status: 'active',
                notes: null
            };
            
            const { data: savedProject, error } = await supabaseClient
                .from('pipeline_projects')
                .upsert(pipelineForDB, { onConflict: 'project_number' })
                .select()
                .single();
                
            if (!error && savedProject) {
                console.log('✅ Pipeline zapisany w Supabase');
                
                // SAVE PHASES TO DATABASE
                if (projectData.phases && projectData.phases.length > 0) {
                    await savePhasesToSupabase(
                        savedProject.id,
                        projectData.phases,
                        false  // false = pipeline
                    );
                }
                
                // Update client's project count
                await updateClientProjectCount(clientId);
            } else {
                console.error('❌ Błąd zapisu pipeline:', error);
            }
        } catch (err) {
            console.log('⚠️ Pipeline tylko lokalnie:', err);
        }
    }
    
    // Mark as changed for auto-save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    renderPipeline();
    closeModal('projectModal');
}

// Update client project count
async function updateClientProjectCount(clientId) {
    if (!clientId) return;
    
    try {
        // Count all projects for this client (pipeline + production)
        const { count: pipelineCount } = await supabaseClient
            .from('pipeline_projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
            
        const { count: productionCount } = await supabaseClient
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
        
        const totalProjects = (pipelineCount || 0) + (productionCount || 0);
        
        // Update client record
        await supabaseClient
            .from('clients')
            .update({ total_projects: totalProjects })
            .eq('id', clientId);
            
    } catch (err) {
        console.error('Error updating client stats:', err);
    }
}

// UPDATED WITH SUPABASE DELETE
async function deletePipelineProject(index) {
    if (confirm('Delete pipeline project "' + pipelineProjects[index].name + '"?')) {
        const projectNumber = pipelineProjects[index].projectNumber;
        const clientId = pipelineProjects[index].client_id;
        
        // Delete from Supabase if connected
        if (projectNumber && typeof supabaseClient !== 'undefined') {
            try {
                const { data: project } = await supabaseClient
                    .from('pipeline_projects')
                    .select('id')
                    .eq('project_number', projectNumber)
                    .single();
                
                if (project) {
                    // Delete phases first
                    await supabaseClient
                        .from('pipeline_phases')
                        .delete()
                        .eq('pipeline_project_id', project.id);
                    
                    // Delete project
                    const { error } = await supabaseClient
                        .from('pipeline_projects')
                        .delete()
                        .eq('project_number', projectNumber);
                        
                    if (error) {
                        console.error('❌ Błąd usuwania pipeline z DB:', error);
                    } else {
                        console.log('✅ Pipeline usunięty z bazy');
                        
                        // Update client project count
                        await updateClientProjectCount(clientId);
                    }
                }
            } catch (err) {
                console.log('⚠️ Brak połączenia z DB, usuwam tylko lokalnie');
            }
        }
        
        // Delete locally
        pipelineProjects.splice(index, 1);
        
        // Mark as changed for auto-save
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
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

// Handle type selection
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

// Convert pipeline to production with CLIENT_ID and PHASES
async function convertToProduction() {
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
        client_id: pipelineProject.client_id,
        deadline: deadline,
        phases: phases
    };
    
    // Auto-adjust phases to deadline
   // autoAdjustPhasesToDeadline(productionProject, today, deadlineDate);
    
    // Add to production projects (cross-page save)
    let productionProjects = JSON.parse(localStorage.getItem('joineryProjects') || '[]');
    productionProjects.push(productionProject);
    localStorage.setItem('joineryProjects', JSON.stringify(productionProjects));
    
    // Save to production DB with client_id and phases
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { data: savedProject, error } = await supabaseClient
                .from('projects')
                .insert([{
                    project_number: productionProject.projectNumber,
                    type: productionProject.type,
                    name: productionProject.name,
                    client_id: productionProject.client_id,
                    deadline: productionProject.deadline,
                    status: 'active',
                    notes: null,
                    contract_value: 0
                }])
                .select()
                .single();
            
            if (!error && savedProject) {
                console.log('✅ Production project saved to DB with client');
                console.log('📊 Saved project ID:', savedProject.id);
                console.log('📊 Phases to save:', productionProject.phases.length);
                console.log('📊 Phases data:', productionProject.phases);
                
                // Save production phases
                const phaseSaveResult = await savePhasesToSupabase(
                    savedProject.id,
                    productionProject.phases,
                    true  // true = production
                );
                
                console.log('📊 Phase save result:', phaseSaveResult);
                
                await updateClientProjectCount(productionProject.client_id);
            }
        } catch (err) {
            console.error('Error saving production project:', err);
        }
    }
    
    // Remove from pipeline
    pipelineProjects.splice(parseInt(selectedIndex), 1);
    localStorage.setItem('joineryPipelineProjects', JSON.stringify(pipelineProjects));
    
    // Delete from pipeline DB
    if (typeof supabaseClient !== 'undefined') {
        const { data: project } = await supabaseClient
            .from('pipeline_projects')
            .select('id')
            .eq('project_number', pipelineProject.projectNumber)
            .single();
        
        if (project) {
            // Delete pipeline phases
            await supabaseClient
                .from('pipeline_phases')
                .delete()
                .eq('pipeline_project_id', project.id);
            
            // Delete pipeline project
            await supabaseClient
                .from('pipeline_projects')
                .delete()
                .eq('project_number', pipelineProject.projectNumber);
                
            console.log('✅ Removed from pipeline DB');
        }
    }
    
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    alert(`Project converted to production: ${productionProject.projectNumber}\nDeadline: ${deadline}\nClient transferred.\nPlease go to Production page to see it.`);
}

// Archive as failed
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
    
    // Mark as changed for auto-save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    renderPipeline();
    closeModal('pipelineFinishedModal');
    
    alert(`Project archived as failed: ${pipelineProject.projectNumber}`);
}

// Create production phases
function createProductionPhases(startDate) {
    const phases = [];
    let currentDate = new Date(startDate);
    
    // Production phases (without deliveryGlazing)
    const productionPhaseKeys = ['siteSurvey', 'md', 'order', 'timber', 'orderGlazing', 'orderSpray', 'spray', 'glazing', 'qc', 'dispatch'];
    
    productionPhaseKeys.forEach(phaseKey => {
        const phaseDuration = 4; // Default 4 days for all phases
        
        const phaseStart = new Date(currentDate);
        
        // Snap to Monday if Sunday
        while (phaseStart.getDay() === 0) {
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

// Helper functions
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

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

function autoAdjustPhasesToDeadline(project, startDate, deadlineDate) {
    if (!project.phases || project.phases.length === 0) return;
    
    const availableWorkDays = workingDaysBetween(startDate, deadlineDate);
    const phasesCount = project.phases.length;
    
    const baseDaysPerPhase = Math.floor(availableWorkDays / phasesCount);
    const extraDays = availableWorkDays % phasesCount;
    
    project.phases.sort((a, b) => {
        return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
    });
    
    let currentStart = new Date(startDate);
    
    while (currentStart.getDay() === 0) {
        currentStart.setDate(currentStart.getDate() + 1);
    }
    
    project.phases.forEach((phase, index) => {
        const phaseDays = baseDaysPerPhase + (index < extraDays ? 1 : 0);
        
        phase.start = formatDate(currentStart);
        phase.workDays = Math.max(1, phaseDays);
        
        const phaseEnd = phaseDays <= 1 ? 
            new Date(currentStart) : 
            addWorkingDays(currentStart, phaseDays - 1);
        
        currentStart = new Date(phaseEnd);
        currentStart.setDate(currentStart.getDate() + 1);
        
        while (currentStart.getDay() === 0) {
            currentStart.setDate(currentStart.getDate() + 1);
        }
    });
}

// Fallback function for old localStorage method
function getNextPipelineNumber() {
    const currentYear = new Date().getFullYear();
    lastPipelineNumber = parseInt(localStorage.getItem('lastPipelineNumber') || '0');
    lastPipelineNumber++;
    localStorage.setItem('lastPipelineNumber', lastPipelineNumber);
    return `PL${String(lastPipelineNumber).padStart(3, '0')}/${currentYear}`;
}