// ========== DRAG & RESIZE - NAPRAWIONA WERSJA ==========
// Helper
function daysInclusive(startStr, endStr){const s=new Date(startStr+'T00:00:00');const e=new Date(endStr+'T00:00:00');return Math.max(1,Math.round((e-s)/(1000*60*60*24))+1);}
let dragOriginalDurationDays=null;

// Funkcja do przesuwania kolejnych faz (BEZ pomijania niedziel)
function shiftSuccessors(projectIndex, phaseIndex, deltaDays) {
    if (deltaDays <= 0) return;
    
    const project = projects[projectIndex];
    const phases = project.phases;
    
    // Przesuwamy wszystkie kolejne fazy
    for (let i = phaseIndex + 1; i < phases.length; i++) {
        const phase = phases[i];
        
        // Proste przesunięcie o deltaDays
        const newStart = new Date(phase.start);
        newStart.setDate(newStart.getDate() + deltaDays);
        
        const newEnd = new Date(phase.end);
        newEnd.setDate(newEnd.getDate() + deltaDays);
        
        phase.start = formatDate(newStart);
        phase.end = formatDate(newEnd);
        
        // Jeśli faza ma adjustedEnd (dni wolne pracownika), też przesuwamy
        if (phase.adjustedEnd) {
            const newAdjustedEnd = new Date(phase.adjustedEnd);
            newAdjustedEnd.setDate(newAdjustedEnd.getDate() + deltaDays);
            phase.adjustedEnd = formatDate(newAdjustedEnd);
        }
    }
    
    // Mark as changed for auto-save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
}

// NOWA FUNKCJA - pozwala na maksymalnie 2 nakładające się fazy
function autoArrangeFromPhase(projectIndex, startPhaseIndex) {
    const project = projects[projectIndex];
    const phases = project.phases;
    
    // Sortuj fazy według kolejności
    phases.sort((a, b) => phaseOrder.indexOf(a.key) - phaseOrder.indexOf(b.key));
    
    // NIE robimy automatycznego układania - pozwalamy na nakładanie
    // Walidacja odbędzie się w stopDrag() poprzez checkMaxTwoOverlaps()
    
    // Mark as changed for auto-save
    if (typeof markAsChanged === 'function') {
        markAsChanged();
    }
}

