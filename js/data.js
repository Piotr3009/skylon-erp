// ========== DATA ==========
let projects = [];
let pipelineProjects = [];
let failedArchive = [];
let completedArchive = [];

// Production phases only (removed deliveryGlazing)
let productionPhases = {
    siteSurvey: { name: "Site Survey", color: "#5e4e81" },
    md: { name: "Manufacturing Drawings", color: "#5a2cdb" },
    order: { name: "Order Materials", color: "#af72ba" },
    timber: { name: "Timber Production", color: "#547d56" },
    orderGlazing: { name: "Order Glazing", color: "#79a4cf" },
    orderSpray: { name: "Order Spray Materials", color: "#eb86d8" },
    spray: { name: "Spraying", color: "#e99f62" },
    glazing: { name: "Glazing", color: "#485d68" },
    qc: { name: "QC & Packing", color: "#63a3ab" },
    dispatch: { name: "Dispatch", color: "#02802a" }
};

// Separate pipeline phases  
let pipelinePhases = {
    initialContact: { name: "Initial Contact", color: "#8b5a3c" },
    siteSurvey: { name: "Site Survey", color: "#5e4e81" },
    quotePrep: { name: "Quote Preparation", color: "#4a6741" },
    quoteSent: { name: "Quote Sent", color: "#387933" },
    negotiations: { name: "Negotiations", color: "#b8860b" },
    contractPrep: { name: "Contract Preparation", color: "#6b4e7a" },
    contractSigned: { name: "Contract Signed", color: "#2e5266" },
    depositReceived: { name: "Deposit Received", color: "#1a5d1a" }
};

// Keep old phases for backward compatibility
let phases = { ...pipelinePhases, ...productionPhases };

// Fixed phase orders
const pipelinePhaseOrder = [
    'initialContact', 'siteSurvey', 'quotePrep', 'quoteSent', 
    'negotiations', 'contractPrep', 'contractSigned', 'depositReceived'
];

// Updated production order WITHOUT deliveryGlazing
const productionPhaseOrder = [
    'siteSurvey', 'md', 'order', 'timber', 'orderGlazing', 'orderSpray', 'spray', 'glazing', 'qc', 'dispatch'
];

// Legacy phase order for backward compatibility
const phaseOrder = [...pipelinePhaseOrder, ...productionPhaseOrder];

// Phase statuses
const phaseStatuses = {
    notStarted: { name: "Not Started", icon: "⏸️" },
    inProgress: { name: "In Progress", icon: "▶️" },
    completed: { name: "Completed", icon: "✅" },
    problem: { name: "Problem/Delayed", icon: "⚠️" }
};

// Project types configuration
const projectTypes = {
    sash: { name: "Sash Window", icon: "🔲" },
    casement: { name: "Casement Window", icon: "🔳" },
    kitchen: { name: "Kitchen", icon: "🍳" },
    wardrobe: { name: "Wardrobe", icon: "🗄️" },
    partition: { name: "Partition Wall", icon: "🗃️" },
    externalSpray: { name: "External Spraying", icon: "🎨" },
    internalDoors: { name: "Internal Doors", icon: "🚪" },
    other: { name: "Other", icon: "📦" }
};

