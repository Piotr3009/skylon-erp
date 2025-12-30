// ========================================
// TODAY - Daily Briefing
// ========================================

// supabaseClient is already declared in config.js

// Global data
let todayData = {
    production: [],
    spraying: [],
    meetings: [],
    holidays: [],
    stock: [],
    fleet: [],
    officeDaily: [],  // Daily office phases + alerts
    pipeline: [],     // Monday only - pipeline review
    weekDeadlines: [],
    events: []
};

// Date helpers
const today = new Date();
const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday...
const isMonday = dayOfWeek === 1;
const isThursday = dayOfWeek === 4;
const isFriday = dayOfWeek === 5;

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Format date for display
function formatDateFull(date) {
    return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

// Format date for DB queries (YYYY-MM-DD)
function formatDateDB(date) {
    return date.toISOString().split('T')[0];
}

// Get week boundaries (Mon-Sat)
function getWeekBounds() {
    const start = new Date(today);
    const diff = today.getDay() === 0 ? -6 : 1 - today.getDay(); // Monday
    start.setDate(today.getDate() + diff);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 5); // Saturday
    
    return { start, end };
}

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', async () => {
    // Set today's date
    document.getElementById('todayDate').textContent = formatDateFull(today);
    
    // Load all data
    await loadAllData();
    
    // Render sections
    renderAll();
    
    // Show grid, hide loading
    document.getElementById('todayLoading').style.display = 'none';
    document.getElementById('todayGrid').style.display = 'grid';
    
    // Show Monday-only section
    if (isMonday) {
        document.getElementById('sectionPipelineWrapper').style.display = 'block';
    }
});

