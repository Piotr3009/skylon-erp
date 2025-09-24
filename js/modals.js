// ========== MODAL MANAGEMENT ==========
let currentEditPhase = null;

// Nowa funkcja do pobierania pracowników z bazy
async function loadTeamMembersForPhase(phaseKey) {
    try {
        let query;
        
        if (phaseKey === 'timber' || phaseKey === 'glazing') {
            // Timber i Glazing → dział Production
            query = supabaseClient
                .from('team_members')
                .select('id, name, employee_number, color')
                .eq('active', true)
                .eq('department', 'production')
                .order('name');
                
        } else if (phaseKey === 'spray') {
            // Spray → dział Spray
            query = supabaseClient
                .from('team_members')
                .select('id, name, employee_number, color')
                .eq('active', true)
                .eq('department', 'spray')
                .order('name');
                
        } else if (phaseKey === 'dispatch') {
            // Dispatch → działy Drivers LUB Installation
            query = supabaseClient
                .from('team_members')
                .select('id, name, employee_number, color')
                .eq('active', true)
                .or('department.eq.drivers,department.eq.installation')
                .order('name');
                
        } else {
            // Inne fazy - nie pokazuj nikogo
            return [];
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
        
    } catch (err) {
        console.error('Error loading team:', err);
        return [];
    }
}

// Open phase edit modal (double-click on any phase)
function openPhaseEditModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = phases[phase.key];
    
    // Special handling for Order Materials phase
    if (phase.key === 'order') {
        openOrderMaterialsModal(projectIndex, phaseIndex);
        return;
    }
    
    // Special handling for Order Glazing phase
    if (phase.key === 'orderGlazing') {
        openOrderGlazingModal(projectIndex, phaseIndex);
        return;
    }
    
    // Special handling for Order Spray Materials phase
    if (phase.key === 'orderSpray') {
        openOrderSprayModal(projectIndex, phaseIndex);
        return;
    }
    
    // PUNKT 5 - Special handling for Delivery Glazing phase
    if (phase.key === 'deliveryGlazing') {
        openDeliveryGlazingModal(projectIndex, phaseIndex);
        return;
    }
    
    // Calculate work days - USE phase.workDays if available
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set modal title
    document.getElementById('phaseEditTitle').textContent = `Edit ${phaseConfig.name}`;
    
    // Fill fields
    document.getElementById('phaseDuration').value = workDays;
    document.getElementById('phaseNotes').value = phase.notes || '';
    
    // Set phase status
    const statusSelect = document.getElementById('phaseStatus');
    statusSelect.value = phase.status || 'notStarted';
    
    // Show/hide team assignment section - ZMIENIONA SEKCJA
    const assignSection = document.getElementById('assignSection');
    if (phase.key === 'timber' || phase.key === 'spray' || phase.key === 'glazing' || phase.key === 'dispatch') {
        assignSection.style.display = 'block';
        
        // NOWE - Pobierz pracowników z bazy
        loadTeamMembersForPhase(phase.key).then(employees => {
            const select = document.getElementById('phaseAssignSelect');
            select.innerHTML = '<option value="">Wybierz pracownika...</option>';
            
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${emp.name} (${emp.employee_number || '-'})`;
                option.dataset.color = emp.color || '#999999';
                
                if (phase.assignedTo === emp.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            // Jeśli brak pracowników
            if (employees.length === 0) {
                select.innerHTML = '<option value="">No one assigned to this department</option>';
            }
        });
    } else {
        assignSection.style.display = 'none';
    }
    
    // Pokaż przycisk Delete Phase
    const deleteBtn = document.getElementById('deletePhaseBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }
    
    openModal('phaseEditModal');
}

// PUNKT 5 - Open Delivery Glazing modal
function openDeliveryGlazingModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Set modal title
    document.getElementById('phaseEditTitle').textContent = 'Edit Delivery Glazing';
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Fill fields
    document.getElementById('phaseDuration').value = workDays;
    document.getElementById('phaseNotes').value = phase.notes || '';
    
    // Set phase status
    const statusSelect = document.getElementById('phaseStatus');
    statusSelect.value = phase.status || 'notStarted';
    
    // Hide team assignment for delivery
    const assignSection = document.getElementById('assignSection');
    if (assignSection) {
        assignSection.style.display = 'none';
    }
    
    // Show delete button
    const deleteBtn = document.getElementById('deletePhaseBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'inline-block';
    }
    
    openModal('phaseEditModal');
}

// Delete Phase
async function deleteCurrentPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    
    // WAŻNE: Sprawdź czy jesteśmy w Pipeline czy normalnym Gantt
    const isPipeline = window.location.pathname.includes('pipeline');
    const project = isPipeline ? pipelineProjects[projectIndex] : projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = isPipeline ? pipelinePhases[phase.key] : phases[phase.key];
    
    if (confirm(`Delete phase "${phaseConfig.name}" from this project?`)) {
        try {
            // Usuń fazę
            project.phases.splice(phaseIndex, 1);
            
            // Automatycznie układaj pozostałe fazy
            if (typeof autoArrangeFromPhase === 'function') {
                autoArrangeFromPhase(projectIndex, phaseIndex);
            }
            
            // MARK AS CHANGED
            if (typeof markAsChanged === 'function') {
                markAsChanged();
            }
            
            // NATYCHMIAST zamknij modal - NIE CZEKAJ na zapis!
            closeModal('phaseEditModal');
            currentEditPhase = null;
            
            // Renderuj widok OD RAZU
            if (window.location.pathname.includes('pipeline')) {
                renderPipeline();
            } else {
                renderUniversal();
            }
            
            // Zapisz dane W TLE (bez czekania)
            saveData().catch(error => {
                console.error('Error saving after delete:', error);
            });
            
        } catch (error) {
            console.error('Error deleting phase:', error);
            alert('Error deleting phase. Please try again.');
            closeModal('phaseEditModal');
            currentEditPhase = null;
        }
    }
}

// Delete Order Phase
async function deleteOrderPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    if (confirm(`Delete "Order Materials" phase from this project?`)) {
        project.phases.splice(phaseIndex, 1);
        
        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, phaseIndex);
        }
        
        // MARK AS CHANGED
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
        saveData();
        
        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
        renderUniversal();
        }
        
        closeModal('orderMaterialsModal');
        currentEditPhase = null;
    }
}

// Delete Order Spray Phase
async function deleteOrderSprayPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    
    if (confirm(`Delete "Order Spray Materials" phase from this project?`)) {
        project.phases.splice(phaseIndex, 1);
        
        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, phaseIndex);
        }
        
        // MARK AS CHANGED
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
        saveData();
        
        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
        renderUniversal();
        }
        
        closeModal('orderSprayModal');
        currentEditPhase = null;
    }
}

// Delete Order Glazing Phase
async function deleteOrderGlazingPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    
    if (confirm(`Delete "Order Glazing" phase from this project?`)) {
        project.phases.splice(phaseIndex, 1);
        
        if (typeof autoArrangeFromPhase === 'function') {
            autoArrangeFromPhase(projectIndex, phaseIndex);
        }
        
        // MARK AS CHANGED
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
        saveData();
        
        // Renderuj odpowiedni widok
        if (window.location.pathname.includes('pipeline')) {
            renderPipeline();
        } else {
        renderUniversal();
        }
        
        closeModal('orderGlazingModal');
        currentEditPhase = null;
    }
}

// Save phase changes - FIXED WITH workDays
async function savePhaseChanges() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    
    // WAŻNE: Sprawdź czy jesteśmy w Pipeline czy normalnym Gantt
    const isPipeline = window.location.pathname.includes('pipeline');
    const project = isPipeline ? pipelineProjects[projectIndex] : projects[projectIndex];
    
    // DIAGNOSTYKA
    console.log('PRZED ZAPISEM - liczba faz:', project.phases.length);
    console.log('PRZED ZAPISEM - klucze faz:', project.phases.map(p => p.key));
    
    const phase = project.phases[phaseIndex];
    const phasesConfig = isPipeline ? pipelinePhases : phases;
    
    // Get new duration
    const newDuration = parseInt(document.getElementById('phaseDuration').value);
    const notes = document.getElementById('phaseNotes').value.trim();
    const status = document.getElementById('phaseStatus').value;
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // SAVE NEW WORKDAYS - CRITICAL!
    phase.workDays = newDuration;
    
    // Calculate new end date with work days
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    
    // CHECK DEADLINE BEFORE SAVING!
    if (project.deadline) {
        const deadlineDate = new Date(project.deadline);
        const phaseEnd = newDuration <= 1 ? start : addWorkingDays(start, newDuration - 1);
        
        if (phaseEnd > deadlineDate) {
            const maxAllowed = workingDaysBetween(start, deadlineDate);
            alert(`This phase would exceed the project deadline!\n\nMaximum allowed: ${maxAllowed} days`);
            return;
        }
    }
    
    // Check if we're extending the phase
    const oldEnd = new Date(phase.end || computeEnd(phase));
    const deltaDays = calculateWorkDays(oldEnd, newEnd) - 1;
    
    phase.end = formatDate(newEnd);
    
    // Save notes
    if (notes) {
        phase.notes = notes;
    } else {
        delete phase.notes;
    }
    
    // Save status
    phase.status = status;
    
    // ZMIENIONA SEKCJA - Assign team member (if applicable)
    if (phase.key === 'timber' || phase.key === 'spray' || phase.key === 'glazing' || phase.key === 'dispatch') {
        const assignedId = document.getElementById('phaseAssignSelect').value;
        if (assignedId) {
            const selectedOption = document.getElementById('phaseAssignSelect').selectedOptions[0];
            phase.assignedTo = assignedId;
            phase.assignedToName = selectedOption.textContent.split(' (')[0];
            phase.assignedToColor = selectedOption.dataset.color || '#999999';
        } else {
            delete phase.assignedTo;
            delete phase.assignedToName;
            delete phase.assignedToColor;
        }
    }
    
    // PUNKT 5 - Auto-shift glazing if delivery glazing is moved
    if (phase.key === 'deliveryGlazing') {
        const glazingPhaseIndex = project.phases.findIndex(p => p.key === 'glazing');
        if (glazingPhaseIndex !== -1) {
            // Move glazing to start after delivery ends
            const deliveryEnd = computeEnd(phase);
            const glazingStartDate = new Date(deliveryEnd);
            glazingStartDate.setDate(glazingStartDate.getDate() + 1);
            
            // Skip Sundays
            while (isWeekend(glazingStartDate)) {
                glazingStartDate.setDate(glazingStartDate.getDate() + 1);
            }
            
            project.phases[glazingPhaseIndex].start = formatDate(glazingStartDate);
        }
    }
    
    // Automatycznie układaj fazy po zmianie  
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex); // ZMIENIONE z 0 na phaseIndex
        
        // DIAGNOSTYKA
        console.log('PO AUTO-ARRANGE - liczba faz:', project.phases.length);
        console.log('PO AUTO-ARRANGE - klucze faz:', project.phases.map(p => p.key));
        
        // CHECK IF AUTO-ARRANGE EXCEEDS DEADLINE
        if (project.deadline) {
            const deadlineDate = new Date(project.deadline);
            let anyPhaseExceedsDeadline = false;
            
            project.phases.forEach(p => {
                const pEnd = computeEnd(p);
                if (pEnd > deadlineDate) {
                    anyPhaseExceedsDeadline = true;
                }
            });
            
            if (anyPhaseExceedsDeadline) {
                alert('Auto-arrange pushed some phases beyond deadline! Please adjust manually.');
            }
        }
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    // Save phases to database if online
    if (typeof supabaseClient !== 'undefined') {
        const tableName = isPipeline ? 'pipeline_projects' : 'projects';
        const { data: projectData } = await supabaseClient
            .from(tableName)
            .select('id')
            .eq('project_number', project.projectNumber)
            .single();
            
        if (projectData) {
            await savePhasesToSupabase(
                projectData.id,
                project.phases,
                !isPipeline  // true = production, false = pipeline
            );
        }
    }
    
    // NATYCHMIAST zamknij modal
    closeModal('phaseEditModal');
    currentEditPhase = null;
    
    // DIAGNOSTYKA
    console.log('PO ZAPISIE - liczba faz:', project.phases.length);
    console.log('PO ZAPISIE - klucze faz:', project.phases.map(p => p.key));
    
    // Renderuj odpowiedni widok - Pipeline lub normalny Gantt
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    // Zapisz dane W TLE (bez czekania)
    saveData().catch(error => {
        console.error('Error saving phase changes:', error);
    });
}

// Open Order Glazing modal
function openOrderGlazingModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set duration field
    document.getElementById('glazingOrderDuration').value = workDays;
    
    // Get glazing materials list
    const glazingList = getGlazingMaterialsList();
    
    // Initialize glazing materials if not exists
    if (!phase.glazingMaterials) {
        phase.glazingMaterials = glazingList.map(mat => ({
            ...mat,
            ordered: false,
            size: ''
        }));
    }
    
    // Render glazing material checklist
    const container = document.getElementById('glazingMaterialsList');
    container.innerHTML = '';
    
    phase.glazingMaterials.forEach((material, index) => {
        const div = document.createElement('div');
        div.className = 'material-item';
        
        let sizeInput = '';
        if (material.hasSize) {
            sizeInput = `
                <input type="text" class="material-size" 
                       placeholder="Size/dimensions..." 
                       value="${material.size || ''}"
                       onchange="updateGlazingSize(${projectIndex}, ${phaseIndex}, ${index}, this.value)"
                       style="width: 120px; padding: 4px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px; font-size: 11px;">
            `;
        }
        
        div.innerHTML = `
            <div class="material-checkbox">
                <input type="checkbox" id="glazing_${index}" 
                       ${material.ordered ? 'checked' : ''}
                       onchange="updateGlazingStatus(${projectIndex}, ${phaseIndex}, ${index})">
                <label for="glazing_${index}">
                    ${material.item}
                    ${material.required ? '<span style="color: #ff4444;">*</span>' : ''}
                </label>
            </div>
            ${sizeInput}
        `;
        container.appendChild(div);
    });
    
    // Update glazing order status
    updateGlazingOrderStatus(projectIndex, phaseIndex);
    
    openModal('orderGlazingModal');
}

// Save Glazing Order duration - FIXED
async function saveGlazingOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('glazingOrderDuration').value);
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    // Automatycznie układaj kolejne fazy
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex);
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
        renderUniversal();
}

// Update glazing material status
function updateGlazingStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`glazing_${materialIndex}`);
    
    phase.glazingMaterials[materialIndex].ordered = checkbox.checked;
    updateGlazingOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Update glazing material size
function updateGlazingSize(projectIndex, phaseIndex, materialIndex, size) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.glazingMaterials[materialIndex].size = size;
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Update glazing order status display
function updateGlazingOrderStatus(projectIndex, phaseIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const allMaterials = phase.glazingMaterials || [];
    const requiredMaterials = allMaterials.filter(m => m.required);
    const orderedRequired = requiredMaterials.filter(m => m.ordered);
    const allOrdered = allMaterials.filter(m => m.ordered);
    
    const statusText = document.getElementById('glazingOrderStatusText');
    const isComplete = requiredMaterials.length === orderedRequired.length && requiredMaterials.length > 0;
    
    // Check if any glass needs size
    const glassNeedsSize = allMaterials.some(m => m.hasSize && m.ordered && !m.size);
    
    let statusHtml = `<strong>Status:</strong> `;
    if (glassNeedsSize) {
        statusHtml += '⚠️ Glass dimensions required';
    } else if (isComplete) {
        statusHtml += '✅ Complete';
    } else {
        statusHtml += '⚠️ Incomplete';
    }
    
    statusHtml += `<br><small>Required: ${orderedRequired.length}/${requiredMaterials.length} | 
        Total: ${allOrdered.length}/${allMaterials.length}</small>`;
    
    statusText.innerHTML = statusHtml;
    
    // Update phase order status
    phase.orderComplete = isComplete && !glassNeedsSize;
}

// Confirm glazing order completion
function confirmGlazingOrderComplete() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Check if glass needs dimensions
    const glassNeedsSize = (phase.glazingMaterials || []).some(m => m.hasSize && m.ordered && !m.size);
    if (glassNeedsSize) {
        alert('Please specify dimensions for all selected glass');
        return;
    }
    
    phase.orderConfirmed = true;
    phase.status = 'completed';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    closeModal('orderGlazingModal');
}

// Open Order Materials modal
function openOrderMaterialsModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set duration field
    document.getElementById('orderDuration').value = workDays;
    
    // Get material list for project type
    const materialList = getMaterialList(project.type);
    
    // Initialize materials if not exists
    if (!phase.materials) {
        phase.materials = materialList.mat(mat => ({
            ...mat,
            ordered: false,
            notes: ''
        }));
    }
    
    // Render material checklist
    const container = document.getElementById('materialsList');
    container.innerHTML = '';
    
    phase.materials.forEach((material, index) => {
        const div = document.createElement('div');
        div.className = 'material-item';
        div.innerHTML = `
            <div class="material-checkbox">
                <input type="checkbox" id="mat_${index}" 
                       ${material.ordered ? 'checked' : ''}
                       onchange="updateMaterialStatus(${projectIndex}, ${phaseIndex}, ${index})">
                <label for="mat_${index}">
                    ${material.item}
                    ${material.required ? '<span style="color: #ff4444;">*</span>' : ''}
                </label>
            </div>
            <input type="text" class="material-note" 
                   placeholder="Notes..." 
                   value="${material.notes || ''}"
                   onchange="updateMaterialNote(${projectIndex}, ${phaseIndex}, ${index}, this.value)"
                   style="width: 150px; padding: 4px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px; font-size: 11px;">
        `;
        container.appendChild(div);
    });
    
    // Add custom materials
    if (phase.customMaterials && phase.customMaterials.length > 0) {
        phase.customMaterials.forEach((material, index) => {
            const div = document.createElement('div');
            div.className = 'material-item';
            div.innerHTML = `
                <div class="material-checkbox">
                    <input type="checkbox" id="custom_${index}" 
                           ${material.ordered ? 'checked' : ''}
                           onchange="updateCustomMaterialStatus(${projectIndex}, ${phaseIndex}, ${index})">
                    <label for="custom_${index}">${material.item}</label>
                </div>
                <button class="action-btn delete" onclick="removeCustomMaterial(${projectIndex}, ${phaseIndex}, ${index})">✕</button>
            `;
            container.appendChild(div);
        });
    }
    
    // Update order status
    updateOrderStatus(projectIndex, phaseIndex);
    
    openModal('orderMaterialsModal');
}

// Save Order duration - FIXED
async function saveOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('orderDuration').value);
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    // Automatycznie układaj kolejne fazy
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex);
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
        renderUniversal();
}

// Open Order Spray Materials modal
function openOrderSprayModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Calculate work days for duration field
    const workDays = phase.workDays || calculateWorkDays(new Date(phase.start), new Date(phase.end));
    
    // Set duration field
    document.getElementById('sprayOrderDuration').value = workDays;
    
    // Get spray materials list
    const sprayList = getSprayMaterialsList();
    
    // Initialize spray materials if not exists
    if (!phase.sprayMaterials) {
        phase.sprayMaterials = sprayList.map(mat => ({
            ...mat,
            ordered: false,
            color: ''
        }));
    }
    
    // Render spray material checklist
    const container = document.getElementById('sprayMaterialsList');
    container.innerHTML = '';
    
    phase.sprayMaterials.forEach((material, index) => {
        const div = document.createElement('div');
        div.className = 'material-item';
        
        let colorInput = '';
        if (material.hasColor) {
            colorInput = `
                <input type="text" class="material-color" 
                       placeholder="RAL code..." 
                       value="${material.color || ''}"
                       onchange="updateSprayColor(${projectIndex}, ${phaseIndex}, ${index}, this.value)"
                       style="width: 100px; padding: 4px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px; font-size: 11px;">
            `;
        }
        
        div.innerHTML = `
            <div class="material-checkbox">
                <input type="checkbox" id="spray_${index}" 
                       ${material.ordered ? 'checked' : ''}
                       onchange="updateSprayStatus(${projectIndex}, ${phaseIndex}, ${index})">
                <label for="spray_${index}">
                    ${material.item}
                    ${material.required ? '<span style="color: #ff4444;">*</span>' : ''}
                </label>
            </div>
            ${colorInput}
        `;
        container.appendChild(div);
    });
    
    // Update spray order status
    updateSprayOrderStatus(projectIndex, phaseIndex);
    
    openModal('orderSprayModal');
}

// Save Spray Order duration - FIXED  
async function saveSprayOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('sprayOrderDuration').value);
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const start = new Date(phase.start);
    const newEnd = addWorkingDays(start, newDuration - 1);
    phase.end = formatDate(newEnd);
    
    // Automatycznie układaj kolejne fazy
    if (typeof autoArrangeFromPhase === 'function') {
        autoArrangeFromPhase(projectIndex, phaseIndex);
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
}

// Update spray material status
function updateSprayStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`spray_${materialIndex}`);
    
    phase.sprayMaterials[materialIndex].ordered = checkbox.checked;
    updateSprayOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Update spray material color
function updateSprayColor(projectIndex, phaseIndex, materialIndex, color) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.sprayMaterials[materialIndex].color = color;
    updateSprayOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Update spray order status display
function updateSprayOrderStatus(projectIndex, phaseIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const allMaterials = phase.sprayMaterials || [];
    const requiredMaterials = allMaterials.filter(m => m.required);
    const orderedRequired = requiredMaterials.filter(m => m.ordered);
    const allOrdered = allMaterials.filter(m => m.ordered);
    
    const statusText = document.getElementById('sprayOrderStatusText');
    const isComplete = requiredMaterials.length === orderedRequired.length && requiredMaterials.length > 0;
    
    // Check if paint is selected and has color
    const paintMaterial = allMaterials.find(m => m.item === 'Paint');
    const paintNeedsColor = paintMaterial && paintMaterial.ordered && !paintMaterial.color;
    
    let statusHtml = `<strong>Status:</strong> `;
    if (paintNeedsColor) {
        statusHtml += '⚠️ Paint color required';
    } else if (isComplete) {
        statusHtml += '✅ Complete';
    } else {
        statusHtml += '⚠️ Incomplete';
    }
    
    statusHtml += `<br><small>Required: ${orderedRequired.length}/${requiredMaterials.length} | 
        Total: ${allOrdered.length}/${allMaterials.length}</small>`;
    
    statusText.innerHTML = statusHtml;
    
    // Update phase order status
    phase.orderComplete = isComplete && !paintNeedsColor;
}

// Confirm spray order completion
function confirmSprayOrderComplete() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    // Check if paint needs color
    const paintMaterial = (phase.sprayMaterials || []).find(m => m.item === 'Paint');
    if (paintMaterial && paintMaterial.ordered && !paintMaterial.color) {
        alert('Please specify paint color (RAL code)');
        return;
    }
    
    phase.orderConfirmed = true;
    phase.status = 'completed';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    closeModal('orderSprayModal');
}

// Update material status
function updateMaterialStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`mat_${materialIndex}`);
    
    phase.materials[materialIndex].ordered = checkbox.checked;
    updateOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Update material note
function updateMaterialNote(projectIndex, phaseIndex, materialIndex, note) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.materials[materialIndex].notes = note;
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Update custom material status
function updateCustomMaterialStatus(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const checkbox = document.getElementById(`custom_${materialIndex}`);
    
    phase.customMaterials[materialIndex].ordered = checkbox.checked;
    updateOrderStatus(projectIndex, phaseIndex);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
}

// Add custom material
function addCustomMaterial() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const itemName = document.getElementById('newMaterialName').value.trim();
    if (!itemName) {
        alert('Please enter material name');
        return;
    }
    
    if (!phase.customMaterials) {
        phase.customMaterials = [];
    }
    
    phase.customMaterials.push({
        item: itemName,
        ordered: false,
        required: false
    });
    
    document.getElementById('newMaterialName').value = '';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    openOrderMaterialsModal(projectIndex, phaseIndex);
}

// Remove custom material
function removeCustomMaterial(projectIndex, phaseIndex, materialIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.customMaterials.splice(materialIndex, 1);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    openOrderMaterialsModal(projectIndex, phaseIndex);
}

// Update order status display
function updateOrderStatus(projectIndex, phaseIndex) {
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const allMaterials = [...(phase.materials || []), ...(phase.customMaterials || [])];
    const requiredMaterials = allMaterials.filter(m => m.required);
    const orderedRequired = requiredMaterials.filter(m => m.ordered);
    const allOrdered = allMaterials.filter(m => m.ordered);
    
    const statusText = document.getElementById('orderStatusText');
    const isComplete = requiredMaterials.length === orderedRequired.length && requiredMaterials.length > 0;
    
    statusText.innerHTML = `
        <strong>Status:</strong> ${isComplete ? '✅ Complete' : '⚠️ Incomplete'}<br>
        <small>Required: ${orderedRequired.length}/${requiredMaterials.length} | 
        Total: ${allOrdered.length}/${allMaterials.length}</small>
    `;
    
    // Update phase order status
    phase.orderComplete = isComplete;
}

// Confirm order completion
function confirmOrderComplete() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    phase.orderConfirmed = true;
    phase.status = 'completed';
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    
    // Renderuj odpowiedni widok
    if (window.location.pathname.includes('pipeline')) {
        renderPipeline();
    } else {
        renderUniversal();
    }
    
    closeModal('orderMaterialsModal');
}

// Open Days Off modal
function openDaysOffModal() {
    updateDaysOffMemberSelect();
    updateDaysOffList();
    openModal('daysOffModal');
}

// Update Days Off member select
function updateDaysOffMemberSelect() {
    const select = document.getElementById('daysOffMemberSelect');
    select.innerHTML = '<option value="">Select member...</option>';
    
    teamMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.name;
        option.textContent = member.name;
        select.appendChild(option);
    });
}

// Mark day off (from Days Off modal)
function markDayOffFromModal() {
    const member = document.getElementById('daysOffMemberSelect').value;
    const date = document.getElementById('daysOffDateInput').value;
    
    if (!member || !date) {
        alert('Please select team member and date');
        return;
    }
    
    const exists = daysOff.some(d => d.member === member && d.date === date);
    if (exists) {
        alert('This day off is already marked');
        return;
    }
    
    daysOff.push({ member, date });
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    updateDaysOffList();
        renderUniversal();
}

// Update Days Off list in modal
function updateDaysOffList() {
    const container = document.getElementById('daysOffListModal');
    container.innerHTML = '';
    
    // Sort by date descending
    const sortedDaysOff = [...daysOff].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sortedDaysOff.length === 0) {
        container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">No days off marked</div>';
        return;
    }
    
    // Group by month
    const grouped = {};
    sortedDaysOff.forEach(dayOff => {
        const date = new Date(dayOff.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(dayOff);
    });
    
    // Display grouped days off
    Object.keys(grouped).sort().reverse().forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const monthDiv = document.createElement('div');
        monthDiv.style.marginBottom = '15px';
        monthDiv.innerHTML = `<div style="color: #007acc; font-weight: bold; margin-bottom: 5px;">${monthName}</div>`;
        
        grouped[monthKey].forEach(dayOff => {
            const dayDiv = document.createElement('div');
            dayDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 5px; border-bottom: 1px solid #3e3e42;';
            
            const date = new Date(dayOff.date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
            
            dayDiv.innerHTML = `
                <span>${dayOff.member}</span>
                <span>${dayName}</span>
                <button class="action-btn delete" onclick="removeDayOff('${dayOff.member}', '${dayOff.date}')">✕</button>
            `;
            monthDiv.appendChild(dayDiv);
        });
        
        container.appendChild(monthDiv);
    });
}

// Remove day off
function removeDayOff(member, date) {
    const index = daysOff.findIndex(d => d.member === member && d.date === date);
    if (index !== -1) {
        daysOff.splice(index, 1);
        
        // MARK AS CHANGED
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
        saveData();
        updateDaysOffList();
        renderUniversal();
    }
}

// Open Move to Archive modal
function openMoveToArchiveModal() {
    const select = document.getElementById('completedProjectSelect');
    select.innerHTML = '<option value="">Select project...</option>';
    
    projects.forEach((project, index) => {
        // Check if all phases are completed
        const allCompleted = project.phases && project.phases.every(phase => 
            phase.status === 'completed' || phase.status === 'dispatched'
        );
        
        if (allCompleted || !project.phases || project.phases.length === 0) {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${project.projectNumber} - ${project.name}`;
            select.appendChild(option);
        }
    });
    
    openModal('moveToArchiveModal');
}