// Material lists per project type
const materialLists = {
    sash: [
        { item: "Sash cords", required: true },
        { item: "Pulleys", required: true },
        { item: "Sash weights", required: true },
        { item: "Staff beads", required: true },
        { item: "Parting beads", required: true },
        { item: "Window locks", required: true },
        { item: "Glazing putty", required: false },
        { item: "Glass panes", required: true },
        { item: "Weather stripping", required: false }
    ],
    casement: [
        { item: "Hinges", required: true },
        { item: "Casement stays", required: true },
        { item: "Window handles", required: true },
        { item: "Multi-point locks", required: false },
        { item: "Glass units", required: true },
        { item: "Glazing beads", required: true },
        { item: "Weather seals", required: true }
    ],
    kitchen: [
        { item: "Hinges (soft close)", required: true },
        { item: "Drawer runners", required: true },
        { item: "Door handles", required: true },
        { item: "Worktop", required: true },
        { item: "Worktop brackets", required: true },
        { item: "Shelf pins", required: false },
        { item: "Plinth legs", required: true },
        { item: "Cornice/Pelmet", required: false },
        { item: "End panels", required: false }
    ],
    wardrobe: [
        { item: "Hinges", required: true },
        { item: "Hanging rails", required: true },
        { item: "Shelf pins", required: true },
        { item: "Door handles", required: true },
        { item: "Drawer runners", required: false },
        { item: "Soft close mechanisms", required: false },
        { item: "LED lighting", required: false },
        { item: "Mirrors", required: false }
    ],
    partition: [
        { item: "Metal studs", required: true },
        { item: "Track systems", required: true },
        { item: "Glass panels", required: true },
        { item: "Door hardware", required: true },
        { item: "Floor/ceiling channels", required: true },
        { item: "Acoustic seals", required: false },
        { item: "Manifestation tape", required: true }
    ],
    externalSpray: [
        { item: "Masking tape", required: true },
        { item: "Protective sheets", required: true },
        { item: "Sandpaper", required: true },
        { item: "Primer", required: false },
        { item: "Paint/Varnish", required: true }
    ],
    internalDoors: [
        { item: "Door hinges", required: true },
        { item: "Door handles", required: true },
        { item: "Door locks/latches", required: true },
        { item: "Door frames", required: true },
        { item: "Door stops", required: true },
        { item: "Architraves", required: true },
        { item: "Skirting boards", required: false },
        { item: "Door seals", required: false },
        { item: "Glass panels", required: false },
        { item: "Wood stain/finish", required: true }
    ],
    other: [
        { item: "Hinges", required: false },
        { item: "Handles", required: false },
        { item: "Locks", required: false },
        { item: "Glass", required: false },
        { item: "Fixings", required: true },
        { item: "Adhesive/Sealant", required: false }
    ]
};

// Glazing materials list
const glazingMaterialsList = [
    { item: "Double glazed units", required: false, hasSize: true },
    { item: "Single glazed panes", required: false, hasSize: true },
    { item: "Toughened glass", required: false, hasSize: true },
    { item: "Laminated glass", required: false, hasSize: true },
    { item: "Obscure glass", required: false, hasSize: true },
    { item: "Glazing silicone", required: true },
    { item: "Glazing tape", required: true },
    { item: "Setting blocks", required: true },
    { item: "Glazing packers", required: true }
];

// Spray materials list
const sprayMaterialsList = [
    { item: "Varnish", required: false, hasColor: false },
    { item: "Paint", required: false, hasColor: true },
    { item: "Primer", required: true, hasColor: false },
    { item: "Thinner", required: true, hasColor: false },
    { item: "Masking tape", required: true, hasColor: false },
    { item: "Sandpaper", required: true, hasColor: false }
];

let teamMembers = [];
let daysOff = [];
let visibleStartDate = new Date();
let daysToShow = 150;
let dayWidth = 36;
let currentEditProject = null;
let currentAssignPhase = null;
let draggedElement = null;
let draggedPhase = null;
let draggedProject = null;
let dragMode = null;
let startX = 0;
let originalLeft = 0;
let originalWidth = 0;
let lastProjectNumber = 0;
let lastPipelineNumber = 0;
let currentView = 'production';

// Auto-save variables
let hasUnsavedChanges = false;
let autoSaveInterval = null;

// ========== DATA MANAGEMENT ==========

// Load projects from Supabase + merge with localStorage phases
async function loadProjectsFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading from Supabase:', error);
            return false;
        }
        
        if (data && data.length > 0) {
            console.log('✅ Loaded', data.length, 'projects from Supabase');
            
            // Load phases from Supabase
            const projectIds = data.map(p => p.id);
            const { data: phasesData } = await supabaseClient
                .from('project_phases')
                .select('*')
                .in('project_id', projectIds)
                .order('order_position');
            
            // Merge projects with phases
            projects = data.map(dbProject => {
                const projectPhases = phasesData?.filter(p => p.project_id === dbProject.id) || [];
                
                return {
                    projectNumber: dbProject.project_number,
                    type: dbProject.type,
                    name: dbProject.name,
                    client_id: dbProject.client_id,
                    deadline: dbProject.deadline,
                    phases: projectPhases.map(phase => ({
                        key: phase.phase_key,
                        start: phase.start_date,
                        end: phase.end_date,
                        workDays: phase.work_days,
                        status: phase.status,
                        assignedTo: phase.assigned_to,
                        notes: phase.notes,
                        materials: phase.materials,
                        orderConfirmed: phase.order_confirmed
                    }))
                };
            });
            
            return true;
        }
        
        return false;
    } catch (err) {
        console.error('Failed to load from Supabase:', err);
        return false;
    }
}

