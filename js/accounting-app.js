// ========================================
// ACCOUNTING MODULE - Main Application
// ========================================

let accountingData = [];
let monthlyOverheadsData = [];
let skillAssignmentsData = [];
let pipelineProjectsData = [];
let productionProjectsData = [];
let archivedProjectsData = [];
let clientsData = [];
let projectMaterialsData = [];

let currentYear = new Date().getFullYear();
let activeTab = 'finances';
let activeFinancesSubTab = 'live';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Accounting module loading...');
    await loadAllAccountingData();
    populateYearFilter();
    renderDashboard();
    
    // Check if it's 1st day of month - remind about overheads
    checkMonthlyOverheadsReminder();
});

// ========================================
// DATA LOADING
// ========================================

async function loadAllAccountingData() {
    try {
        const { data: clients, error: clientsError } = await supabaseClient
            .from('clients')
            .select('*');
        
        if (!clientsError) clientsData = clients || [];

        const { data: pipeline, error: pipelineError } = await supabaseClient
            .from('pipeline_projects')
            .select('*')
            .eq('status', 'active');
        
        console.log('🔍 RAW Pipeline data from DB:', pipeline);
        
        if (!pipelineError) {
            pipelineProjectsData = pipeline || [];
        }

        const pipelineIds = pipelineProjectsData.map(p => p.id);
        let pipelinePhases = [];
        if (pipelineIds.length > 0) {
            const { data: phases } = await supabaseClient
                .from('pipeline_phases')
                .select('*')
                .in('pipeline_project_id', pipelineIds);
            pipelinePhases = phases || [];
        }

        pipelineProjectsData = pipelineProjectsData.map(p => {
            const phases = pipelinePhases.filter(ph => ph.pipeline_project_id === p.id);
            const lastPhase = phases.sort((a, b) => 
                new Date(b.end_date || b.start_date) - new Date(a.end_date || a.start_date)
            )[0];
            
            return {
                ...p,
                deadline: lastPhase ? (lastPhase.end_date || lastPhase.start_date) : null
            };
        });

        const { data: production, error: productionError } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('status', 'active');
        
        console.log('🔍 RAW Production data from DB:', production);
        
        if (!productionError) productionProjectsData = production || [];

        // Load project materials for cost calculation
        const productionIds = productionProjectsData.map(p => p.id);
        if (productionIds.length > 0) {
            const { data: materials, error: materialsError } = await supabaseClient
                .from('project_materials')
                .select('project_id, quantity_reserved, unit_cost')
                .in('project_id', productionIds);
            
            if (!materialsError) projectMaterialsData = materials || [];
        }

        const { data: archived, error: archivedError } = await supabaseClient
            .from('archived_projects')
            .select('*');
        
        if (!archivedError) archivedProjectsData = archived || [];

        const { data: overheads, error: overheadsError } = await supabaseClient
            .from('monthly_overheads')
            .select('*')
            .order('month', { ascending: true });
        
        if (!overheadsError) monthlyOverheadsData = overheads || [];

        const { data: skills, error: skillsError } = await supabaseClient
            .from('skill_assignments')
            .select('*')
            .order('month', { ascending: true });
        
        if (!skillsError) skillAssignmentsData = skills || [];

        console.log('✅ All accounting data loaded');
        console.log('Pipeline (LIFE):', pipelineProjectsData.length);
        console.log('Production:', productionProjectsData.length);
        console.log('Archived:', archivedProjectsData.length);

    } catch (error) {
        console.error('Error loading accounting data:', error);
    }
}

async function refreshAccountingData() {
    await loadAllAccountingData();
    renderDashboard();
}

// ========================================
// CALCULATIONS
// ========================================

function calculateTotalPipelineBudget() {
    console.log('📊 Pipeline projects:', pipelineProjectsData.length);
    pipelineProjectsData.forEach(p => {
        console.log(`  - ${p.project_number}: estimated_value = ${p.estimated_value}`);
    });
    
    const total = pipelineProjectsData.reduce((sum, p) => {
        return sum + (parseFloat(p.estimated_value) || 0);
    }, 0);
    console.log('💰 Total Pipeline Budget:', total);
    return total;
}

