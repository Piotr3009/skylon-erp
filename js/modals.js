// ========== MODAL MANAGEMENT ==========
let currentEditPhase = null;

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
    
    // Show/hide team assignment section
    const assignSection = document.getElementById('assignSection');
    if (phase.key === 'timber' || phase.key === 'spray' || phase.key === 'glazing') {
        assignSection.style.display = 'block';
        
        // Fill team member select
        const select = document.getElementById('phaseAssignSelect');
        select.innerHTML = '<option value="">None</option>';
        
        teamMembers.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            if (phase.assignedTo === member.id) {
                option.selected = true;
            }
            select.appendChild(option);
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
function deleteCurrentPhase() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = phases[phase.key];
    
    if (confirm(`Delete phase "${phaseConfig.name}" from this project?`)) {
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
        
        saveData();
        render();
        closeModal('phaseEditModal');
        currentEditPhase = null;
    }
}

// Delete Order Phase
function deleteOrderPhase() {
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
        render();
        closeModal('orderMaterialsModal');
        currentEditPhase = null;
    }
}

// Delete Order Spray Phase
function deleteOrderSprayPhase() {
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
        render();
        closeModal('orderSprayModal');
        currentEditPhase = null;
    }
}

// Delete Order Glazing Phase
function deleteOrderGlazingPhase() {
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
        render();
        closeModal('orderGlazingModal');
        currentEditPhase = null;
    }
}