async function loadPipelineFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('pipeline_projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Error loading pipeline:', error);
            return false;
        }
        
        if (data && data.length > 0) {
            console.log('✅ Loaded', data.length, 'pipeline projects from Supabase');
            
            // Load phases from Supabase
            const projectIds = data.map(p => p.id);
            const { data: phasesData } = await supabaseClient
                .from('pipeline_phases')
                .select('*')
                .in('pipeline_project_id', projectIds)
                .order('order_position');
            
            // Merge projects with phases
            pipelineProjects = data.map(dbProject => {
                const projectPhases = phasesData?.filter(p => p.pipeline_project_id === dbProject.id) || [];
                
                return {
                    projectNumber: dbProject.project_number,
                    type: dbProject.type,
                    name: dbProject.name,
                    client_id: dbProject.client_id,
                    phases: projectPhases.map(phase => ({
                        key: phase.phase_key,
                        start: phase.start_date,
                        end: phase.end_date,
                        workDays: phase.work_days,
                        status: phase.status,
                        notes: phase.notes
                    }))
                };
            });
            
            return true;
        }
        
        return false;
    } catch (err) {
        console.error('Failed to load pipeline:', err);
        return false;
    }
}

function loadData() {
    // Najpierw próbuj z Supabase
    if (typeof supabaseClient !== 'undefined') {
        Promise.all([
            loadProjectsFromSupabase(),
            loadPipelineFromSupabase()
        ]).then(([prodLoaded, pipeLoaded]) => {
            // Jeśli Supabase pusty, użyj localStorage
            if (!prodLoaded) {
                const saved = localStorage.getItem('joineryProjects');
                if (saved) {
                    projects = JSON.parse(saved);
                    projects.forEach(project => {
                        if (project.phases) {
                            project.phases.forEach(phase => {
                                if (!phase.status) {
                                    phase.status = 'notStarted';
                                }
                                if (!phase.workDays && phase.start && phase.end) {
                                    phase.workDays = workingDaysBetween(
                                        new Date(phase.start), 
                                        new Date(phase.end)
                                    );
                                }
                            });
                        }
                    });
                }
            }
            
            if (!pipeLoaded) {
                const savedPipeline = localStorage.getItem('joineryPipelineProjects');
                if (savedPipeline) {
                    pipelineProjects = JSON.parse(savedPipeline);
                }
            }
            
            // Załaduj resztę danych (always from localStorage)
            const savedFailedArchive = localStorage.getItem('joineryFailedArchive');
            if (savedFailedArchive) {
                failedArchive = JSON.parse(savedFailedArchive);
            }
            
            const savedCompletedArchive = localStorage.getItem('joineryCompletedArchive');
            if (savedCompletedArchive) {
                completedArchive = JSON.parse(savedCompletedArchive);
            }
            
            const savedPhases = localStorage.getItem('joineryPhases');
            if (savedPhases) {
                const loadedPhases = JSON.parse(savedPhases);
                phases = { ...phases, ...loadedPhases };
            }

            const savedTeam = localStorage.getItem('joineryTeam');
            if (savedTeam) teamMembers = JSON.parse(savedTeam);

            const savedDaysOff = localStorage.getItem('joineryDaysOff');
            if (savedDaysOff) daysOff = JSON.parse(savedDaysOff);
            
            const savedLastNumber = localStorage.getItem('joineryLastProjectNumber');
            if (savedLastNumber) lastProjectNumber = parseInt(savedLastNumber);
            
            const savedLastPipelineNumber = localStorage.getItem('joineryLastPipelineNumber');
            if (savedLastPipelineNumber) lastPipelineNumber = parseInt(savedLastPipelineNumber);
            
            const savedCurrentView = localStorage.getItem('joineryCurrentView');
            if (savedCurrentView) currentView = savedCurrentView;

            const today = new Date();
            visibleStartDate = new Date(today);
            visibleStartDate.setDate(today.getDate() - today.getDay());
            visibleStartDate.setHours(0,0,0,0);
            
            // Start auto-save
            startAutoSave();
            
            // Renderuj po załadowaniu
            if (typeof render === 'function') render();
            if (typeof renderPipeline === 'function') renderPipeline();
        });
    } else {
        // Brak Supabase - użyj tylko localStorage
        loadFromLocalStorage();
    }
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('joineryProjects');
    if (saved) {
        projects = JSON.parse(saved);
        projects.forEach(project => {
            if (project.phases) {
                project.phases.forEach(phase => {
                    if (!phase.status) {
                        phase.status = 'notStarted';
                    }
                    if (!phase.workDays && phase.start && phase.end) {
                        phase.workDays = workingDaysBetween(
                            new Date(phase.start), 
                            new Date(phase.end)
                        );
                    }
                });
            }
        });
    }
    
    const savedPipeline = localStorage.getItem('joineryPipelineProjects');
    if (savedPipeline) {
        pipelineProjects = JSON.parse(savedPipeline);
    }
    
    const savedFailedArchive = localStorage.getItem('joineryFailedArchive');
    if (savedFailedArchive) {
        failedArchive = JSON.parse(savedFailedArchive);
    }
    
    const savedCompletedArchive = localStorage.getItem('joineryCompletedArchive');
    if (savedCompletedArchive) {
        completedArchive = JSON.parse(savedCompletedArchive);
    }
    
    const savedPhases = localStorage.getItem('joineryPhases');
    if (savedPhases) {
        const loadedPhases = JSON.parse(savedPhases);
        phases = { ...phases, ...loadedPhases };
    }

    const savedTeam = localStorage.getItem('joineryTeam');
    if (savedTeam) teamMembers = JSON.parse(savedTeam);

    const savedDaysOff = localStorage.getItem('joineryDaysOff');
    if (savedDaysOff) daysOff = JSON.parse(savedDaysOff);
    
    const savedLastNumber = localStorage.getItem('joineryLastProjectNumber');
    if (savedLastNumber) lastProjectNumber = parseInt(savedLastNumber);
    
    const savedLastPipelineNumber = localStorage.getItem('joineryLastPipelineNumber');
    if (savedLastPipelineNumber) lastPipelineNumber = parseInt(savedLastPipelineNumber);
    
    const savedCurrentView = localStorage.getItem('joineryCurrentView');
    if (savedCurrentView) currentView = savedCurrentView;

    const today = new Date();
    visibleStartDate = new Date(today);
    visibleStartDate.setDate(today.getDate() - today.getDay());
    visibleStartDate.setHours(0,0,0,0);
}

