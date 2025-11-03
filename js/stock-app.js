// ========== STOCK MANAGEMENT APP ==========

let stockItems = [];
let filteredItems = [];
let suppliers = [];
// projects i teamMembers są w data.js

// Sortowanie
let currentSortColumn = null;
let currentSortDirection = 'asc'; // 'asc' lub 'desc'

// Subcategory mapping
const subcategories = {
    doors: ['Hinges', 'Locks', 'Handles', 'Seals', 'Other'],
    windows: ['Lead', 'Rope', 'Seals', 'Beads', 'Other'],
    consumables: ['Glue', 'Screws', 'Dowels', 'Biscuits', 'Tape', 'Other'],
    timber: [],
    hardware: [],
    sheet: [],
    glass: [],
    paint: [],
    other: []
};

// Sortowanie stock items
function sortStockItems(column) {
    // Jeśli kliknięto tę samą kolumnę - zmień kierunek
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    filteredItems.sort((a, b) => {
        let valA, valB;
        
        switch(column) {
            case 'item_number':
                valA = a.item_number || '';
                valB = b.item_number || '';
                break;
            case 'qty':
                valA = parseFloat(a.current_quantity) || 0;
                valB = parseFloat(b.current_quantity) || 0;
                break;
            case 'cost':
                valA = parseFloat(a.cost_per_unit) || 0;
                valB = parseFloat(b.cost_per_unit) || 0;
                break;
            case 'value':
                valA = (parseFloat(a.current_quantity) || 0) * (parseFloat(a.cost_per_unit) || 0);
                valB = (parseFloat(b.current_quantity) || 0) * (parseFloat(b.cost_per_unit) || 0);
                break;
            default:
                return 0;
        }
        
        // Sortowanie numeryczne lub alfabetyczne
        if (typeof valA === 'number' && typeof valB === 'number') {
            return currentSortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
            const comparison = String(valA).localeCompare(String(valB));
            return currentSortDirection === 'asc' ? comparison : -comparison;
        }
    });
    
    renderStock();
}


// Update subcategory dropdown based on category
async function updateSubcategoryOptions() {
    const category = document.getElementById('stockCategory').value;
    const subcategorySelect = document.getElementById('stockSubcategory');
    
    subcategorySelect.innerHTML = '<option value="">-- Select subcategory --</option>';
    
    // Load subcategories from database
    const categoryObj = stockCategories.find(c => c.name.toLowerCase() === category && c.type === 'category');
    
    if (categoryObj) {
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === categoryObj.id);
        
        if (subcats.length > 0) {
            subcats.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.name.toLowerCase();
                option.textContent = sub.name;
                subcategorySelect.appendChild(option);
            });
            subcategorySelect.disabled = false;
        } else {
            subcategorySelect.disabled = true;
        }
    } else {
        subcategorySelect.disabled = true;
    }
}

// Update subcategory dropdown for edit modal
async function updateEditSubcategoryOptions() {
    const category = document.getElementById('editStockCategory').value;
    const subcategorySelect = document.getElementById('editStockSubcategory');
    
    subcategorySelect.innerHTML = '<option value="">-- Select subcategory --</option>';
    
    // Find category in stockCategories
    const categoryObj = stockCategories.find(c => c.type === 'category' && c.name === category);
    
    if (categoryObj) {
        // Load subcategories from database
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === categoryObj.id);
        
        if (subcats.length > 0) {
            subcats.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.name.toLowerCase();
                option.textContent = sub.name;
                subcategorySelect.appendChild(option);
            });
            subcategorySelect.disabled = false;
        } else {
            subcategorySelect.disabled = true;
        }
    } else {
        subcategorySelect.disabled = true;
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await loadTeamMembers();
    await loadSuppliers();
    await loadProjects();
    await loadStockItems();
    updateStats();
});

