// ========== EQUIPMENT MANAGEMENT APP ==========

let machines = [];
let vans = [];
let smallTools = [];
let currentView = 'machines'; // machines / vans / tools
let currentEditItem = null;

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadAllEquipment();
    renderView();
    updateStats();
});

// ========== AUTH CHECK ==========
async function checkAuth() {
    if (typeof supabaseClient !== 'undefined') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        window.currentUser = profile;
        
        // Add logout button
        const toolbar = document.querySelector('.toolbar');
        if (toolbar && !document.getElementById('logoutBtn') && profile) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn';
            logoutBtn.className = 'toolbar-btn';
            logoutBtn.innerHTML = '🚪 Logout (' + (profile.full_name || profile.email) + ')';
            logoutBtn.onclick = logout;
            logoutBtn.style.marginLeft = 'auto';
            toolbar.appendChild(logoutBtn);
        }
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        supabaseClient.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}

// ========== LOAD DATA ==========
async function loadAllEquipment() {
    try {
        // Load machines
        const { data: machinesData, error: machinesError } = await supabaseClient
            .from('machines')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (machinesError) throw machinesError;
        machines = machinesData || [];
        console.log('✅ Loaded', machines.length, 'machines');
        
        // Load vans
        const { data: vansData, error: vansError } = await supabaseClient
            .from('vans')
            .select(`
                *,
                team_members (
                    id,
                    name
                )
            `)
            .order('created_at', { ascending: false });
        
        if (vansError) throw vansError;
        vans = vansData || [];
        console.log('✅ Loaded', vans.length, 'vans');
        
        // Load small tools
        const { data: toolsData, error: toolsError } = await supabaseClient
            .from('small_tools')
            .select('*')
            .order('name', { ascending: true });
        
        if (toolsError) throw toolsError;
        smallTools = toolsData || [];
        console.log('✅ Loaded', smallTools.length, 'small tools');
        
    } catch (err) {
        console.error('Error loading equipment:', err);
        alert('Error loading data: ' + err.message);
    }
}

// ========== VIEW SWITCHING ==========
function switchView(view) {
    currentView = view;
    
    // Update active button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderView();
    updateStats();
}

// ========== RENDER VIEW ==========
function renderView() {
    const container = document.getElementById('equipmentContainer');
    
    if (currentView === 'machines') {
        renderMachinesTable(container);
    } else if (currentView === 'vans') {
        renderVansTable(container);
    } else if (currentView === 'tools') {
        renderToolsTable(container);
    }
}

