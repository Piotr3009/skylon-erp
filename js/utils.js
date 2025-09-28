// ========== UTILITIES ==========

// Uniwersalna funkcja renderująca - wybiera właściwy renderer
function renderUniversal() {
    if (window.location.pathname.includes('pipeline')) {
        if (typeof renderPipeline === 'function') {
            renderPipeline();
        }
    } else {
        if (typeof render === 'function') {
            render();
        }
    }
}

// Deduplikacja faz - usuwa duplikaty na podstawie klucza i daty
function dedupeProjectPhases(phases) {
    if (!Array.isArray(phases)) return phases;
    const seen = new Set();
    return phases.filter(p => {
        // Unikalność fazy: klucz + data startu + status
        const k = p.key;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function shiftWeek(direction) {
    visibleStartDate.setDate(visibleStartDate.getDate() + (7 * direction));
    renderUniversal();
}

function zoomIn() {
    dayWidth = Math.min(72, dayWidth + 5);  // Max 72px (zmniejszone z 80)
    renderUniversal();
}

function zoomOut() {
    dayWidth = Math.max(18, dayWidth - 5);  // Min 18px (zmniejszone z 20)
    renderUniversal();
}

// Reset zoom to 100% (original size)
function zoomReset() {
    dayWidth = 36; // Original default width (zmniejszone z 40)
    renderUniversal();
}

// Count days off between dates for a specific member (BEZ pomijania niedziel)
function countDaysOffBetween(memberName, startDate, endDate) {
    return daysOff.filter(dayOff => {
        if (dayOff.member !== memberName) return false;
        const offDate = new Date(dayOff.date);
        return offDate >= startDate && offDate <= endDate;
    }).length;
}

// Calculate ALL calendar days between dates (BEZ pomijania niedziel)
function calculateWorkDays(startDate, endDate) {
    const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
}

// Check if date is Sunday
function isSunday(date) {
    return date.getDay() === 0;
}

// Get next day (BEZ pomijania niedziel)
function getNextWorkDay(date) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
}

// Add calendar days to date (BEZ pomijania niedziel)
function addWorkDays(startDate, days) {
    const result = new Date(startDate);
    result.setDate(result.getDate() + days);
    return result;
}

// Calculate calendar days (BEZ pomijania niedziel)
function calculateCalendarDaysForWorkDays(startDate, workDays) {
    return workDays; // Prosto zwracamy tę samą liczbę
}

// Adjust end date for team member days off (BEZ pomijania niedziel)
function adjustEndDateForDaysOff(startDate, endDate, memberName) {
    let adjustedEnd = new Date(endDate);
    const daysOffCount = countDaysOffBetween(memberName, startDate, endDate);
    
    if (daysOffCount > 0) {
        // Dodajemy dni wolne bezpośrednio
        adjustedEnd.setDate(adjustedEnd.getDate() + daysOffCount);
    }
    
    return adjustedEnd;
}

// Na samym końcu utils.js
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth()+1}`;
}