// Load team members
async function loadTeamMembers() {
    try {
        const { data, error } = await supabaseClient
            .from('team_members')
            .select('*')
            .eq('active', true)
            .order('name');
        
        if (error) throw error;
        
        teamMembers = data || [];
        console.log('✅ Loaded', teamMembers.length, 'team members');
        
    } catch (err) {
        console.error('Error loading team members:', err);
    }
}

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
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">IMAGE</th>
                    <th onclick="sortStockItems('item_number')" style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none;">
                        ITEM # ${currentSortColumn === 'item_number' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">NAME</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">SIZE</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">THICKNESS</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">COLOR</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">CATEGORY</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #444; font-size: 12px; color: #999;">SUBCATEGORY</th>
                    <th onclick="sortStockItems('qty')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none;">
                        QTY ${currentSortColumn === 'qty' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999;">MIN</th>
                    <th onclick="sortStockItems('cost')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none;">
                        COST/UNIT ${currentSortColumn === 'cost' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
                    <th onclick="sortStockItems('value')" style="padding: 12px; text-align: right; border-bottom: 2px solid #444; font-size: 12px; color: #999; cursor: pointer; user-select: none;">
                        VALUE ${currentSortColumn === 'value' ? (currentSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </th>
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
    
    // Format date
    const createdDate = item.created_at ? new Date(item.created_at).toLocaleDateString('en-GB') : 'N/A';
    
    return `
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 12px;">
                ${item.image_url ? 
                    `<img src="${item.image_url}" onclick="openImageModal('${item.image_url}')" style="width: 50px; height: 50px; object-fit: cover; border-radius: 3px; cursor: pointer;" title="Click to enlarge">` 
                    : '<div style="width: 50px; height: 50px; background: #3e3e42; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;">📦</div>'}
            </td>
            <td style="padding: 12px;">
                <span style="font-family: monospace; color: #4a9eff; font-weight: 600;" title="Added: ${createdDate}">${item.item_number || '-'}</span>
            </td>
            <td style="padding: 12px;">
                <div style="font-weight: 600; color: #e8e2d5;">${item.name}</div>
                ${item.supplier_id ? `<div style="font-size: 11px; color: #999;">Supplier: ${getSupplierName(item.supplier_id)}</div>` : ''}
                ${item.material_link ? `<div style="font-size: 11px;"><a href="${item.material_link}" target="_blank" style="color: #4CAF50; text-decoration: none;">🔗 Material Link</a></div>` : ''}
            </td>
            <td style="padding: 12px;">
                <span style="color: #4a9eff; font-weight: 500;">${item.size || '-'}</span>
            </td>
            <td style="padding: 12px;">
                <span style="color: #9C27B0; font-weight: 500;">${item.thickness || '-'}</span>
            </td>
            <td style="padding: 12px;">
                ${item.color ? `<span style="padding: 3px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; color: #e8e2d5;">${item.color}</span>` : '<span style="color: #666;">-</span>'}
            </td>
            <td style="padding: 12px;">
                <span style="padding: 4px 8px; background: #3e3e42; border-radius: 3px; font-size: 11px; text-transform: uppercase;">
                    ${item.category}
                </span>
            </td>
            <td style="padding: 12px;">
                ${item.subcategory ? `<span style="padding: 3px 8px; background: #2d2d30; border-radius: 3px; font-size: 11px; color: #ffa500; text-transform: capitalize;">${item.subcategory}</span>` : '<span style="color: #666;">-</span>'}
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

// Helper: Get supplier name by ID
function getSupplierName(supplierId) {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Unknown';
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

// Refresh stock
async function refreshStock() {
    await loadStockItems();
    await loadSuppliers();
    await loadProjects();
    updateStats();
    alert('Stock refreshed!');
}

// Open modals
async function openAddStockModal() {
    // Load categories first
    await loadStockCategories();
    
    document.getElementById('stockName').value = '';
    document.getElementById('stockSize').value = '';
    document.getElementById('stockSizeUnit').value = 'mm';
    document.getElementById('stockThickness').value = '';
    document.getElementById('stockColor').value = '';
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
    
    // Update subcategories for default category
    updateSubcategoryOptions();
    
    document.getElementById('addStockModal').classList.add('active');
}

function openStockInModal(itemId = null) {
    // Reset category filter
    document.getElementById('stockInCategoryFilter').value = '';
    
    // Populate suppliers
    const supplierSelect = document.getElementById('stockInSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.name;
        supplierSelect.appendChild(option);
    });
    
    // Populate workers (active workers only)
    const workerSelect = document.getElementById('stockInWorker');
    workerSelect.innerHTML = '<option value="">-- Select worker --</option>';
    teamMembers.filter(w => w.active === true).forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
    });
    
    // Populate all items initially
    populateStockInItems(stockItems, itemId);
    
    // If itemId provided, preselect default supplier
    if (itemId) {
        const item = stockItems.find(i => i.id === itemId);
        if (item && item.supplier_id) {
            supplierSelect.value = item.supplier_id;
        }
    }
    
    document.getElementById('stockInQty').value = '';
    document.getElementById('stockInCostPerUnit').value = '';
    document.getElementById('stockInInvoice').value = '';
    document.getElementById('stockInCost').value = '';
    document.getElementById('stockInNotes').value = '';
    
    document.getElementById('stockInModal').classList.add('active');
}

// Filter stock items by category in Stock IN
function filterStockInItems() {
    const category = document.getElementById('stockInCategoryFilter').value;
    const filtered = category ? stockItems.filter(item => item.category === category) : stockItems;
    populateStockInItems(filtered);
}

// Populate Stock IN items dropdown
function populateStockInItems(items, selectedId = null) {
    const select = document.getElementById('stockInItem');
    select.innerHTML = '<option value="">Select stock item...</option>';
    
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        
        // Build detailed description
        let desc = item.item_number || 'NO-NUM';
        desc += ` | ${item.name}`;
        if (item.size) desc += ` | ${item.size}`;
        if (item.thickness) desc += ` | ${item.thickness}`;
        if (item.color) desc += ` | ${item.color}`;
        desc += ` (${item.current_quantity} ${item.unit})`;
        
        option.textContent = desc;
        if (selectedId && item.id === selectedId) option.selected = true;
        select.appendChild(option);
    });
    
    // If item was preselected, set cost
    if (selectedId) {
        const item = items.find(i => i.id === selectedId);
        if (item) {
            document.getElementById('stockInCostPerUnit').value = (item.cost_per_unit || 0).toFixed(2);
        }
    }
}

// Handle item selection change
function onStockInItemChange() {
    const itemId = document.getElementById('stockInItem').value;
    const item = stockItems.find(i => i.id === itemId);
    if (item) {
        document.getElementById('stockInCostPerUnit').value = (item.cost_per_unit || 0).toFixed(2);
        calculateStockInCost();
    }
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
        
        // Build detailed description
        let desc = item.item_number || 'NO-NUM';
        desc += ` | ${item.name}`;
        if (item.size) desc += ` | ${item.size}`;
        if (item.thickness) desc += ` | ${item.thickness}`;
        if (item.color) desc += ` | ${item.color}`;
        desc += ` (Available: ${item.current_quantity} ${item.unit})`;
        
        option.textContent = desc;
        if (itemId && item.id === itemId) option.selected = true;
        select.appendChild(option);
    });
    
    // Populate ONLY production projects with type icons
    const projectSelect = document.getElementById('stockOutProject');
    projectSelect.innerHTML = '<option value="">-- Select project --</option>';
    
    // Filter only production projects
    const productionProjects = projects.filter(proj => proj.source === 'production');
    
    productionProjects.forEach(proj => {
        const option = document.createElement('option');
        option.value = proj.project_number;
        
        // Get project type icon
        let icon = '📦'; // default
        if (proj.type === 'doors') icon = '🚪';
        else if (proj.type === 'sash') icon = '🪟';
        else if (proj.type === 'casement') icon = '🪟';
        else if (proj.type === 'kitchen') icon = '🏠';
        else if (proj.type === 'wardrobe') icon = '👔';
        else if (proj.type === 'furniture') icon = '🪑';
        
        option.textContent = `${icon} ${proj.project_number} - ${proj.name}`;
        projectSelect.appendChild(option);
    });
    
    // Populate workers (active workers only)
    const workerSelect = document.getElementById('stockOutWorker');
    workerSelect.innerHTML = '<option value="">-- Select worker --</option>';
    teamMembers.filter(w => w.active === true).forEach(worker => {
        const option = document.createElement('option');
        option.value = worker.id;
        option.textContent = worker.name;
        workerSelect.appendChild(option);
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
    const thickness = document.getElementById('stockThickness').value.trim();
    const color = document.getElementById('stockColor').value.trim();
    const category = document.getElementById('stockCategory').value;
    const subcategory = document.getElementById('stockSubcategory').value || null;
    const unit = document.getElementById('stockUnit').value;
    const minQty = parseFloat(document.getElementById('stockMinQty').value) || 0;
    const cost = parseFloat(document.getElementById('stockCost').value) || 0;
    const supplierId = document.getElementById('stockSupplier').value || null;
    const link = document.getElementById('stockLink').value.trim();
    const notes = document.getElementById('stockNotes').value.trim();
    const imageFile = document.getElementById('stockImage').files[0];
    
    if (!name) {
        alert('Please enter item name');
        return;
    }
    
    try {
        // Generate item_number
        const { data: lastItem, error: lastError } = await supabaseClient
            .from('stock_items')
            .select('item_number')
            .order('item_number', { ascending: false })
            .limit(1);
        
        let nextNumber = 1;
        if (lastItem && lastItem.length > 0 && lastItem[0].item_number) {
            const match = lastItem[0].item_number.match(/^MAT-(\d+)$/);
            if (match && match[1]) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }
        
        const itemNumber = `MAT-${String(nextNumber).padStart(3, '0')}`;
        
        // Upload image if provided
        let imageUrl = null;
        if (imageFile) {
            imageUrl = await uploadStockImage(imageFile, itemNumber);
        }
        
        const { data, error } = await supabaseClient
            .from('stock_items')
            .insert([{
                item_number: itemNumber,
                name,
                size: size,
                thickness: thickness || null,
                color: color || null,
                category,
                subcategory: subcategory,
                unit,
                current_quantity: 0,
                min_quantity: minQty,
                cost_per_unit: cost,
                supplier_id: supplierId,
                material_link: link || null,
                image_url: imageUrl,
                notes: notes || null
            }])
            .select();
        
        if (error) throw error;
        
        console.log('✅ Stock item added:', itemNumber);
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
    const supplierId = document.getElementById('stockInSupplier').value;
    const qty = parseFloat(document.getElementById('stockInQty').value);
    const costPerUnit = parseFloat(document.getElementById('stockInCostPerUnit').value);
    const invoice = document.getElementById('stockInInvoice').value.trim();
    const notes = document.getElementById('stockInNotes').value.trim();
    
    if (!itemId) {
        alert('Please select an item');
        return;
    }
    
    if (!supplierId) {
        alert('Please select a supplier');
        return;
    }
    
    if (!qty || qty <= 0) {
        alert('Please enter valid quantity');
        return;
    }
    
    if (!costPerUnit || costPerUnit <= 0) {
        alert('Please enter cost per unit');
        return;
    }
    
    try {
        const item = stockItems.find(i => i.id === itemId);
        const totalCost = qty * costPerUnit;
        
        // Calculate weighted average
        const oldQty = item.current_quantity || 0;
        const oldCost = item.cost_per_unit || 0;
        const newQty = oldQty + qty;
        const newAvgCost = ((oldQty * oldCost) + (qty * costPerUnit)) / newQty;
        
        console.log('📊 Weighted Average Calculation:');
        console.log('Old:', oldQty, 'units @', oldCost);
        console.log('New:', qty, 'units @', costPerUnit);
        console.log('Result:', newQty, 'units @', newAvgCost.toFixed(2));
        
        // Create transaction with supplier
        const { error: txError } = await supabaseClient
            .from('stock_transactions')
            .insert([{
                stock_item_id: itemId,
                type: 'IN',
                quantity: qty,
                supplier_id: supplierId,
                invoice_number: invoice || null,
                cost: totalCost,
                notes: notes || null
            }]);
        
        if (txError) throw txError;
        
        // Update stock quantity AND weighted average cost
        const { error: updateError } = await supabaseClient
            .from('stock_items')
            .update({ 
                current_quantity: newQty,
                cost_per_unit: newAvgCost
            })
            .eq('id', itemId);
        
        if (updateError) throw updateError;
        
        console.log('✅ Stock IN recorded with supplier');
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
    const item = stockItems.find(i => i.id === itemId);
    if (!item) {
        alert('Item not found');
        return;
    }
    
    document.getElementById('editStockId').value = item.id;
    document.getElementById('editStockName').value = item.name || '';
    
    // Parse size (e.g. "63x120mm" -> "63x120" + "mm")
    if (item.size) {
        const sizeMatch = item.size.match(/^(.+?)(mm×mm|mm|inch×inch|inch|m|kg|ml|litres)$/);
        if (sizeMatch) {
            document.getElementById('editStockSize').value = sizeMatch[1];
            document.getElementById('editStockSizeUnit').value = sizeMatch[2];
        } else {
            document.getElementById('editStockSize').value = item.size;
            document.getElementById('editStockSizeUnit').value = 'mm';
        }
    } else {
        document.getElementById('editStockSize').value = '';
        document.getElementById('editStockSizeUnit').value = 'mm';
    }
    
    document.getElementById('editStockThickness').value = item.thickness || '';
    document.getElementById('editStockColor').value = item.color || '';
    document.getElementById('editStockCategory').value = item.category || 'timber';
    
    // Update subcategory options and set value
    updateEditSubcategoryOptions();
    document.getElementById('editStockSubcategory').value = item.subcategory || '';
    
    document.getElementById('editStockUnit').value = item.unit || 'pcs';
    document.getElementById('editStockMinQty').value = item.min_quantity || 0;
    document.getElementById('editStockCost').value = item.cost_per_unit || 0;
    document.getElementById('editStockLink').value = item.material_link || '';
    document.getElementById('editStockNotes').value = item.notes || '';
    document.getElementById('editStockImageUrl').value = item.image_url || '';
    
    // Show existing image
    const preview = document.getElementById('editStockImagePreview');
    if (item.image_url) {
        preview.innerHTML = `<img src="${item.image_url}" style="max-width: 200px; max-height: 200px; border-radius: 5px;">`;
    } else {
        preview.innerHTML = '';
    }
    
    // Populate suppliers dropdown
    const supplierSelect = document.getElementById('editStockSupplier');
    supplierSelect.innerHTML = '<option value="">-- Select supplier --</option>';
    suppliers.forEach(sup => {
        const option = document.createElement('option');
        option.value = sup.id;
        option.textContent = sup.name;
        if (item.supplier_id === sup.id) option.selected = true;
        supplierSelect.appendChild(option);
    });
    
    document.getElementById('editStockModal').classList.add('active');
}

async function updateStockItem() {
    const id = document.getElementById('editStockId').value;
    const name = document.getElementById('editStockName').value.trim();
    const sizeValue = document.getElementById('editStockSize').value.trim();
    const sizeUnit = document.getElementById('editStockSizeUnit').value;
    const size = sizeValue ? `${sizeValue}${sizeUnit}` : null;
    const thickness = document.getElementById('editStockThickness').value.trim();
    const color = document.getElementById('editStockColor').value.trim();
    const category = document.getElementById('editStockCategory').value;
    const subcategory = document.getElementById('editStockSubcategory').value || null;
    const unit = document.getElementById('editStockUnit').value;
    const minQty = parseFloat(document.getElementById('editStockMinQty').value) || 0;
    const cost = parseFloat(document.getElementById('editStockCost').value) || 0;
    const supplierId = document.getElementById('editStockSupplier').value || null;
    const link = document.getElementById('editStockLink').value.trim();
    const notes = document.getElementById('editStockNotes').value.trim();
    const imageFile = document.getElementById('editStockImage').files[0];
    const currentImageUrl = document.getElementById('editStockImageUrl').value;
    
    if (!name) {
        alert('Please enter item name');
        return;
    }
    
    try {
        const item = stockItems.find(i => i.id === id);
        
        // Upload new image if provided
        let imageUrl = currentImageUrl; // Keep existing if no new upload
        if (imageFile) {
            imageUrl = await uploadStockImage(imageFile, item.item_number);
        }
        
        const { error } = await supabaseClient
            .from('stock_items')
            .update({
                name,
                size,
                thickness: thickness || null,
                color: color || null,
                category,
                subcategory: subcategory,
                unit,
                min_quantity: minQty,
                cost_per_unit: cost,
                supplier_id: supplierId,
                material_link: link || null,
                image_url: imageUrl,
                notes: notes || null
            })
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Stock item updated');
        closeModal('editStockModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error updating stock item:', err);
        alert('Error: ' + err.message);
    }
}

async function deleteStockItem() {
    const id = document.getElementById('editStockId').value;
    const item = stockItems.find(i => i.id === id);
    
    if (!confirm(`Delete "${item.name}"?\n\nThis will also delete all transaction history for this item.`)) {
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_items')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        console.log('✅ Stock item deleted');
        closeModal('editStockModal');
        await loadStockItems();
        
    } catch (err) {
        console.error('Error deleting stock item:', err);
        alert('Error: ' + err.message);
    }
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

// ========== IMAGE UPLOAD ==========

function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.display = 'flex';
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 90%; max-height: 90%; padding: 0; background: transparent; box-shadow: none;">
            <img src="${imageUrl}" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 5px;">
        </div>
    `;
    
    document.body.appendChild(modal);
}

function previewStockImage(input) {
    const preview = document.getElementById('stockImagePreview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 5px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        preview.innerHTML = '';
    }
}

function previewEditStockImage(input) {
    const preview = document.getElementById('editStockImagePreview');
    
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" style="max-width: 200px; max-height: 200px; border-radius: 5px;">`;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadStockImage(file, itemNumber) {
    if (!file) return null;
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${itemNumber}.${fileExt}`;
        const filePath = `${fileName}`;
        
        console.log('📤 Uploading image:', filePath);
        
        // Upload to Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from('stock-images')
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type
            });
        
        if (error) throw error;
        
        // Get public URL
        const { data: urlData } = supabaseClient.storage
            .from('stock-images')
            .getPublicUrl(filePath);
        
        console.log('✅ Image uploaded:', urlData.publicUrl);
        return urlData.publicUrl;
        
    } catch (err) {
        console.error('Error uploading image:', err);
        alert('Error uploading image: ' + err.message);
        return null;
    }
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

// ========== CATEGORIES MANAGEMENT ==========

let stockCategories = [];

// Load categories from database
async function loadStockCategories() {
    try {
        const { data, error } = await supabaseClient
            .from('stock_categories')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        
        stockCategories = data || [];
        console.log('✅ Loaded', stockCategories.length, 'stock categories');
        
    } catch (err) {
        console.error('Error loading stock categories:', err);
    }
}

// Open manage categories modal
async function openManageCategoriesModal() {
    await loadStockCategories();
    displayCategoriesList();
    document.getElementById('manageCategoriesModal').classList.add('active');
}

// Display categories list
function displayCategoriesList() {
    const container = document.getElementById('categoriesList');
    
    const categories = stockCategories.filter(c => c.type === 'category');
    
    let html = '';
    
    categories.forEach(cat => {
        const subcats = stockCategories.filter(s => s.type === 'subcategory' && s.parent_category_id === cat.id);
        
        html += `
            <div style="background: #3e3e42; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 14px;">${cat.name}</strong>
                    <button class="modal-btn danger" onclick="deleteCategory('${cat.id}')" style="padding: 4px 8px; font-size: 11px;">Delete</button>
                </div>
                ${subcats.length > 0 ? `
                    <div style="padding-left: 15px; font-size: 12px; color: #aaa;">
                        ${subcats.map(s => `
                            <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                                <span>↳ ${s.name}</span>
                                <button class="modal-btn danger" onclick="deleteCategory('${s.id}')" style="padding: 2px 6px; font-size: 10px;">Delete</button>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html || '<p style="color: #999;">No categories yet.</p>';
}

// Open add category modal
function openAddCategoryModal() {
    document.getElementById('newCategoryName').value = '';
    document.getElementById('addCategoryModal').classList.add('active');
}

// Open add subcategory modal
async function openAddSubcategoryModal() {
    await loadStockCategories();
    
    const select = document.getElementById('subcategoryParent');
    select.innerHTML = '<option value="">-- Select category --</option>';
    
    stockCategories.filter(c => c.type === 'category').forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
    
    document.getElementById('newSubcategoryName').value = '';
    document.getElementById('addSubcategoryModal').classList.add('active');
}

// Save new category
async function saveNewCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    
    if (!name) {
        alert('Please enter category name');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_categories')
            .insert([{
                name,
                type: 'category',
                display_order: stockCategories.filter(c => c.type === 'category').length + 1
            }]);
        
        if (error) throw error;
        
        alert('Category added successfully!');
        closeModal('addCategoryModal');
        await loadStockCategories();
        displayCategoriesList();
        
    } catch (err) {
        console.error('Error saving category:', err);
        alert('Error: ' + err.message);
    }
}

// Save new subcategory
async function saveNewSubcategory() {
    const name = document.getElementById('newSubcategoryName').value.trim();
    const parentId = document.getElementById('subcategoryParent').value;
    
    if (!name || !parentId) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('stock_categories')
            .insert([{
                name,
                type: 'subcategory',
                parent_category_id: parentId,
                display_order: stockCategories.filter(c => c.type === 'subcategory' && c.parent_category_id === parentId).length + 1
            }]);
        
        if (error) throw error;
        
        alert('Subcategory added successfully!');
        closeModal('addSubcategoryModal');
        await loadStockCategories();
        displayCategoriesList();
        
    } catch (err) {
        console.error('Error saving subcategory:', err);
        alert('Error: ' + err.message);
    }
}

// Delete category
async function deleteCategory(categoryId) {
    // Check if any stock items use this category
    const category = stockCategories.find(c => c.id === categoryId);
    
    const { data: stockCheck } = await supabaseClient
        .from('stock_items')
        .select('id')
        .eq('category', category.name.toLowerCase())
        .limit(1);
    
    if (stockCheck && stockCheck.length > 0) {
        alert('Cannot delete - products are using this category!');
        return;
    }
    
    if (!confirm(`Delete "${category.name}"?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('stock_categories')
            .delete()
            .eq('id', categoryId);
        
        if (error) throw error;
        
        await loadStockCategories();
        displayCategoriesList();
        
    } catch (err) {
        console.error('Error deleting category:', err);
        alert('Error: ' + err.message);
    }
}