// Nowa funkcja - sprawdza czy więcej niż 2 fazy się nakładają w danym momencie
function checkMaxTwoOverlaps(phases) {
    if (!Array.isArray(phases) || phases.length < 3) return true; // OK jeśli <3 fazy
    
    // Normalizuj fazy z datami
    const normalized = phases.map((p, idx) => ({
        idx,
        key: p.key,
        start: new Date(p.start),
        end: new Date(computeEnd(p))
    })).sort((a, b) => a.start - b.start);
    
    // Sprawdź każdy punkt czasowy czy więcej niż 2 fazy się nakładają
    for (let i = 0; i < normalized.length; i++) {
        const currentPhase = normalized[i];
        
        // Policz ile faz nakłada się z currentPhase
        let overlapCount = 1; // currentPhase się liczy
        
        for (let j = 0; j < normalized.length; j++) {
            if (i === j) continue;
            
            const otherPhase = normalized[j];
            
            // Sprawdź czy fazy się nakładają
            const overlap = !(currentPhase.end < otherPhase.start || currentPhase.start > otherPhase.end);
            
            if (overlap) {
                overlapCount++;
                
                // Jeśli więcej niż 2 fazy się nakładają
                if (overlapCount > 2) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

function startDrag(e, bar, phase, projectIndex, phaseIndex) {
    e.preventDefault();
    draggedElement = bar;
    draggedPhase = phase;
    draggedProject = projectIndex;
    dragMode = 'move';
    startX = e.clientX;
    originalLeft = parseInt(bar.style.left);
    
    bar.classList.add('dragging');
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function startResize(e, bar, phase, side) {
    const phaseOriginalEnd = phase.adjustedEnd || phase.end;
    e.preventDefault();
    e.stopPropagation();
    draggedElement = bar;
    draggedPhase = phase;
    dragMode = side === 'left' ? 'resize-left' : 'resize-right';
    startX = e.clientX;
    originalLeft = parseInt(bar.style.left);
    originalWidth = parseInt(bar.style.width);
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function handleDrag(e) {
    if (!draggedElement) return;
    
    const deltaX = e.clientX - startX;
    
    if (dragMode === 'move') {
        const newLeft = Math.max(0, originalLeft + deltaX);
        const snappedLeft = Math.round(newLeft / dayWidth) * dayWidth;
        draggedElement.style.left = snappedLeft + 'px';
    } else if (dragMode === 'resize-left') {
        const newLeft = Math.max(0, originalLeft + deltaX);
        const newWidth = Math.max(dayWidth, originalWidth - deltaX);
        const snappedLeft = Math.round(newLeft / dayWidth) * dayWidth;
        draggedElement.style.left = snappedLeft + 'px';
        draggedElement.style.width = (originalWidth + originalLeft - snappedLeft) + 'px';
    } else if (dragMode === 'resize-right') {
        const newWidth = Math.max(dayWidth, originalWidth + deltaX);
        const snappedWidth = Math.round(newWidth / dayWidth) * dayWidth;
        draggedElement.style.width = snappedWidth + 'px';
    }
}

async function stopDrag(e) {
    if (!draggedElement) return;
    
    const deltaX = e.clientX - startX;
    const hasMovedOrResized = Math.abs(deltaX) > 5; // Tolerance 5px
    
    draggedElement.classList.remove('dragging');
    
    if (hasMovedOrResized) {
        const projectIndex = parseInt(draggedElement.dataset.projectIndex);
        const phaseIndex = parseInt(draggedElement.dataset.phaseIndex);
        const project = projects[projectIndex];
        const phase = project.phases[phaseIndex];
        
        // Zapisz WSZYSTKIE stare fazy przed jakimikolwiek zmianami
        const oldPhases = JSON.parse(JSON.stringify(project.phases));
        const oldStart = phase.start;
        const oldWorkDays = phase.workDays;
        
        const left = parseInt(draggedElement.style.left);
        const width = parseInt(draggedElement.style.width);
        
        if (dragMode === 'move') {
            // PRZESUWANIE - zmienia tylko start, workDays zostaje
            const startDays = Math.round(left / dayWidth);
            const newStart = new Date(visibleStartDate);
            newStart.setDate(newStart.getDate() + startDays);
            
            // Snap do poniedziałku jeśli niedziela
            while (isWeekend(newStart)) {
                newStart.setDate(newStart.getDate() + 1);
            }
            
            phase.start = formatDate(newStart);
            // NIE zmieniamy workDays!
            
        } else if (dragMode === 'resize-left' || dragMode === 'resize-right') {
            // ROZCIĄGANIE - zmienia workDays
            const startDays = Math.round(left / dayWidth);
            const calendarDays = Math.round(width / dayWidth);
            
            const newStart = new Date(visibleStartDate);
            newStart.setDate(newStart.getDate() + startDays);
            
            const tentativeEnd = new Date(newStart);
            tentativeEnd.setDate(tentativeEnd.getDate() + calendarDays - 1);
            
            // Wylicz nowe workDays
            const newWorkDays = workingDaysBetween(newStart, tentativeEnd);
            
            phase.start = formatDate(newStart);
            phase.workDays = Math.max(1, newWorkDays);
        }
        
        // Usuń stare adjustedEnd
        delete phase.adjustedEnd;
        
        // KROK 1: Układaj wszystkie fazy żeby nie było nakładania
        autoArrangeFromPhase(projectIndex, 0);
        
        // KROK 1.5: Sprawdź czy nie ma więcej niż 2 nakładających się faz
        if (!checkMaxTwoOverlaps(project.phases)) {
            alert('Cannot move/resize: More than 2 phases would overlap at the same time!');
            
            // Przywróć oryginalne fazy
            project.phases = oldPhases;
            
            // Czyść handlery
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            draggedElement = null;
            draggedPhase = null;
            dragMode = null;
            
            // Odśwież
            render();
            return;
        }
        
        // KROK 2: Sprawdź czy cokolwiek przekracza deadline
        let exceedsDeadline = false;
        if (project.deadline) {
            const deadlineDate = new Date(project.deadline);
            
            project.phases.forEach(p => {
                const pEnd = computeEnd(p);
                if (pEnd > deadlineDate) {
                    exceedsDeadline = true;
                }
            });
        }
        
        // KROK 3: Jeśli przekracza deadline, cofnij WSZYSTKO
        if (exceedsDeadline) {
            // Różne komunikaty dla różnych sytuacji
            const phaseEnd = computeEnd(phase);
            const deadlineDate = new Date(project.deadline);
            
            if (phaseEnd > deadlineDate) {
                alert('Cannot move/resize phase beyond project deadline!');
            } else {
                alert('This change would push other phases beyond the deadline!');
            }
            
            // Przywróć WSZYSTKIE oryginalne fazy
            project.phases = oldPhases;
            
            // Czyść handlery
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            draggedElement = null;
            draggedPhase = null;
            dragMode = null;
            
            // Odśwież
            render();
            return;
        }
        
        // KROK 4: Jeśli wszystko OK, zapisz
        // Mark as changed for auto-save
        if (typeof markAsChanged === 'function') {
            markAsChanged();
        }
        
        // ZAPISZ FAZY DO SUPABASE
        if (typeof supabaseClient !== 'undefined' && project.projectNumber) {
            try {
                // Pobierz project.id z bazy
                const { data: projectData, error: fetchError } = await supabaseClient
                    .from('projects')
                    .select('id')
                    .eq('project_number', project.projectNumber)
                    .single();
                
                if (!fetchError && projectData) {
                    await savePhasesToSupabase(projectData.id, project.phases, true);
                } else {
                    console.warn('⚠️ Could not find project in database:', project.projectNumber);
                }
            } catch (err) {
                console.error('Error saving phases to Supabase:', err);
            }
        }
        
        saveData();
        render();
    }
    
    // Czyść handlery na końcu
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    draggedElement = null;
    draggedPhase = null;
    dragMode = null;
}