// ========== ZAPISYWANIE FAZ DO SUPABASE ==========

async function savePhasesToSupabase(projectId, phases, isProduction = true) {
    try {
        const tableName = isProduction ? 'project_phases' : 'pipeline_phases';
        const projectIdField = isProduction ? 'project_id' : 'pipeline_project_id';
        
        // 1. USUŃ STARE FAZY (żeby nie było duplikatów)
        const { error: deleteError } = await supabaseClient
            .from(tableName)
            .delete()
            .eq(projectIdField, projectId);
            
        if (deleteError) {
            console.error('Error deleting old phases:', deleteError);
            return false;
        }
        
        // 2. PRZYGOTUJ NOWE FAZY
        const phasesForDB = phases.map((phase, index) => ({
            [projectIdField]: projectId,
            phase_key: phase.key,
            start_date: phase.start,
            end_date: phase.end || null,
            work_days: phase.workDays || 4,
            status: phase.status || 'notStarted',
            notes: phase.notes || null,
            order_position: index,
            // Tylko dla production:
            ...(isProduction && {
                assigned_to: phase.assignedTo || null,
                materials: phase.materials || null,
                order_confirmed: phase.orderConfirmed || false
            })
        }));
        
        // 3. WSTAW NOWE FAZY
        if (phasesForDB.length > 0) {
            const { data, error } = await supabaseClient
                .from(tableName)
                .insert(phasesForDB);
                
            if (error) {
                console.error('Error saving phases:', error);
                return false;
            }
        }
        
        console.log(`✅ Saved ${phases.length} phases to ${tableName}`);
        return true;
        
    } catch (err) {
        console.error('Failed to save phases:', err);
        return false;
    }
}

