// ========== TEAM MANAGEMENT SYSTEM ==========
let teamMembers = [];
let currentEditEmployee = null;
let currentUser = null;

// ========== LOAD & DISPLAY ==========
async function loadTeam() {
    try {
        // Load from Supabase - wszystko widoczne, bez zabezpieczeń
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('*')
            .order('name');
        
        if (error) {
            console.error('Error loading team:', error);
            return;
        }
        
        teamMembers = data || [];
        renderTeam(teamMembers);
        updateStats();
        
    } catch (err) {
        console.error('Failed to load team:', err);
    }
}

// Render team table
function renderTeam(members) {
    const tbody = document.getElementById('teamTableBody');
    tbody.innerHTML = '';
    
    if (members.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #999;">No team members found</td></tr>';
        return;
    }
    
    members.forEach(member => {
        const tr = document.createElement('tr');
        
        // Calculate holiday percentage
        const holidayPercent = member.holiday_allowance > 0 ? 
            ((member.holiday_allowance - member.holiday_used) / member.holiday_allowance * 100) : 100;
        
        tr.innerHTML = `
            <td>
                <span class="color-indicator" style="background: ${member.color_code || '#999'};"></span>
            </td>
            <td>
                <strong>${member.name}</strong><br>
                <small style="color: #999;">
                    ${member.email || 'No email'} | ${member.phone || 'No phone'}
                </small>
            </td>
            <td>
                <span class="department-badge dept-${member.department || 'production'}">
                    ${formatDepartment(member.department)}
                </span>
            </td>
            <td>${member.role || '-'}</td>
            <td>
                <small>${formatContract(member.contract_type)}</small>
            </td>
            <td>
                <span class="status-badge status-${member.status?.toLowerCase() || 'active'}">
                    ${member.status || 'Active'}
                </span>
            </td>
            <td>
                <div class="holiday-bar">
                    <div class="holiday-progress">
                        <div class="holiday-fill" style="width: ${holidayPercent}%"></div>
                    </div>
                    <small>${member.holiday_remaining || 0}/${member.holiday_allowance || 28}</small>
                </div>
            </td>
            <td>
                <button class="action-btn" onclick="viewEmployee('${member.id}')" title="View">👁️</button>
                <button class="action-btn" onclick="editEmployee('${member.id}')" title="Edit">✏️</button>
                <button class="action-btn delete" onclick="deactivateEmployee('${member.id}')" title="Deactivate">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update statistics cards
function updateStats() {
    const active = teamMembers.filter(m => m.active && m.status === 'Active');
    const onHoliday = teamMembers.filter(m => m.status === 'Holiday');
    
    document.getElementById('totalEmployees').textContent = teamMembers.length;
    document.getElementById('activeEmployees').textContent = active.length;
    document.getElementById('onHoliday').textContent = onHoliday.length;
    
    // Calculate weekly cost - bez szyfrowania
    const weeklyCost = active.reduce((sum, m) => {
        const hourly = m.hourly_rate || 0;
        return sum + (hourly * 40); // 40 hours/week
    }, 0);
    document.getElementById('weeklyCost').textContent = `£${weeklyCost.toFixed(0)}`;
    
    // Total holiday days available
    const totalHolidayDays = teamMembers.reduce((sum, m) => sum + (m.holiday_remaining || 0), 0);
    document.getElementById('holidayDays').textContent = totalHolidayDays;
}

// ========== ADD/EDIT EMPLOYEE ==========
function openAddEmployeeModal() {
    currentEditEmployee = null;
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    
    // Clear form
    document.getElementById('empName').value = '';
    document.getElementById('empEmail').value = '';
    document.getElementById('empPhone').value = '';
    document.getElementById('empNumber').value = generateEmployeeNumber();
    document.getElementById('empDepartment').value = 'production';
    document.getElementById('empRole').value = '';
    document.getElementById('empContract').value = 'contract';
    document.getElementById('salaryType').value = 'hourly';
    document.getElementById('salaryRate').value = '';
    document.getElementById('empStartDate').value = formatDate(new Date());
    document.getElementById('empColor').value = generateRandomColor();
    document.getElementById('empColorHex').value = document.getElementById('empColor').value;
    document.getElementById('empNotes').value = '';
    document.getElementById('emergencyName').value = '';
    document.getElementById('emergencyPhone').value = '';
    document.getElementById('emergencyRelation').value = '';
    
    openModal('employeeModal');
}

function editEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    currentEditEmployee = id;
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    
    // Fill form
    document.getElementById('empName').value = member.name || '';
    document.getElementById('empEmail').value = member.email || '';
    document.getElementById('empPhone').value = member.phone || '';
    document.getElementById('empNumber').value = member.employee_number || '';
    document.getElementById('empDepartment').value = member.department || 'production';
    document.getElementById('empRole').value = member.role || '';
    document.getElementById('empContract').value = member.contract_type || 'contract';
    document.getElementById('salaryType').value = member.salary_type || 'hourly';
    document.getElementById('salaryRate').value = member.hourly_rate || '';
    document.getElementById('empStartDate').value = member.start_date || '';
    document.getElementById('empColor').value = member.color_code || '#FFA500';
    document.getElementById('empColorHex').value = member.color_code || '#FFA500';
    document.getElementById('empNotes').value = member.notes || '';
    
    // Emergency contact (if stored in JSON)
    if (member.emergency_contact) {
        try {
            const ec = JSON.parse(member.emergency_contact);
            document.getElementById('emergencyName').value = ec.name || '';
            document.getElementById('emergencyPhone').value = ec.phone || '';
            document.getElementById('emergencyRelation').value = ec.relation || '';
        } catch(e) {
            // If not JSON, ignore
        }
    }
    
    openModal('employeeModal');
}

async function saveEmployee() {
    const name = document.getElementById('empName').value.trim();
    
    if (!name) {
        alert('Please enter employee name');
        return;
    }
    
    // Prepare employee data - BEZ SZYFROWANIA i BEZ STATUS
    const employeeData = {
        name: name,
        email: document.getElementById('empEmail').value.trim() || null,
        phone: document.getElementById('empPhone').value.trim() || null,
        employee_number: document.getElementById('empNumber').value.trim() || null,
        department: document.getElementById('empDepartment').value,
        role: document.getElementById('empRole').value.trim() || null,
        contract_type: document.getElementById('empContract').value,
        salary_type: document.getElementById('salaryType').value,
        hourly_rate: parseFloat(document.getElementById('salaryRate').value) || null,
        start_date: document.getElementById('empStartDate').value || null,
        color_code: document.getElementById('empColor').value,
        notes: document.getElementById('empNotes').value.trim() || null,
        active: true
        // USUNIĘTE: status: 'Active' - to jest wyliczane w VIEW!
    };

    console.log('Sending data:', employeeData);
    
    // Add emergency contact if provided
    const emergencyName = document.getElementById('emergencyName').value.trim();
    if (emergencyName) {
        employeeData.emergency_contact = JSON.stringify({
            name: emergencyName,
            phone: document.getElementById('emergencyPhone').value.trim(),
            relation: document.getElementById('emergencyRelation').value.trim()
        });
    }
    
    try {
        if (currentEditEmployee) {
            // Update existing
            const { error } = await supabaseClient
                .from('team_members')
                .update(employeeData)
                .eq('id', currentEditEmployee);
            
            if (error) throw error;
            console.log('✅ Employee updated');
        } else {
            // Insert new
            const { error } = await supabaseClient
                .from('team_members')
                .insert([employeeData]);
            
            if (error) throw error;
            console.log('✅ Employee added');
        }
        
        closeModal('employeeModal');
        loadTeam();
        
    } catch (error) {
        console.error('Error saving employee:', error);
        alert('Error saving employee: ' + error.message);
    }
}

// ========== VIEW EMPLOYEE DETAILS ==========
function viewEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    const panel = document.getElementById('detailPanel');
    const body = document.getElementById('detailBody');
    
    document.getElementById('detailName').textContent = member.name;
    
    // Parse emergency contact if exists
    let emergencyHTML = 'Not provided';
    if (member.emergency_contact) {
        try {
            const ec = JSON.parse(member.emergency_contact);
            emergencyHTML = `${ec.name || '-'} (${ec.relation || '-'})<br>📱 ${ec.phone || '-'}`;
        } catch (e) {
            emergencyHTML = member.emergency_contact;
        }
    }
    
    // Pokaż prawdziwe wynagrodzenie
    const salaryInfo = member.hourly_rate ? 
        `£${member.hourly_rate}/hour` : 
        'Not set';
    
    body.innerHTML = `
        <div class="detail-section">
            <h3>Personal Information</h3>
            <p><strong>Email:</strong> ${member.email || 'Not provided'}</p>
            <p><strong>Phone:</strong> ${member.phone || 'Not provided'}</p>
            <p><strong>Employee #:</strong> ${member.employee_number || 'Not assigned'}</p>
        </div>
        
        <div class="detail-section">
            <h3>Employment Details</h3>
            <p><strong>Department:</strong> <span class="department-badge dept-${member.department}">${formatDepartment(member.department)}</span></p>
            <p><strong>Role:</strong> ${member.role || 'Not specified'}</p>
            <p><strong>Contract:</strong> ${formatContract(member.contract_type)}</p>
            <p><strong>Salary:</strong> ${salaryInfo}</p>
            <p><strong>Status:</strong> <span class="status-badge status-${member.status?.toLowerCase()}">${member.status}</span></p>
            <p><strong>Start Date:</strong> ${formatDateDisplay(member.start_date)}</p>
        </div>
        
        <div class="detail-section">
            <h3>Holiday Information</h3>
            <p><strong>Allowance:</strong> ${member.holiday_allowance || 28} days</p>
            <p><strong>Used:</strong> ${member.holiday_used || 0} days</p>
            <p><strong>Remaining:</strong> ${member.holiday_remaining || member.holiday_allowance} days</p>
            <div class="holiday-progress" style="width: 100%; height: 20px; margin-top: 10px;">
                <div class="holiday-fill" style="width: ${((member.holiday_remaining || 0) / (member.holiday_allowance || 28) * 100)}%; height: 100%;"></div>
            </div>
        </div>
        
        <div class="detail-section">
            <h3>Emergency Contact</h3>
            <p>${emergencyHTML}</p>
        </div>
        
        <div class="detail-section">
            <h3>Notes</h3>
            <p>${member.notes || 'No notes'}</p>
        </div>
        
        <div class="detail-section">
            <h3>System</h3>
            <p><strong>Gantt Color:</strong> <span class="color-indicator" style="background: ${member.color_code};"></span> ${member.color_code}</p>
            <p><strong>Created:</strong> ${formatDateDisplay(member.created_at)}</p>
        </div>
    `;
    
    panel.classList.add('active');
}

function closeDetailPanel() {
    document.getElementById('detailPanel').classList.remove('active');
}

// ========== DEACTIVATE EMPLOYEE ==========
async function deactivateEmployee(id) {
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    
    if (!confirm(`Deactivate employee "${member.name}"?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('team_members')
            .update({ 
                active: false,
                end_date: new Date().toISOString().split('T')[0]
            })
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Employee deactivated');
        loadTeam();
        
    } catch (error) {
        console.error('Error deactivating employee:', error);
        alert('Error: ' + error.message);
    }
}

// ========== HOLIDAYS MODAL ==========
function openHolidaysModal() {
    const tbody = document.getElementById('holidaysTableBody');
    tbody.innerHTML = '';
    
    teamMembers
        .filter(m => m.active)
        .forEach(member => {
            const tr = document.createElement('tr');
            const remaining = member.holiday_remaining || member.holiday_allowance || 0;
            
            tr.innerHTML = `
                <td>${member.name}</td>
                <td>${member.holiday_allowance || 28}</td>
                <td>${member.holiday_used || 0}</td>
                <td><strong>${remaining}</strong></td>
                <td>
                    <input type="number" id="holiday-${member.id}" 
                           min="0" max="${remaining}" value="0" 
                           style="width: 60px;">
                    <button class="action-btn primary" 
                            onclick="bookHoliday('${member.id}')">Book</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    
    openModal('holidaysModal');
}

async function bookHoliday(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    const days = parseInt(document.getElementById(`holiday-${memberId}`).value) || 0;
    if (days <= 0) {
        alert('Please enter valid number of days');
        return;
    }
    
    const remaining = member.holiday_remaining || member.holiday_allowance || 0;
    if (days > remaining) {
        alert(`Cannot book ${days} days. Only ${remaining} days remaining.`);
        return;
    }
    
    const newUsed = (member.holiday_used || 0) + days;
    
    if (!confirm(`Book ${days} days holiday for ${member.name}?`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('team_members')
            .update({ 
                holiday_used: newUsed
                // USUNIĘTE: holiday_remaining - to jest wyliczane w bazie!
            })
            .eq('id', memberId);
        
        if (error) throw error;
        
        console.log('✅ Holiday booked');
        loadTeam();
        openHolidaysModal(); // Refresh modal
        
    } catch (error) {
        console.error('Error booking holiday:', error);
        alert('Error: ' + error.message);
    }
}

// ========== PAYMENTS MODAL ==========
function openPaymentsModal() {
    // Populate employee select
    const select = document.getElementById('paymentEmployee');
    select.innerHTML = '<option value="">Select Employee...</option>';
    
    teamMembers
        .filter(m => m.active)
        .forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            option.textContent = member.name;
            select.appendChild(option);
        });
    
    // Set today's date
    document.getElementById('paymentDate').value = formatDate(new Date());
    
    // Load recent payments
    loadRecentPayments();
    
    openModal('paymentsModal');
}

async function loadRecentPayments() {
    const tbody = document.getElementById('recentPaymentsBody');
    if (!tbody) {
        console.warn('recentPaymentsBody element not found');
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';
    
    try {
        const { data, error } = await supabaseClient
            .from('team_payments')
            .select(`
                *,
                team_members (
                    name
                )
            `)
            .order('payment_date', { ascending: false })
            .limit(20);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No payments found</td></tr>';
            return;
        }
        
        tbody.innerHTML = '';
        data.forEach(payment => {
            const tr = document.createElement('tr');
            // Wyświetl kwoty (poprawione nazwy kolumn)
            const base = parseFloat(payment.base_payment) || 0;
            const bonus = parseFloat(payment.bonus) || 0;
            const total = parseFloat(payment.total) || base + bonus;
            
            tr.innerHTML = `
                <td>${formatDateDisplay(payment.payment_date)}</td>
                <td>${payment.team_members?.name || 'Unknown'}</td>
                <td>£${base.toFixed(2)}</td>
                <td>£${bonus.toFixed(2)}</td>
                <td><strong>£${total.toFixed(2)}</strong></td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Error loading payments:', error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading payments</td></tr>';
    }
}

async function addPayment() {
    const employeeId = document.getElementById('paymentEmployee').value;
    const date = document.getElementById('paymentDate').value;
    const baseAmount = parseFloat(document.getElementById('paymentBase').value) || 0;
    const bonusAmount = parseFloat(document.getElementById('paymentBonus').value) || 0;
    
    if (!employeeId || !date) {
        alert('Please select employee and date');
        return;
    }
    
    if (baseAmount <= 0 && bonusAmount <= 0) {
        alert('Please enter payment amount');
        return;
    }
    
    // Calculate period (assuming weekly payments)
    const paymentDate = new Date(date);
    const dayOfWeek = paymentDate.getDay();
    const startOfWeek = new Date(paymentDate);
    startOfWeek.setDate(paymentDate.getDate() - dayOfWeek + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    
    // BEZ SZYFROWANIA - przechowuj zwykłe liczby jako tekst
    const paymentData = {
        team_member_id: employeeId,
        payment_date: date,
        payment_period: 'weekly',
        period_start: formatDate(startOfWeek),
        period_end: formatDate(endOfWeek),
        base_payment: baseAmount.toFixed(2),  // Poprawione nazwy kolumn
        bonus: bonusAmount > 0 ? bonusAmount.toFixed(2) : null,
        total: (baseAmount + bonusAmount).toFixed(2),
        payment_method: 'bank',
        notes: null,
        approved_by: currentUser?.id || null
    };
    
    try {
        const { error } = await supabaseClient
            .from('team_payments')  // Zmienione z 'payments'
            .insert([paymentData]);
        
        if (error) throw error;
        
        console.log('✅ Payment added');
        
        // Clear form
        document.getElementById('paymentEmployee').value = '';
        document.getElementById('paymentBase').value = '';
        document.getElementById('paymentBonus').value = '';
        
        // Reload payments
        loadRecentPayments();
        
    } catch (error) {
        console.error('Error adding payment:', error);
        alert('Error: ' + error.message);
    }
}

// ========== SEARCH & FILTER ==========
function searchTeam() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = teamMembers.filter(m => 
        (m.name?.toLowerCase().includes(searchTerm)) ||
        (m.email?.toLowerCase().includes(searchTerm)) ||
        (m.role?.toLowerCase().includes(searchTerm)) ||
        (m.employee_number?.toLowerCase().includes(searchTerm))
    );
    renderTeam(filtered);
}

function filterTeam() {
    const dept = document.getElementById('filterDepartment').value;
    const status = document.getElementById('filterStatus').value;
    
    let filtered = teamMembers;
    
    if (dept) {
        filtered = filtered.filter(m => m.department === dept);
    }
    
    if (status) {
        filtered = filtered.filter(m => m.status?.toLowerCase() === status);
    }
    
    renderTeam(filtered);
}

// ========== EXPORT FUNCTIONS ==========
function exportTeamCSV() {
    const csv = [
        ['Name', 'Email', 'Phone', 'Department', 'Role', 'Contract', 'Status', 'Salary/Hour', 'Start Date', 'Holidays Remaining'],
        ...teamMembers.map(m => [
            m.name,
            m.email || '',
            m.phone || '',
            formatDepartment(m.department),
            m.role || '',
            formatContract(m.contract_type),
            m.status || 'Active',
            m.hourly_rate ? `£${m.hourly_rate}` : '',
            m.start_date || '',
            m.holiday_remaining || '0'
        ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function exportTeamJSON() {
    const json = JSON.stringify(teamMembers, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

async function exportPaymentsCSV() {
    try {
        // Pobierz payments z bazy
        const { data, error } = await supabaseClient
            .from('team_payments')
            .select(`
                *,
                team_members (
                    name,
                    employee_number
                )
            `)
            .order('payment_date', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            alert('No payments to export');
            return;
        }
        
        // Stwórz CSV
        const csv = [
            ['Date', 'Employee', 'Employee Number', 'Period', 'Base Amount', 'Bonus', 'Total', 'Payment Method'],
            ...data.map(p => {
                const base = parseFloat(p.base_payment) || 0;
                const bonus = parseFloat(p.bonus) || 0;
                const total = parseFloat(p.total) || base + bonus;
                
                return [
                    p.payment_date,
                    p.team_members?.name || 'Unknown',
                    p.team_members?.employee_number || '-',
                    `${p.period_start} to ${p.period_end}`,
                    `£${base.toFixed(2)}`,
                    `£${bonus.toFixed(2)}`,
                    `£${total.toFixed(2)}`,
                    p.payment_method || 'bank'
                ];
            })
        ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        
    } catch (error) {
        console.error('Error exporting payments:', error);
        alert('Error exporting payments: ' + error.message);
    }
}

// ========== UTILITY FUNCTIONS ==========
function generateEmployeeNumber() {
    const existingNumbers = teamMembers
        .map(m => m.employee_number)
        .filter(n => n && n.startsWith('EMP'))
        .map(n => parseInt(n.replace('EMP', '')) || 0);
    
    const nextNumber = existingNumbers.length > 0 ? 
        Math.max(...existingNumbers) + 1 : 1;
    
    return `EMP${nextNumber.toString().padStart(4, '0')}`;
}

function generateRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D', '#6BCF7F', '#C06FBB'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function formatDate(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

function formatDateDisplay(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-GB');
}

function formatDepartment(dept) {
    if (!dept) return 'Unknown';
    const deptMap = {
        'production': 'Production',
        'spray': 'Spray Shop',
        'installation': 'Installation',
        'drivers': 'Drivers',
        'management': 'Management',
        'admin': 'Admin'
    };
    return deptMap[dept] || dept;
}

function formatContract(type) {
    if (!type) return 'Unknown';
    const typeMap = {
        'contract': 'Contract',
        'permanent': 'Permanent',
        'temporary': 'Temporary',
        'probation': 'Probation'
    };
    return typeMap[type] || type;
}

// ========== MODAL FUNCTIONS ==========
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Color picker sync
document.addEventListener('DOMContentLoaded', function() {
    const colorPicker = document.getElementById('empColor');
    const colorHex = document.getElementById('empColorHex');
    
    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', function() {
            colorHex.value = this.value;
        });
    }
    
    // Load team on start
    loadTeam();
});

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// ========== INITIALIZATION ==========
console.log('Team Management System loaded');