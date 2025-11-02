// ========== PROJECT MANAGEMENT ==========

// Load clients for dropdown - TYLKO JEDNA DEFINICJA
async function loadClientsDropdown() {
    try {
        if (!supabaseClient) {
            console.error('Supabase not initialized');
            return;
        }
        
        const { data, error } = await supabaseClient
            .from('clients')
            .select('id, client_number, company_name, contact_person')
            .order('company_name');
        
        if (error) {
            console.error('Error loading clients:', error);
            return;
        }
        
        const select = document.getElementById('projectClient');
        if (!select) {
            console.error('Client select not found');
            return;
        }
        
        select.innerHTML = '<option value="">-- Wybierz klienta z bazy --</option>';
        
        if (data && data.length > 0) {
            data.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = `${client.client_number} - ${client.company_name || client.contact_person}`;
                select.appendChild(option);
            });
            console.log('✅ Loaded', data.length, 'clients');
        } else {
            console.log('No clients in database');
        }
    } catch (err) {
        console.error('Błąd ładowania klientów:', err);
    }
}

// NAPRAWIONA funkcja addProject z async/await
async function addProject() {
    currentEditProject = null;
    document.getElementById('projectModalTitle').textContent = 'Add Project';
    document.getElementById('projectName').value = '';
    document.getElementById('projectStartDate').value = formatDate(new Date());
    document.getElementById('projectDeadline').value = '';
    
    // POBIERZ NUMERACJĘ Z BAZY DANYCH
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { data: lastProject, error } = await supabaseClient
                .from('projects')
                .select('project_number')
                .order('project_number', { ascending: false })
                .limit(1);
            
            let nextNumber = 1;
            
            if (lastProject && lastProject.length > 0) {
                const projectNum = lastProject[0].project_number;
                console.log('Ostatni numer Production z bazy:', projectNum);
                
                // Format: "001.2025" - wyciągnij cyfry przed kropką
                const match = projectNum.match(/^(\d{3})\//);
                if (match && match[1]) {
                    const lastNum = parseInt(match[1]);
                    if (!isNaN(lastNum)) {
                        nextNumber = lastNum + 1;
                    }
                }
            }
            
            const currentYear = new Date().getFullYear();
            const generatedNumber = `${String(nextNumber).padStart(3, '0')}/${currentYear}`;
            document.getElementById('projectNumber').value = generatedNumber;
            console.log('Wygenerowany numer Production:', generatedNumber);
            
        } catch (err) {
            console.error('Błąd pobierania numeracji:', err);
            // Fallback - użyj domyślnego
            const currentYear = new Date().getFullYear();
            document.getElementById('projectNumber').value = `001.${currentYear}`;
        }
    } else {
        // Jeśli nie ma Supabase - użyj domyślnego  
        const currentYear = new Date().getFullYear();
        document.getElementById('projectNumber').value = `001.${currentYear}`;
    }
    
    // Reset type selection
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.type-option[data-type="other"]').classList.add('selected');
    
    // For new project all phases are checked by default
    updatePhasesList(null, true);
    
    // WAŻNE: Najpierw otwórz modal
    openModal('projectModal');
    
    // WAŻNE: Potem załaduj klientów BEZ await - użyjemy then()
    loadClientsDropdown().then(() => {
        console.log('Clients loaded');
    }).catch(err => {
        console.error('Error loading clients:', err);
    });
}

// NAPRAWIONA funkcja editProject z then() zamiast await
function editProject(index) {
    currentEditProject = index;
    const project = projects[index];
    
    document.getElementById('projectModalTitle').textContent = 'Edit Project';
    document.getElementById('projectName').value = project.name;
    document.getElementById('projectStartDate').value = project.phases[0]?.start || formatDate(new Date());
    document.getElementById('projectNumber').value = project.projectNumber || '';
    document.getElementById('projectDeadline').value = project.deadline || '';
    document.getElementById('projectContractValue').value = project.contract_value || '';
    document.getElementById('projectCost').value = project.project_cost || '';
    
    // Set selected type
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    const selectedType = project.type || 'other';
    document.querySelector(`.type-option[data-type="${selectedType}"]`).classList.add('selected');
    
    updatePhasesList(project.phases, false);
    
    // WAŻNE: Najpierw otwórz modal
    openModal('projectModal');
    
    // WAŻNE: Potem załaduj klientów i ustaw aktualnego
    loadClientsDropdown().then(() => {
        // Ustaw aktualnego klienta PO załadowaniu listy
        if (project.client_id) {
            document.getElementById('projectClient').value = project.client_id;
        }
    }).catch(err => {
        console.error('Error loading clients:', err);
    });
}

