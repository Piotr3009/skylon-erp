// ========== MATERIALS LIST FUNCTIONS ==========

// Globalna zmienna dla aktualnego projektu
let currentMaterialsProject = null;

// Otwórz Materials List Modal
async function openMaterialsList(projectIndex) {
    const project = projects[projectIndex];
    currentMaterialsProject = project;
    
    // Update header info
    document.getElementById('materialsProjectInfo').textContent = 
        `Project: ${project.projectNumber} | ${project.name} | Client: ${project.client_name || 'N/A'}`;
    
    // Załaduj dane
    await loadProjectMaterials(project.id);
    
    // Pokaż modal
    document.getElementById('materialsModal').classList.add('active');
}

// Załaduj materiały projektu
async function loadProjectMaterials(projectId) {
    try {
        const { data, error } = await supabaseClient
            .from('project_materials')
            .select(`
                *,
                stock_items (
                    id,
                    name,
                    image_url,
                    current_quantity,
                    unit,
                    cost_per_unit
                ),
                stock_categories!category_id (
                    id,
                    name
                ),
                suppliers (
                    id,
                    name
                )
            `)
            .eq('project_id', projectId)
            .order('used_in_stage', { ascending: true })
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        // Renderuj materials list
        renderMaterialsList(data);
        
    } catch (error) {
        console.error('Error loading materials:', error);
        alert('Error loading materials list: ' + error.message);
    }
}

