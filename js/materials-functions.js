// ========== ADD MATERIAL FUNCTIONS ==========

let stockCategories = [];
let stockItems = [];
let suppliers = [];
let selectedStockItem = null;

// Otwórz Add Material Modal
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
    
    // Stock category dropdown
    const categorySelect = document.getElementById('addMaterialCategory');
    categorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
    });
    
    // Bespoke category dropdown
    const bespokeCategorySelect = document.getElementById('bespokeMaterialCategory');
    bespokeCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    mainCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        bespokeCategorySelect.appendChild(option);
    });
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