async function saveProject() {
    const name = document.getElementById('projectName').value.trim();
    const clientId = document.getElementById('projectClient').value;
    const startDate = document.getElementById('projectStartDate').value;
    const projectNumber = document.getElementById('projectNumber').value.trim();
    const deadline = document.getElementById('projectDeadline').value;
    const contractValue = parseFloat(document.getElementById('projectContractValue').value) || 0;
    const projectCost = parseFloat(document.getElementById('projectCost').value) || 0;
    
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
    
    if (!clientId) {
        alert('Please select a client from database!');
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

        // NOWA LOGIKA: Przy edycji zachowaj stare daty
        let newPhase;

        if (currentEditProject !== null) {
            const existingPhase = projects[currentEditProject].phases?.find(p => p.key === phaseKey);
            if (existingPhase) {
                // ZACHOWAJ WSZYSTKO ze starej fazy
                newPhase = { ...existingPhase };
            } else {
                // Nowa faza dodana przy edycji - oblicz daty
                const phaseStart = new Date(currentDate);
                while (isWeekend(phaseStart)) {
                    phaseStart.setDate(phaseStart.getDate() + 1);
                }
                const phaseEnd = phaseDuration <= 1 ?
                    new Date(phaseStart) :
                    addWorkingDays(phaseStart, phaseDuration - 1);

                newPhase = {
                    key: phaseKey,
                    start: formatDate(phaseStart),
                    end: formatDate(phaseEnd),
                    workDays: phaseDuration,
                    status: 'notStarted'
                };

                // NAPRAWA: Aktualizuj currentDate RÓWNIEŻ dla edycji nowych faz
                currentDate = new Date(newPhase.end);
                currentDate.setDate(currentDate.getDate() + 1);
                while (isWeekend(currentDate)) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
        } else {
            // NOWY PROJEKT - oblicz daty normalnie
            const phaseStart = new Date(currentDate);
            while (isWeekend(phaseStart)) {
                phaseStart.setDate(phaseStart.getDate() + 1);
            }
            const phaseEnd = phaseDuration <= 1 ?
                new Date(phaseStart) :
                addWorkingDays(phaseStart, phaseDuration - 1);

            newPhase = {
                key: phaseKey,
                start: formatDate(phaseStart),
                end: formatDate(phaseEnd),
                workDays: phaseDuration,
                status: 'notStarted'
            };

            // Aktualizuj currentDate dla nowych projektów
            currentDate = new Date(newPhase.end);
            currentDate.setDate(currentDate.getDate() + 1);
            while (isWeekend(currentDate)) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        selectedPhases.push(newPhase);
    });
    

    const projectData = {
    projectNumber,
    type: projectType,
    name,
    client_id: clientId,
    deadline: deadline || null,
    contract_value: contractValue,
    project_cost: projectCost,
    phases: selectedPhases
};

console.log('💾 Saving project data:', projectData);
console.log('💰 Contract Value:', contractValue, typeof contractValue);

// PRESERVE id and google_drive fields when editing
if (currentEditProject !== null && projects[currentEditProject]) {
    if (projects[currentEditProject].id) {
        projectData.id = projects[currentEditProject].id;
    }
    if (projects[currentEditProject].google_drive_url) {
        projectData.google_drive_url = projects[currentEditProject].google_drive_url;
    }
    if (projects[currentEditProject].google_drive_folder_id) {
        projectData.google_drive_folder_id = projects[currentEditProject].google_drive_folder_id;
    }
    if (projects[currentEditProject].google_drive_folder_name) {
        projectData.google_drive_folder_name = projects[currentEditProject].google_drive_folder_name;
    }
}
    
    // WYŁĄCZONE - automatyczne ustawianie faz przy deadline
    // if (deadline && selectedPhases.length > 0) {
    //     const today = new Date();
    //     today.setHours(0,0,0,0);
    //     const deadlineDate = new Date(deadline);
    //     
    //     // Sprawdź czy deadline jest wystarczający
    //     const availableWorkDays = workingDaysBetween(today, deadlineDate);
    //     
    //     if (availableWorkDays < selectedPhases.length) {
    //         alert(`Deadline too short! Need at least ${selectedPhases.length} working days for ${selectedPhases.length} phases.`);
    //         return;
    //     }
    //     
    //     // Auto-dopasuj fazy do deadline
    //     autoAdjustPhasesToDeadline(projectData, today, deadlineDate);
    // }
    
    if (currentEditProject !== null) {
        projects[currentEditProject] = projectData;
    } else {
        projects.push(projectData);
    }
    
    // Save to Supabase
    if (typeof supabaseClient !== 'undefined') {
        try {
            const projectForDB = {
                project_number: projectData.projectNumber,
                type: projectData.type,
                name: projectData.name,
                client_id: projectData.client_id,
                deadline: projectData.deadline,
                status: 'active',
                notes: null,
                contract_value: projectData.contract_value ? projectData.contract_value.toString() : '0',
                project_cost: projectData.project_cost ? projectData.project_cost.toString() : '0',
                google_drive_url: projectData.google_drive_url || null,
                google_drive_folder_id: projectData.google_drive_folder_id || null
            };
            
            console.log('📤 Sending to Supabase:', projectForDB);
            console.log('💷 CONTRACT_VALUE in object:', projectForDB.contract_value, typeof projectForDB.contract_value);
            console.log('🔍 Full object keys:', Object.keys(projectForDB));
            
            let supabaseResponse;
            if (currentEditProject !== null) {
                // UPDATE existing project by project_number
                console.log('🔄 UPDATE mode - project_number:', projectForDB.project_number);
                supabaseResponse = await supabaseClient
                    .from('projects')
                    .update(projectForDB)
                    .eq('project_number', projectForDB.project_number)
                    .select(); // DODAJ select() żeby zobaczyć co zostało zapisane
                    
                console.log('📊 Updated data returned:', supabaseResponse.data);
                if (supabaseResponse.data && supabaseResponse.data[0]) {
                    console.log('✅ ZAPISANA wartość contract_value:', supabaseResponse.data[0].contract_value);
                }
            } else {
                // INSERT new project
                console.log('➕ INSERT mode');
                supabaseResponse = await supabaseClient
                    .from('projects')
                    .insert(projectForDB);
            }
            
            const { error } = supabaseResponse;
            console.log('📥 Supabase response error:', error);
                
            if (!error) {
                console.log('✅ Project saved to Supabase with client');
                
                // Pobierz ID zapisanego projektu
                const { data: savedProject } = await supabaseClient
                    .from('projects')
                    .select('id')
                    .eq('project_number', projectData.projectNumber)
                    .single();
                
                // ZAPISZ FAZY DO TABELI project_phases
                if (savedProject && projectData.phases && projectData.phases.length > 0) {
                    console.log('💾 Zapisuję', projectData.phases.length, 'faz do tabeli project_phases dla projektu', savedProject.id);
                    
                    const phaseSaveResult = await savePhasesToSupabase(
                        savedProject.id,
                        projectData.phases,
                        true  // true = production
                    );
                    
                    if (phaseSaveResult) {
                        console.log('✅ All phases saved successfully');
                    } else {
                        console.error('❌ Failed to save phases');
                    }
                }
                
                // Update client project count
                await updateClientProjectCount(clientId);
            } else {
                console.error('❌ Error saving project:', error);
            }
        } catch (err) {
            console.log('⚠️ Project saved locally only:', err);
        }
    }
    
    saveDataQueued();
    render();
    closeModal('projectModal');
}

// Update client project count
async function updateClientProjectCount(clientId) {
    if (!clientId) return;
    
    try {
        // Count all projects for this client
        const { count: productionCount } = await supabaseClient
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
            
        const { count: pipelineCount } = await supabaseClient
            .from('pipeline_projects')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
        
        const totalProjects = (productionCount || 0) + (pipelineCount || 0);
        
        // Update client record
        await supabaseClient
            .from('clients')
            .update({ total_projects: totalProjects })
            .eq('id', clientId);
            
    } catch (err) {
        console.error('Error updating client stats:', err);
    }
}

// deleteProject function removed - use "Move to Archive" instead (toolbar button)

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
    
    saveDataQueued();
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
    console.log('🔍 Opening Move to Archive modal...');
    console.log('📊 Projects count:', projects.length);
    updateCompletedProjectSelect();
    openModal('moveToArchiveModal');
    console.log('✅ Modal opened');
}