// ========== ZAPISZ WSZYSTKIE PROJEKTY Z FAZAMI ==========

async function saveAllProjectsWithPhases() {
    let savedCount = 0;
    
    // PRODUCTION PROJECTS
    for (const project of projects) {
        if (project.phases && project.phases.length > 0) {
            // Znajdź project ID w bazie
            const { data: projectData } = await supabaseClient
                .from('projects')
                .select('id')
                .eq('project_number', project.projectNumber)
                .single();
                
            if (projectData) {
                const success = await savePhasesToSupabase(
                    projectData.id, 
                    project.phases, 
                    true
                );
                if (success) savedCount++;
            }
        }
    }
    
    // PIPELINE PROJECTS
    for (const project of pipelineProjects) {
        if (project.phases && project.phases.length > 0) {
            const { data: projectData } = await supabaseClient
                .from('pipeline_projects')
                .select('id')
                .eq('project_number', project.projectNumber)
                .single();
                
            if (projectData) {
                const success = await savePhasesToSupabase(
                    projectData.id, 
                    project.phases, 
                    false
                );
                if (success) savedCount++;
            }
        }
    }
    
    console.log(`✅ Total saved: ${savedCount} projects with phases`);
}

// ========== AUTO-SAVE FUNCTIONS ==========

function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    
    autoSaveInterval = setInterval(() => {
        if (hasUnsavedChanges) {
            console.log('🔄 Auto-saving...');
            saveData();
            hasUnsavedChanges = false;
            document.title = "Skylon Joinery - Production Manager";
        }
    }, 10000); // CO 10 SEKUND
}

function markAsChanged() {
    hasUnsavedChanges = true;
    document.title = "* Skylon Joinery - Unsaved Changes";
}

// Save on page close
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        saveData();
        e.returnValue = 'You have unsaved changes!';
    }
});

// ========== UPDATED SAVE FUNCTION WITH SUPABASE ==========
async function saveData() {
    // Save projects to Supabase
    try {
        if (projects.length > 0) {
            // Prepare data for Supabase (rename fields to match DB schema)
            const projectsForDB = projects.map(p => ({
                project_number: p.projectNumber,
                type: p.type,
                name: p.name,
                deadline: p.deadline || null,
                status: 'active',
                notes: p.client || null,
                contract_value: 0,
                client_id: p.client_id || null
            }));
            
            // Save to projects table
            const { data, error } = await supabaseClient
                .from('projects')
                .upsert(projectsForDB, { onConflict: 'project_number' });
                
            if (error) {
                console.error('Error saving to Supabase:', error);
            } else {
                console.log('✅ Projects saved to Supabase!');
                
                // ZAPISZ FAZY DO BAZY
                await saveAllProjectsWithPhases();
            }
        }
        
        // Save to localStorage as backup
        localStorage.setItem('joineryProjects', JSON.stringify(projects));
        localStorage.setItem('joineryPipelineProjects', JSON.stringify(pipelineProjects));
        localStorage.setItem('joineryFailedArchive', JSON.stringify(failedArchive));
        localStorage.setItem('joineryCompletedArchive', JSON.stringify(completedArchive));
        localStorage.setItem('joineryPhases', JSON.stringify(phases));
        localStorage.setItem('joineryTeam', JSON.stringify(teamMembers));
        localStorage.setItem('joineryDaysOff', JSON.stringify(daysOff));
        localStorage.setItem('joineryLastProjectNumber', lastProjectNumber);
        localStorage.setItem('joineryLastPipelineNumber', lastPipelineNumber);
        localStorage.setItem('joineryCurrentView', currentView);
        
    } catch (err) {
        console.error('General error:', err);
        // Fallback - save everything locally
        localStorage.setItem('joineryProjects', JSON.stringify(projects));
        localStorage.setItem('joineryPipelineProjects', JSON.stringify(pipelineProjects));
        localStorage.setItem('joineryFailedArchive', JSON.stringify(failedArchive));
        localStorage.setItem('joineryCompletedArchive', JSON.stringify(completedArchive));
        localStorage.setItem('joineryPhases', JSON.stringify(phases));
        localStorage.setItem('joineryTeam', JSON.stringify(teamMembers));
        localStorage.setItem('joineryDaysOff', JSON.stringify(daysOff));
        localStorage.setItem('joineryLastProjectNumber', lastProjectNumber);
        localStorage.setItem('joineryLastPipelineNumber', lastPipelineNumber);
        localStorage.setItem('joineryCurrentView', currentView);
    }
}

