// ========== MATERIALS LIST FUNCTIONS ==========

// Globalna zmienna dla aktualnego projektu
let currentMaterialsProject = null;

// Otwórz Materials List Modal
async function openMaterialsList(projectIndex) {
    const project = projects[projectIndex];
    currentMaterialsProject = project;
    
    // Update header info
    document.getElementById('materialsProjectInfo').textContent = 
        `Project: ${project.project_number} | ${project.name} | Client: ${project.client_name || 'N/A'}`;
    
    // Załaduj dane
    await loadProjectMaterials(project.id);
    
    // Pokaż modal
    document.getElementById('materialsModal').classList.add('active');
}

// Załaduj materiały projektu
async function loadProjectMaterials(projectId) {
    try {
        const { data, error } = await supabase
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
        showNotification('Error loading materials list', 'error');
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
function showAddMaterialModal() {
    showNotification('Add Material function - to be implemented', 'info');
}

function editMaterial(materialId) {
    showNotification('Edit Material function - to be implemented', 'info');
}

async function deleteMaterial(materialId) {
    if (!confirm('Are you sure you want to delete this material?')) return;
    
    try {
        const { error } = await supabase
            .from('project_materials')
            .delete()
            .eq('id', materialId);
        
        if (error) throw error;
        
        showNotification('Material deleted successfully', 'success');
        await loadProjectMaterials(currentMaterialsProject.id);
        
    } catch (error) {
        console.error('Error deleting material:', error);
        showNotification('Error deleting material', 'error');
    }
}

function exportMaterialsPDF() {
    showNotification('Export PDF function - to be implemented', 'info');
}

function generateShoppingList() {
    showNotification('Shopping List function - to be implemented', 'info');
}

// Auto-load template przy tworzeniu projektu
async function autoLoadMaterialsTemplate(projectId, projectType) {
    const template = getMaterialsTemplate(projectType);
    
    if (!template || template.length === 0) {
        console.log('No template for project type:', projectType);
        return;
    }
    
    try {
        // Dla każdego item w template
        for (const templateItem of template) {
            // Znajdź category
            const { data: category } = await supabase
                .from('stock_categories')
                .select('id, name')
                .eq('name', templateItem.category_name)
                .eq('type', 'category')
                .maybeSingle();
            
            if (!category) {
                console.log('Category not found:', templateItem.category_name);
                continue;
            }
            
            // Znajdź subcategory (jeśli jest)
            let subcategory = null;
            if (templateItem.subcategory_name) {
                const { data: subcat } = await supabase
                    .from('stock_categories')
                    .select('id, name')
                    .eq('name', templateItem.subcategory_name)
                    .eq('type', 'subcategory')
                    .eq('parent_category_id', category.id)
                    .maybeSingle();
                
                subcategory = subcat;
            }
            
            // Konstruuj item_name
            const itemName = `${templateItem.category_name}${templateItem.subcategory_name ? ' - ' + templateItem.subcategory_name : ''} (select item)`;
            
            // Dodaj placeholder do project_materials
            await supabase.from('project_materials').insert({
                project_id: projectId,
                category_id: category.id,
                subcategory_id: subcategory?.id,
                item_name: itemName,
                quantity_needed: templateItem.default_quantity,
                unit: templateItem.default_unit,
                used_in_stage: templateItem.stage,
                item_notes: templateItem.notes,
                is_bespoke: false,
                quantity_reserved: 0,
                quantity_used: 0,
                quantity_wasted: 0,
                usage_recorded: false
            });
        }
        
        console.log('Materials template loaded for project:', projectId, 'type:', projectType);
        
    } catch (error) {
        console.error('Error loading materials template:', error);
    }
}
