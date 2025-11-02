// ========== STOCK MANAGEMENT APP ==========

let stockItems = [];
let filteredItems = [];
let suppliers = [];
let projects = [];

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await loadSuppliers();
    await loadProjects();
    await loadStockItems();
    updateStats();
});

// Load suppliers
async function loadSuppliers() {
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        suppliers = data || [];
        console.log('✅ Loaded', suppliers.length, 'suppliers');
        
    } catch (err) {
        console.error('Error loading suppliers:', err);
    }
}

// Load projects from production and pipeline
async function loadProjects() {
    try {
        const { data: prodProjects, error: prodError } = await supabaseClient
            .from('projects')
            .select('id, project_number, name')
            .order('project_number', { ascending: false });
        
        const { data: pipeProjects, error: pipeError } = await supabaseClient
            .from('pipeline_projects')
            .select('id, project_number, name')
            .order('project_number', { ascending: false});
        
        if (prodError) console.error('Error loading production projects:', prodError);
        if (pipeError) console.error('Error loading pipeline projects:', pipeError);
        
        projects = [
            ...(prodProjects || []).map(p => ({ ...p, source: 'production' })),
            ...(pipeProjects || []).map(p => ({ ...p, source: 'pipeline' }))
        ];
        
        console.log('✅ Loaded', projects.length, 'projects');
        
    } catch (err) {
        console.error('Error loading projects:', err);
    }
}

// Load stock items
async function loadStockItems() {
    try {
        const { data, error } = await supabaseClient
            .from('stock_items')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        stockItems = data || [];
        filteredItems = [...stockItems];
        
        console.log('✅ Loaded', stockItems.length, 'stock items');
        
        renderStockTable();
        updateStats();
        
    } catch (err) {
        console.error('Error loading stock:', err);
        alert('Error loading stock items');
    }
}

// Render stock table
function renderStockTable() {
    const container = document.getElementById('stockContainer');
    
    if (filteredItems.length === 0) {
        container.innerHTML = `
            <div style="padding: 60px; text-align: center; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">📦</div>
                <div style="font-size: 18px;">No stock items found</div>
                <div style="font-size: 14px; margin-top: 10px;">Click "+ Add Stock Item" to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: #252526;">
                <tr>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">CATEGORY</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">QTY</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MIN</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">COST/UNIT</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">VALUE</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #444; font-size: 12px; color: #999;">ACTIONS</th>
                </tr>
            </thead>
            <tbody>
                ${filteredItems.map(item => createStockRow(item)).join('')}
            </tbody>
        </table>
    `;
}

// Create stock row
function createStockRow(item) {
    const isLowStock = item.current_quantity <= item.min_quantity;
    const value = (item.current_quantity || 0) * (item.cost_per_unit || 0);
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${item.name}</div>
                ${item.size ? `<div style="font-size: 11px; color: #4a9eff;">📏 ${item.size}</div>` : ''}
                ${item.supplier ? `<div style="font-size: 11px; color: #999;">Supplier: ${item.supplier}</div>` : ''}
                ${item.material_link ? `<div style="font-size: 11px;"><a href="${item.material_link}" target="_blank" style="color: #4CAF50; text-decoration: none;">🔗 Material Link</a></div>` : ''}
            </td>
            <td style="padding: 12px;">
                <span style="padding: 4px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; text-transform: uppercase;">
                    ${item.category}
                </span>
            </td>
            <td style="padding: 12px; text-align: right;">
                <span style="font-weight: 600; color: ${isLowStock ? '#ff9800' : '#4CAF50'};">
                    ${item.current_quantity || 0} ${item.unit}
                </span>
                ${isLowStock ? '<div style="font-size: 10px; color: #ff9800;">⚠️ LOW</div>' : ''}
            </td>
            <td style="padding: 12px; text-align: right; color: #999;">
                ${item.min_quantity || 0} ${item.unit}
            </td>
            <td style="padding: 12px; text-align: right; color: #e8e2d5;">
                £${(item.cost_per_unit || 0).toFixed(2)}
            </td>
            <td style="padding: 12px; text-align: right; font-weight: 600; color: #4CAF50;">
                £${value.toFixed(2)}
            </td>
            <td style="padding: 12px; text-align: center;">
                <button onclick="openStockInModal('${item.id}')" class="toolbar-btn success" style="padding: 6px 10px; font-size: 11px; margin-right: 5px;">📥 IN</button>
                <button onclick="openStockOutModal('${item.id}')" class="toolbar-btn danger" style="padding: 6px 10px; font-size: 11px; margin-right: 5px;">📤 OUT</button>
                <button onclick="editStockItem('${item.id}')" class="toolbar-btn" style="padding: 6px 10px; font-size: 11px;">✏️</button>
            </td>
        </tr>
    `;
}

// Update stats
function updateStats() {
    const total = stockItems.length;
    const lowStock = stockItems.filter(item => item.current_quantity <= item.min_quantity).length;
    const totalValue = stockItems.reduce((sum, item) => {
        return sum + ((item.current_quantity || 0) * (item.cost_per_unit || 0));
    }, 0);
    
    document.getElementById('totalItems').textContent = total;
    document.getElementById('lowStockCount').textContent = lowStock;
    document.getElementById('totalValue').textContent = '£' + totalValue.toFixed(2);
}

// Filter stock
function filterStock() {
    const category = document.getElementById('categoryFilter').value;
    
    filteredItems = stockItems.filter(item => {
        if (category && item.category !== category) return false;
        return true;
    });
    
    renderStockTable();
}

// Open modals
function openAddStockModal() {
    document.getElementById('stockName').value = '';
    document.getElementById('stockSize').value = '';
    document.getElementById('stockSizeUnit').value = 'mm';
    document.getElementById('stockCategory').value = 'timber';
    document.getElementById('stockUnit').value = 'pcs';
    document.getElementById('stockMinQty').value = '0';
    document.getElementById('stockCost').value = '0';
    document.getElementById('stockLink').value = '';
    document.getElementById('stockNotes').value = '';
    
    // Populate suppliers
    const supplierSelect = document.getElementById('stockSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.name;
        supplierSelect.appendChild(option);
    });
    
    document.getElementById('addStockModal').classList.add('active');
}

function openStockInModal(itemId = null) {
    const select = document.getElementById('stockInItem');
    select.innerHTML = '<option value="">Select stock item...</option>';
    
    stockItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (${item.current_quantity} ${item.unit})`;
        if (itemId && item.id === itemId) option.selected = true;
        select.appendChild(option);
    });
    
    document.getElementById('stockInQty').value = '';
    document.getElementById('stockInCostPerUnit').value = '';
    document.getElementById('stockInInvoice').value = '';
    document.getElementById('stockInCost').value = '';
    document.getElementById('stockInNotes').value = '';
    
    // Set cost per unit when item selected
    if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        if (item) {
            document.getElementById('stockInCostPerUnit').value = (item.cost_per_unit || 0).toFixed(2);
        }
    }
    
    // Add event listener for item selection
    select.addEventListener('change', function() {
        const item = stockItems.find(i => i.id === this.value);
        if (item) {
            document.getElementById('stockInCostPerUnit').value = (item.cost_per_unit || 0).toFixed(2);
            calculateStockInCost();
        }
    });
    
    document.getElementById('stockInModal').classList.add('active');
}

