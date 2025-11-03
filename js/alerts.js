// ========== OFFICE ALERTS SYSTEM ==========

// Pracownicy administracyjni (hardcoded - można też fetch z Supabase)
const OFFICE_STAFF = [
    { id: '4e2d2ed2-38c0-4597-b5c3-0d34737e9a0b', name: 'Julia Dodzian', role: 'Office Admin' },
    { id: '8b4213b9-1d79-4ecd-902d-e4417c5223e2', name: 'Katarzyna Kowalska', role: 'OM' }
];

// Pobierz aktywne alerty z Supabase
async function loadActiveAlerts() {
    try {
        const { data, error } = await supabase
            .from('project_alerts')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            displayAlerts(data);
        } else {
            hideAlerts();
        }
        
        return data;
    } catch (error) {
        console.error('Error loading alerts:', error);
        return [];
    }
}

// Wyświetl alerty na stronie
function displayAlerts(alerts) {
    const container = document.getElementById('alertsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    alerts.forEach(alert => {
        const alertHTML = createAlertHTML(alert);
        container.insertAdjacentHTML('beforeend', alertHTML);
    });
    
    container.style.display = 'block';
}

// Utwórz HTML dla pojedynczego alertu
function createAlertHTML(alert) {
    const metadata = alert.metadata || {};
    const projectName = metadata.project_name || 'Unknown Project';
    const phaseKey = metadata.phase_key || '';
    const startDate = metadata.start_date || '';
    const endDate = metadata.end_date || '';
    
    // Format daty
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    
    // Nazwa fazy
    const phaseNames = {
        'timber': 'Timber',
        'spray': 'Spray',
        'glazing': 'Glazing',
        'qc': 'QC'
    };
    const phaseName = phaseNames[phaseKey] || phaseKey;
    
    // Dropdown pracowników
    const staffOptions = OFFICE_STAFF.map(staff => 
        `<option value="${staff.id}">${staff.name} (${staff.role})</option>`
    ).join('');
    
    return `
        <div class="alert-banner" data-alert-id="${alert.id}">
            <div class="alert-tape">
                ⚠️ PRODUCTION UPDATED - ACTION REQUIRED ⚠️
            </div>
            <div class="alert-content">
                <div class="alert-project-title">
                    Project: ${alert.project_number} - ${projectName}
                </div>
                
                <div class="alert-phases-list">
                    Production dates changed:
                    <div class="alert-phase-item">
                        • <strong>${phaseName}</strong>: ${formatDate(startDate)} - ${formatDate(endDate)}
                    </div>
                </div>
                
                <div class="alert-deadline">
                    ⏰ Order materials before: <strong>${formatDate(startDate)}</strong>
                </div>
                
                <div class="alert-confirm-section">
                    <label class="alert-confirm-label">Confirmed by:</label>
                    <select class="alert-staff-select" id="staff-${alert.id}">
                        <option value="">Select staff member...</option>
                        ${staffOptions}
                    </select>
                </div>
                
                <div class="alert-actions">
                    <button class="alert-btn alert-btn-dismiss" onclick="dismissAlert('${alert.id}')">
                        Dismiss
                    </button>
                    <button class="alert-btn alert-btn-confirm" onclick="confirmAlert('${alert.id}')">
                        ✓ Confirm Order Completed
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Ukryj kontener alertów
function hideAlerts() {
    const container = document.getElementById('alertsContainer');
    if (container) {
        container.style.display = 'none';
    }
}

// Dismiss alert (usuń bez potwierdzenia)
async function dismissAlert(alertId) {
    try {
        const { error } = await supabase
            .from('project_alerts')
            .update({ 
                status: 'dismissed',
                dismissed_at: new Date().toISOString()
            })
            .eq('id', alertId);
        
        if (error) throw error;
        
        // Usuń alert z UI
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
            alertElement.style.transition = 'opacity 0.3s, transform 0.3s';
            alertElement.style.opacity = '0';
            alertElement.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                alertElement.remove();
                
                // Jeśli nie ma więcej alertów, ukryj kontener
                const container = document.getElementById('alertsContainer');
                if (container && container.children.length === 0) {
                    hideAlerts();
                }
            }, 300);
        }
        
        console.log('Alert dismissed:', alertId);
    } catch (error) {
        console.error('Error dismissing alert:', error);
        alert('Error dismissing alert. Please try again.');
    }
}

// Confirm alert (potwierdź zamówienie materiałów)
async function confirmAlert(alertId) {
    const staffSelect = document.getElementById(`staff-${alertId}`);
    const confirmedBy = staffSelect?.value;
    
    if (!confirmedBy) {
        alert('Please select a staff member who confirmed the order.');
        return;
    }
    
    try {
        // 1. Update alert status
        const { error: alertError } = await supabase
            .from('project_alerts')
            .update({ 
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
                confirmed_by: confirmedBy
            })
            .eq('id', alertId);
        
        if (alertError) throw alertError;
        
        // 2. Get alert data to find project
        const { data: alertData, error: fetchError } = await supabase
            .from('project_alerts')
            .select('project_id, metadata')
            .eq('id', alertId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 3. Update production phases - mark materials as confirmed
        const phaseKey = alertData.metadata?.phase_key;
        
        if (phaseKey) {
            const { error: phaseError } = await supabase
                .from('project_phases')
                .update({
                    materials_ordered_confirmed: true,
                    materials_ordered_confirmed_by: confirmedBy,
                    materials_ordered_confirmed_at: new Date().toISOString()
                })
                .eq('project_id', alertData.project_id)
                .eq('phase_key', phaseKey);
            
            if (phaseError) throw phaseError;
        }
        
        // 4. Usuń alert z UI
        const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
        if (alertElement) {
            alertElement.style.transition = 'opacity 0.3s, transform 0.3s';
            alertElement.style.opacity = '0';
            alertElement.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                alertElement.remove();
                
                const container = document.getElementById('alertsContainer');
                if (container && container.children.length === 0) {
                    hideAlerts();
                }
                
                // Odśwież widok Gantt żeby pokazać badge na fazie
                if (typeof render === 'function') {
                    render();
                }
            }, 300);
        }
        
        console.log('Alert confirmed:', alertId, 'by:', confirmedBy);
    } catch (error) {
        console.error('Error confirming alert:', error);
        alert('Error confirming alert. Please try again.');
    }
}

// Załaduj alerty po załadowaniu strony
document.addEventListener('DOMContentLoaded', () => {
    console.log('Loading office alerts...');
    loadActiveAlerts();
    
    // Odświeżaj alerty co 5 minut
    setInterval(loadActiveAlerts, 5 * 60 * 1000);
});