function calculateTotalProductionBudget() {
    console.log('📊 Production projects:', productionProjectsData.length);
    productionProjectsData.forEach(p => {
        console.log(`  - ${p.project_number}: contract_value = ${p.contract_value}`);
    });
    
    const total = productionProjectsData.reduce((sum, p) => {
        return sum + (parseFloat(p.contract_value) || 0);
    }, 0);
    console.log('💰 Total Production Budget:', total);
    return total;
}

function calculateYTDTurnover(year = currentYear) {
    console.log('📊 Calculating YTD for year:', year);
    console.log('📊 Archived projects:', archivedProjectsData.length);
    
    const filtered = archivedProjectsData.filter(p => {
        if (!p.completed_date && !p.archived_date) return false;
        const date = new Date(p.completed_date || p.archived_date);
        return date.getFullYear() === year && p.archive_reason === 'completed';
    });
    
    console.log('📊 Completed projects for', year, ':', filtered.length);
    filtered.forEach(p => {
        const value = parseFloat(p.actual_value || p.contract_value) || 0;
        console.log(`  - ${p.project_number}: value = £${value}`);
    });
    
    const ytd = filtered.reduce((sum, p) => sum + (parseFloat(p.actual_value || p.contract_value) || 0), 0);
    console.log('💰 Total YTD Turnover:', ytd);
    return ytd;
}

function calculateBurnRate() {
    console.log('📊 Monthly overheads data:', monthlyOverheadsData.length);
    
    if (monthlyOverheadsData.length === 0) {
        console.log('⚠️ No monthly overheads data');
        return 0;
    }
    
    monthlyOverheadsData.forEach(o => {
        console.log(`  - ${o.month}: overheads = £${o.overheads_value}`);
    });
    
    const avgOverheads = monthlyOverheadsData.reduce((sum, o) => 
        sum + (parseFloat(o.overheads_value) || 0), 0
    ) / monthlyOverheadsData.length;
    
    const burnRate = avgOverheads / 30;
    console.log('💰 Daily Burn Rate:', burnRate);
    return burnRate;
}

function getWeeklyBudget() {
    const weeks = {};
    
    productionProjectsData.forEach(p => {
        if (!p.deadline) return;
        
        const deadline = new Date(p.deadline);
        const weekStart = getWeekStart(deadline);
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeks[weekKey]) {
            weeks[weekKey] = {
                weekStart: weekStart,
                weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000),
                projects: [],
                totalValue: 0
            };
        }
        
        weeks[weekKey].projects.push(p);
        weeks[weekKey].totalValue += parseFloat(p.contract_value) || 0;
    });
    
    return Object.values(weeks).sort((a, b) => a.weekStart - b.weekStart);
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getMonthlyBreakdown() {
    const months = {};
    
    productionProjectsData.forEach(p => {
        if (!p.deadline) return;
        
        const deadline = new Date(p.deadline);
        const monthKey = `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}`;
        
        if (!months[monthKey]) {
            months[monthKey] = {
                month: monthKey,
                projects: [],
                totalValue: 0
            };
        }
        
        months[monthKey].projects.push(p);
        months[monthKey].totalValue += parseFloat(p.contract_value) || 0;
    });
    
    Object.keys(months).forEach(monthKey => {
        const skills = skillAssignmentsData.filter(s => s.month === monthKey);
        const joineryWorkers = skills.find(s => s.skill_type === 'joinery')?.worker_count || 0;
        const sprayingWorkers = skills.find(s => s.skill_type === 'spraying')?.worker_count || 0;
        const totalWorkers = joineryWorkers + sprayingWorkers;
        
        months[monthKey].joineryWorkers = joineryWorkers;
        months[monthKey].sprayingWorkers = sprayingWorkers;
        months[monthKey].totalWorkers = totalWorkers;
        months[monthKey].valuePerPerson = totalWorkers > 0 ? months[monthKey].totalValue / totalWorkers : 0;
        
        const overhead = monthlyOverheadsData.find(o => o.month === monthKey);
        months[monthKey].overheads = parseFloat(overhead?.overheads_value) || 0;
        months[monthKey].profit = months[monthKey].totalValue - months[monthKey].overheads;
        months[monthKey].overheadsPercent = months[monthKey].totalValue > 0 
            ? (months[monthKey].overheads / months[monthKey].totalValue * 100) 
            : 0;
    });
    
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month));
}