// Calculate total cost for Stock IN
function calculateStockInCost() {
    const qty = parseFloat(document.getElementById('stockInQty').value) || 0;
    const costPerUnit = parseFloat(document.getElementById('stockInCostPerUnit').value) || 0;
    const totalCost = qty * costPerUnit;
    document.getElementById('stockInCost').value = totalCost.toFixed(2);
}

function openStockOutModal(itemId = null) {
    const select = document.getElementById('stockOutItem');
    select.innerHTML = '<option value="">Select stock item...</option>';
    
    stockItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name} (Available: ${item.current_quantity} ${item.unit})`;
        if (itemId && item.id === itemId) option.selected = true;
        select.appendChild(option);
    });
    
    // Populate projects
    const projectSelect = document.getElementById('stockOutProject');
    projectSelect.innerHTML = '<option value="">-- Select project --</option>';
    projects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.project_number;
        const source = proj.source === 'production' ? '🏭' : '📋';
        option.textContent = `${source} ${proj.project_number} - ${proj.name}`;
        projectSelect.appendChild(option);
    });
    
    if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        if (item) {
            document.getElementById('stockOutAvailable').textContent = `Available: ${item.current_quantity} ${item.unit}`;
        }
    }
    
    document.getElementById('stockOutQty').value = '';
    document.getElementById('stockOutNotes').value = '';
    
    document.getElementById('stockOutModal').classList.add('active');
    
    // Update available quantity on item change
    select.addEventListener('change', function() {
        const item = stockItems.find(i => i.id === this.value);
        if (item) {
            document.getElementById('stockOutAvailable').textContent = `Available: ${item.current_quantity} ${item.unit}`;
        }
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Save stock item
async function saveStockItem() {
    const name = document.getElementById('stockName').value.trim();
    const sizeValue = document.getElementById('stockSize').value.trim();
    const sizeUnit = document.getElementById('stockSizeUnit').value;
    const size = sizeValue ? `${sizeValue}${sizeUnit}` : null;
    const category = document.getElementById('stockCategory').value;
    const unit = document.getElementById('stockUnit').value;
    const minQty = parseFloat(document.getElementById('stockMinQty').value) || 0;
    const cost = parseFloat(document.getElementById('stockCost').value) || 0;
    const supplierId = document.getElementById('stockSupplier').value || null;
    const link = document.getElementById('stockLink').value.trim();
    const notes = document.getElementById('stockNotes').value.trim();
    
    if (!name) {
        alert('Please enter item name');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('stock_items')
            .insert([{
                name,
                size: size,
                category,
                unit,
                current_quantity: 0, // Start with 0, add via Stock IN
                min_quantity: minQty,
                cost_per_unit: cost,
                supplier_id: supplierId,
                material_link: link || null,
                notes: notes || null
            }])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Stock item added');
        closeModal('addStockModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error saving stock item:', err);
        alert('Error saving stock item: ' + err.message);
    }
}

// Save stock IN
async function saveStockIn() {
    const itemId = document.getElementById('stockInItem').value;
    const qty = parseFloat(document.getElementById('stockInQty').value);
    const invoice = document.getElementById('stockInInvoice').value.trim();
    const cost = parseFloat(document.getElementById('stockInCost').value) || 0;
    const notes = document.getElementById('stockInNotes').value.trim();
    
    if (!itemId) {
        alert('Please select an item');
        return;
    }
    
    if (!qty || qty <= 0) {
        alert('Please enter valid quantity');
        return;
    }
    
    try {
        const item = stockItems.find(i => i.id === itemId);
        
        // Create transaction
        const { error: txError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: itemId,
                type: 'IN',
                quantity: qty,
                invoice_number: invoice || null,
                cost: cost,
                notes: notes || null
            }]);
        
        if (txError) throw txError;
        
        // Update stock quantity
        const newQty = (item.current_quantity || 0) + qty;
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({ current_quantity: newQty })
            .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        console.log('✅ Stock IN recorded');
        closeModal('stockInModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error recording stock IN:', err);
        alert('Error: ' + err.message);
    }
}

// Save stock OUT
async function saveStockOut() {
    const itemId = document.getElementById('stockOutItem').value;
    const qty = parseFloat(document.getElementById('stockOutQty').value);
    const projectNumber = document.getElementById('stockOutProject').value;
    const notes = document.getElementById('stockOutNotes').value.trim();
    
    if (!itemId) {
        alert('Please select an item');
        return;
    }
    
    if (!qty || qty <= 0) {
        alert('Please enter valid quantity');
        return;
    }
    
    if (!projectNumber) {
        alert('Please select a project');
        return;
    }
    
    const item = stockItems.find(i => i.id === itemId);
    
    if (qty > item.current_quantity) {
        alert(`Not enough stock! Available: ${item.current_quantity} ${item.unit}`);
        return;
    }
    
    try {
        // Create transaction
        const { error: txError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: itemId,
                type: 'OUT',
                quantity: qty,
                project_number: projectNumber,
                notes: notes || null
            }]);
        
        if (txError) throw txError;
        
        // Update stock quantity
        const newQty = item.current_quantity - qty;
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({ current_quantity: newQty })
            .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        console.log('✅ Stock OUT recorded');
        closeModal('stockOutModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error recording stock OUT:', err);
        alert('Error: ' + err.message);
    }
}

function editStockItem(itemId) {
    alert('Edit Modal - Coming in next commit (5 min)');
}

// ========== SUPPLIER MANAGEMENT ==========

function openAddSupplierModal() {
    document.getElementById('supplierName').value = '';
    document.getElementById('supplierContact').value = '';
    document.getElementById('supplierEmail').value = '';
    document.getElementById('supplierPhone').value = '';
    document.getElementById('supplierWebsite').value = '';
    document.getElementById('supplierNotes').value = '';
    
    document.getElementById('addSupplierModal').classList.add('active');
}

async function saveSupplier() {
    const name = document.getElementById('supplierName').value.trim();
    const contact = document.getElementById('supplierContact').value.trim();
    const email = document.getElementById('supplierEmail').value.trim();
    const phone = document.getElementById('supplierPhone').value.trim();
    const website = document.getElementById('supplierWebsite').value.trim();
    const notes = document.getElementById('supplierNotes').value.trim();
    
    if (!name) {
        alert('Please enter supplier name');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .insert([{
                name,
                contact_person: contact || null,
                email: email || null,
                phone: phone || null,
                website: website || null,
                notes: notes || null
            }])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Supplier added');
        closeModal('addSupplierModal');
        
        // Reload suppliers and update dropdown
        await loadSuppliers();
        
        // Select the newly added supplier
        if (data && data[0]) {
            document.getElementById('stockSupplier').value = data[0].id;
        }
        
    } catch (err) {
        console.error('Error saving supplier:', err);
        alert('Error saving supplier: ' + err.message);
    }
}