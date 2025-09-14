// ========== DRAG & RESIZE ==========
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
}

// NOWA FUNKCJA - automatyczne układanie od danej fazy
function autoArrangeFromPhase(projectIndex, startPhaseIndex) {
    const project = projects[projectIndex];
    const phases = project.phases;
    
    // Sortuj fazy według kolejności
    phases.sort((a, b) => phaseOrder.indexOf(a.key) - phaseOrder.indexOf(b.key));
    
    // Układaj każdą fazę po poprzedniej
    for (let i = 1; i < phases.length; i++) {
        const prevPhase = phases[i - 1];
        const currPhase = phases[i];
        
        // Oblicz koniec poprzedniej fazy
        const prevEnd = computeEnd(prevPhase);
        const currStart = new Date(currPhase.start);
        
        // Jeśli fazy się nakładają lub są w złej kolejności
        if (currStart <= prevEnd) {
            // Przesuń bieżącą fazę za poprzednią
            let nextDay = new Date(prevEnd);
            nextDay.setDate(nextDay.getDate() + 1);
            
            // Pomiń niedziele
            while (isWeekend(nextDay)) {
                nextDay.setDate(nextDay.getDate() + 1);
            }
            
            currPhase.start = formatDate(nextDay);
            
            // workDays pozostaje bez zmian - to ważne!
            // Nie zmieniamy czasu trwania, tylko pozycję
        }
    }
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

function stopDrag(e) {
    if (!draggedElement) return;
    
    const deltaX = e.clientX - startX;
    const hasMovedOrResized = Math.abs(deltaX) > 5; // Tolerance 5px
    
    draggedElement.classList.remove('dragging');
    
    if (hasMovedOrResized) {
        const projectIndex = parseInt(draggedElement.dataset.projectIndex);
        const phaseIndex = parseInt(draggedElement.dataset.phaseIndex);
        const project = projects[projectIndex];
        const phase = project.phases[phaseIndex];
        
        // Zapisz stare wartości na wypadek cofnięcia
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
        
        // SPRAWDŹ CZY NIE PRZEKRACZA DEADLINE
        if (project.deadline) {
            const deadlineDate = new Date(project.deadline);
            const phaseEnd = computeEnd(phase);
            
            if (phaseEnd > deadlineDate) {
                alert('Cannot move/resize phase beyond project deadline!');
                // Przywróć stare wartości
                phase.start = oldStart;
                phase.workDays = oldWorkDays;
                // Nie zapisuj i odśwież
                render();
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
                draggedElement = null;
                draggedPhase = null;
                dragMode = null;
                return;
            }
        }
        
        // Usuń stare adjustedEnd
        delete phase.adjustedEnd;
        
        // Automatycznie układaj kolejne fazy
        autoArrangeFromPhase(projectIndex, 0);
        
        // SPRAWDŹ CZY PO AUTO-ARRANGE FAZY NIE PRZEKRACZAJĄ DEADLINE
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
                alert('Auto-arrange would push phases beyond deadline! Reverting changes.');
                // Przywróć stare wartości
                phase.start = oldStart;
                phase.workDays = oldWorkDays;
                render();
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', stopDrag);
                draggedElement = null;
                draggedPhase = null;
                dragMode = null;
                return;
            }
        }
        
        saveData();
        render();
    }
    
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
    draggedElement = null;
    draggedPhase = null;
    dragMode = null;
}