function getProjectProfits() {
    return archivedProjectsData
        .filter(p => p.archive_reason === 'completed')
        .map(p => {
            const value = parseFloat(p.actual_value || p.contract_value) || 0;
            const cost = parseFloat(p.project_cost) || 0;
            const profit = value - cost;
            const margin = value > 0 ? (profit / value * 100) : 0;
            
            return {
                ...p,
                value,
                cost,
                profit,
                margin
            };
        })
        .sort((a, b) => b.margin - a.margin);
}

function getRevenuePerClient() {
    const clientRevenue = {};
    
    archivedProjectsData
        .filter(p => p.archive_reason === 'completed')
        .forEach(p => {
            const clientId = p.client_id;
            if (!clientId) return;
            
            if (!clientRevenue[clientId]) {
                const client = clientsData.find(c => c.id === clientId);
                clientRevenue[clientId] = {
                    client_id: clientId,
                    client_name: client?.company_name || 'Unknown',
                    projects: [],
                    totalRevenue: 0
                };
            }
            
            const revenue = parseFloat(p.actual_value || p.contract_value) || 0;
            clientRevenue[clientId].projects.push(p);
            clientRevenue[clientId].totalRevenue += revenue;
        });
    
    return Object.values(clientRevenue).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function getCashFlowForecast(weeksAhead = 8) {
    const today = new Date();
    const forecast = [];
    
    for (let i = 0; i < weeksAhead; i++) {
        const weekStart = new Date(today.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        
        const projectsInWeek = productionProjectsData.filter(p => {
            if (!p.deadline) return false;
            const deadline = new Date(p.deadline);
            return deadline >= weekStart && deadline <= weekEnd;
        });
        
        const totalValue = projectsInWeek.reduce((sum, p) => 
            sum + (parseFloat(p.contract_value) || 0), 0
        );
        
        forecast.push({
            weekNumber: i + 1,
            weekStart,
            weekEnd,
            projects: projectsInWeek,
            totalValue
        });
    }
    
    return forecast;
}

// ========================================
// RENDERING
// ========================================

function renderDashboard() {
    renderSummaryCards();
    renderActiveTab();
}

function renderSummaryCards() {
    const pipelineBudget = calculateTotalPipelineBudget();
    document.getElementById('totalPipelineBudget').textContent = `£${pipelineBudget.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('pipelineProjectCount').textContent = `${pipelineProjectsData.length} projects`;
    
    const productionBudget = calculateTotalProductionBudget();
    document.getElementById('totalProductionBudget').textContent = `£${productionBudget.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    document.getElementById('productionProjectCount').textContent = `${productionProjectsData.length} projects`;
    
    const ytd = calculateYTDTurnover();
    document.getElementById('ytdTurnover').textContent = `£${ytd.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
    
    const burnRate = calculateBurnRate();
    document.getElementById('burnRate').textContent = `£${burnRate.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: 0})}`;
}

function renderActiveTab() {
    switch(activeTab) {
        case 'finances':
            renderFinances();
            break;
        case 'weekly':
            renderWeeklyBudget();
            break;
        case 'monthly':
            renderMonthlyBreakdown();
            break;
        case 'projects':
            renderProjectProfits();
            break;
        case 'clients':
            renderRevenuePerClient();
            break;
        case 'forecast':
            renderCashFlowForecast();
            break;
    }
}

// ========== PROJECT FINANCES ==========

function switchFinancesSubTab(subTab) {
    activeFinancesSubTab = subTab;
    
    // Update sub-tab buttons
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
        if (btn.dataset.subtab === subTab) {
            btn.style.background = '#3b82f6';
            btn.style.border = 'none';
            btn.style.color = 'white';
            btn.classList.add('active');
        } else {
            btn.style.background = '#27272a';
            btn.style.border = '1px solid #3f3f46';
            btn.style.color = '#a1a1aa';
            btn.classList.remove('active');
        }
    });
    
    // Show/hide tables
    document.getElementById('financesLiveTable').style.display = subTab === 'live' ? 'block' : 'none';
    document.getElementById('financesArchiveTable').style.display = subTab === 'archive' ? 'block' : 'none';
    
    renderFinances();
}

function renderFinances() {
    if (activeFinancesSubTab === 'live') {
        renderFinancesLive();
    } else {
        renderFinancesArchive();
    }
}

function renderFinancesLive() {
    const container = document.getElementById('financesLiveTable');
    
    // Oblicz materials cost dla każdego projektu
    const getMaterialsCost = (projectId) => {
        return projectMaterialsData
            .filter(m => m.project_id === projectId)
            .reduce((sum, m) => sum + ((m.quantity_reserved || 0) * (m.unit_cost || 0)), 0);
    };
    
    // Filtruj projekty
    const projects = productionProjectsData.map(p => {
        const value = parseFloat(p.contract_value) || 0;
        const materials = getMaterialsCost(p.id);
        const labour = parseFloat(p.labour_cost) || 0;
        const totalCost = materials + labour;
        const profit = value - totalCost;
        const margin = value > 0 ? (profit / value * 100) : 0;
        
        return {
            ...p,
            value,
            materials,
            labour,
            totalCost,
            profit,
            margin
        };
    }).sort((a, b) => (b.project_number || '').localeCompare(a.project_number || ''));
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #999;">No active projects in production.</p>';
        return;
    }
    
    let html = `<table style="width: 100%; border-collapse: collapse; color: white;">
        <thead>
            <tr style="background: #2a2a2a; border-bottom: 2px solid #444;">
                <th style="padding: 12px; text-align: left;">Project #</th>
                <th style="padding: 12px; text-align: left;">Name</th>
                <th style="padding: 12px; text-align: right;">Value</th>
                <th style="padding: 12px; text-align: right;">Materials</th>
                <th style="padding: 12px; text-align: right;">Labour</th>
                <th style="padding: 12px; text-align: right;">Profit</th>
                <th style="padding: 12px; text-align: right;">Margin %</th>
            </tr>
        </thead>
        <tbody>`;
    
    projects.forEach(p => {
        const hasCosts = p.materials > 0 || p.labour > 0;
        const marginColor = p.margin >= 20 ? '#4ade80' : p.margin >= 10 ? '#fee140' : '#f5576c';
        
        const materialsDisplay = p.materials > 0 ? `£${p.materials.toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '<span style="color: #666;">—</span>';
        const labourDisplay = p.labour > 0 ? `£${p.labour.toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '<span style="color: #666;">—</span>';
        const profitDisplay = hasCosts ? `£${p.profit.toLocaleString('en-GB', {minimumFractionDigits: 2})}` : '<span style="color: #666;">—</span>';
        const marginDisplay = hasCosts ? `${p.margin.toFixed(1)}%` : '<span style="color: #666;">—</span>';
        
        html += `<tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">${p.project_number}</td>
            <td style="padding: 12px;">${p.name}</td>
            <td style="padding: 12px; text-align: right;">£${p.value.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
            <td style="padding: 12px; text-align: right; color: #f97316;">${materialsDisplay}</td>
            <td style="padding: 12px; text-align: right; color: #8b5cf6;">${labourDisplay}</td>
            <td style="padding: 12px; text-align: right; color: ${p.profit >= 0 ? '#4ade80' : '#f5576c'};">${profitDisplay}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: ${marginColor};">${marginDisplay}</td>
        </tr>`;
    });
    
    // Totals
    const totalValue = projects.reduce((sum, p) => sum + p.value, 0);
    const totalMaterials = projects.reduce((sum, p) => sum + p.materials, 0);
    const totalLabour = projects.reduce((sum, p) => sum + p.labour, 0);
    const totalProfit = totalValue - totalMaterials - totalLabour;
    const avgMargin = totalValue > 0 ? (totalProfit / totalValue * 100) : 0;
    
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;">
        <td colspan="2" style="padding: 12px;">TOTAL (${projects.length} projects)</td>
        <td style="padding: 12px; text-align: right;">£${totalValue.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #f97316;">£${totalMaterials.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #8b5cf6;">£${totalLabour.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: ${totalProfit >= 0 ? '#4ade80' : '#f5576c'};">£${totalProfit.toLocaleString('en-GB', {minimumFractionDigits: 2})}</td>
        <td style="padding: 12px; text-align: right; color: #4facfe;">${avgMargin.toFixed(1)}%</td>
    </tr></tbody></table>`;
    
    container.innerHTML = html;
}

function renderFinancesArchive() {
    const container = document.getElementById('financesArchiveTable');
    
    // Filtruj ukończone projekty
    const projects = archivedProjectsData
        .filter(p => p.archive_reason === 'completed')
        .map(p => {
            const value = parseFloat(p.actual_value || p.contract_value) || 0;
            const cost = parseFloat(p.project_cost) || 0;
            const profit = value - cost;
            const margin = value > 0 ? (profit / value * 100) : 0;
            
            return {
                ...p,
                value,
                cost,
                profit,
                margin
            };
        })
        .sort((a, b) => b.margin - a.margin);
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #999;">No completed projects in archive.</p>';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Project #</th><th style="padding: 12px; text-align: left;">Name</th><th style="padding: 12px; text-align: right;">Value</th><th style="padding: 12px; text-align: right;">Cost</th><th style="padding: 12px; text-align: right;">Profit</th><th style="padding: 12px; text-align: right;">Margin %</th></tr></thead><tbody>';
    
    projects.forEach(p => {
        const marginColor = p.margin >= 20 ? '#4ade80' : p.margin >= 10 ? '#fee140' : '#f5576c';
        const costDisplay = p.cost > 0 ? `£${p.cost.toLocaleString('en-GB', {minimumFractionDigits: 0})}` : '<span style="color: #666;">—</span>';
        const profitDisplay = p.cost > 0 ? `£${p.profit.toLocaleString('en-GB', {minimumFractionDigits: 0})}` : '<span style="color: #666;">—</span>';
        const marginDisplay = p.cost > 0 ? `${p.margin.toFixed(1)}%` : '<span style="color: #666;">—</span>';
        
        html += `<tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">${p.project_number}</td>
            <td style="padding: 12px;">${p.name}</td>
            <td style="padding: 12px; text-align: right;">£${p.value.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td>
            <td style="padding: 12px; text-align: right;">${costDisplay}</td>
            <td style="padding: 12px; text-align: right; color: ${p.profit >= 0 ? '#4ade80' : '#f5576c'};">${profitDisplay}</td>
            <td style="padding: 12px; text-align: right; font-weight: bold; color: ${marginColor};">${marginDisplay}</td>
        </tr>`;
    });
    
    // Totals
    const totalValue = projects.reduce((sum, p) => sum + p.value, 0);
    const totalCost = projects.reduce((sum, p) => sum + p.cost, 0);
    const totalProfit = totalValue - totalCost;
    const avgMargin = totalValue > 0 ? (totalProfit / totalValue * 100) : 0;
    
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;">
        <td colspan="2" style="padding: 12px;">TOTAL (${projects.length} projects)</td>
        <td style="padding: 12px; text-align: right;">£${totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td>
        <td style="padding: 12px; text-align: right;">£${totalCost.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td>
        <td style="padding: 12px; text-align: right; color: ${totalProfit >= 0 ? '#4ade80' : '#f5576c'};">£${totalProfit.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td>
        <td style="padding: 12px; text-align: right; color: #4facfe;">${avgMargin.toFixed(1)}%</td>
    </tr></tbody></table>`;
    
    container.innerHTML = html;
}

function renderWeeklyBudget() {
    const weeks = getWeeklyBudget();
    const container = document.getElementById('weeklyBudgetTable');
    
    if (weeks.length === 0) {
        container.innerHTML = '<p style="color: #999;">No projects with deadlines in production.</p>';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Week Start</th><th style="padding: 12px; text-align: left;">Week End</th><th style="padding: 12px; text-align: center;">Projects</th><th style="padding: 12px; text-align: right;">Total Value</th></tr></thead><tbody>';
    
    weeks.forEach(week => {
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${formatDate(week.weekStart)}</td><td style="padding: 12px;">${formatDate(week.weekEnd)}</td><td style="padding: 12px; text-align: center;">${week.projects.length}</td><td style="padding: 12px; text-align: right; font-weight: bold;">£${week.totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    const grandTotal = weeks.reduce((sum, w) => sum + w.totalValue, 0);
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;"><td colspan="3" style="padding: 12px;">TOTAL</td><td style="padding: 12px; text-align: right;">£${grandTotal.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr></tbody></table>`;
    
    container.innerHTML = html;
}

function renderMonthlyBreakdown() {
    const months = getMonthlyBreakdown();
    
    let html1 = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Month</th><th style="padding: 12px; text-align: right;">Total Value</th><th style="padding: 12px; text-align: center;">Joinery</th><th style="padding: 12px; text-align: center;">Spraying</th><th style="padding: 12px; text-align: center;">Total Workers</th><th style="padding: 12px; text-align: right;">£ per Person</th></tr></thead><tbody>';
    
    months.forEach(m => {
        html1 += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${formatMonth(m.month)}</td><td style="padding: 12px; text-align: right; font-weight: bold;">£${m.totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: center;">${m.joineryWorkers}</td><td style="padding: 12px; text-align: center;">${m.sprayingWorkers}</td><td style="padding: 12px; text-align: center; font-weight: bold;">${m.totalWorkers}</td><td style="padding: 12px; text-align: right; color: #4facfe;">£${m.valuePerPerson.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    html1 += '</tbody></table>';
    document.getElementById('monthlyBreakdownTable').innerHTML = html1;
    
    let html2 = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Month</th><th style="padding: 12px; text-align: right;">Revenue</th><th style="padding: 12px; text-align: right;">Overheads</th><th style="padding: 12px; text-align: right;">Profit</th><th style="padding: 12px; text-align: right;">OH %</th></tr></thead><tbody>';
    
    months.forEach(m => {
        const ohColor = m.overheadsPercent > 50 ? '#f5576c' : m.overheadsPercent > 30 ? '#fee140' : '#4ade80';
        html2 += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${formatMonth(m.month)}</td><td style="padding: 12px; text-align: right;">£${m.totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right;">£${m.overheads.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right; color: ${m.profit >= 0 ? '#4ade80' : '#f5576c'};">£${m.profit.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right; font-weight: bold; color: ${ohColor};">${m.overheadsPercent.toFixed(1)}%</td></tr>`;
    });
    
    html2 += '</tbody></table>';
    document.getElementById('monthlyOverheadsTable').innerHTML = html2;
}

function renderProjectProfits() {
    const projects = getProjectProfits();
    const container = document.getElementById('projectProfitsTable');
    
    if (projects.length === 0) {
        container.innerHTML = '<p style="color: #999;">No completed projects with cost data.</p>';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Project #</th><th style="padding: 12px; text-align: left;">Name</th><th style="padding: 12px; text-align: right;">Value</th><th style="padding: 12px; text-align: right;">Cost</th><th style="padding: 12px; text-align: right;">Profit</th><th style="padding: 12px; text-align: right;">Margin %</th></tr></thead><tbody>';
    
    projects.forEach(p => {
        const marginColor = p.margin >= 20 ? '#4ade80' : p.margin >= 10 ? '#fee140' : '#f5576c';
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${p.project_number}</td><td style="padding: 12px;">${p.name}</td><td style="padding: 12px; text-align: right;">£${p.value.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right;">£${p.cost.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right; color: ${p.profit >= 0 ? '#4ade80' : '#f5576c'};">£${p.profit.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td><td style="padding: 12px; text-align: right; font-weight: bold; color: ${marginColor};">${p.margin.toFixed(1)}%</td></tr>`;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderRevenuePerClient() {
    const clients = getRevenuePerClient();
    const container = document.getElementById('clientsRevenueTable');
    
    if (clients.length === 0) {
        container.innerHTML = '<p style="color: #999;">No completed projects with client data.</p>';
        return;
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Client</th><th style="padding: 12px; text-align: center;">Projects</th><th style="padding: 12px; text-align: right;">Total Revenue</th></tr></thead><tbody>';
    
    clients.forEach(c => {
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">${c.client_name}</td><td style="padding: 12px; text-align: center;">${c.projects.length}</td><td style="padding: 12px; text-align: right; font-weight: bold;">£${c.totalRevenue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    const grandTotal = clients.reduce((sum, c) => sum + c.totalRevenue, 0);
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;"><td colspan="2" style="padding: 12px;">TOTAL</td><td style="padding: 12px; text-align: right;">£${grandTotal.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr></tbody></table>`;
    
    container.innerHTML = html;
}

function renderCashFlowForecast() {
    const weeksSelector = document.getElementById('forecastWeeksSelector');
    const weeks = weeksSelector ? parseInt(weeksSelector.value) : 8;
    
    const forecast = getCashFlowForecast(weeks);
    const container = document.getElementById('forecastTable');
    
    let html = '<table style="width: 100%; border-collapse: collapse; color: white;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 12px; text-align: left;">Week</th><th style="padding: 12px; text-align: left;">Period</th><th style="padding: 12px; text-align: center;">Projects</th><th style="padding: 12px; text-align: right;">Expected Income</th></tr></thead><tbody>';
    
    forecast.forEach(f => {
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 12px;">Week ${f.weekNumber}</td><td style="padding: 12px;">${formatDate(f.weekStart)} - ${formatDate(f.weekEnd)}</td><td style="padding: 12px; text-align: center;">${f.projects.length}</td><td style="padding: 12px; text-align: right; font-weight: bold;">£${f.totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    const totalForecast = forecast.reduce((sum, f) => sum + f.totalValue, 0);
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;"><td colspan="3" style="padding: 12px;">TOTAL (${weeks} weeks)</td><td style="padding: 12px; text-align: right;">£${totalForecast.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr></tbody></table>`;
    
    container.innerHTML = html;
}

function updateForecastWeeks() {
    renderCashFlowForecast();
}

// ========================================
// TAB SWITCHING & MODALS
// ========================================

function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + 'Tab').style.display = 'block';
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    renderActiveTab();
}

// Monthly settings modal - see monthly-overheads-modal.js

function openExportRangeModal() {
    document.getElementById('exportRangeModal').style.display = 'block';
}

function closeExportRangeModal() {
    document.getElementById('exportRangeModal').style.display = 'none';
}

async function exportProjectsByRange() {
    const fromDate = document.getElementById('exportFromDate').value;
    const toDate = document.getElementById('exportToDate').value;
    
    if (!fromDate || !toDate) {
        alert('Please select both dates');
        return;
    }
    
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    const projectsInRange = archivedProjectsData.filter(p => {
        if (!p.completed_date && !p.archived_date) return false;
        const date = new Date(p.completed_date || p.archived_date);
        return date >= from && date <= to && p.archive_reason === 'completed';
    });
    
    const totalValue = projectsInRange.reduce((sum, p) => 
        sum + (parseFloat(p.actual_value || p.contract_value) || 0), 0
    );
    
    let html = `<h3 style="color: white; margin-bottom: 15px;">Export Results</h3><p style="color: #999;">Period: ${formatDate(from)} - ${formatDate(to)}</p><p style="color: #999; margin-bottom: 15px;">Found ${projectsInRange.length} completed projects</p><table style="width: 100%; border-collapse: collapse; color: white; margin-bottom: 20px;"><thead><tr style="background: #2a2a2a; border-bottom: 2px solid #444;"><th style="padding: 10px; text-align: left;">Project #</th><th style="padding: 10px; text-align: left;">Name</th><th style="padding: 10px; text-align: right;">Value</th></tr></thead><tbody>`;
    
    projectsInRange.forEach(p => {
        const value = parseFloat(p.actual_value || p.contract_value) || 0;
        html += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 10px;">${p.project_number}</td><td style="padding: 10px;">${p.name}</td><td style="padding: 10px; text-align: right;">£${value.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr>`;
    });
    
    html += `<tr style="background: #2a2a2a; font-weight: bold; border-top: 2px solid #444;"><td colspan="2" style="padding: 10px;">TOTAL</td><td style="padding: 10px; text-align: right;">£${totalValue.toLocaleString('en-GB', {minimumFractionDigits: 0})}</td></tr></tbody></table><button class="modal-btn primary" onclick="downloadRangeCSV('${fromDate}', '${toDate}')">Download CSV</button>`;
    
    document.getElementById('exportResult').innerHTML = html;
    document.getElementById('exportResult').style.display = 'block';
}

function downloadRangeCSV(fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    
    const projectsInRange = archivedProjectsData.filter(p => {
        if (!p.completed_date && !p.archived_date) return false;
        const date = new Date(p.completed_date || p.archived_date);
        return date >= from && date <= to && p.archive_reason === 'completed';
    });
    
    let csv = 'Project Number,Name,Value,Completed Date\n';
    projectsInRange.forEach(p => {
        const value = parseFloat(p.actual_value || p.contract_value) || 0;
        const date = p.completed_date || p.archived_date;
        csv += `${p.project_number},"${p.name}",${value},${date}\n`;
    });
    
    const totalValue = projectsInRange.reduce((sum, p) => 
        sum + (parseFloat(p.actual_value || p.contract_value) || 0), 0
    );
    csv += `,,${totalValue},TOTAL\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects_${fromDate}_to_${toDate}.csv`;
    a.click();
}

function formatDate(date) {
    const d = new Date(date);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

function populateYearFilter() {
    const select = document.getElementById('yearFilter');
    const years = new Set();
    
    archivedProjectsData.forEach(p => {
        if (p.completed_date || p.archived_date) {
            const year = new Date(p.completed_date || p.archived_date).getFullYear();
            years.add(year);
        }
    });
    
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    sortedYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        select.appendChild(option);
    });
}

function filterByYear() {
    const select = document.getElementById('yearFilter');
    const selectedYear = select.value;
    
    if (selectedYear === 'all') {
        currentYear = new Date().getFullYear();
    } else {
        currentYear = parseInt(selectedYear);
    }
    
    renderDashboard();
}

// Check if 1st day of month - remind about overheads
function checkMonthlyOverheadsReminder() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    // Only on 1st day of month
    if (dayOfMonth !== 1) return;
    
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const storageKey = `overheads_confirmed_${currentMonth}`;
    
    // Check if already confirmed this month
    const confirmed = localStorage.getItem(storageKey);
    
    if (confirmed) return;
    
    // Show reminder
    setTimeout(() => {
        if (confirm('⚠️ MONTHLY OVERHEADS REMINDER\n\nIt\'s the 1st day of the month!\n\nPlease review and confirm monthly overhead costs.\n\nOpen Monthly Overheads Settings?')) {
            openMonthlySettingsModal();
        }
    }, 2000); // 2 sekundy po załadowaniu strony
}

// Mark overheads as confirmed (call this after Save Changes)
function markOverheadsConfirmed() {
    const month = document.getElementById('settingsMonth').value;
    if (month) {
        localStorage.setItem(`overheads_confirmed_${month}`, 'true');
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}