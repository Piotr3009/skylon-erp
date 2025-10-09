// ========== SORT & FILTER ==========

let currentSortMode = 'number';
let currentFilter = null; // { type: 'timber'|'spray', workerId: 'uuid'|'all'|'unassigned' }

// Initialize workers lists in dropdowns
function initializeFilterDropdowns() {
    if (!teamMembers || teamMembers.length === 0) {
        console.warn('No team members loaded yet');
        return;
    }
    
    // Timber workers list
    const timberList = document.getElementById('timberWorkersList');
    if (timberList) {
        timberList.innerHTML = '';
        teamMembers.forEach(worker => {
            const button = document.createElement('button');
            button.onclick = () => setTimberFilter(worker.id);
            button.innerHTML = `<span class="worker-color-dot" style="background: ${worker.color};"></span>${worker.name}`;
            timberList.appendChild(button);
        });
        
        // Add unassigned option
        const unassignedBtn = document.createElement('button');
        unassignedBtn.onclick = () => setTimberFilter('unassigned');
        unassignedBtn.innerHTML = '<span style="color: #999;">(Unassigned)</span>';
        timberList.appendChild(unassignedBtn);
    }
    
    // Spray workers list
    const sprayList = document.getElementById('sprayWorkersList');
    if (sprayList) {
        sprayList.innerHTML = '';
        teamMembers.forEach(worker => {
            const button = document.createElement('button');
            button.onclick = () => setSprayFilter(worker.id);
            button.innerHTML = `<span class="worker-color-dot" style="background: ${worker.color};"></span>${worker.name}`;
            sprayList.appendChild(button);
        });
        
        // Add unassigned option
        const unassignedBtn = document.createElement('button');
        unassignedBtn.onclick = () => setSprayFilter('unassigned');
        unassignedBtn.innerHTML = '<span style="color: #999;">(Unassigned)</span>';
        sprayList.appendChild(unassignedBtn);
    }
}

// Toggle dropdown visibility
function toggleFilterDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Close other dropdowns
    document.querySelectorAll('.filter-menu').forEach(menu => {
        if (menu.id !== dropdownId) {
            menu.style.display = 'none';
        }
    });
    
    // Toggle current dropdown
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown')) {
        document.querySelectorAll('.filter-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

// ========== SORTING ==========

function setSortMode(mode) {
    currentSortMode = mode;
    
    // Update button states
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-sort="${mode}"]`)?.classList.add('active');
    
    // Sort and render
    sortProjects();
    renderUniversal();
}

function sortProjects() {
    switch(currentSortMode) {
        case 'number':
            projects.sort((a, b) => {
                const numA = parseInt(a.projectNumber?.split('/')[0]) || 0;
                const numB = parseInt(b.projectNumber?.split('/')[0]) || 0;
                return numA - numB;
            });
            break;
            
        case 'deadline':
            projects.sort((a, b) => {
                if (!a.deadline) return 1;
                if (!b.deadline) return -1;
                return new Date(a.deadline) - new Date(b.deadline);
            });
            break;
            
        case 'timber':
            projects.sort((a, b) => {
                const timberA = a.phases?.find(p => p.key === 'timber');
                const timberB = b.phases?.find(p => p.key === 'timber');
                
                if (!timberA || !timberA.start) return 1;
                if (!timberB || !timberB.start) return -1;
                
                return new Date(timberA.start) - new Date(timberB.start);
            });
            break;
            
        case 'spray':
            projects.sort((a, b) => {
                const sprayA = a.phases?.find(p => p.key === 'spray');
                const sprayB = b.phases?.find(p => p.key === 'spray');
                
                if (!sprayA || !sprayA.start) return 1;
                if (!sprayB || !sprayB.start) return -1;
                
                return new Date(sprayA.start) - new Date(sprayB.start);
            });
            break;
    }
}

// ========== FILTERING ==========

function setTimberFilter(workerId) {
    currentFilter = {
        type: 'timber',
        workerId: workerId
    };
    
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    
    applyFilter();
}

function setSprayFilter(workerId) {
    currentFilter = {
        type: 'spray',
        workerId: workerId
    };
    
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.style.display = 'none';
    });
    
    applyFilter();
}

function clearFilters() {
    currentFilter = null;
    renderUniversal();
}

function applyFilter() {
    if (!currentFilter) {
        renderUniversal();
        return;
    }
    
    const { type, workerId } = currentFilter;
    const phaseKey = type; // 'timber' or 'spray'
    
    // Filter projects and phases
    const filteredProjects = projects.filter(project => {
        if (!project.phases) return false;
        
        const targetPhase = project.phases.find(p => p.key === phaseKey);
        if (!targetPhase) return false;
        
        // Check worker assignment
        if (workerId === 'all') {
            return true; // Show all projects with this phase
        } else if (workerId === 'unassigned') {
            return !targetPhase.assignedTo;
        } else {
            return targetPhase.assignedTo === workerId;
        }
    });
    
    // Temporarily modify projects to show only target phase
    const originalProjects = [...projects];
    
    // Create filtered view
    projects = filteredProjects.map(project => ({
        ...project,
        phases: project.phases.filter(p => p.key === phaseKey)
    }));
    
    renderUniversal();
    
    // Restore original projects after render
    setTimeout(() => {
        projects = originalProjects;
    }, 100);
}

// Override render to apply current filter
const originalRenderUniversal = window.renderUniversal;
window.renderUniversal = function() {
    if (currentFilter) {
        applyFilter();
    } else {
        sortProjects();
        originalRenderUniversal();
    }
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    // Wait for team members to load
    const checkTeamMembers = setInterval(() => {
        if (teamMembers && teamMembers.length > 0) {
            initializeFilterDropdowns();
            clearInterval(checkTeamMembers);
        }
    }, 100);
});