// ========== DATA LOADING ==========
async function loadAllData() {
    const todayStr = formatDateDB(today);
    const tomorrowStr = formatDateDB(new Date(today.getTime() + 24*60*60*1000));
    const weekBounds = getWeekBounds();
    const weekStartStr = formatDateDB(weekBounds.start);
    const weekEndStr = formatDateDB(weekBounds.end);
    const sevenDaysLater = formatDateDB(new Date(today.getTime() + 7*24*60*60*1000));
    
    try {
        // 1. Load team members
        const { data: teamMembers } = await supabaseClient
            .from('team_members')
            .select('id, name, role')
            .eq('active', true);
        
        const workerMap = {};
        teamMembers?.forEach(m => workerMap[m.id] = m.name);
        
        // 2. Load production phases (today's work) - simplified query
        const { data: productionPhases } = await supabaseClient
            .from('project_phases')
            .select('*')
            .or(`and(start_date.lte.${todayStr},end_date.gte.${todayStr}),start_date.eq.${tomorrowStr}`)
            .neq('status', 'Completed');
        
        // Load projects separately (use status='active' not stage='production')
        const { data: productionProjects } = await supabaseClient
            .from('projects')
            .select('id, project_number, name, deadline')
            .eq('status', 'active');
        
        const projectMap = {};
        productionProjects?.forEach(p => projectMap[p.id] = p);
        
        // Process production - separate joinery and spraying
        if (productionPhases) {
            productionPhases.forEach(phase => {
                const project = projectMap[phase.project_id];
                if (!project) return; // Skip if project not in production
                
                const isSpray = phase.phase_key?.toLowerCase().includes('spray') || 
                               phase.phase_name?.toLowerCase().includes('spray');
                
                const item = {
                    projectNumber: project.project_number,
                    projectName: project.name,
                    phaseName: phase.phase_name || phase.phase_key,
                    worker: workerMap[phase.assigned_to] || 'Unassigned',
                    workerId: phase.assigned_to,
                    startDate: phase.start_date,
                    endDate: phase.end_date,
                    isDeadlineToday: phase.end_date === todayStr,
                    startsTomorrow: phase.start_date === tomorrowStr
                };
                
                if (isSpray) {
                    todayData.spraying.push(item);
                } else {
                    todayData.production.push(item);
                }
            });
        }
        
        // 3. Load recurring events for today
        const { data: events } = await supabaseClient
            .from('today_events')
            .select('*')
            .eq('active', true);
        
        if (events) {
            const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;
            todayData.events = events.filter(e => 
                e.day_of_week === dayOfWeek || 
                (e.show_day_before && e.day_of_week === tomorrowDayOfWeek)
            ).map(e => ({
                ...e,
                isReminder: e.day_of_week !== dayOfWeek
            }));
        }
        
        // 4. Load holidays today (using correct column names: date_from, date_to)
        const { data: holidays } = await supabaseClient
            .from('employee_holidays')
            .select(`
                id, date_from, date_to,
                team_members(name)
            `)
            .lte('date_from', todayStr)
            .gte('date_to', todayStr);
        
        if (holidays) {
            todayData.holidays = holidays.map(h => ({
                name: h.team_members?.name || 'Unknown',
                startDate: h.date_from,
                endDate: h.date_to
            }));
        }
        
        // 5. Load stock alerts (negative quantity)
        const { data: stockItems } = await supabaseClient
            .from('stock_items')
            .select('*');
        
        if (stockItems) {
            stockItems.forEach(item => {
                const available = (item.current_quantity || 0) - (item.reserved_quantity || 0);
                if (available < 0) {
                    todayData.stock.push({
                        name: item.name,
                        available: available,
                        unit: item.unit,
                        type: 'negative'
                    });
                } else if (isMonday && item.min_quantity && available <= item.min_quantity) {
                    todayData.stock.push({
                        name: item.name,
                        available: available,
                        minQuantity: item.min_quantity,
                        unit: item.unit,
                        type: 'low'
                    });
                }
            });
        }
        
        // 6. Load fleet alerts (MOT, Insurance within 7 days) - correct column names
        const { data: vans } = await supabaseClient
            .from('vans')
            .select('*');
        
        if (vans) {
            vans.forEach(van => {
                // MOT - use mot_due_date
                if (van.mot_due_date && van.mot_due_date <= sevenDaysLater && van.mot_due_date >= todayStr) {
                    const daysUntil = Math.ceil((new Date(van.mot_due_date) - today) / (24*60*60*1000));
                    todayData.fleet.push({
                        type: 'MOT',
                        vehicle: `${van.registration || ''} (${van.make || ''} ${van.model || ''})`.trim(),
                        dueDate: van.mot_due_date,
                        daysUntil: daysUntil
                    });
                }
                // Insurance - use insurance_due_date
                if (van.insurance_due_date && van.insurance_due_date <= sevenDaysLater && van.insurance_due_date >= todayStr) {
                    const daysUntil = Math.ceil((new Date(van.insurance_due_date) - today) / (24*60*60*1000));
                    todayData.fleet.push({
                        type: 'Insurance',
                        vehicle: `${van.registration || ''} (${van.make || ''} ${van.model || ''})`.trim(),
                        dueDate: van.insurance_due_date,
                        daysUntil: daysUntil
                    });
                }
            });
        }
        
        // 7. Load machine service alerts (next_service_date is from machine_service_history)
        const { data: machines } = await supabaseClient
            .from('machines')
            .select('*');
        
        // Load service history to get next_service_date
        const { data: serviceHistory } = await supabaseClient
            .from('machine_service_history')
            .select('machine_id, next_service_date')
            .order('service_date', { ascending: false });
        
        // Map next_service_date to machines
        const serviceMap = {};
        serviceHistory?.forEach(s => {
            if (!serviceMap[s.machine_id] && s.next_service_date) {
                serviceMap[s.machine_id] = s.next_service_date;
            }
        });
        
        if (machines) {
            machines.forEach(m => {
                const nextService = serviceMap[m.id];
                if (nextService && nextService <= sevenDaysLater && nextService >= todayStr) {
                    const daysUntil = Math.ceil((new Date(nextService) - today) / (24*60*60*1000));
                    todayData.fleet.push({
                        type: 'Service',
                        vehicle: m.name,
                        dueDate: nextService,
                        daysUntil: daysUntil
                    });
                }
            });
        }
        
        // 8. DAILY - Office phases (order, office type) active today + alerts
        // Load office phases from production projects
        if (productionPhases) {
            productionPhases.forEach(phase => {
                const project = projectMap[phase.project_id];
                if (!project) return;
                
                const isOffice = phase.phase_key?.toLowerCase().includes('order') || 
                                phase.phase_key?.toLowerCase().includes('office') ||
                                phase.phase_name?.toLowerCase().includes('order') ||
                                phase.phase_name?.toLowerCase().includes('office');
                
                if (isOffice) {
                    todayData.officeDaily.push({
                        type: 'phase',
                        projectNumber: project.project_number,
                        projectName: project.name,
                        phaseName: phase.phase_name || phase.phase_key,
                        worker: workerMap[phase.assigned_to] || 'Unassigned',
                        startDate: phase.start_date,
                        endDate: phase.end_date,
                        isDeadlineToday: phase.end_date === todayStr
                    });
                }
            });
        }
        
        // Load active alerts
        const { data: alerts } = await supabaseClient
            .from('project_alerts')
            .select('*')
            .eq('status', 'active');
        
        if (alerts && alerts.length > 0) {
            // Get project info for alerts
            const alertProjectIds = [...new Set(alerts.map(a => a.project_id).filter(Boolean))];
            let alertProjects = {};
            
            if (alertProjectIds.length > 0) {
                const { data: projData } = await supabaseClient
                    .from('projects')
                    .select('id, project_number, name')
                    .in('id', alertProjectIds);
                
                projData?.forEach(p => alertProjects[p.id] = p);
            }
            
            alerts.forEach(alert => {
                const proj = alertProjects[alert.project_id];
                todayData.officeDaily.push({
                    type: 'alert',
                    alertType: alert.alert_type,
                    message: alert.message,
                    projectNumber: proj?.project_number || '',
                    projectName: proj?.name || '',
                    createdAt: alert.created_at
                });
            });
        }
        
        // 9. Monday only - Pipeline projects > 8 weeks
        if (isMonday) {
            const eightWeeksAgo = new Date(today.getTime() - 8*7*24*60*60*1000);
            const { data: pipelineOld } = await supabaseClient
                .from('pipeline_projects')
                .select('id, project_number, name, created_at')
                .lte('created_at', eightWeeksAgo.toISOString());
            
            if (pipelineOld) {
                pipelineOld.forEach(p => {
                    const weeks = Math.floor((today - new Date(p.created_at)) / (7*24*60*60*1000));
                    todayData.pipeline.push({
                        type: 'pipeline_old',
                        projectNumber: p.project_number,
                        projectName: p.name,
                        weeks: weeks
                    });
                });
            }
            
            // Unassigned phases this week
            const { data: unassignedPhases } = await supabaseClient
                .from('project_phases')
                .select('*')
                .is('assigned_to', null)
                .gte('start_date', todayStr)
                .lte('start_date', weekEndStr);
            
            if (unassignedPhases && productionProjects) {
                unassignedPhases.forEach(p => {
                    const project = projectMap[p.project_id];
                    if (!project) return;
                    
                    todayData.pipeline.push({
                        type: 'unassigned',
                        projectNumber: project.project_number,
                        projectName: project.name,
                        phaseName: p.phase_name || p.phase_key,
                        startDate: p.start_date
                    });
                });
            }
        }
        
        // 10. This week deadlines (use status='active')
        if (productionProjects) {
            todayData.weekDeadlines = productionProjects
                .filter(p => p.deadline && p.deadline >= todayStr && p.deadline <= weekEndStr)
                .sort((a, b) => a.deadline.localeCompare(b.deadline))
                .map(p => ({
                    projectNumber: p.project_number,
                    projectName: p.name,
                    deadline: p.deadline,
                    isToday: p.deadline === todayStr
                }));
        }
        
    } catch (err) {
        console.error('Error loading today data:', err);
        showToast('Error loading data: ' + err.message, 'error');
    }
}