// ========== RENDER MACHINES TABLE ==========
function renderMachinesTable(container) {
    if (machines.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔧</div>
                <div style="font-size: 18px;">No machines found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Machine" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MANUFACTURER</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MODEL</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">SERIAL #</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">STATUS</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">VALUE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">WARRANTY</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${machines.map(machine => createMachineRow(machine)).join('')}
            </tbody>
        </table>
    `;
}

function createMachineRow(machine) {
    const statusColors = {
        working: '#4CAF50',
        repair: '#ff9800',
        retired: '#f44336'
    };
    
    const warrantyDate = machine.warranty_end_date ? new Date(machine.warranty_end_date) : null;
    const warrantyExpired = warrantyDate && warrantyDate < new Date();
    const warrantyClass = warrantyExpired ? 'expired' : 'active';
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                ${machine.image_url ? 
                    `<img src="${machine.image_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 3px; cursor: pointer;" onclick="viewImage('${machine.image_url}')">` 
                    : '<div style="width: 60px; height: 60px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🔧</div>'}
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${machine.name}</div>
            </td>
            <td style="padding: 12px; color: #b5cea8;">${machine.manufacturer || '-'}</td>
            <td style="padding: 12px; color: #4a9eff;">${machine.model || '-'}</td>
            <td style="padding: 12px; font-family: monospace; color: #999;">${machine.serial_number || '-'}</td>
            <td style="padding: 12px; text-align: center;">
                <span style="padding: 4px 10px; background: ${statusColors[machine.status]}20; color: ${statusColors[machine.status]}; border-radius: 3px; font-size: 11px; text-transform: uppercase; font-weight: 600;">
                    ${machine.status}
                </span>
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #4CAF50;">
                £${(machine.current_value || 0).toLocaleString()}
            </td>
            <td style="padding: 12px; text-align: center;">
                ${warrantyDate ? 
                    `<span style="color: ${warrantyExpired ? '#f44336' : '#4CAF50'};">${warrantyDate.toLocaleDateString('en-GB')}</span>` 
                    : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="viewMachineDetails('${machine.id}')" class="action-btn" style="background: #4a9eff; margin-right: 5px;">📋 Details</button>
                <button onclick="editMachine('${machine.id}')" class="action-btn" style="background: #4ec9b0;">✏️ Edit</button>
                <button onclick="deleteMachine('${machine.id}')" class="action-btn delete" style="background: #f44336;">🗑️</button>
            </td>
        </tr>
    `;
}

// ========== RENDER VANS TABLE ==========
function renderVansTable(container) {
    if (vans.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🚐</div>
                <div style="font-size: 18px;">No vans found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Van" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">REG PLATE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MOT DUE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">INSURANCE DUE</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MILEAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ASSIGNED TO</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">STATUS</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${vans.map(van => createVanRow(van)).join('')}
            </tbody>
        </table>
    `;
}

function createVanRow(van) {
    const motDate = van.mot_due_date ? new Date(van.mot_due_date) : null;
    const insuranceDate = van.insurance_due_date ? new Date(van.insurance_due_date) : null;
    const today = new Date();
    
    const motDaysLeft = motDate ? Math.floor((motDate - today) / (1000 * 60 * 60 * 24)) : null;
    const insuranceDaysLeft = insuranceDate ? Math.floor((insuranceDate - today) / (1000 * 60 * 60 * 24)) : null;
    
    const motColor = motDaysLeft <= 30 ? '#f44336' : (motDaysLeft <= 60 ? '#ff9800' : '#4CAF50');
    const insuranceColor = insuranceDaysLeft <= 30 ? '#f44336' : (insuranceDaysLeft <= 60 ? '#ff9800' : '#4CAF50');
    
    const statusColors = {
        active: '#4CAF50',
        repair: '#ff9800',
        retired: '#f44336'
    };
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                ${van.image_url ? 
                    `<img src="${van.image_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 3px;">` 
                    : '<div style="width: 60px; height: 60px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 24px;">🚐</div>'}
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${van.name}</div>
            </td>
            <td style="padding: 12px; font-family: monospace; font-weight: 600; color: #4a9eff;">${van.registration_plate}</td>
            <td style="padding: 12px; text-align: center;">
                ${motDate ? 
                    `<div style="color: ${motColor}; font-weight: 600;">${motDate.toLocaleDateString('en-GB')}</div>
                     <div style="font-size: 11px; color: ${motColor};">${motDaysLeft} days</div>` 
                    : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                ${insuranceDate ? 
                    `<div style="color: ${insuranceColor}; font-weight: 600;">${insuranceDate.toLocaleDateString('en-GB')}</div>
                     <div style="font-size: 11px; color: ${insuranceColor};">${insuranceDaysLeft} days</div>` 
                    : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #b5cea8;">
                ${(van.mileage || 0).toLocaleString()} mi
            </td>
            <td style="padding: 12px;">
                ${van.team_members ? 
                    `<span style="color: #4ec9b0;">${van.team_members.name}</span>` 
                    : '<span style="color: #666;">Unassigned</span>'}
            </td>
            <td style="padding: 12px; text-align: center;">
                <span style="padding: 4px 10px; background: ${statusColors[van.status]}20; color: ${statusColors[van.status]}; border-radius: 3px; font-size: 11px; text-transform: uppercase; font-weight: 600;">
                    ${van.status}
                </span>
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="viewVanDetails('${van.id}')" class="action-btn" style="background: #4a9eff; margin-right: 5px;">📋 Details</button>
                <button onclick="editVan('${van.id}')" class="action-btn" style="background: #4ec9b0;">✏️ Edit</button>
                <button onclick="deleteVan('${van.id}')" class="action-btn delete" style="background: #f44336;">🗑️</button>
            </td>
        </tr>
    `;
}

// ========== RENDER TOOLS TABLE ==========
function renderToolsTable(container) {
    if (smallTools.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔩</div>
                <div style="font-size: 18px;">No tools found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Tool" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">CATEGORY</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">QUANTITY</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MIN QTY</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">LOCATION</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">COST/UNIT</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${smallTools.map(tool => createToolRow(tool)).join('')}
            </tbody>
        </table>
    `;
}

function createToolRow(tool) {
    const isLowStock = tool.quantity <= tool.min_quantity;
    
    return `
        <tr style="border-bottom: 1px solid #333; ${isLowStock ? 'background: rgba(244, 67, 54, 0.1);' : ''}">
            <td style="padding: 12px;">
                ${tool.image_url ? 
                    `<img src="${tool.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 3px;">` 
                    : '<div style="width: 50px; height: 50px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🔩</div>'}
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${tool.name}</div>
            </td>
            <td style="padding: 12px;">
                <span style="padding: 3px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; text-transform: uppercase;">${tool.category}</span>
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: ${isLowStock ? '#f44336' : '#4CAF50'};">
                ${tool.quantity} ${isLowStock ? '⚠️' : ''}
            </td>
            <td style="padding: 12px; text-align: right; color: #999;">
                ${tool.min_quantity}
            </td>
            <td style="padding: 12px; color: #b5cea8;">
                ${tool.location || '-'}
            </td>
            <td style="padding: 12px; text-align: right; color: #4a9eff;">
                £${(tool.cost_per_unit || 0).toFixed(2)}
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="editTool('${tool.id}')" class="action-btn" style="background: #4ec9b0; margin-right: 5px;">✏️ Edit</button>
                <button onclick="deleteTool('${tool.id}')" class="action-btn delete" style="background: #f44336;">🗑️</button>
            </td>
        </tr>
    `;
}

// ========== STATS ==========
function updateStats() {
    if (currentView === 'machines') {
        const workingMachines = machines.filter(m => m.status === 'working').length;
        const totalValue = machines.reduce((sum, m) => sum + (m.current_value || 0), 0);
        const warrantyExpiring = machines.filter(m => {
            if (!m.warranty_end_date) return false;
            const daysLeft = Math.floor((new Date(m.warranty_end_date) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 && daysLeft <= 90;
        }).length;
        
        document.getElementById('stat1Value').textContent = machines.length;
        document.getElementById('stat1Label').textContent = 'Total Machines';
        
        document.getElementById('stat2Value').textContent = workingMachines;
        document.getElementById('stat2Label').textContent = 'Working';
        
        document.getElementById('stat3Value').textContent = `£${totalValue.toLocaleString()}`;
        document.getElementById('stat3Label').textContent = 'Total Value';
        
        document.getElementById('stat4Value').textContent = warrantyExpiring;
        document.getElementById('stat4Label').textContent = 'Warranty Expiring';
        
    } else if (currentView === 'vans') {
        const activeVans = vans.filter(v => v.status === 'active').length;
        const totalValue = vans.reduce((sum, v) => sum + (v.current_value || 0), 0);
        const motExpiring = vans.filter(v => {
            if (!v.mot_due_date) return false;
            const daysLeft = Math.floor((new Date(v.mot_due_date) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 && daysLeft <= 60;
        }).length;
        const insuranceExpiring = vans.filter(v => {
            if (!v.insurance_due_date) return false;
            const daysLeft = Math.floor((new Date(v.insurance_due_date) - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft > 0 && daysLeft <= 60;
        }).length;
        
        document.getElementById('stat1Value').textContent = vans.length;
        document.getElementById('stat1Label').textContent = 'Total Vans';
        
        document.getElementById('stat2Value').textContent = activeVans;
        document.getElementById('stat2Label').textContent = 'Active';
        
        document.getElementById('stat3Value').textContent = `£${totalValue.toLocaleString()}`;
        document.getElementById('stat3Label').textContent = 'Total Value';
        
        document.getElementById('stat4Value').textContent = `${motExpiring} / ${insuranceExpiring}`;
        document.getElementById('stat4Label').textContent = 'MOT / Insurance Expiring';
        
    } else if (currentView === 'tools') {
        const lowStock = smallTools.filter(t => t.quantity <= t.min_quantity).length;
        const totalQuantity = smallTools.reduce((sum, t) => sum + (t.quantity || 0), 0);
        const totalValue = smallTools.reduce((sum, t) => sum + ((t.quantity || 0) * (t.cost_per_unit || 0)), 0);
        
        document.getElementById('stat1Value').textContent = smallTools.length;
        document.getElementById('stat1Label').textContent = 'Total Items';
        
        document.getElementById('stat2Value').textContent = lowStock;
        document.getElementById('stat2Label').textContent = 'Low Stock';
        
        document.getElementById('stat3Value').textContent = totalQuantity;
        document.getElementById('stat3Label').textContent = 'Total Quantity';
        
        document.getElementById('stat4Value').textContent = `£${totalValue.toLocaleString()}`;
        document.getElementById('stat4Label').textContent = 'Total Value';
    }
}

// ========== MODAL FUNCTIONS ==========

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ========== ADD MACHINE ==========
function openAddMachineModal() {
    currentEditItem = null;
    document.getElementById('machineModalTitle').textContent = 'Add Machine';
    
    // Clear form
    document.getElementById('machineName').value = '';
    document.getElementById('machineManufacturer').value = '';
    document.getElementById('machineModel').value = '';
    document.getElementById('machineSerial').value = '';
    document.getElementById('machinePurchaseDate').value = '';
    document.getElementById('machineWarrantyEnd').value = '';
    document.getElementById('machinePurchaseCost').value = '';
    document.getElementById('machineCurrentValue').value = '';
    document.getElementById('machineStatus').value = 'working';
    document.getElementById('machineImage').value = '';
    document.getElementById('machineNotes').value = '';
    
    document.getElementById('machineModal').classList.add('active');
}

async function saveMachine() {
    const name = document.getElementById('machineName').value.trim();
    
    if (!name) {
        alert('Please enter machine name');
        return;
    }
    
    const machineData = {
        name: name,
        manufacturer: document.getElementById('machineManufacturer').value.trim() || null,
        model: document.getElementById('machineModel').value.trim() || null,
        serial_number: document.getElementById('machineSerial').value.trim() || null,
        purchase_date: document.getElementById('machinePurchaseDate').value || null,
        warranty_end_date: document.getElementById('machineWarrantyEnd').value || null,
        purchase_cost: parseFloat(document.getElementById('machinePurchaseCost').value) || null,
        current_value: parseFloat(document.getElementById('machineCurrentValue').value) || null,
        status: document.getElementById('machineStatus').value,
        image_url: document.getElementById('machineImage').value.trim() || null,
        notes: document.getElementById('machineNotes').value.trim() || null
    };
    
    try {
        if (currentEditItem) {
            // Update existing
            const { error } = await supabaseClient
                .from('machines')
                .update(machineData)
                .eq('id', currentEditItem);
            
            if (error) throw error;
            console.log('✅ Machine updated');
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('machines')
                .insert([machineData]);
            
            if (error) throw error;
            console.log('✅ Machine added');
        }
        
        closeModal('machineModal');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error saving machine:', err);
        alert('Error: ' + err.message);
    }
}

// ========== ADD VAN ==========
async function openAddVanModal() {
    currentEditItem = null;
    document.getElementById('vanModalTitle').textContent = 'Add Van';
    
    // Load team members for assignment
    const { data: teamData } = await supabaseClient
        .from('team_members')
        .select('id, name')
        .eq('active', true)
        .order('name');
    
    const select = document.getElementById('vanAssignedWorker');
    select.innerHTML = '<option value="">Unassigned</option>';
    
    if (teamData) {
        teamData.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });
    }
    
    // Clear form
    document.getElementById('vanName').value = '';
    document.getElementById('vanRegPlate').value = '';
    document.getElementById('vanPurchaseDate').value = '';
    document.getElementById('vanMileage').value = '';
    document.getElementById('vanMotDue').value = '';
    document.getElementById('vanInsuranceDue').value = '';
    document.getElementById('vanPurchaseCost').value = '';
    document.getElementById('vanCurrentValue').value = '';
    document.getElementById('vanAssignedWorker').value = '';
    document.getElementById('vanStatus').value = 'active';
    document.getElementById('vanImage').value = '';
    document.getElementById('vanNotes').value = '';
    
    document.getElementById('vanModal').classList.add('active');
}

async function saveVan() {
    const name = document.getElementById('vanName').value.trim();
    const regPlate = document.getElementById('vanRegPlate').value.trim().toUpperCase();
    
    if (!name) {
        alert('Please enter van name');
        return;
    }
    
    if (!regPlate) {
        alert('Please enter registration plate');
        return;
    }
    
    const vanData = {
        name: name,
        registration_plate: regPlate,
        purchase_date: document.getElementById('vanPurchaseDate').value || null,
        mileage: parseInt(document.getElementById('vanMileage').value) || 0,
        mot_due_date: document.getElementById('vanMotDue').value || null,
        insurance_due_date: document.getElementById('vanInsuranceDue').value || null,
        purchase_cost: parseFloat(document.getElementById('vanPurchaseCost').value) || null,
        current_value: parseFloat(document.getElementById('vanCurrentValue').value) || null,
        assigned_to_worker_id: document.getElementById('vanAssignedWorker').value || null,
        status: document.getElementById('vanStatus').value,
        image_url: document.getElementById('vanImage').value.trim() || null,
        notes: document.getElementById('vanNotes').value.trim() || null
    };
    
    try {
        if (currentEditItem) {
            // Update existing
            const { error } = await supabaseClient
                .from('vans')
                .update(vanData)
                .eq('id', currentEditItem);
            
            if (error) throw error;
            console.log('✅ Van updated');
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('vans')
                .insert([vanData]);
            
            if (error) throw error;
            console.log('✅ Van added');
        }
        
        closeModal('vanModal');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error saving van:', err);
        alert('Error: ' + err.message);
    }
}

// ========== ADD TOOL ==========
function openAddToolModal() {
    currentEditItem = null;
    document.getElementById('toolModalTitle').textContent = 'Add Tool';
    
    // Clear form
    document.getElementById('toolName').value = '';
    document.getElementById('toolCategory').value = 'other';
    document.getElementById('toolQuantity').value = '0';
    document.getElementById('toolMinQuantity').value = '0';
    document.getElementById('toolLocation').value = '';
    document.getElementById('toolCostPerUnit').value = '';
    document.getElementById('toolImage').value = '';
    document.getElementById('toolNotes').value = '';
    
    document.getElementById('toolModal').classList.add('active');
}

async function saveTool() {
    const name = document.getElementById('toolName').value.trim();
    
    if (!name) {
        alert('Please enter tool name');
        return;
    }
    
    const toolData = {
        name: name,
        category: document.getElementById('toolCategory').value,
        quantity: parseInt(document.getElementById('toolQuantity').value) || 0,
        min_quantity: parseInt(document.getElementById('toolMinQuantity').value) || 0,
        location: document.getElementById('toolLocation').value.trim() || null,
        cost_per_unit: parseFloat(document.getElementById('toolCostPerUnit').value) || null,
        image_url: document.getElementById('toolImage').value.trim() || null,
        notes: document.getElementById('toolNotes').value.trim() || null
    };
    
    try {
        if (currentEditItem) {
            // Update existing
            const { error } = await supabaseClient
                .from('small_tools')
                .update(toolData)
                .eq('id', currentEditItem);
            
            if (error) throw error;
            console.log('✅ Tool updated');
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('small_tools')
                .insert([toolData]);
            
            if (error) throw error;
            console.log('✅ Tool added');
        }
        
        closeModal('toolModal');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error saving tool:', err);
        alert('Error: ' + err.message);
    }
}

// ========== EDIT FUNCTIONS ==========
async function editMachine(id) {
    const machine = machines.find(m => m.id === id);
    if (!machine) return;
    
    currentEditItem = id;
    document.getElementById('machineModalTitle').textContent = 'Edit Machine';
    
    // Fill form
    document.getElementById('machineName').value = machine.name || '';
    document.getElementById('machineManufacturer').value = machine.manufacturer || '';
    document.getElementById('machineModel').value = machine.model || '';
    document.getElementById('machineSerial').value = machine.serial_number || '';
    document.getElementById('machinePurchaseDate').value = machine.purchase_date || '';
    document.getElementById('machineWarrantyEnd').value = machine.warranty_end_date || '';
    document.getElementById('machinePurchaseCost').value = machine.purchase_cost || '';
    document.getElementById('machineCurrentValue').value = machine.current_value || '';
    document.getElementById('machineStatus').value = machine.status;
    document.getElementById('machineImage').value = machine.image_url || '';
    document.getElementById('machineNotes').value = machine.notes || '';
    
    document.getElementById('machineModal').classList.add('active');
}

async function editVan(id) {
    const van = vans.find(v => v.id === id);
    if (!van) return;
    
    currentEditItem = id;
    document.getElementById('vanModalTitle').textContent = 'Edit Van';
    
    // Load team members
    const { data: teamData } = await supabaseClient
        .from('team_members')
        .select('id, name')
        .eq('active', true)
        .order('name');
    
    const select = document.getElementById('vanAssignedWorker');
    select.innerHTML = '<option value="">Unassigned</option>';
    
    if (teamData) {
        teamData.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });
    }
    
    // Fill form
    document.getElementById('vanName').value = van.name || '';
    document.getElementById('vanRegPlate').value = van.registration_plate || '';
    document.getElementById('vanPurchaseDate').value = van.purchase_date || '';
    document.getElementById('vanMileage').value = van.mileage || '';
    document.getElementById('vanMotDue').value = van.mot_due_date || '';
    document.getElementById('vanInsuranceDue').value = van.insurance_due_date || '';
    document.getElementById('vanPurchaseCost').value = van.purchase_cost || '';
    document.getElementById('vanCurrentValue').value = van.current_value || '';
    document.getElementById('vanAssignedWorker').value = van.assigned_to_worker_id || '';
    document.getElementById('vanStatus').value = van.status;
    document.getElementById('vanImage').value = van.image_url || '';
    document.getElementById('vanNotes').value = van.notes || '';
    
    document.getElementById('vanModal').classList.add('active');
}

async function editTool(id) {
    const tool = smallTools.find(t => t.id === id);
    if (!tool) return;
    
    currentEditItem = id;
    document.getElementById('toolModalTitle').textContent = 'Edit Tool';
    
    // Fill form
    document.getElementById('toolName').value = tool.name || '';
    document.getElementById('toolCategory').value = tool.category;
    document.getElementById('toolQuantity').value = tool.quantity || 0;
    document.getElementById('toolMinQuantity').value = tool.min_quantity || 0;
    document.getElementById('toolLocation').value = tool.location || '';
    document.getElementById('toolCostPerUnit').value = tool.cost_per_unit || '';
    document.getElementById('toolImage').value = tool.image_url || '';
    document.getElementById('toolNotes').value = tool.notes || '';
    
    document.getElementById('toolModal').classList.add('active');
}

// ========== DELETE FUNCTIONS ==========
async function deleteMachine(id) {
    if (!confirm('Delete this machine? This cannot be undone!')) return;
    
    try {
        const { error } = await supabaseClient
            .from('machines')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Machine deleted');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error deleting machine:', err);
        alert('Error: ' + err.message);
    }
}

async function deleteVan(id) {
    if (!confirm('Delete this van? This cannot be undone!')) return;
    
    try {
        const { error } = await supabaseClient
            .from('vans')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Van deleted');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error deleting van:', err);
        alert('Error: ' + err.message);
    }
}

async function deleteTool(id) {
    if (!confirm('Delete this tool? This cannot be undone!')) return;
    
    try {
        const { error } = await supabaseClient
            .from('small_tools')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Tool deleted');
        await loadAllEquipment();
        renderView();
        updateStats();
        
    } catch (err) {
        console.error('Error deleting tool:', err);
        alert('Error: ' + err.message);
    }
}

// ========== DETAILS/REPORTS (TODO) ==========
function viewMachineDetails(id) {
    alert('View Machine Details - TODO: Service history, documents');
}

function viewVanDetails(id) {
    alert('View Van Details - TODO: Service history, documents');
}

function generateMachinesReport() {
    alert('Generate Machines Report - TODO');
}

function generateVansReport() {
    alert('Generate Vans Report - TODO');
}

function generateToolsReport() {
    alert('Generate Tools Remanent Report - TODO');
}

function viewImage(url) {
    window.open(url, '_blank');
}

console.log('✅ Equipment Management App loaded');