// ========== PIPELINE RENDERING ==========
function renderPipeline() {
    renderPipelineTimeline();
    renderPipelineProjects();
    renderPipelineGridPattern();
    renderTodayLine();
}

// Grid pattern and green stripes for Sundays (pipeline version)
function renderPipelineGridPattern() {
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
            background: rgba(255,255,255,0.05);
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
                background: rgba(7, 79, 138, 0.1);
                pointer-events: none;
                z-index: 1;
                border-left: 1px solid rgba(41, 15, 173, 0.2);
                border-right: 1px solid rgba(41, 15, 173, 0.2);
            `;
            document.querySelector('.chart-wrapper').appendChild(stripe);
        }
    }
}

function renderPipelineTimeline() {
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
            border-right: 1px solid #354339;
            box-sizing: border-box;
            flex-shrink: 0;
        `;
        
        // SUNDAY - add style (no class!)
        if (date.getDay() === 0) {
            cell.style.backgroundColor = 'rgba(7, 79, 138, 0.1)';
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

function renderPipelineProjects() {
    const body = document.getElementById('chartBody');
    body.innerHTML = '';
    
    pipelineProjects.forEach((project, index) => {
        // DEDUPLIKACJA FAZ - usuń duplikaty przed renderowaniem
        project.phases = dedupeProjectPhases(project.phases);
        
        // DIAGNOSTYKA - sprawdź czy są duplikaty faz
        if (project.phases) {
            const phaseKeys = project.phases.map(p => p.key);
            const uniqueKeys = [...new Set(phaseKeys)];
            if (phaseKeys.length !== uniqueKeys.length) {
                console.error(`DUPLIKATY FAZ w projekcie ${project.name}:`, phaseKeys);
            }
        }
        
        const row = document.createElement('div');
        row.className = 'project-row';
        
        const projectCell = document.createElement('div');
        projectCell.className = 'project-cell';
        
        const projectType = projectTypes[project.type] || projectTypes.other;
        
        projectCell.innerHTML = `
            <div class="project-column project-number" onclick="editPipelineProjectNumber(${index})" title="Click to edit number">
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
            <div class="project-column project-actions">
                <button class="action-btn" onclick="editPipelineProject(${index})" title="Edit">✏️</button>
                <button class="action-btn delete" onclick="deletePipelineProject(${index})" title="Delete">✕</button>
            </div>
        `;
        
        const timelineCell = document.createElement('div');
        timelineCell.className = 'timeline-cell';
        timelineCell.style.width = (daysToShow * dayWidth) + 'px';
        timelineCell.style.minWidth = (daysToShow * dayWidth) + 'px';
        
        if (project.phases) {
            const sortedPhases = [...project.phases].sort((a, b) => {
                return pipelinePhaseOrder.indexOf(a.key) - pipelinePhaseOrder.indexOf(b.key);
            });
            
            const overlaps = detectPipelinePhaseOverlaps(sortedPhases);
            
            sortedPhases.forEach((phase, sortedIndex) => {
                const originalIndex = project.phases.findIndex(p => p === phase);
                const phaseBar = createPipelinePhaseBar(phase, project, index, originalIndex, overlaps);
                if (phaseBar) timelineCell.appendChild(phaseBar);
            });
        }
        
        row.appendChild(projectCell);
        row.appendChild(timelineCell);
        body.appendChild(row);
    });
}

function detectPipelinePhaseOverlaps(phases) {
    const overlaps = [];
    if (!Array.isArray(phases) || phases.length < 2) return overlaps;

    const norm = phases.map((p, idx) => ({
        idx,
        key: p.key,
        start: new Date(p.start),
        end: new Date(p.adjustedEnd || p.end)
    })).sort((a,b) => a.start - b.start);

    for (let i = 0; i < norm.length; i++) {
        for (let j = i + 1; j < norm.length; j++) {
            const A = norm[i], B = norm[j];
            if (B.start >= A.end) break;
            const overlapStart = new Date(Math.max(A.start, B.start));
            const overlapEnd = new Date(Math.min(A.end, B.end));
            if (overlapEnd > overlapStart) {
                overlaps.push({ 
                    phase1Key: phases[A.idx].key, 
                    phase2Key: phases[B.idx].key, 
                    phase1Idx: A.idx,
                    phase2Idx: B.idx,
                    overlapStart, overlapEnd 
                });
            }
        }
    }
    return overlaps;
}

function createPipelinePhaseBar(phase, project, projectIndex, phaseIndex, overlaps) {
    const container = document.createElement('div');
    const phaseConfig = pipelinePhases[phase.key];
    if (!phaseConfig) return null;
    
    container.className = 'phase-container';
    
    const start = new Date(phase.start);
    const end = computeEnd(phase);
    
    let adjustedEnd = new Date(end);
    
    const daysDiff = Math.round((start - visibleStartDate) / (1000 * 60 * 60 * 24));
    const duration = Math.round((adjustedEnd - start) / (1000 * 60 * 60 * 24)) + 1;
    
    const workDays = phase.workDays || workingDaysBetween(start, adjustedEnd);
    const displayDays = workDays;
    
    container.style.left = (daysDiff * dayWidth) + 'px';
    container.style.width = (duration * dayWidth) + 'px';
    container.style.borderColor = phaseConfig.color;
    
    // Top part - colored
    const topDiv = document.createElement('div');
    topDiv.className = 'phase-top';
    
    const overlap = overlaps.find(o => 
        o.phase1Key === phase.key || o.phase2Key === phase.key
    );
    
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

        topDiv.style.background = phaseConfig.color;

        if (overlayWidth > 0) {
            const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
            const otherColor = pipelinePhases[otherKey]?.color || '#888';
            const overlay = document.createElement('div');
            overlay.className = 'dual-overlay';
            overlay.style.left = overlayLeft + 'px';
            overlay.style.width = overlayWidth + 'px';
            overlay.style.background = `linear-gradient(90deg, ${phaseConfig.color} 0 50%, ${otherColor} 50% 100%)`;
            container.appendChild(overlay);
        }
    } else {
        topDiv.style.background = phaseConfig.color;
    }
    
    topDiv.innerHTML = `<span>${phaseConfig.name}</span>`;
    
    // Bottom part
    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'phase-bottom';
    
    const status = phaseStatuses[phase.status || 'notStarted'];
    let bottomContent = `<span class="phase-status-icon" title="${status.name}">${status.icon}</span>`;
    bottomContent += `<span class="phase-days-info">(${displayDays} days)</span>`;
    
    if (phase.notes) {
        bottomContent += `<span class="phase-note-icon" title="Has notes">📝</span>`;
    }
    
    bottomDiv.innerHTML = bottomContent;
    
    container.appendChild(topDiv);
    container.appendChild(bottomDiv);
    
    container.dataset.projectIndex = projectIndex;
    container.dataset.phaseIndex = phaseIndex;
    
    const endDateStr = formatDate(end);
    let tooltipText = `${phaseConfig.name}: ${phase.start} to ${endDateStr} (${displayDays} work days)`;
    tooltipText += `\nStatus: ${status.name}`;
    if (phase.notes) tooltipText += `\nNotes: ${phase.notes.substring(0, 50)}...`;
    if (overlap) {
        const otherKey = (overlap.phase1Key === phase.key) ? overlap.phase2Key : overlap.phase1Key;
        tooltipText += `\n⚠️ Overlapping with ${pipelinePhases[otherKey]?.name || 'phase'}`;
    }
    
    container.title = tooltipText;
    
    container.ondblclick = (e) => {
        e.stopPropagation();
        openPipelinePhaseEditModal(projectIndex, phaseIndex);
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
        startDrag(e, container, phase, projectIndex, phaseIndex);
    };
    
    return container;
}

function editPipelineProjectNumber(index) {
    const project = pipelineProjects[index];
    const currentNumber = project.projectNumber || '';
    const newNumber = prompt('Edit pipeline number:', currentNumber);
    
    if (newNumber !== null && newNumber !== currentNumber) {
        project.projectNumber = newNumber;
        saveData();
        renderPipeline();
    }
}

// Open phase edit modal for pipeline phases
function openPipelinePhaseEditModal(projectIndex, phaseIndex) {
    currentEditPhase = { projectIndex, phaseIndex };
    const project = pipelineProjects[projectIndex];
    const phase = project.phases[phaseIndex];
    const phaseConfig = pipelinePhases[phase.key];
    
    // Calculate work days
    const start = new Date(phase.start);
    const end = new Date(phase.end);
    const workDays = calculateWorkDays(start, end);
    
    // Set modal title
    document.getElementById('phaseEditTitle').textContent = `Edit ${phaseConfig.name}`;
    
    // Fill fields
    document.getElementById('phaseDuration').value = workDays;
    document.getElementById('phaseNotes').value = phase.notes || '';
    
    // Set phase status
    const statusSelect = document.getElementById('phaseStatus');
    statusSelect.value = phase.status || 'notStarted';
    
    // Pipeline phases don't have team assignment
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

// ADD MISSING renderTodayLine function
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

// ADD MISSING workingDaysBetween function
function workingDaysBetween(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
        if (current.getDay() !== 0) { // nie niedziela
            count++;
        }
        current.setDate(current.getDate() + 1);
    }
    return count;
}
// Nadpisz funkcję shiftWeek dla Pipeline
window.shiftWeek = function(direction) {
    visibleStartDate.setDate(visibleStartDate.getDate() + (7 * direction));
    renderPipeline();
}