// ========== RENDERING ==========
function renderAll() {
    renderProduction();
    renderSpraying();
    renderMeetings();
    renderHolidays();
    renderStock();
    renderFleet();
    renderOfficeDaily();
    renderPipeline();
    renderWeekDeadlines();
}

function renderProduction() {
    const container = document.getElementById('sectionProduction');
    const badge = document.getElementById('badgeProduction');
    
    if (todayData.production.length === 0) {
        container.innerHTML = '<div class="today-empty">No production tasks today</div>';
        badge.textContent = '0';
        return;
    }
    
    // Group by worker
    const byWorker = {};
    todayData.production.forEach(item => {
        if (!byWorker[item.worker]) byWorker[item.worker] = [];
        byWorker[item.worker].push(item);
    });
    
    let html = '';
    Object.keys(byWorker).sort().forEach(worker => {
        html += `<div class="today-worker">
            <div class="today-worker-name">👤 ${worker}</div>
            <div class="today-worker-tasks">`;
        
        byWorker[worker].forEach(task => {
            let classes = 'today-task';
            let prefix = '';
            if (task.isDeadlineToday) {
                classes += ' deadline-today';
                prefix = '🔴 DEADLINE TODAY - ';
            } else if (task.startsTomorrow) {
                classes += ' starts-tomorrow';
                prefix = '🟢 Starts tomorrow - ';
            }
            
            html += `<div class="${classes}">
                ${prefix}<strong>${task.projectNumber}</strong> ${task.projectName}
                <span style="color: #888; font-size: 12px;"> - ${task.phaseName}</span>
            </div>`;
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    badge.textContent = todayData.production.length;
}

function renderSpraying() {
    const container = document.getElementById('sectionSpraying');
    const badge = document.getElementById('badgeSpraying');
    
    if (todayData.spraying.length === 0) {
        container.innerHTML = '<div class="today-empty">No spraying tasks today</div>';
        badge.textContent = '0';
        return;
    }
    
    // Group by worker
    const byWorker = {};
    todayData.spraying.forEach(item => {
        if (!byWorker[item.worker]) byWorker[item.worker] = [];
        byWorker[item.worker].push(item);
    });
    
    let html = '';
    Object.keys(byWorker).sort().forEach(worker => {
        html += `<div class="today-worker">
            <div class="today-worker-name">👤 ${worker}</div>
            <div class="today-worker-tasks">`;
        
        byWorker[worker].forEach(task => {
            let classes = 'today-task';
            let prefix = '';
            if (task.isDeadlineToday) {
                classes += ' deadline-today';
                prefix = '🔴 DEADLINE TODAY - ';
            }
            
            html += `<div class="${classes}">
                ${prefix}<strong>${task.projectNumber}</strong> ${task.projectName}
                <span style="color: #888; font-size: 12px;"> - ${task.phaseName}</span>
            </div>`;
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html;
    badge.textContent = todayData.spraying.length;
}

function renderMeetings() {
    const container = document.getElementById('sectionMeetings');
    
    if (todayData.events.length === 0) {
        container.innerHTML = '<div class="today-empty">No meetings or reminders today</div>';
        return;
    }
    
    let html = '';
    todayData.events.forEach(event => {
        const timeStr = event.time ? `<strong>${event.time}</strong> - ` : '';
        const reminderBadge = event.isReminder ? '<span style="background: #f59e0b; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 8px;">TOMORROW</span>' : '';
        
        html += `<div class="today-item ${event.isReminder ? 'warning' : 'info'}">
            <div class="today-item-title">${timeStr}${event.title}${reminderBadge}</div>
            ${event.description ? `<div class="today-item-subtitle">${event.description}</div>` : ''}
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderHolidays() {
    const container = document.getElementById('sectionHolidays');
    
    if (todayData.holidays.length === 0) {
        container.innerHTML = '<div class="today-empty">Everyone is working today ✓</div>';
        return;
    }
    
    let html = '';
    todayData.holidays.forEach(h => {
        html += `<div class="today-item warning">
            <div class="today-item-title">🏖️ ${h.name}</div>
            <div class="today-item-subtitle">Off until ${new Date(h.endDate).toLocaleDateString('en-GB')}</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderStock() {
    const container = document.getElementById('sectionStock');
    const badge = document.getElementById('badgeStock');
    
    const negative = todayData.stock.filter(s => s.type === 'negative');
    const low = todayData.stock.filter(s => s.type === 'low');
    
    if (todayData.stock.length === 0) {
        container.innerHTML = '<div class="today-empty">Stock levels OK ✓</div>';
        badge.style.display = 'none';
        return;
    }
    
    let html = '';
    
    if (negative.length > 0) {
        html += `<div class="today-item urgent">
            <div class="today-item-title">🔴 ${negative.length} items NEGATIVE</div>
            <div class="today-item-subtitle">Check urgent orders needed!</div>
            <div class="today-item-meta">${negative.map(s => s.name).join(', ')}</div>
        </div>`;
        badge.textContent = negative.length;
        badge.style.display = 'inline';
    }
    
    if (low.length > 0 && isMonday) {
        html += `<div class="today-item warning">
            <div class="today-item-title">⚠️ ${low.length} items LOW STOCK</div>
            <div class="today-item-meta">${low.map(s => s.name).join(', ')}</div>
        </div>`;
    }
    
    container.innerHTML = html;
}

function renderFleet() {
    const container = document.getElementById('sectionFleet');
    
    if (todayData.fleet.length === 0) {
        container.innerHTML = '<div class="today-empty">No alerts ✓</div>';
        return;
    }
    
    let html = '';
    todayData.fleet.sort((a, b) => a.daysUntil - b.daysUntil).forEach(item => {
        const urgentClass = item.daysUntil <= 3 ? 'urgent' : 'warning';
        const icon = item.type === 'MOT' ? '🔧' : item.type === 'Insurance' ? '📋' : '⚙️';
        
        html += `<div class="today-item ${urgentClass}">
            <div class="today-item-title">${icon} ${item.type} - ${item.vehicle}</div>
            <div class="today-item-subtitle">Due in ${item.daysUntil} day${item.daysUntil !== 1 ? 's' : ''} (${new Date(item.dueDate).toLocaleDateString('en-GB')})</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

function renderOfficeDaily() {
    const container = document.getElementById('sectionOfficeDaily');
    const badge = document.getElementById('badgeOfficeDaily');
    
    if (todayData.officeDaily.length === 0) {
        container.innerHTML = '<div class="today-empty">No office tasks today ✓</div>';
        badge.textContent = '0';
        badge.style.display = 'none';
        return;
    }
    
    badge.textContent = todayData.officeDaily.length;
    badge.style.display = 'inline';
    
    let html = '';
    
    // Office phases
    const phases = todayData.officeDaily.filter(o => o.type === 'phase');
    if (phases.length > 0) {
        html += '<div style="margin-bottom: 15px;"><strong style="color: #f97316;">📋 Office Tasks:</strong></div>';
        phases.forEach(p => {
            const urgentClass = p.isDeadlineToday ? 'urgent' : '';
            const prefix = p.isDeadlineToday ? '🔴 DEADLINE - ' : '';
            html += `<div class="today-item ${urgentClass}">
                <div class="today-item-title">${prefix}<strong>${p.projectNumber}</strong> - ${p.phaseName}</div>
                <div class="today-item-subtitle">${p.projectName} • ${p.worker}</div>
            </div>`;
        });
    }
    
    // Alerts
    const alerts = todayData.officeDaily.filter(o => o.type === 'alert');
    if (alerts.length > 0) {
        html += '<div style="margin-bottom: 15px; margin-top: 20px;"><strong style="color: #ef4444;">🔔 Active Alerts:</strong></div>';
        alerts.forEach(a => {
            html += `<div class="today-item warning">
                <div class="today-item-title">${a.projectNumber ? `<strong>${a.projectNumber}</strong> - ` : ''}${a.alertType || 'Alert'}</div>
                <div class="today-item-subtitle">${a.message || a.projectName}</div>
            </div>`;
        });
    }
    
    container.innerHTML = html;
}

function renderPipeline() {
    const container = document.getElementById('sectionPipeline');
    
    if (!isMonday || todayData.pipeline.length === 0) {
        container.innerHTML = '<div class="today-empty">No items to review ✓</div>';
        return;
    }
    
    let html = '';
    
    // Pipeline old
    const pipelineOld = todayData.pipeline.filter(o => o.type === 'pipeline_old');
    if (pipelineOld.length > 0) {
        html += '<div style="margin-bottom: 15px;"><strong style="color: #f59e0b;">📋 Pipeline - Too Long:</strong></div>';
        pipelineOld.forEach(p => {
            html += `<div class="today-item warning">
                <div class="today-item-title">${p.projectNumber} - ${p.projectName}</div>
                <div class="today-item-subtitle">${p.weeks} weeks in pipeline - Contact client or archive?</div>
            </div>`;
        });
    }
    
    // Unassigned
    const unassigned = todayData.pipeline.filter(o => o.type === 'unassigned');
    if (unassigned.length > 0) {
        html += '<div style="margin-bottom: 15px; margin-top: 20px;"><strong style="color: #4a9eff;">👤 Unassigned Phases This Week:</strong></div>';
        unassigned.forEach(p => {
            html += `<div class="today-item info">
                <div class="today-item-title">${p.projectNumber} - ${p.phaseName}</div>
                <div class="today-item-subtitle">Starts ${new Date(p.startDate).toLocaleDateString('en-GB')}</div>
            </div>`;
        });
    }
    
    container.innerHTML = html;
}

function renderWeekDeadlines() {
    const container = document.getElementById('sectionWeek');
    
    if (todayData.weekDeadlines.length === 0) {
        container.innerHTML = '<div class="today-empty">No deadlines this week ✓</div>';
        return;
    }
    
    let html = '';
    todayData.weekDeadlines.forEach(p => {
        const dateObj = new Date(p.deadline);
        const dayName = dayNames[dateObj.getDay()].substring(0, 3);
        const dateStr = dateObj.toLocaleDateString('en-GB');
        
        html += `<div class="today-item ${p.isToday ? 'urgent' : ''}">
            <div class="today-item-title">${p.isToday ? '🔴 TODAY - ' : ''}${dayName} ${dateStr}</div>
            <div class="today-item-subtitle"><strong>${p.projectNumber}</strong> - ${p.projectName}</div>
        </div>`;
    });
    
    container.innerHTML = html;
}

// ========== MANAGE EVENTS ==========
function openManageEvents() {
    loadEventsList();
    document.getElementById('manageEventsModal').classList.add('active');
}

function closeManageEvents() {
    document.getElementById('manageEventsModal').classList.remove('active');
}

async function loadEventsList() {
    const container = document.getElementById('eventsList');
    
    try {
        const { data: events, error } = await supabaseClient
            .from('today_events')
            .select('*')
            .order('day_of_week')
            .order('time');
        
        if (error) throw error;
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No recurring events yet</div>';
            return;
        }
        
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        html += `<thead>
            <tr style="border-bottom: 1px solid #3e3e42;">
                <th style="text-align: left; padding: 8px; color: #888;">Day</th>
                <th style="text-align: left; padding: 8px; color: #888;">Time</th>
                <th style="text-align: left; padding: 8px; color: #888;">Title</th>
                <th style="text-align: left; padding: 8px; color: #888;">Section</th>
                <th style="text-align: center; padding: 8px; color: #888;">Active</th>
                <th style="text-align: center; padding: 8px; color: #888;">Actions</th>
            </tr>
        </thead><tbody>`;
        
        events.forEach(e => {
            html += `<tr style="border-bottom: 1px solid #2d2d30;">
                <td style="padding: 10px;">${dayNames[e.day_of_week]}</td>
                <td style="padding: 10px;">${e.time || '-'}</td>
                <td style="padding: 10px;">
                    ${e.title}
                    ${e.description ? `<br><span style="color: #888; font-size: 11px;">${e.description}</span>` : ''}
                </td>
                <td style="padding: 10px;">${e.section}</td>
                <td style="padding: 10px; text-align: center;">
                    <input type="checkbox" ${e.active ? 'checked' : ''} onchange="toggleEventActive('${e.id}', this.checked)">
                </td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="deleteEvent('${e.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer;">Delete</button>
                </td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        container.innerHTML = html;
        
    } catch (err) {
        console.error('Error loading events:', err);
        container.innerHTML = '<div style="color: #ef4444; padding: 20px;">Error loading events</div>';
    }
}

async function addEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    const day = parseInt(document.getElementById('eventDay').value);
    const time = document.getElementById('eventTime').value || null;
    const section = document.getElementById('eventSection').value;
    const description = document.getElementById('eventDescription').value.trim() || null;
    const showDayBefore = document.getElementById('eventShowDayBefore').checked;
    
    if (!title) {
        showToast('Please enter a title', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('today_events')
            .insert({
                title,
                day_of_week: day,
                time,
                section,
                description,
                show_day_before: showDayBefore
            });
        
        if (error) throw error;
        
        showToast('Event added!', 'success');
        
        // Clear form
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventTime').value = '';
        document.getElementById('eventDescription').value = '';
        document.getElementById('eventShowDayBefore').checked = false;
        
        // Reload list
        loadEventsList();
        
    } catch (err) {
        console.error('Error adding event:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function toggleEventActive(id, active) {
    try {
        const { error } = await supabaseClient
            .from('today_events')
            .update({ active })
            .eq('id', id);
        
        if (error) throw error;
        
        showToast(active ? 'Event activated' : 'Event deactivated', 'success');
        
    } catch (err) {
        console.error('Error toggling event:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('today_events')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showToast('Event deleted', 'success');
        loadEventsList();
        
    } catch (err) {
        console.error('Error deleting event:', err);
        showToast('Error: ' + err.message, 'error');
    }
}