// Save phase changes - FIXED WITH workDays
async function savePhaseChanges() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
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
        
        // Calculate days needed for remaining phases
        let daysNeededForOtherPhases = 0;
        for (let i = phaseIndex + 1; i < project.phases.length; i++) {
            const otherPhase = project.phases[i];
            daysNeededForOtherPhases += otherPhase.workDays || 4; // default 4 days if not set
        }
        
        // Calculate maximum allowed duration for THIS phase
        const totalAvailableDays = workingDaysBetween(start, deadlineDate);
        const maxAllowedDuration = Math.max(1, totalAvailableDays - daysNeededForOtherPhases);
        
        if (newDuration > maxAllowedDuration) {
            alert(`Duration exceeds deadline!\n\nMaximum allowed: ${maxAllowedDuration} days\n` +
                  `(${totalAvailableDays} days to deadline - ${daysNeededForOtherPhases} days for remaining ${project.phases.length - phaseIndex - 1} phases)`);
            return; // NIE ZAPISUJ!
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
    
    // Assign team member (if applicable)
    if (phase.key === 'timber' || phase.key === 'spray' || phase.key === 'glazing') {
        const assignedId = document.getElementById('phaseAssignSelect').value;
        if (assignedId) {
            phase.assignedTo = assignedId;
        } else {
            delete phase.assignedTo;
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
        autoArrangeFromPhase(projectIndex, phaseIndex);
        
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
                // Można tu cofnąć zmiany jeśli chcesz
            }
        }
    }
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    // Save phases to database if online
    if (typeof supabaseClient !== 'undefined') {
        const { data: projectData } = await supabaseClient
            .from('projects')
            .select('id')
            .eq('project_number', project.projectNumber)
            .single();
            
        if (projectData) {
            await savePhasesToSupabase(
                projectData.id,
                project.phases,
                true  // true = production
            );
        }
    }
    
    saveData();
    render();
    closeModal('phaseEditModal');
    currentEditPhase = null;
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
function saveGlazingOrderDuration() {
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
    render();
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
    render();
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
        phase.materials = materialList.map(mat => ({
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
                   onchange="updateMaterialNote(${projectIndex}, ${phaseIndex}, ${index}, this.value)">
        `;
        container.appendChild(div);
    });
    
    // Add custom materials section
    const customMaterials = phase.customMaterials || [];
    if (customMaterials.length > 0) {
        const divider = document.createElement('div');
        divider.style.cssText = 'border-top: 1px solid #3e3e42; margin: 10px 0; padding-top: 10px;';
        divider.innerHTML = '<label style="font-size: 11px; color: #9e9e9e;">Custom Materials:</label>';
        container.appendChild(divider);
        
        customMaterials.forEach((material, index) => {
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
                       placeholder="RAL/Color code..." 
                       value="${material.color || ''}"
                       onchange="updateSprayColor(${projectIndex}, ${phaseIndex}, ${index}, this.value)">
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

// Save Order Materials duration - FIXED
function saveOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('orderDuration').value);
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // CHECK DEADLINE BEFORE SAVING!
    const start = new Date(phase.start);
    
    if (project.deadline) {
        const deadlineDate = new Date(project.deadline);
        
        // Calculate days needed for remaining phases
        let daysNeededForOtherPhases = 0;
        for (let i = phaseIndex + 1; i < project.phases.length; i++) {
            const otherPhase = project.phases[i];
            daysNeededForOtherPhases += otherPhase.workDays || 4;
        }
        
        // Calculate maximum allowed duration
        const totalAvailableDays = workingDaysBetween(start, deadlineDate);
        const maxAllowedDuration = Math.max(1, totalAvailableDays - daysNeededForOtherPhases);
        
        if (newDuration > maxAllowedDuration) {
            alert(`Duration exceeds deadline!\n\nMaximum allowed: ${maxAllowedDuration} days\n` +
                  `(${totalAvailableDays} days to deadline - ${daysNeededForOtherPhases} days for remaining phases)`);
            document.getElementById('orderDuration').value = phase.workDays || 4;
            return;
        }
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const newEnd = addWorkDays(start, newDuration - 1);
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
    render();
}

// Save Spray Order duration - FIXED
function saveSprayOrderDuration() {
    if (!currentEditPhase) return;
    
    const { projectIndex, phaseIndex } = currentEditPhase;
    const project = projects[projectIndex];
    const phase = project.phases[phaseIndex];
    
    const newDuration = parseInt(document.getElementById('sprayOrderDuration').value);
    
    if (newDuration < 1) {
        alert('Duration must be at least 1 day');
        return;
    }
    
    // CHECK DEADLINE BEFORE SAVING!
    const start = new Date(phase.start);
    
    if (project.deadline) {
        const deadlineDate = new Date(project.deadline);
        
        // Calculate days needed for remaining phases
        let daysNeededForOtherPhases = 0;
        for (let i = phaseIndex + 1; i < project.phases.length; i++) {
            const otherPhase = project.phases[i];
            daysNeededForOtherPhases += otherPhase.workDays || 4;
        }
        
        // Calculate maximum allowed duration
        const totalAvailableDays = workingDaysBetween(start, deadlineDate);
        const maxAllowedDuration = Math.max(1, totalAvailableDays - daysNeededForOtherPhases);
        
        if (newDuration > maxAllowedDuration) {
            alert(`Duration exceeds deadline!\n\nMaximum allowed: ${maxAllowedDuration} days\n` +
                  `(${totalAvailableDays} days to deadline - ${daysNeededForOtherPhases} days for remaining phases)`);
            document.getElementById('sprayOrderDuration').value = phase.workDays || 4;
            return;
        }
    }
    
    // SAVE WORKDAYS!
    phase.workDays = newDuration;
    
    // Calculate new end date
    const newEnd = addWorkDays(start, newDuration - 1);
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
    render();
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
    render();
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
    render();
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
    render();
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
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        const monthName = date.toLocaleDateString('en', { month: 'long', year: 'numeric' });
        
        if (!grouped[monthKey]) {
            grouped[monthKey] = { name: monthName, days: [] };
        }
        grouped[monthKey].days.push(dayOff);
    });
    
    Object.values(grouped).forEach(month => {
        const monthDiv = document.createElement('div');
        monthDiv.style.cssText = 'margin-bottom: 15px;';
        monthDiv.innerHTML = `<h4 style="color: #9e9e9e; font-size: 12px; margin-bottom: 5px;">${month.name}</h4>`;
        
        month.days.forEach(dayOff => {
            const div = document.createElement('div');
            div.style.cssText = 'display: flex; justify-content: space-between; padding: 5px; border-bottom: 1px solid #3e3e42;';
            div.innerHTML = `
                <span>${dayOff.member} - ${new Date(dayOff.date).toLocaleDateString()}</span>
                <button class="action-btn delete" onclick="removeDayOff('${dayOff.date}', '${dayOff.member}')" style="width: 20px; height: 20px;">✕</button>
            `;
            monthDiv.appendChild(div);
        });
        
        container.appendChild(monthDiv);
    });
}

// Remove day off
function removeDayOff(date, member) {
    daysOff = daysOff.filter(d => !(d.date === date && d.member === member));
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    updateDaysOffList();
    render();
}



// Open Move to Archive Modal
function openMoveToArchiveModal() {
    updateCompletedProjectSelect();
    openModal('moveToArchiveModal');
}

// Update completed project select
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

// Confirm move to archive
function confirmMoveToArchive() {
    const selectedIndex = document.getElementById('completedProjectSelect').value;
    const reason = document.getElementById('archiveReason').value;
    const notes = document.getElementById('archiveNotes').value.trim();
    
    if (!selectedIndex) {
        alert('Please select a project to archive');
        return;
    }
    
    const projectIndex = parseInt(selectedIndex);
    const project = projects[projectIndex];
    
    // Add to completed archive
    project.archivedDate = new Date().toISOString();
    project.archiveReason = reason;
    if (notes) project.archiveNotes = notes;
    
    if (!completedArchive) completedArchive = [];
    completedArchive.push(project);
    
    // Remove from active projects
    projects.splice(projectIndex, 1);
    
    // MARK AS CHANGED
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
    
    saveData();
    render();
    closeModal('moveToArchiveModal');
    
    alert(`Project archived: ${project.projectNumber}`);
}

// Generic modal functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}