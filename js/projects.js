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
            end: formatDate(phaseEnd),
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
                if (existingPhase.orderComplete !== undefined) newPhase.orderComplete = existingPhase.orderComplete;
                if (existingPhase.orderConfirmed !== undefined) newPhase.orderConfirmed = existingPhase.orderConfirmed;
            }
        }
        
        selectedPhases.push(newPhase);
        
        // Next phase starts after this one ends
        currentDate = new Date(phaseEnd);
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Skip weekends for next phase start
        while (isWeekend(currentDate)) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
    
    if (selectedPhases.length === 0) {
        alert('Please select at least one phase');
        return;
    }
    
    const projectData = {
        name: name,
        projectNumber: projectNumber,
        phases: selectedPhases,
        type: projectType,
        client_id: clientId,
        deadline: deadline || null,
        created_at: currentEditProject !== null ? projects[currentEditProject].created_at : new Date().toISOString()
    };
    
    // Preserve google drive data if exists
    if (currentEditProject !== null) {
        const existingProject = projects[currentEditProject];
        if (existingProject.google_drive_url) {
            projectData.google_drive_url = existingProject.google_drive_url;
        }
        if (existingProject.google_drive_folder_id) {
            projectData.google_drive_folder_id = existingProject.google_drive_folder_id;
        }
        if (existingProject.contract_value) {
            projectData.contract_value = existingProject.contract_value;
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
    
    // ZAPISZ DO SUPABASE
    if (typeof supabaseClient !== 'undefined') {
        try {
            // Przygotuj dane projektu
            const projectToSave = {
                project_number: projectData.projectNumber,
                name: projectData.name,
                type: projectData.type,
                client_id: projectData.client_id,
                google_drive_url: projectData.google_drive_url || null,
                google_drive_folder_id: projectData.google_drive_folder_id || null,
                contract_value: projectData.contract_value || 0,
                deadline: projectData.deadline,
                created_at: projectData.created_at
            };
            
            if (currentEditProject !== null) {
                // UPDATE istniejącego projektu
                const { data, error } = await supabaseClient
                    .from('projects')
                    .update(projectToSave)
                    .eq('project_number', projectData.projectNumber)
                    .select();
                
                if (error) {
                    console.error('Error updating project:', error);
                    alert('Error saving project to database. Changes saved locally only.');
                } else if (data && data.length > 0) {
                    console.log('✅ Project updated in database:', data[0]);
                    
                    // Zapisz fazy
                    await savePhasesToSupabase(data[0].id, projectData.phases, true);
                    
                    // Update client project count
                    await updateClientProjectCount(projectData.client_id);
                } else {
                    console.warn('⚠️ Project not found in database, creating new...');
                    // Jeśli nie znaleziono, spróbuj utworzyć nowy
                    const { data: newData, error: insertError } = await supabaseClient
                        .from('projects')
                        .insert([projectToSave])
                        .select();
                    
                    if (insertError) {
                        console.error('Error creating project:', insertError);
                    } else if (newData && newData.length > 0) {
                        console.log('✅ Project created in database:', newData[0]);
                        await savePhasesToSupabase(newData[0].id, projectData.phases, false);
                        await updateClientProjectCount(projectData.client_id);
                    }
                }
            } else {
                // INSERT nowego projektu
                const { data, error } = await supabaseClient
                    .from('projects')
                    .insert([projectToSave])
                    .select();
                
                if (error) {
                    console.error('Error creating project:', error);
                    alert('Error saving project to database. Project saved locally only.');
                } else if (data && data.length > 0) {
                    console.log('✅ Project created in database:', data[0]);
                    
                    // Zapisz fazy
                    await savePhasesToSupabase(data[0].id, projectData.phases, false);
                    
                    // Update client project count
                    await updateClientProjectCount(projectData.client_id);
                }
            }
        } catch (err) {
            console.error('Database error:', err);
            alert('Error connecting to database. Changes saved locally only.');
        }
    }
    
    saveData();
    render();
    closeModal('projectModal');
}

async function deleteProject(index) {
    const project = projects[index];
    
    if (confirm(`Delete project "${project.name}"?`)) {
        // USUŃ Z SUPABASE
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            try {
                const { error } = await supabaseClient
                    .from('projects')
                    .delete()
                    .eq('project_number', project.projectNumber);
                
                if (error) {
                    console.error('Error deleting project from database:', error);
                    alert('Error deleting from database. Project removed locally only.');
                } else {
                    console.log('✅ Project deleted from database');
                    
                    // Update client project count
                    if (project.client_id) {
                        await updateClientProjectCount(project.client_id);
                    }
                }
            } catch (err) {
                console.error('Database error:', err);
            }
        }
        
        projects.splice(index, 1);
        saveData();
        render();
    }
}

function refreshAfterPhaseChange(projectIndex) {
    if (!projects[projectIndex]) return;
    
    const project = projects[projectIndex];
    
    // Sort phases
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
    
    // Znajdź workers przypisanych do faz timber i spray
    let timberWorkerId = null;
    let sprayWorkerId = null;
    
    if (project.phases) {
        const timberPhase = project.phases.find(p => p.key === 'timber');
        const sprayPhase = project.phases.find(p => p.key === 'spray');
        
        if (timberPhase && timberPhase.assignedTo) timberWorkerId = timberPhase.assignedTo;
        if (sprayPhase && sprayPhase.assignedTo) sprayWorkerId = sprayPhase.assignedTo;
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
        deadline: project.deadline || null,
        created_at: project.created_at || new Date().toISOString(),
        archived_date: new Date().toISOString(),
        archive_reason: reason,
        archive_notes: notes || null,
        source: 'production'
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
    
    saveData();
    render();
    closeModal('moveToArchiveModal');
    
    const reasonText = document.querySelector(`#archiveReason option[value="${reason}"]`)?.textContent || reason;
    alert(`Project archived: ${project.projectNumber}\nReason: ${reasonText}`);
}