function getNextProjectNumber() {
    lastProjectNumber++;
    const year = new Date().getFullYear();
    const number = String(lastProjectNumber).padStart(3, '0');
    return `${number}/${year}`;
}

function getNextPipelineNumber() {
    lastPipelineNumber++;
    const year = new Date().getFullYear();
    const number = String(lastPipelineNumber).padStart(3, '0');
    return `PL${number}/${year}`;
}

function getMaterialList(projectType) {
    return materialLists[projectType] || materialLists.other;
}

function getSprayMaterialsList() {
    return sprayMaterialsList;
}

function getGlazingMaterialsList() {
    return glazingMaterialsList;
}

// ========== EXPORT/IMPORT ==========
function exportJSON() {
    const data = {
        version: '1.8',
        projects,
        phases,
        teamMembers,
        daysOff,
        lastProjectNumber,
        exportDate: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joinery-projects-${formatDate(new Date())}.json`;
    a.click();
}

function exportCSV() {
    const data = [['No.', 'Type', 'Project', 'Phase', 'Status', 'Start', 'End', 'Days', 'Assigned To']];
    
    projects.forEach(project => {
        if (project.phases) {
            project.phases.forEach(phase => {
                const phaseConfig = phases[phase.key];
                const start = new Date(phase.start);
                const end = new Date(phase.adjustedEnd || phase.end);
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                
                let assignedTo = '';
                if (phase.assignedTo) {
                    const member = teamMembers.find(m => m.id === phase.assignedTo);
                    assignedTo = member ? member.name : '';
                }
                
                const projectType = projectTypes[project.type] || projectTypes.other;
                const status = phaseStatuses[phase.status] || phaseStatuses.notStarted;
                
                data.push([
                    project.projectNumber || '',
                    projectType.name,
                    project.name,
                    phaseConfig ? phaseConfig.name : phase.key,
                    status.name,
                    phase.start,
                    phase.adjustedEnd || phase.end,
                    days,
                    assignedTo
                ]);
            });
        }
    });
    
    const csv = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `joinery-projects-${formatDate(new Date())}.csv`;
    a.click();
}

function importJSON() {
    const input = document.getElementById('fileInput');
    input.click();
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                projects = data.projects || [];
                phases = data.phases || phases;
                teamMembers = data.teamMembers || [];
                daysOff = data.daysOff || data.sickDays || [];
                lastProjectNumber = data.lastProjectNumber || 0;
                
                projects.forEach(project => {
                    if (!project.type) project.type = 'other';
                    if (!project.projectNumber) project.projectNumber = getNextProjectNumber();
                    if (project.phases) {
                        project.phases.sort((a, b) => {
                            return phaseOrder.indexOf(a.key) - phaseOrder.indexOf(b.key);
                        });
                        project.phases.forEach(phase => {
                            if (!phase.status) phase.status = 'notStarted';
                        });
                    }
                });
                
                saveData();
                updatePhasesLegend();
                render();
                alert('Data imported successfully');
            } catch (err) {
                alert('Error importing file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
}

function clearAll() {
    if (confirm('Clear all projects? This cannot be undone!')) {
        projects = [];
        lastProjectNumber = 0;
        saveData();
        render();
    }
}