// Renderuj Materials List
function renderMaterialsList(materials) {
    const body = document.getElementById('materialsModalBody');
    
    if (!materials || materials.length === 0) {
        body.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #888;">
                <div style="font-size: 48px; margin-bottom: 16px;">📋</div>
                <p style="font-size: 16px; margin-bottom: 20px;">No materials added yet for this project.</p>
                <button class="modal-btn primary" onclick="showAddMaterialModal()">+ Add First Material</button>
            </div>
        `;
        return;
    }
    
    // Grupuj po stage
    const grouped = {
        'Production': [],
        'Spraying': [],
        'Installation': []
    };
    
    materials.forEach(m => {
        if (grouped[m.used_in_stage]) {
            grouped[m.used_in_stage].push(m);
        }
    });
    
    // Render stages
    let html = '';
    
    Object.keys(grouped).forEach(stage => {
        if (grouped[stage].length === 0) return;
        
        const stageIcon = {
            'Production': '📦',
            'Spraying': '🎨',
            'Installation': '🔧'
        }[stage];
        
        const stageClass = stage.toLowerCase();
        
        html += `
            <div class="materials-stage-section ${stageClass}">
                <div class="materials-stage-header">
                    <div class="materials-stage-title">
                        <span>${stageIcon}</span>
                        ${stage.toUpperCase()} STAGE
                    </div>
                </div>
                <table class="materials-table">
                    <thead>
                        <tr>
                            <th style="width: 30%;">Material</th>
                            <th>Needed</th>
                            <th>Reserved</th>
                            <th>In Stock</th>
                            <th>To Order</th>
                            <th>Unit Cost</th>
                            <th>Total Cost</th>
                            <th>Status</th>
                            <th style="width: 100px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${grouped[stage].map(m => renderMaterialRow(m)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    });
    
    // Summary
    const summary = calculateMaterialsSummary(materials);
    html += renderMaterialsSummary(summary);
    
    body.innerHTML = html;
}

// Renderuj pojedynczy wiersz materiału
function renderMaterialRow(material) {
    const stockItem = material.stock_items;
    const inStock = stockItem ? stockItem.current_quantity : 0;
    const toOrder = Math.max(0, material.quantity_needed - material.quantity_reserved);
    const totalCost = material.quantity_needed * (material.unit_cost || 0);
    
    // Status
    let statusBadge = '';
    if (material.is_bespoke) {
        statusBadge = `<span class="material-status-badge status-bespoke">🛒 Bespoke</span>`;
    } else if (toOrder > 0) {
        statusBadge = `<span class="material-status-badge status-warning">⚠️ Order Needed</span>`;
    } else if (material.quantity_reserved > 0) {
        statusBadge = `<span class="material-status-badge status-reserved">🔒 Reserved</span>`;
    } else {
        statusBadge = `<span class="material-status-badge status-ok">✅ In Stock</span>`;
    }
    
    return `
        <tr>
            <td>
                <div class="material-item-cell">
                    ${stockItem?.image_url ? 
                        `<img src="${stockItem.image_url}" class="material-image" alt="${material.item_name}">` :
                        `<div class="material-image-placeholder">📦</div>`
                    }
                    <div>
                        <div class="material-name">${material.item_name}</div>
                        <div class="material-category">${material.stock_categories?.name || 'N/A'}</div>
                        ${material.item_notes ? `<div class="material-category">📝 ${material.item_notes}</div>` : ''}
                    </div>
                </div>
            </td>
            <td class="material-quantity">${material.quantity_needed.toFixed(2)} ${material.unit}</td>
            <td class="material-quantity">${material.quantity_reserved.toFixed(2)} ${material.unit}</td>
            <td class="material-quantity">${material.is_bespoke ? '-' : `${inStock.toFixed(2)} ${material.unit}`}</td>
            <td class="material-quantity">${toOrder > 0 ? `${toOrder.toFixed(2)} ${material.unit}` : '-'}</td>
            <td class="material-cost">£${(material.unit_cost || 0).toFixed(2)}</td>
            <td class="material-cost">£${totalCost.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="icon-btn" onclick="editMaterial('${material.id}')" title="Edit">✏️</button>
                    <button class="icon-btn" onclick="deleteMaterial('${material.id}')" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

// Oblicz summary
function calculateMaterialsSummary(materials) {
    let totalItems = materials.length;
    let itemsToOrder = 0;
    let bespokeItems = 0;
    let estimatedCost = 0;
    
    materials.forEach(m => {
        const toOrder = Math.max(0, m.quantity_needed - m.quantity_reserved);
        if (toOrder > 0) itemsToOrder++;
        if (m.is_bespoke) bespokeItems++;
        estimatedCost += m.quantity_needed * (m.unit_cost || 0);
    });
    
    return { totalItems, itemsToOrder, bespokeItems, estimatedCost };
}

// Renderuj summary
function renderMaterialsSummary(summary) {
    return `
        <div class="materials-summary">
            <div class="materials-summary-grid">
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Total Materials</div>
                    <div class="materials-summary-value">${summary.totalItems}</div>
                </div>
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Items to Order</div>
                    <div class="materials-summary-value ${summary.itemsToOrder > 0 ? 'warning' : ''}">${summary.itemsToOrder}</div>
                </div>
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Bespoke Items</div>
                    <div class="materials-summary-value">${summary.bespokeItems}</div>
                </div>
                <div class="materials-summary-item">
                    <div class="materials-summary-label">Estimated Total Cost</div>
                    <div class="materials-summary-value">£${summary.estimatedCost.toFixed(2)}</div>
                </div>
            </div>
        </div>
    `;
}

// Zamknij modal
function closeMaterialsModal() {
    document.getElementById('materialsModal').classList.remove('active');
    currentMaterialsProject = null;
}

// Placeholder functions (do implementacji później)
async function showAddMaterialModal() {
    // Załaduj dane
    await loadCategoriesAndItems();
    await loadSuppliers();
    
    // Reset form
    resetAddMaterialForm();
    
    // Pokaż modal
    document.getElementById('addMaterialModal').classList.add('active');
}

// Zamknij modal
function closeAddMaterialModal() {
    document.getElementById('addMaterialModal').classList.remove('active');
    resetAddMaterialForm();
}

// Reset formularza
function resetAddMaterialForm() {
    document.getElementById('addMaterialStage').value = '';
    document.querySelectorAll('input[name="materialType"]')[0].checked = true;
    document.getElementById('addMaterialCategory').value = '';
    document.getElementById('addMaterialSubcategory').value = '';
    document.getElementById('addMaterialStockItem').value = '';
    document.getElementById('bespokeItemName').value = '';
    document.getElementById('bespokeMaterialCategory').value = '';
    document.getElementById('bespokeDescription').value = '';
    document.getElementById('bespokeSupplier').value = '';
    document.getElementById('bespokePurchaseLink').value = '';
    document.getElementById('bespokeUnitCost').value = '';
    document.getElementById('addMaterialQuantity').value = '';
    document.getElementById('addMaterialUnit').value = '';
    document.getElementById('addMaterialNotes').value = '';
    
    document.getElementById('stockItemSection').style.display = 'block';
    document.getElementById('bespokeItemSection').style.display = 'none';
    document.getElementById('subcategoryGroup').style.display = 'none';
    document.getElementById('stockItemGroup').style.display = 'none';
    document.getElementById('stockItemInfo').style.display = 'none';
    
    selectedStockItem = null;
}

// Załaduj categories i stock items
async function loadCategoriesAndItems() {
    try {
        // Load categories
        const { data: cats, error: catsError } = await supabaseClient
            .from('stock_categories')
            .select('*')
            .order('name');
        
        if (catsError) throw catsError;
        stockCategories = cats || [];
        
        // Load stock items
        const { data: items, error: itemsError } = await supabaseClient
            .from('stock_items')
            .select('*')
            .order('name');
        
        if (itemsError) throw itemsError;
        stockItems = items || [];
        
        // Populate category dropdowns
        populateCategoryDropdowns();
        
    } catch (error) {
        console.error('Error loading categories and items:', error);
        alert('Error loading data: ' + error.message);
    }
}

// Załaduj suppliers
async function loadSuppliers() {
    try {
        const { data, error } = await supabaseClient
            .from('suppliers')
            .select('*')
            .order('name');
        
        if (error) throw error;
        suppliers = data || [];
        
        // Populate supplier dropdown
        const supplierSelect = document.getElementById('bespokeSupplier');
        supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>';
        suppliers.forEach(s => {
            const option = document.createElement('option');
            option.value = s.id;
            option.textContent = s.name;
            supplierSelect.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

// Populate category dropdowns
function populateCategoryDropdowns() {
    const mainCategories = stockCategories.filter(c => c.type === 'category');
    console.log('📦 Populating categories:', mainCategories.length, 'categories found');
    
    // Stock category dropdown
    const categorySelect = document.getElementById('addMaterialCategory');
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
    
    console.log('✅ Stock category dropdown populated with', categorySelect.options.length - 1, 'options');
    
    // Bespoke category dropdown
    const bespokeCategorySelect = document.getElementById('bespokeMaterialCategory');
    bespokeCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        bespokeCategorySelect.appendChild(option);
    });
    
    console.log('✅ Bespoke category dropdown populated with', bespokeCategorySelect.options.length - 1, 'options');
}

// Stage change
function onStageChange() {
    // Możesz tu dodać logikę filtrowania categorii per stage jeśli potrzebne
}

// Material type change (Stock vs Bespoke)
function onMaterialTypeChange() {
    const type = document.querySelector('input[name="materialType"]:checked').value;
    
    if (type === 'stock') {
        document.getElementById('stockItemSection').style.display = 'block';
        document.getElementById('bespokeItemSection').style.display = 'none';
    } else {
        document.getElementById('stockItemSection').style.display = 'none';
        document.getElementById('bespokeItemSection').style.display = 'block';
    }
}

// Category change
function onCategoryChange() {
    const categoryId = document.getElementById('addMaterialCategory').value;
    
    if (!categoryId) {
        document.getElementById('subcategoryGroup').style.display = 'none';
        document.getElementById('stockItemGroup').style.display = 'none';
        return;
    }
    
    // Znajdź subcategories dla tej kategorii
    const subcats = stockCategories.filter(c => 
        c.type === 'subcategory' && c.parent_category_id === categoryId
    );
    
    if (subcats.length > 0) {
        // Pokaż subcategory dropdown
        const subcatSelect = document.getElementById('addMaterialSubcategory');
        subcatSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
        subcats.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.id;
            option.textContent = sub.name;
            subcatSelect.appendChild(option);
        });
        document.getElementById('subcategoryGroup').style.display = 'block';
        document.getElementById('stockItemGroup').style.display = 'none';
    } else {
        // Nie ma subcategorii - pokaż od razu items
        document.getElementById('subcategoryGroup').style.display = 'none';
        populateStockItems(categoryId, null);
    }
}

// Subcategory change
function onSubcategoryChange() {
    const categoryId = document.getElementById('addMaterialCategory').value;
    const subcategoryId = document.getElementById('addMaterialSubcategory').value;
    
    if (subcategoryId) {
        populateStockItems(categoryId, subcategoryId);
    }
}

// Populate stock items dropdown
function populateStockItems(categoryId, subcategoryId) {
    const category = stockCategories.find(c => c.id === categoryId);
    
    // Filtruj items po category name
    let filteredItems = stockItems.filter(item => 
        item.category && item.category.toLowerCase() === category.name.toLowerCase()
    );
    
    // Jeśli jest subcategory - dodatkowy filtr
    if (subcategoryId) {
        const subcategory = stockCategories.find(c => c.id === subcategoryId);
        filteredItems = filteredItems.filter(item =>
            item.subcategory && item.subcategory.toLowerCase() === subcategory.name.toLowerCase()
        );
    }
    
    const itemSelect = document.getElementById('addMaterialStockItem');
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
    
    filteredItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.name}${item.size ? ' - ' + item.size : ''}${item.color ? ' - ' + item.color : ''}`;
        itemSelect.appendChild(option);
    });
    
    document.getElementById('stockItemGroup').style.display = 'block';
}

