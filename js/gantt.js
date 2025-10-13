// Minimal CSS injection for dual-overlay
(function ensureDualOverlayCSS(){
    if (document.getElementById('dual-overlay-style')) return;
    const style = document.createElement('style');
    style.id = 'dual-overlay-style';
    style.textContent = `
        .phase-container{position:absolute}
        .phase-container .dual-overlay{pointer-events:none}
        .timeline-header {
            overflow: visible !important;
            min-width: max-content !important;
        }
    `;
    document.head.appendChild(style);
})();
// ========== SORTOWANIE ========== 
function setSortMode(mode) {
    currentSortMode = mode;
    localStorage.setItem('joinerySortMode', mode);
    
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.sort-btn[data-sort="${mode}"]`)?.classList.add('active');
    
    render();
}

function getSortedProjects() {
    let sortedProjects = [...projects];
    
    if (currentSortMode === 'deadline') {
        sortedProjects.sort((a, b) => {
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
        });
    } else if (currentSortMode === 'timber') {
        sortedProjects.sort((a, b) => {
            const timberA = a.phases?.find(p => p.key === 'timber');
            const timberB = b.phases?.find(p => p.key === 'timber');
            
            if (!timberA || !timberA.start) return 1;
            if (!timberB || !timberB.start) return -1;
            
            return new Date(timberA.start) - new Date(timberB.start);
        });
    } else if (currentSortMode === 'spray') {
        sortedProjects.sort((a, b) => {
            const sprayA = a.phases?.find(p => p.key === 'spray');
            const sprayB = b.phases?.find(p => p.key === 'spray');
            
            if (!sprayA || !sprayA.start) return 1;
            if (!sprayB || !sprayB.start) return -1;
            
            return new Date(sprayA.start) - new Date(sprayB.start);
        });
    } else {
        // Default: by number
        sortedProjects.sort((a, b) => {
            const numA = parseInt(a.projectNumber.split('/')[0]);
            const numB = parseInt(b.projectNumber.split('/')[0]);
            return numA - numB;
        });
    }
    
    return sortedProjects;
}


// ========== RENDERING ==========
function render() {
    renderTimeline();
    renderProjects();
    renderGridPattern();
    renderTodayLine();
}

function renderTimeline() {
    const header = document.getElementById('timelineHeader');
    if (!header) {
        console.error('Timeline header not found!');
        return;
    }
    
    // Clear header
    header.innerHTML = '';
    
    const grid = document.createElement('div');
    grid.className = 'timeline-grid';
    grid.style.cssText = `
        display: flex;
        height: 100%;
        position: relative;
        width: ${daysToShow * dayWidth}px;
        min-width: ${daysToShow * dayWidth}px;
    `;
    
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        // Basic styles for each cell
        cell.style.cssText = `
            width: ${dayWidth}px;
            min-width: ${dayWidth}px;
            max-width: ${dayWidth}px;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-right: 1px solid #3e3e42;
            box-sizing: border-box;
            flex-shrink: 0;
        `;
        
        // SUNDAY - add class
        if (date.getDay() === 0) {
            cell.className += ' day-cell-sunday';
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.style.cssText = `
            font-size: 14px;
            font-weight: ${date.getDay() === 0 ? 'bold' : 'normal'};
        `;
        dayNumber.textContent = date.getDate();
        
        // Month
        const dayMonth = document.createElement('div');
        dayMonth.style.cssText = `
            font-size: 10px;
            color: #9e9e9e;
        `;
        dayMonth.textContent = date.toLocaleDateString('en', {month: 'short'});
        
        cell.appendChild(dayNumber);
        cell.appendChild(dayMonth);
        grid.appendChild(cell);
    }
    
    header.appendChild(grid);
    
    // Sync width with timeline cells
    const timelineCells = document.querySelectorAll('.timeline-cell');
    timelineCells.forEach(cell => {
        cell.style.width = (daysToShow * dayWidth) + 'px';
        cell.style.minWidth = (daysToShow * dayWidth) + 'px';
    });
}

// Grid pattern and green stripes for Sundays
function renderGridPattern() {
    document.querySelectorAll('.grid-line').forEach(el => el.remove());
    document.querySelectorAll('.sunday-stripe').forEach(el => el.remove());
    
    // Vertical grid lines
    for (let i = 0; i <= daysToShow; i++) {
        const line = document.createElement('div');
        line.className = 'grid-line';
        line.style.cssText = `
            position: absolute;
            left: ${400 + i * dayWidth}px;
            top: 50px;
            bottom: 0;
            width: 1px;
            background: rgba(255,255,255,0.03);
            pointer-events: none;
            z-index: 0;
        `;
        document.querySelector('.chart-wrapper').appendChild(line);
    }
    
    // GREEN STRIPES FOR SUNDAYS
    for (let i = 0; i < daysToShow; i++) {
        const date = new Date(visibleStartDate);
        date.setDate(date.getDate() + i);
        
        if (date.getDay() === 0) {  // Sunday
            const stripe = document.createElement('div');
            stripe.className = 'sunday-stripe';
            stripe.style.cssText = `
                position: absolute;
                left: ${400 + i * dayWidth}px;
                top: 45px;
                bottom: 0;
                width: ${dayWidth}px;
                background: rgba(0, 255, 0, 0.05);
                pointer-events: none;
                z-index: 1;
                border-left: 1px solid rgba(0, 255, 0, 0.2);
                border-right: 1px solid rgba(0, 255, 0, 0.2);
            `;
            document.querySelector('.chart-wrapper').appendChild(stripe);
        }
    }
}

function renderProjects() {
    const body = document.getElementById('chartBody');
    
    // DIAGNOSTYKA - monitoruj liczbę faz
    const totalPhases = projects.reduce((sum, p) => sum + (p.phases?.length || 0), 0);
    
    body.innerHTML = '';
    
    // NOWE - sortowanie
    const sortedProjects = getSortedProjects();
    
    sortedProjects.forEach((project, sortIndex) => {
        // DIAGNOSTYKA - sprawdź czy są duplikaty faz
        if (project.phases) {
            const phaseKeys = project.phases.map(p => p.key);
            const uniqueKeys = [...new Set(phaseKeys)];
            if (phaseKeys.length !== uniqueKeys.length) {
                console.error(`DUPLIKATY FAZ w projekcie ${project.name}:`, phaseKeys);
            }
        }
        
        // WAŻNE - znajdź oryginalny indeks
        const index = projects.indexOf(project);
        const row = document.createElement('div');
        row.className = 'project-row';
        
        const projectCell = document.createElement('div');
        projectCell.className = 'project-cell';
        
        const projectType = projectTypes[project.type] || projectTypes.other;
        
        // ZMIANA: Dodałem przycisk Google Drive
        projectCell.innerHTML = `
            <div class="project-column project-number" onclick="editProjectNumber(${index})" title="Click to edit number">
                ${project.projectNumber || '---'}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-type" title="${projectType.name}">
                ${projectType.icon}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-name" title="${project.name}">
                ${project.name}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-deadline" onclick="editProjectDeadline(${index})" title="Click to edit deadline">
                ${project.deadline ? formatDateShort(project.deadline) : '---'}
            </div>
            <div class="project-column-divider"></div>
            <div class="project-column project-actions">
                <button class="action-btn" onclick="editProject(${index})" title="Edit">✏️</button>
                ${project.google_drive_url ? 
                    `<a href="${project.google_drive_url}" target="_blank" class="action-btn gdrive" title="Open in Google Drive">📁</a>` :
                    `<button class="action-btn gdrive-add" onclick="openGoogleDrivePicker(projects[${index}])" title="Add Google Drive link">➕</button>`
                }
                <button class="action-btn delete" onclick="deleteProject(${index})" title="Delete">✕</button>
            </div>
        `;
        
        const timelineCell = document.createElement('div');
        timelineCell.className = 'timeline-cell';
        timelineCell.style.width = (daysToShow * dayWidth) + 'px';
        timelineCell.style.minWidth = (daysToShow * dayWidth) + 'px';
        
        if (project.phases) {
            const sortedPhases = [...project.phases].sort((a, b) => {
                return productionPhaseOrder.indexOf(a.key) - productionPhaseOrder.indexOf(b.key);
            });
            
            
            const overlaps = detectPhaseOverlaps(sortedPhases);
            
            let renderedCount = 0;
            sortedPhases.forEach((phase, sortedIndex) => {
                const originalIndex = project.phases.findIndex(p => p === phase);
                const phaseBar = createPhaseBar(phase, project, index, originalIndex, overlaps);
                if (phaseBar) {
                    timelineCell.appendChild(phaseBar);
                    renderedCount++;
                } else {
                    console.error(`❌ Faza ${phase.key} NIE utworzona dla projektu "${project.name}"`);
                }
            });
        }
        
        // Renderuj deadline
        if (project.deadline) {
            renderDeadlineCell(project, timelineCell);
        }

        row.appendChild(projectCell);
        row.appendChild(timelineCell);
        body.appendChild(row);
    });
}

function detectPhaseOverlaps(phases) {
    console.log('🔍 detectPhaseOverlaps START');
    const overlaps = [];
    if (!Array.isArray(phases) || phases.length < 2) {
        console.log('❌ Less than 2 phases, no overlaps possible');
        return overlaps;
    }

    const norm = phases.map((p, idx) => ({
        idx,
        key: p.key,
        start: new Date(p.start),
        end: new Date(p.adjustedEnd || p.end)
    })).sort((a,b) => a.start - b.start);

    console.log('📋 Normalized phases:', norm.map(n => `${n.key}: ${n.start.toISOString().split('T')[0]} - ${n.end.toISOString().split('T')[0]}`));

    for (let i = 0; i < norm.length; i++) {
        for (let j = i + 1; j < norm.length; j++) {
            const A = norm[i], B = norm[j];
            
            console.log(`Checking: ${A.key} vs ${B.key}`);
            console.log(`  A: ${A.start.toISOString().split('T')[0]} - ${A.end.toISOString().split('T')[0]}`);
            console.log(`  B: ${B.start.toISOString().split('T')[0]} - ${B.end.toISOString().split('T')[0]}`);
            
            // B starts AFTER A ends - no overlap possible
            if (B.start > A.end) {
                console.log(`  ❌ B starts after A ends - no overlap`);
                break;
            }
            
            const overlapStart = new Date(Math.max(A.start, B.start));
            const overlapEnd = new Date(Math.min(A.end, B.end));
            
            console.log(`  Overlap range: ${overlapStart.toISOString().split('T')[0]} - ${overlapEnd.toISOString().split('T')[0]}`);
            
            if (overlapEnd >= overlapStart) {
                console.log(`  ✅ OVERLAP DETECTED`);
                overlaps.push({ 
                    phase1Key: phases[A.idx].key, 
                    phase2Key: phases[B.idx].key, 
                    phase1Idx: A.idx,
                    phase2Idx: B.idx,
                    overlapStart, 
                    overlapEnd
                });
            } else {
                console.log(`  ❌ NO OVERLAP`);
            }
        }
    }
    
    console.log('🔍 detectPhaseOverlaps RESULT:', overlaps.length, 'overlaps');
    return overlaps;
}

function createPhaseBar(phase, project, projectIndex, phaseIndex, overlaps) {
    const container = document.createElement('div');
    let phaseConfig = productionPhases[phase.key];
    
    if (!phaseConfig) {
        console.warn(`⚠️ Nieznana faza "${phase.key}" w projekcie ${project.name}. Używam domyślnej konfiguracji.`);
        // Fallback dla nieznanych faz
        phaseConfig = {
            name: phase.key.replace(/([A-Z])/g, ' $1').trim(), // camelCase na spacje
            color: '#808080' // szary kolor dla nieznanych
        };
    }
    
   // Zawsze szukaj w teamMembers po ID
   const teamMember = phase.assignedTo ? 
       teamMembers.find(m => m.id === phase.assignedTo) : null;
    
    container.className = 'phase-container';
    
    // Check if should flash
    if ((phase.key === 'order' || phase.key === 'orderSpray' || phase.key === 'orderGlazing') && !phase.orderConfirmed) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const phaseEnd = new Date(phase.end);
        const daysDiff = Math.round((phaseEnd - today) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1 && daysDiff >= 0) {
            container.classList.add('flashing');
        }
    }
    
    const start = new Date(phase.start);
    
    // DIAGNOSTYKA DAT
    if (isNaN(start.getTime())) {
        console.error(`❌ Błędna data start dla fazy ${phase.key}: "${phase.start}"`);
        return null;
    }
    
    // NEW - use computeEnd instead of phase.end
    const end = computeEnd(phase);
    
    let adjustedEnd = new Date(end);
    if (teamMember) {
        const daysOffCount = countDaysOffBetween(teamMember.name, start, end);
        if (daysOffCount > 0) {
            adjustedEnd.setDate(adjustedEnd.getDate() + daysOffCount);
            phase.adjustedEnd = formatDate(adjustedEnd);
        }
    }
    
    const daysDiff = Math.round((start - visibleStartDate) / (1000 * 60 * 60 * 24));
    const duration = Math.round((adjustedEnd - start) / (1000 * 60 * 60 * 24)) + 1;
    
    // NEW - calculate WORKING days for display
    const workDays = phase.workDays || workingDaysBetween(start, adjustedEnd);
    const displayDays = workDays; // Display WORKING days, not calendar days
    
    container.style.left = (daysDiff * dayWidth) + 'px';
    container.style.width = (duration * dayWidth) + 'px';
    container.style.borderColor = phaseConfig.color;
    
    // DIAGNOSTYKA
    if (daysDiff < -10 || daysDiff > 200) {
        console.warn(`⚠️ Faza "${phase.key}" poza widocznym obszarem! Left: ${daysDiff * dayWidth}px, Projekt: ${project.name}`);
    }
    if (duration <= 0) {
        console.error(`❌ Faza "${phase.key}" ma zerową szerokość! Duration: ${duration}, Projekt: ${project.name}`);
    }
    
    // Top part - colored
    const topDiv = document.createElement('div');
    topDiv.className = 'phase-top';
    
    const overlap = overlaps.find(o => 
        o.phase1Key === phase.key || o.phase2Key === phase.key
    );
    
    // PROSTA LOGIKA: 
    // - Górna połowa (topDiv) = kolor fazy (zawsze)
    // - Dolna połowa (bottomDiv background) = kolor pracownika
    // - Overlap = dodatkowy layer NA GÓRZE topDiv
    
    topDiv.style.background = phaseConfig.color;
    
    topDiv.innerHTML = `<span>${phaseConfig.name}</span>`;
    
    // Bottom part
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'phase-bottom';
    
    // Jeśli jest pracownik - dolna część ma border w jego kolorze (przezroczyste tło)
    if (teamMember) {
        bottomDiv.style.borderTop = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.borderBottom = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.borderLeft = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.borderRight = `2px solid ${teamMember.color_code || teamMember.color}`;
        bottomDiv.style.background = 'transparent';
    }
    
    const status = phaseStatuses[phase.status || 'notStarted'];
    let bottomContent = `<span class="phase-status-icon" title="${status.name}">${status.icon}</span>`;
    bottomContent += `<span class="phase-days-info">(${displayDays} days)</span>`;
    
    // ADD CARPENTER NAME
    if (teamMember) {
        bottomContent += `<span style="font-size: 9px; color: ${teamMember.color_code || teamMember.color}; margin-left: 4px; font-weight: bold;">${teamMember.name}</span>`;
    }
    
    if (phase.notes) {
        bottomContent += `<span class="phase-note-icon" title="Has notes">📝</span>`;
    }
    
    if (phase.key === 'order' || phase.key === 'orderSpray' || phase.key === 'orderGlazing') {
        if (phase.orderConfirmed) {
            bottomContent += '<span class="phase-order-icon" title="Order confirmed">📦✅</span>';
        } else if (phase.orderComplete) {
            bottomContent += '<span class="phase-order-icon" title="Order complete, not confirmed">📦⚠️</span>';
        } else {
            bottomContent += '<span class="phase-order-icon" title="Order incomplete">📦❌</span>';
        }
    }
    
    bottomDiv.innerHTML = bottomContent;
    
    container.appendChild(topDiv);
    container.appendChild(bottomDiv);
    
    // OVERLAP: Nakładka zakrywa CAŁĄ wysokość (50px) w obszarze overlap
    if (overlap) {
        const sPhase = new Date(phase.start);
        const ePhase = new Date(phase.adjustedEnd || phase.end);
        const sOverlap = overlap.overlapStart;
        const eOverlap = overlap.overlapEnd;

        const dayMs = 1000 * 60 * 60 * 24;
        const widthPx = parseInt(container.style.width);

        const fromStartDays = Math.max(0, Math.round((sOverlap - sPhase) / dayMs));
        const overlapDays = Math.max(0, Math.round((eOverlap - sOverlap) / dayMs) + 1);

        const overlayLeft = Math.min(widthPx, fromStartDays * dayWidth);
        const overlayWidth = Math.max(0, Math.min(widthPx - overlayLeft, overlapDays * dayWidth));

        const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
        const otherColor = productionPhases[otherKey]?.color || '#888';
        
        if (overlayWidth > 0) {
            // Nakładka GÓRA-DÓŁ 50/50 - zakrywa całą wysokość (50px)
            const overlapOverlay = document.createElement('div');
            overlapOverlay.className = 'overlap-stripe';
            overlapOverlay.style.cssText = `
                position: absolute;
                left: ${overlayLeft}px;
                width: ${overlayWidth}px;
                top: 0;
                height: 50px;
                background: linear-gradient(to bottom, ${phaseConfig.color} 50%, ${otherColor} 50%);
                pointer-events: none;
                z-index: 3;
                border-radius: 2px;
            `;
            container.appendChild(overlapOverlay);
        }
    }
    
    container.dataset.projectIndex = projectIndex;
    container.dataset.phaseIndex = phaseIndex;
    
    if (teamMember) {
        renderDaysOffOnBar(container, teamMember.name, start, adjustedEnd);
    }
    
    const endDateStr = phase.adjustedEnd || formatDate(end);
    let tooltipText = `${phaseConfig.name}: ${phase.start} to ${endDateStr} (${displayDays} work days)`;
    tooltipText += `\nStatus: ${status.name}`;
    if (teamMember) tooltipText += `\nAssigned to: ${teamMember.name}`;
    if (phase.notes) tooltipText += `\nNotes: ${phase.notes.substring(0, 50)}...`;
    if (overlap) {
        const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
        tooltipText += `\n⚠️ Overlapping with ${productionPhases[otherKey]?.name || 'phase'}`;
    }
    
    container.title = tooltipText;
    
    container.ondblclick = (e) => {
        e.stopPropagation();
        openPhaseEditModal(projectIndex, phaseIndex);
    };
    
    const leftHandle = document.createElement('div');
    leftHandle.className = 'resize-handle resize-handle-left';
    leftHandle.onmousedown = (e) => startResize(e, container, phase, 'left');
    
    const rightHandle = document.createElement('div');
    rightHandle.className = 'resize-handle resize-handle-right';
    rightHandle.onmousedown = (e) => startResize(e, container, phase, 'right');
    
    container.appendChild(leftHandle);
    container.appendChild(rightHandle);
    
    container.onmousedown = (e) => {
        if (e.target.classList.contains('resize-handle')) return;
        if (e.target.classList.contains('phase-status-icon')) return;
        if (e.target.classList.contains('phase-note-icon')) return;
        if (e.target.classList.contains('phase-order-icon')) return;
        startDrag(e, container, phase, projectIndex, phaseIndex);
    };
    
    return container;
}

function renderDaysOffOnBar(bar, memberName, startDate, endDate) {
    const markersContainer = document.createElement('div');
    markersContainer.className = 'days-off-markers';
    
    daysOff.forEach(dayOff => {
        if (dayOff.member !== memberName) return;
        
        const offDate = new Date(dayOff.date);
        if (offDate >= startDate && offDate <= endDate) {
            const daysDiff = Math.round((offDate - startDate) / (1000 * 60 * 60 * 24));
            const xPosition = daysDiff * dayWidth;
            
            const marker = document.createElement('div');
            marker.className = 'day-off-x';
            marker.style.left = xPosition + 'px';
            marker.innerHTML = '✕';
            marker.title = `${memberName} - Day off ${dayOff.date}`;
            
            markersContainer.appendChild(marker);
        }
    });
    
    bar.appendChild(markersContainer);
}

function renderTodayLine() {
    const existing = document.querySelector('.today-line');
    if (existing) existing.remove();
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const daysDiff = Math.round((today - visibleStartDate) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 0 && daysDiff < daysToShow) {
        const line = document.createElement('div');
        line.className = 'today-line';
        line.style.cssText = `
            position: absolute;
            left: ${400 + daysDiff * dayWidth}px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #007acc;
            pointer-events: none;
            z-index: 5;
        `;
        document.querySelector('.chart-wrapper').appendChild(line);
    }
}

function editProjectNumber(index) {
    const project = projects[index];
    const currentNumber = project.projectNumber || '';
    const newNumber = prompt('Edit project number:', currentNumber);
    
    if (newNumber !== null && newNumber !== currentNumber) {
        project.projectNumber = newNumber;
        saveData();
        render();
    }
}

function editProjectDeadline(index) {
    const project = projects[index];
    
    // Utwórz tymczasowy modal dla deadline
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="width: 300px;">
            <div class="modal-header">Set Project Deadline</div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Deadline Date</label>
                    <input type="date" id="tempDeadlineInput" value="${project.deadline || ''}" style="width: 100%; padding: 8px; background: #3e3e42; border: 1px solid #555; color: #e8e2d5; border-radius: 3px;">
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="modal-btn primary" onclick="saveDeadlineFromModal(${index})">Save</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus na input
    setTimeout(() => {
        document.getElementById('tempDeadlineInput').focus();
    }, 100);
}

function saveDeadlineFromModal(index) {
    const newDeadline = document.getElementById('tempDeadlineInput').value;
    const modal = document.querySelector('.modal.active');
    
    if (newDeadline) {
        const project = projects[index];
        const today = new Date();
        today.setHours(0,0,0,0);
        const deadlineDate = new Date(newDeadline);
        
        // Sprawdź czy deadline nie jest w przeszłości
        if (deadlineDate < today) {
            alert('Deadline cannot be in the past!');
            return;
        }
        
        // Oblicz dostępne dni robocze
        const availableWorkDays = workingDaysBetween(today, deadlineDate);
        const phasesCount = project.phases ? project.phases.length : 0;
        
        // Sprawdź minimalne wymagania
        if (phasesCount > 0 && availableWorkDays < phasesCount) {
            alert(`Deadline too short! Need at least ${phasesCount} working days for ${phasesCount} phases.`);
            return;
        }
        
        // Zapisz deadline
        project.deadline = newDeadline;
        
      
        
        saveData();
        render();
    }
    
    modal.remove();
}

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

function renderDeadlineCell(project, timelineCell) {
    if (!project.deadline) return;
    
    const deadlineDate = new Date(project.deadline);
    const daysDiff = Math.round((deadlineDate - visibleStartDate) / (1000 * 60 * 60 * 24));
    
    // Tylko jeśli deadline jest w widocznym zakresie
    if (daysDiff >= 0 && daysDiff < daysToShow) {
        const deadlineCell = document.createElement('div');
        deadlineCell.className = 'deadline-cell';
        deadlineCell.style.cssText = `
            position: absolute;
            left: ${daysDiff * dayWidth}px;
            top: 2px;
            width: ${dayWidth}px;
            height: 50px;
            background: #8B0000;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border-radius: 3px;
            z-index: 4;
            cursor: pointer;
            border: 1px solid #5B0000;
        `;
        deadlineCell.innerHTML = 'DL';
        deadlineCell.title = `Deadline: ${project.deadline}`;
        
        timelineCell.appendChild(deadlineCell);
    }
}

// NOWA FUNKCJA: Dodaj/Edytuj link Google Drive
async function addGoogleDriveLink(projectIndex) {
    const project = projects[projectIndex];
    const currentUrl = project.google_drive_url || '';
    
    const newUrl = prompt('Enter Google Drive folder URL:', currentUrl);
    
    if (newUrl !== null && newUrl !== currentUrl) {
        // Validate URL
        if (newUrl && !newUrl.includes('drive.google.com')) {
            alert('Please enter a valid Google Drive URL');
            return;
        }
        
        // Update local data
        project.google_drive_url = newUrl;
        
        // Save to Supabase if connected
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            try {
                const { error } = await supabaseClient
                    .from('projects')
                    .update({ google_drive_url: newUrl })
                    .eq('project_number', project.projectNumber);
                
                if (error) {
                    console.error('Error updating Google Drive URL:', error);
                    alert('Error saving to database. URL saved locally only.');
                } else {
                }
            } catch (err) {
                console.error('Database connection error:', err);
            }
        }
        
        // Update local storage and refresh
        saveData();
        render();
    }
}
// Wczytaj zapisane sortowanie przy starcie
window.addEventListener('DOMContentLoaded', function() {
    const savedSort = localStorage.getItem('joinerySortMode') || 'number';
    currentSortMode = savedSort;

    // Zaznacz aktywny przycisk po załadowaniu
    setTimeout(() => {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.sort-btn[data-sort="${savedSort}"]`)?.classList.add('active');
    }, 100);
});