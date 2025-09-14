// ========== PHASE MANAGEMENT ==========
function updatePhasesLegend() {
    const legend = document.getElementById('phasesLegend');
    legend.innerHTML = '';
    
    // ZMIANA 2 - Pokazuj tylko production phases w widoku production
    const phasesToShow = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    const orderToUse = window.location.pathname.includes('pipeline') ? pipelinePhaseOrder : productionPhaseOrder;
    
    // Sortuj fazy według odpowiedniej kolejności
    const sortedPhases = Object.entries(phasesToShow).sort((a, b) => {
        return orderToUse.indexOf(a[0]) - orderToUse.indexOf(b[0]);
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

function openPhaseManager() {
    updateAvailablePhases();
    openModal('phaseModal');
}

function updateAvailablePhases() {
    const container = document.getElementById('availablePhases');
    container.innerHTML = '';
    
    // ZMIANA 2 - Pokazuj tylko odpowiednie fazy w managerze
    const phasesToShow = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    const orderToUse = window.location.pathname.includes('pipeline') ? pipelinePhaseOrder : productionPhaseOrder;
    
    // Sortuj domyślne według kolejności
    const defaultPhases = [];
    const customPhases = [];
    
    Object.entries(phasesToShow).forEach(([key, phase]) => {
        if (orderToUse.includes(key)) {
            defaultPhases.push([key, phase]);
        } else {
            customPhases.push([key, phase]);
        }
    });
    
    // Sortuj domyślne według kolejności
    defaultPhases.sort((a, b) => {
        return orderToUse.indexOf(a[0]) - orderToUse.indexOf(b[0]);
    });
    
    // Połącz listy
    const allPhases = [...defaultPhases, ...customPhases];
    
    allPhases.forEach(([key, phase]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 5px; border-bottom: 1px solid #3e3e42;';
        
        // Lista domyślnych faz
        const isDefault = orderToUse.includes(key);
        
        div.innerHTML = `
            <div class="phase-color" style="background: ${phase.color}; width: 30px; height: 20px; border-radius: 2px;"></div>
            <span style="flex: 1;">${phase.name}</span>
            ${!isDefault ? `<button class="action-btn delete" onclick="removePhase('${key}')">✕</button>` : ''}
        `;
        
        container.appendChild(div);
    });
}

function addCustomPhase() {
    const name = document.getElementById('newPhaseName').value.trim();
    const color = document.getElementById('newPhaseColor').value;
    
    if (!name) {
        alert('Please enter a phase name');
        return;
    }
    
    const key = name.toLowerCase().replace(/\s+/g, '_');
    
    // ZMIANA 2 - Dodaj do odpowiednich faz
    const phasesToUpdate = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    
    if (phasesToUpdate[key]) {
        alert('Phase already exists');
        return;
    }
    
    phasesToUpdate[key] = { name, color };
    phases[key] = { name, color }; // Also add to global phases for compatibility
    
    saveData();
    updatePhasesLegend();
    updateAvailablePhases();
    
    document.getElementById('newPhaseName').value = '';
}

function removePhase(key) {
    const phasesToUpdate = window.location.pathname.includes('pipeline') ? pipelinePhases : productionPhases;
    
    if (confirm('Remove phase "' + phasesToUpdate[key].name + '"?')) {
        delete phasesToUpdate[key];
        delete phases[key];
        
        // Remove from appropriate projects
        const projectsToUpdate = window.location.pathname.includes('pipeline') ? pipelineProjects : projects;
        
        projectsToUpdate.forEach(project => {
            if (project.phases) {
                project.phases = project.phases.filter(p => p.key !== key);
            }
        });
        
        saveData();
        updatePhasesLegend();
        updateAvailablePhases();
        render();
    }
}