// Stock item change
function onStockItemChange() {
    const itemId = document.getElementById('addMaterialStockItem').value;
    
    if (!itemId) {
        document.getElementById('stockItemInfo').style.display = 'none';
        selectedStockItem = null;
        return;
    }
    
    selectedStockItem = stockItems.find(i => i.id === itemId);
    
    if (selectedStockItem) {
        // Pokaż info o item
        document.getElementById('itemInStock').textContent = 
            `${selectedStockItem.current_quantity || 0} ${selectedStockItem.unit}`;
        document.getElementById('itemUnit').textContent = selectedStockItem.unit;
        document.getElementById('itemCost').textContent = 
            `£${(selectedStockItem.cost_per_unit || 0).toFixed(2)}`;
        document.getElementById('stockItemInfo').style.display = 'block';
        
        // Auto-fill unit
        document.getElementById('addMaterialUnit').value = selectedStockItem.unit;
    }
}

// Save material
async function saveMaterial() {
    try {
        // Validation
        const stage = document.getElementById('addMaterialStage').value;
        const quantity = parseFloat(document.getElementById('addMaterialQuantity').value);
        const unit = document.getElementById('addMaterialUnit').value.trim();
        
        if (!stage) {
            alert('Please select a stage');
            return;
        }
        
        if (!quantity || quantity <= 0) {
            alert('Please enter a valid quantity');
            return;
        }
        
        if (!unit) {
            alert('Please enter a unit');
            return;
        }
        
        const materialType = document.querySelector('input[name="materialType"]:checked').value;
        let materialData = {
            project_id: currentMaterialsProject.id,
            used_in_stage: stage,
            quantity_needed: quantity,
            unit: unit,
            item_notes: document.getElementById('addMaterialNotes').value.trim() || null,
            quantity_reserved: 0,
            quantity_used: 0,
            quantity_wasted: 0,
            usage_recorded: false
        };
        
        if (materialType === 'stock') {
            // Stock item
            if (!selectedStockItem) {
                alert('Please select a stock item');
                return;
            }
            
            materialData.stock_item_id = selectedStockItem.id;
            materialData.item_name = selectedStockItem.name;
            materialData.unit_cost = selectedStockItem.cost_per_unit;
            materialData.is_bespoke = false;
            
            const categoryId = document.getElementById('addMaterialCategory').value;
            const subcategoryId = document.getElementById('addMaterialSubcategory').value;
            materialData.category_id = categoryId || null;
            materialData.subcategory_id = subcategoryId || null;
            
        } else {
            // Bespoke item
            const bespokeName = document.getElementById('bespokeItemName').value.trim();
            const bespokeCategory = document.getElementById('bespokeMaterialCategory').value;
            const bespokeUnitCost = parseFloat(document.getElementById('bespokeUnitCost').value);
            
            if (!bespokeName) {
                alert('Please enter item name');
                return;
            }
            
            if (!bespokeCategory) {
                alert('Please select a category');
                return;
            }
            
            if (!bespokeUnitCost || bespokeUnitCost < 0) {
                alert('Please enter a valid unit cost');
                return;
            }
            
            materialData.stock_item_id = null;
            materialData.item_name = bespokeName;
            materialData.unit_cost = bespokeUnitCost;
            materialData.is_bespoke = true;
            materialData.category_id = bespokeCategory;
            materialData.subcategory_id = null;
            materialData.bespoke_description = document.getElementById('bespokeDescription').value.trim() || null;
            materialData.supplier_id = document.getElementById('bespokeSupplier').value || null;
            materialData.purchase_link = document.getElementById('bespokePurchaseLink').value.trim() || null;
        }
        
        // Save to database
        const { data: newMaterial, error: insertError } = await supabaseClient
            .from('project_materials')
            .insert(materialData)
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        // Jeśli to stock item - utwórz RESERVATION
        if (materialType === 'stock' && selectedStockItem) {
            const availableStock = selectedStockItem.current_quantity || 0;
            const toReserve = Math.min(availableStock, quantity);
            
            if (toReserve > 0) {
                const { error: reserveError } = await supabaseClient
                    .from('stock_transactions')
                    .insert({
                        stock_item_id: selectedStockItem.id,
                        type: 'RESERVED',
                        quantity: toReserve,
                        project_id: currentMaterialsProject.id,
                        project_material_id: newMaterial.id,
                        notes: `Reserved for ${currentMaterialsProject.projectNumber} - ${stage}`
                    });
                
                if (reserveError) throw reserveError;
                
                // Update quantity_reserved w project_materials
                await supabaseClient
                    .from('project_materials')
                    .update({ quantity_reserved: toReserve })
                    .eq('id', newMaterial.id);
            }
        }
        
        alert('Material added successfully!');
        closeAddMaterialModal();
        
        // Reload materials list
        await loadProjectMaterials(currentMaterialsProject.id);
        
    } catch (error) {
        console.error('Error saving material:', error);
        alert('Error saving material: ' + error.message);
    }
}