function updateCompletedProjectSelect() {
    const select = document.getElementById('completedProjectSelect');
    console.log('🔍 Select element:', select);
    select.innerHTML = '<option value="">Select project...</option>';
    
    console.log('🔍 Projects to add:', projects);
    projects.forEach((project, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${project.projectNumber} - ${project.name}`;
        select.appendChild(option);
        console.log('➕ Added project:', option.textContent);
    });
    console.log('✅ Total options:', select.options.length);
}

async function confirmMoveToArchive() {
    const selectedIndex = document.getElementById('completedProjectSelect').value;
    const reason = document.getElementById('archiveReason').value;
    const notes = document.getElementById('archiveNotes').value.trim();
    const budgetSameAsQuote = document.getElementById('budgetSameAsQuote').checked;
    const actualFinalValue = parseFloat(document.getElementById('actualFinalValue').value) || null;
    
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
    
    // Walidacja: jeśli completed i nie zaznaczono "same as quote", musi być actual value
    if (reason === 'completed' && !budgetSameAsQuote && !actualFinalValue) {
        alert('Please enter the actual final value or confirm that budget was same as quote');
        return;
    }
    
    // Znajdź workers przypisanych do faz timber i spray
    let timberWorkerId = null;
    let sprayWorkerId = null;
    
    if (project.phases) {
        const timberPhase = project.phases.find(p => p.key === 'timber');
        const sprayPhase = project.phases.find(p => p.key === 'spray');
        
        if (timberPhase && timberPhase.assignedTo) timberWorkerId = timberPhase.assignedTo;
        if (sprayPhase && sprayPhase.assignedTo) sprayWorkerId = sprayPhase.assignedTo;
    }
    
    // Określ actual_value
    let finalActualValue = null;
    if (reason === 'completed') {
        if (budgetSameAsQuote) {
            finalActualValue = project.contract_value || 0;
        } else {
            finalActualValue = actualFinalValue;
        }
    }
    
    // Przygotuj dane do archiwum
    const archivedProject = {
        project_number: project.projectNumber,
        name: project.name,
        type: project.type,
        client_id: project.client_id,
        google_drive_url: project.google_drive_url || null,
        google_drive_folder_id: project.google_drive_folder_id || null,
        timber_worker_id: timberWorkerId,
        spray_worker_id: sprayWorkerId,
        admin_id: null, // na przyszłość
        sales_person_id: null, // na przyszłość
        contract_value: project.contract_value || 0,
        actual_value: finalActualValue,
        project_cost: project.project_cost || 0,
        deadline: project.deadline || null,
        created_at: project.created_at || new Date().toISOString(),
        archived_date: new Date().toISOString(),
        archive_reason: reason,
        archive_notes: notes || null,
        source: 'production'
        // TODO: Dodaj kolumnę 'completed_date' do tabeli archived_projects w Supabase
        // completed_date: reason === 'completed' ? new Date().toISOString() : null
    };
    
    // Zapisz do bazy
    if (typeof supabaseClient !== 'undefined') {
        try {
            const { data, error } = await supabaseClient
                .from('archived_projects')
                .insert([archivedProject]);
            
            if (error) {
                console.error('Error archiving project:', error);
                alert('Error saving to archive. Please try again.');
                return;
            }
            
            console.log('✅ Project archived to database');
            
            // Usuń projekt z tabeli projects
            const { error: deleteError } = await supabaseClient
                .from('projects')
                .delete()
                .eq('project_number', project.projectNumber);
            
            if (deleteError) {
                console.error('Error deleting project:', deleteError);
            }
            
            // Update client project count
            if (project.client_id) {
                await updateClientProjectCount(project.client_id);
            }
            
        } catch (err) {
            console.error('Database error:', err);
            alert('Error connecting to database.');
            return;
        }
    }
    
    // Usuń z lokalnej tablicy
    projects.splice(projectIndex, 1);
    
    saveDataQueued();
    render();
    closeModal('moveToArchiveModal');
    
    const reasonText = document.querySelector(`#archiveReason option[value="${reason}"]`)?.textContent || reason;
    alert(`Project archived: ${project.projectNumber}\nReason: ${reasonText}`);
}

// ========== PROJECT NOTES ==========
function openProductionProjectNotes(index) {
    const project = projects[index];
    if (!project) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'productionProjectNotesModal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; width: 90%;">
            <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div id="logoPlaceholder" style="width: 60px; height: 60px; border: 2px dashed #555; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #777; font-size: 10px; text-align: center;">
                        LOGO
                    </div>
                    <div>
                        <div style="font-size: 18px; font-weight: bold;">Project Notes</div>
                        <div style="font-size: 14px; color: #999;">${project.projectNumber} - ${project.name}</div>
                    </div>
                </div>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Notes</label>
                    <textarea id="productionProjectNotesText" placeholder="Add notes about this production project..." style="min-height: 400px; font-size: 14px;">${project.notes || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="closeProductionProjectNotes()">Cancel</button>
                ${project.pdf_url ? 
                    `<button class="modal-btn" onclick="window.open('${project.pdf_url}', '_blank')" style="background: #4a90e2;">📄 Open PDF</button>` : ''
                }
                <button class="modal-btn success" onclick="exportProductionProjectNotesPDF(${index})">📥 Export PDF</button>
                <button class="modal-btn primary" onclick="saveProductionProjectNotes(${index})">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeProductionProjectNotes() {
    const modal = document.getElementById('productionProjectNotesModal');
    if (modal) modal.remove();
}

async function saveProductionProjectNotes(index) {
    const project = projects[index];
    if (!project) {
        console.error('❌ Project not found at index:', index);
        return;
    }
    
    console.log('💾 Saving notes for project:', project.projectNumber);
    console.log('📊 Project object:', project);
    
    const notes = document.getElementById('productionProjectNotesText').value.trim();
    project.notes = notes || null;
    
    console.log('📝 Notes to save:', notes);
    
    // Save to Supabase
    if (typeof supabaseClient !== 'undefined') {
        try {
            console.log('🔄 Updating Supabase...');
            const { data, error } = await supabaseClient
                .from('projects')
                .update({ notes: notes || null })
                .eq('project_number', project.projectNumber);
            
            if (error) {
                console.error('❌ Error saving notes:', error);
                alert('Error saving notes to database');
                return;
            }
            
            console.log('✅ Notes saved to Supabase!', data);
        } catch (err) {
            console.error('❌ Database error:', err);
        }
    } else {
        console.warn('⚠️ supabaseClient not defined');
    }
    
    saveDataQueued();
    render();
    closeProductionProjectNotes();
}

async function exportProductionProjectNotesPDF(index) {
    const project = projects[index];
    if (!project) return;
    
    const notes = document.getElementById('productionProjectNotesText').value.trim();
    
    if (!notes) {
        alert('No notes to export. Please add some notes first.');
        return;
    }
    
    // Access jsPDF from global scope
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // PDF Settings
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    
    // Logo placeholder (rectangle)
    doc.setDrawColor(150);
    doc.setLineWidth(1);
    doc.rect(margin, margin, 30, 30);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('LOGO', margin + 15, margin + 17, { align: 'center' });
    
    // Header - Project Info
    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.setFont(undefined, 'bold');
    doc.text('Project Notes', margin + 40, margin + 10);
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100);
    doc.text(`${project.projectNumber} - ${project.name}`, margin + 40, margin + 20);
    
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, margin + 40, margin + 28);
    
    // Line separator
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 35, pageWidth - margin, margin + 35);
    
    // Notes content
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont(undefined, 'normal');
    
    const splitNotes = doc.splitTextToSize(notes, contentWidth);
    let yPosition = margin + 45;
    
    splitNotes.forEach((line) => {
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
        doc.text(line, margin, yPosition);
        yPosition += 7;
    });
    
    // Generate PDF as blob
    const pdfBlob = doc.output('blob');
    
    // Generate filename
    const filename = `${project.projectNumber.replace(/\//g, '-')}-notes.pdf`;
    
    // Helper function for local download
    function downloadLocally() {
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('PDF downloaded locally!');
    }
    
    // Upload to Supabase Storage
    if (typeof supabaseClient !== 'undefined') {
        try {
            const filePath = `production/${filename}`;
            
            console.log('📤 Uploading PDF to Storage...');
            
            // Upload file
            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('project-documents')
                .upload(filePath, pdfBlob, {
                    contentType: 'application/pdf',
                    upsert: true
                });
            
            if (uploadError) {
                console.error('Upload error:', uploadError);
                alert('Error uploading PDF. Downloading locally instead.');
                downloadLocally();
                return;
            }
            
            console.log('✅ PDF uploaded successfully');
            
            // Get public URL
            const { data: urlData } = supabaseClient.storage
                .from('project-documents')
                .getPublicUrl(filePath);
            
            const pdfUrl = urlData.publicUrl;
            
            // Save URL to database
            const { error: updateError } = await supabaseClient
                .from('projects')
                .update({ pdf_url: pdfUrl })
                .eq('project_number', project.projectNumber);
            
            if (updateError) {
                console.error('Error updating PDF URL:', updateError);
            }
            
            project.pdf_url = pdfUrl;
            
            console.log('✅ PDF URL saved to database');
            
            // Re-render to show "Open PDF" button
            render();
            
            alert('PDF generated and saved successfully!\n\nYou can now access it anytime using the "Open PDF" button.');
            
            // Refresh modal to show Open PDF button
            closeProductionProjectNotes();
            openProductionProjectNotes(index);
            
        } catch (err) {
            console.error('Storage error:', err);
            alert('Error uploading to storage. Downloading locally instead.');
            downloadLocally();
        }
    } else {
        // No Supabase - download locally
        downloadLocally();
    }
}