// Confirm move to archive
async function confirmMoveToArchive() {
    const selectedIndex = document.getElementById('completedProjectSelect').value;
    const reason = document.getElementById('archiveReason').value;
    const notes = document.getElementById('archiveNotes').value.trim();
    
    if (!selectedIndex) {
        alert('Please select a project to archive');
        return;
    }
    
    const project = projects[selectedIndex];
    
    // Add to completed archive
    const archivedProject = {
        ...project,
        archivedDate: new Date().toISOString(),
        archiveReason: reason,
        archiveNotes: notes
    };
    
    completedArchive.push(archivedProject);
    
    // Remove from active projects
    projects.splice(selectedIndex, 1);
    
    // Update database if online
    if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
        try {
            // Update project status in database
            await supabaseClient
                .from('projects')
                .update({ 
                    status: 'archived',
                    archived_date: archivedProject.archivedDate,
                    archive_reason: reason,
                    archive_notes: notes
                })
                .eq('project_number', project.projectNumber);
                
            console.log('✅ Project archived in database');
        } catch (err) {
            console.error('Error archiving in database:', err);
        }
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
        renderUniversal();
    closeModal('moveToArchiveModal');
    
    alert(`Project ${project.projectNumber} has been archived successfully!`);
}

// Helper functions for materials
function getMaterialList(projectType) {
    return materialsList[projectType] || materialsList.other;
}

function getGlazingMaterialsList() {
    return glazingMaterialsList || [];
}

function getSprayMaterialsList() {
    return sprayMaterialsList || [];
}

// Generic modal functions - WAŻNE!
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}