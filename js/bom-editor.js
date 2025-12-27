// ========== BOM EDITOR - NEW VERSION ==========

// Store last used values for each element type (for copying to next element)
let lastElementValues = {};
let editingElementId = null;

// Field definitions per element type
const BOM_FIELDS = {
    sash: {
        label: 'Sash Windows',
        prefix: 'W',
        fields: [
            // Row 2: Dimensions
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '800' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '1200' },
            // Row 3: Type-specific
            { row: 3, id: 'sash_box', label: 'Sash Box', type: 'select', options: ['Standard', 'Slim'] },
            { row: 3, id: 'opening_type', label: 'Opening Type', type: 'select', options: ['Both Sash', 'Bottom Only', 'Fix'] },
            { row: 3, id: 'bars', label: 'Bars', type: 'select', options: ['Yes', 'No'] },
            { row: 3, id: 'trickle_vent', label: 'Trickle Vent', type: 'select', options: ['Yes', 'No'] },
            // Row 4: Glass & Ironmongery
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'] },
            { row: 4, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '16 / 24 / 28 / Other' },
            { row: 4, id: 'ironmongery', label: 'Ironmongery', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
        ]
    },
    casement: {
        label: 'Casement Windows',
        prefix: 'W',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '800' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '1200' },
            { row: 3, id: 'opening_type', label: 'Opening Type', type: 'select', options: ['Left Hung', 'Right Hung', 'Top Hung', 'Fix'] },
            { row: 3, id: 'bars', label: 'Bars', type: 'select', options: ['Yes', 'No'] },
            { row: 3, id: 'trickle_vent', label: 'Trickle Vent', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'] },
            { row: 4, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '16 / 24 / 28 / Other' },
            { row: 4, id: 'ironmongery', label: 'Ironmongery', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
        ]
    },
    internalDoors: {
        label: 'Internal Doors',
        prefix: 'D',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '826' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2040' },
            { row: 3, id: 'door_type', label: 'Door Type', type: 'select', options: ['Single', 'Double', 'Sliding', 'Pocket'] },
            { row: 3, id: 'door_handing', label: 'Door Handing', type: 'select', options: ['Left', 'Right'] },
            { row: 3, id: 'fire_rating', label: 'Fire Rating', type: 'select', options: ['NFR', 'FD30', 'FD60'] },
            { row: 3, id: 'intumescent_set', label: 'Intumescent Set', type: 'select', options: ['Yes', 'No'], conditionalOn: 'fire_rating', showWhen: ['FD30', 'FD60'] },
            { row: 4, id: 'self_closer', label: 'Self Closer', type: 'select', options: ['Integrated', 'External', 'No Selfcloser'], conditionalOn: 'fire_rating', showWhen: ['FD30', 'FD60'] },
            { row: 4, id: 'glazed', label: 'Glazed', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure', 'Pyroguard 30', 'Pyroguard 60'], conditionalOn: 'glazed', showWhen: ['Yes'] },
            { row: 4, id: 'ironmongery_hinges', label: 'Ironmongery/Hinges', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
            { row: 5, id: 'locks_qty', label: 'Number of Locks', type: 'select', options: ['1', '2', '3'] },
            { row: 5, id: 'lock_1', label: 'Lock 1', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder', 'Nightlatch', 'Deadlock', 'Magnetic Lock', 'Electric Lock'] },
            { row: 5, id: 'lock_2', label: 'Lock 2', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder', 'Nightlatch', 'Deadlock', 'Magnetic Lock', 'Electric Lock'], conditionalOn: 'locks_qty', showWhen: ['2', '3'] },
            { row: 5, id: 'lock_3', label: 'Lock 3', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder', 'Nightlatch', 'Deadlock', 'Magnetic Lock', 'Electric Lock'], conditionalOn: 'locks_qty', showWhen: ['3'] },
        ]
    },
    externalDoors: {
        label: 'External Doors',
        prefix: 'ED',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '900' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2100' },
            { row: 3, id: 'external_door_type', label: 'Door Type', type: 'select', options: ['Single Door', 'French Doors', 'By-fold Doors'] },
            { row: 3, id: 'door_handing', label: 'Door Handing', type: 'select', options: ['Left', 'Right'] },
            { row: 3, id: 'threshold', label: 'Threshold', type: 'select', options: ['Standard', 'Low', 'Flush'] },
            { row: 4, id: 'glazed', label: 'Glazed', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'], conditionalOn: 'glazed', showWhen: ['Yes'] },
            { row: 4, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '16 / 24 / 28 / Other', conditionalOn: 'glazed', showWhen: ['Yes'] },
            { row: 4, id: 'locks', label: 'Locks', type: 'select', options: ['Multipoint', 'Eurocylinder', 'Other'] },
            { row: 4, id: 'ironmongery_hinges', label: 'Ironmongery/Hinges', type: 'select', options: ['Chrome', 'Satin', 'Brass', 'Antique Brass', 'Other'] },
        ]
    },
    kitchen: {
        label: 'Kitchen',
        prefix: 'K',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '600' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '720' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '560' },
            { row: 3, id: 'unit_type', label: 'Unit Type', type: 'select', options: ['Base', 'Wall', 'Tall', 'Drawer'] },
            { row: 3, id: 'front_style', label: 'Front Style', type: 'select', options: ['Flat', 'Shaker'] },
            { row: 3, id: 'front_material', label: 'Front Material', type: 'select', options: ['MDF 25', 'MDF 18', 'Veneer', 'Other'] },
            { row: 4, id: 'carcass_material', label: 'Carcass Material', type: 'text', placeholder: 'e.g. 18mm MFC White' },
            { row: 4, id: 'handle_type', label: 'Handle Type', type: 'select', options: ['Handleless J Type', 'Push to Open', 'Handle'] },
            { row: 4, id: 'soft_close', label: 'Soft Close', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'worktop', label: 'Worktop', type: 'text', placeholder: 'e.g. Quartz 30mm' },
        ]
    },
    wardrobe: {
        label: 'Wardrobe',
        prefix: 'WR',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '2400' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2200' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '600' },
            { row: 3, id: 'wardrobe_shape', label: 'Shape', type: 'select', options: ['Straight', 'L Shape', 'Sloped (Attic)'] },
            { row: 3, id: 'door_style', label: 'Door Style', type: 'select', options: ['Sliding', 'Hinged'] },
            { row: 3, id: 'front_style', label: 'Front Style', type: 'select', options: ['Flat', 'Shaker'] },
            { row: 4, id: 'front_material', label: 'Front Material', type: 'select', options: ['MDF 25', 'MDF 18', 'Veneer', 'Other'] },
            { row: 4, id: 'carcass_material', label: 'Carcass Material', type: 'text', placeholder: 'e.g. 18mm MFC White' },
            { row: 4, id: 'handle_type', label: 'Handle Type', type: 'select', options: ['Handleless J Type', 'Push to Open', 'Handle'] },
            { row: 4, id: 'internal_layout', label: 'Internal Layout', type: 'text', placeholder: 'e.g. 2 rails, 3 shelves' },
            { row: 4, id: 'mirror', label: 'Mirror', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'soft_close', label: 'Soft Close', type: 'select', options: ['Yes', 'No'] },
        ]
    },
    partition: {
        label: 'Partition',
        prefix: 'P',
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '3000' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '2400' },
            { row: 3, id: 'panel_type', label: 'Panel Type', type: 'select', options: ['Solid', 'Glazed', 'Mixed'] },
            { row: 3, id: 'frame_material', label: 'Frame Material', type: 'text', placeholder: 'e.g. Oak, Aluminium' },
            { row: 3, id: 'glass_type', label: 'Glass Type', type: 'select', options: ['Clear', 'Frosted', 'Obscure'], conditionalOn: 'panel_type', showWhen: ['Glazed', 'Mixed'] },
            { row: 3, id: 'glass_thickness', label: 'Glass Thickness', type: 'text', placeholder: '10mm laminated', conditionalOn: 'panel_type', showWhen: ['Glazed', 'Mixed'] },
            { row: 4, id: 'door_included', label: 'Door Included', type: 'select', options: ['Yes', 'No'] },
            { row: 4, id: 'door_handing', label: 'Door Handing', type: 'select', options: ['Left', 'Right'], conditionalOn: 'door_included', showWhen: ['Yes'] },
            { row: 4, id: 'door_lock', label: 'Door Lock', type: 'select', options: ['Latch', 'Bathroom', 'Eurocylinder'], conditionalOn: 'door_included', showWhen: ['Yes'] },
            { row: 4, id: 'acoustic_rating', label: 'Acoustic Rating', type: 'text', placeholder: 'e.g. 42dB' },
        ]
    },
    externalSpray: {
        label: 'External Spray',
        prefix: 'S',
        hasQty: true,
        fields: [
            { row: 3, id: 'item_type', label: 'Item Type', type: 'select', options: ['Doors', 'Windows', 'Furniture', 'Kitchen Fronts', 'Other'] },
            { row: 3, id: 'substrate', label: 'Substrate', type: 'select', options: ['Timber', 'MDF', 'Veneer', 'Primed', 'Other'] },
            { row: 4, id: 'paint_system', label: 'Paint System', type: 'text', placeholder: 'e.g. Teknos, Dulux' },
            { row: 4, id: 'sheen_level', label: 'Sheen Level (%)', type: 'text', placeholder: 'e.g. 10%, 30%' },
            { row: 4, id: 'num_coats', label: 'Coats', type: 'select', options: ['1', '2', '3'] },
        ]
    },
    other: {
        label: 'Other',
        prefix: 'X',
        hasQty: true,
        fields: [
            { row: 2, id: 'width', label: 'Width (mm)', type: 'number', placeholder: '500' },
            { row: 2, id: 'height', label: 'Height (mm)', type: 'number', placeholder: '400' },
            { row: 2, id: 'depth', label: 'Depth (mm)', type: 'number', placeholder: '' },
            { row: 3, id: 'material', label: 'Material', type: 'text', placeholder: 'e.g. Steel, Wood' },
            { row: 4, id: 'custom_field_1', label: 'Custom Field 1', type: 'text', placeholder: '' },
            { row: 4, id: 'custom_field_2', label: 'Custom Field 2', type: 'text', placeholder: '' },
            { row: 4, id: 'custom_field_3', label: 'Custom Field 3', type: 'text', placeholder: '' },
        ]
    }
};

// Style for form inputs
const inputStyle = 'width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5;';
const selectStyle = 'width: 100%; padding: 8px; background: #1e1e1e; border: 1px solid #3e3e42; border-radius: 4px; color: #e8e2d5;';
const labelStyle = 'font-size: 10px; color: #888; display: block; margin-bottom: 4px;';

// Open BOM Modal
function openBomModal() {
    document.getElementById('psBomModal').classList.add('active');
    renderBomTable();
    
    // Auto-select element type based on project type
    const projectType = projectData.project?.type;
    const typeSelect = document.getElementById('bomElementType');
    
    if (projectType && BOM_FIELDS[projectType]) {
        typeSelect.value = projectType;
        onElementTypeChange();
    }
}

// Close BOM Modal
function closeBomModal() {
    document.getElementById('psBomModal').classList.remove('active');
    cancelBomEdit();
    checkAllItems();
    updateProgress();
    generatePreview();
}

// Handle element type change
function onElementTypeChange() {
    const type = document.getElementById('bomElementType').value;
    const container = document.getElementById('bomFormContainer');
    const placeholder = document.getElementById('bomFormPlaceholder');
    
    if (!type) {
        container.style.display = 'none';
        placeholder.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    placeholder.style.display = 'none';
    
    renderBomForm(type);
}

// Render form based on element type
function renderBomForm(type) {
    const config = BOM_FIELDS[type];
    if (!config) return;
    
    // Clear all rows
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`bomFormRow${i}`).innerHTML = '';
    }
    
    // Row 1: Always ID and Name
    const row1 = document.getElementById('bomFormRow1');
    row1.style.gridTemplateColumns = config.hasQty ? '100px 1fr 80px' : '100px 1fr';
    row1.innerHTML = `
        <div>
            <label style="${labelStyle}">ID</label>
            <input type="text" id="bomFieldId" placeholder="${config.prefix}-001" style="${inputStyle}">
        </div>
        <div>
            <label style="${labelStyle}">Name *</label>
            <input type="text" id="bomFieldName" placeholder="e.g. Living Room" style="${inputStyle}">
        </div>
        ${config.hasQty ? `
        <div>
            <label style="${labelStyle}">Qty</label>
            <input type="number" id="bomFieldQty" value="1" min="1" style="${inputStyle}">
        </div>
        ` : ''}
    `;
    
    // Group fields by row
    const rows = { 2: [], 3: [], 4: [], 5: [] };
    config.fields.forEach(field => {
        if (rows[field.row]) {
            rows[field.row].push(field);
        }
    });
    
    // Render each row (2, 3, 4, 5)
    [2, 3, 4, 5].forEach(rowNum => {
        const rowEl = document.getElementById(`bomFormRow${rowNum}`);
        const fields = rows[rowNum];
        
        if (fields.length === 0) {
            if (rowNum !== 5) {
                rowEl.style.display = 'none';
            }
            return;
        }
        
        rowEl.style.display = 'grid';
        rowEl.style.gridTemplateColumns = `repeat(${Math.min(fields.length, 4)}, 1fr)`;
        
        rowEl.innerHTML = fields.map(field => {
            const conditionalAttr = field.conditionalOn ? 
                `data-conditional-on="${field.conditionalOn}" data-show-when="${field.showWhen.join(',')}"` : '';
            
            if (field.type === 'select') {
                return `
                    <div class="bom-field-wrapper" ${conditionalAttr}>
                        <label style="${labelStyle}">${field.label}</label>
                        <select id="bomField_${field.id}" style="${selectStyle}" onchange="onBomFieldChange('${field.id}')">
                            <option value="">-- Select --</option>
                            ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    </div>
                `;
            } else {
                return `
                    <div class="bom-field-wrapper" ${conditionalAttr}>
                        <label style="${labelStyle}">${field.label}</label>
                        <input type="${field.type}" id="bomField_${field.id}" placeholder="${field.placeholder || ''}" style="${inputStyle}">
                    </div>
                `;
            }
        }).join('');
    });
    
    // Row 5: If no locks fields, use for Colour
    const row5 = document.getElementById('bomFormRow5');
    if (rows[5].length === 0) {
        row5.style.display = 'grid';
        row5.style.gridTemplateColumns = '150px 1fr';
        row5.innerHTML = `
            <div>
                <label style="${labelStyle}">Colour Type</label>
                <select id="bomField_colour_type" style="${selectStyle}">
                    <option value="">-- Select --</option>
                    <option value="Single">Single</option>
                    <option value="Dual">Dual</option>
                </select>
            </div>
            <div>
                <label style="${labelStyle}">Colour</label>
                <input type="text" id="bomField_colour" placeholder="e.g. RAL 9016 or RAL 9016 / RAL 9010 ext" style="${inputStyle}">
            </div>
        `;
    }
    
    // Row 6: Colour + Description (if row 5 used for locks) or just Description
    const row6 = document.getElementById('bomFormRow6');
    if (rows[5].length > 0) {
        row6.innerHTML = `
            <div style="display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin-bottom: 10px;">
                <div>
                    <label style="${labelStyle}">Colour Type</label>
                    <select id="bomField_colour_type" style="${selectStyle}">
                        <option value="">-- Select --</option>
                        <option value="Single">Single</option>
                        <option value="Dual">Dual</option>
                    </select>
                </div>
                <div>
                    <label style="${labelStyle}">Colour</label>
                    <input type="text" id="bomField_colour" placeholder="e.g. RAL 9016 or RAL 9016 / RAL 9010 ext" style="${inputStyle}">
                </div>
            </div>
            <div>
                <label style="${labelStyle}">Description (optional)</label>
                <input type="text" id="bomField_description" placeholder="Additional notes or specifications" style="${inputStyle}">
            </div>
        `;
    } else {
        row6.innerHTML = `
            <div>
                <label style="${labelStyle}">Description (optional)</label>
                <input type="text" id="bomField_description" placeholder="Additional notes or specifications" style="${inputStyle}">
            </div>
        `;
    }
    
    // Apply last used values if available
    applyLastValues(type);
    
    // Update conditional fields visibility
    updateConditionalFields();
}

// Handle field change (for conditional fields)
function onBomFieldChange(fieldId) {
    updateConditionalFields();
}

// Update visibility of conditional fields
function updateConditionalFields() {
    const wrappers = document.querySelectorAll('.bom-field-wrapper[data-conditional-on]');
    
    wrappers.forEach(wrapper => {
        const conditionalOn = wrapper.dataset.conditionalOn;
        const showWhen = wrapper.dataset.showWhen.split(',');
        const conditionalField = document.getElementById(`bomField_${conditionalOn}`);
        
        if (conditionalField) {
            const currentValue = conditionalField.value;
            wrapper.style.display = showWhen.includes(currentValue) ? 'block' : 'none';
        }
    });
}

// Apply last used values to form
function applyLastValues(type) {
    const lastValues = lastElementValues[type];
    if (!lastValues) return;
    
    // Apply values except for ID and Name
    Object.keys(lastValues).forEach(key => {
        if (key === 'element_id' || key === 'name') return;
        
        const field = document.getElementById(`bomField_${key}`);
        if (field && lastValues[key]) {
            field.value = lastValues[key];
        }
    });
    
    // Also apply width, height, depth
    ['width', 'height', 'depth'].forEach(dim => {
        const field = document.getElementById(`bomField_${dim}`);
        if (field && lastValues[dim]) {
            field.value = lastValues[dim];
        }
    });
    
    updateConditionalFields();
}

// Save last used values
function saveLastValues(type, data) {
    lastElementValues[type] = { ...data };
}

// Collect form data
function collectFormData() {
    const type = document.getElementById('bomElementType').value;
    const config = BOM_FIELDS[type];
    if (!config) return null;
    
    const data = {
        project_id: projectId,
        element_type: type,
        element_id: document.getElementById('bomFieldId')?.value.trim() || null,
        name: document.getElementById('bomFieldName')?.value.trim() || null,
        qty: config.hasQty ? (parseInt(document.getElementById('bomFieldQty')?.value) || 1) : 1,
        colour_type: document.getElementById('bomField_colour_type')?.value || null,
        colour: document.getElementById('bomField_colour')?.value.trim() || null,
        description: document.getElementById('bomField_description')?.value.trim() || null,
        sort_order: editingElementId ? undefined : projectData.elements.length
    };
    
    // Collect type-specific fields
    config.fields.forEach(field => {
        const fieldEl = document.getElementById(`bomField_${field.id}`);
        if (fieldEl) {
            if (field.type === 'number') {
                data[field.id] = parseInt(fieldEl.value) || null;
            } else {
                data[field.id] = fieldEl.value.trim() || null;
            }
        }
    });
    
    return data;
}

// Save element (Add or Update)
async function saveBomElement() {
    const type = document.getElementById('bomElementType').value;
    if (!type) {
        showToast('Please select element type', 'warning');
        return;
    }
    
    const data = collectFormData();
    if (!data.name) {
        showToast('Name is required', 'warning');
        return;
    }
    
    // Remove undefined fields
    Object.keys(data).forEach(key => {
        if (data[key] === undefined) delete data[key];
    });
    
    try {
        if (editingElementId) {
            // Update existing
            const { error } = await supabaseClient
                .from('project_elements')
                .update(data)
                .eq('id', editingElementId);
            
            if (error) throw error;
            
            // Update in local array
            const index = projectData.elements.findIndex(e => e.id === editingElementId);
            if (index !== -1) {
                projectData.elements[index] = { ...projectData.elements[index], ...data };
            }
            
            showToast('Element updated!', 'success');
            cancelBomEdit();
        } else {
            // Insert new
            const { data: newData, error } = await supabaseClient
                .from('project_elements')
                .insert(data)
                .select()
                .single();
            
            if (error) throw error;
            
            projectData.elements.push(newData);
            showToast('Element added!', 'success');
            
            // Save values for next element
            saveLastValues(type, data);
            
            // Clear form for next entry (keep last values)
            clearBomFormPartial();
        }
        
        renderBomTable();
        
    } catch (err) {
        console.error('Error saving element:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Clear form but keep last values for quick entry
function clearBomFormPartial() {
    document.getElementById('bomFieldId').value = '';
    document.getElementById('bomFieldName').value = '';
    document.getElementById('bomFieldId').focus();
}

// Edit element
function editBomElement(elementId) {
    const element = projectData.elements.find(e => e.id === elementId);
    if (!element) return;
    
    editingElementId = elementId;
    
    // Set element type
    const typeSelect = document.getElementById('bomElementType');
    typeSelect.value = element.element_type || 'other';
    onElementTypeChange();
    
    // Fill form with element data
    setTimeout(() => {
        // Basic fields
        const idField = document.getElementById('bomFieldId');
        const nameField = document.getElementById('bomFieldName');
        const qtyField = document.getElementById('bomFieldQty');
        
        if (idField) idField.value = element.element_id || '';
        if (nameField) nameField.value = element.name || '';
        if (qtyField) qtyField.value = element.qty || 1;
        
        // Type-specific fields
        const config = BOM_FIELDS[element.element_type];
        if (config) {
            config.fields.forEach(field => {
                const fieldEl = document.getElementById(`bomField_${field.id}`);
                if (fieldEl && element[field.id] !== undefined) {
                    fieldEl.value = element[field.id] || '';
                }
            });
        }
        
        // Colour fields
        const colourType = document.getElementById('bomField_colour_type');
        const colour = document.getElementById('bomField_colour');
        const description = document.getElementById('bomField_description');
        
        if (colourType) colourType.value = element.colour_type || '';
        if (colour) colour.value = element.colour || '';
        if (description) description.value = element.description || '';
        
        updateConditionalFields();
        
        // Update UI
        document.getElementById('bomFormTitle').textContent = '✏️ Edit Element';
        document.getElementById('bomSaveBtn').textContent = 'Update Element';
        document.getElementById('bomCancelBtn').style.display = 'inline-block';
        
    }, 50);
}

// Cancel edit
function cancelBomEdit() {
    editingElementId = null;
    document.getElementById('bomFormTitle').textContent = '➕ Add New Element';
    document.getElementById('bomSaveBtn').textContent = '+ Add Element';
    document.getElementById('bomCancelBtn').style.display = 'none';
    
    // Reset form
    const type = document.getElementById('bomElementType').value;
    if (type) {
        renderBomForm(type);
    }
}

// Delete element
async function deleteBomElement(elementId) {
    if (!confirm('Delete this element?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('project_elements')
            .delete()
            .eq('id', elementId);
        
        if (error) throw error;
        
        projectData.elements = projectData.elements.filter(e => e.id !== elementId);
        renderBomTable();
        showToast('Element deleted', 'success');
        
    } catch (err) {
        console.error('Error deleting element:', err);
        showToast('Error: ' + err.message, 'error');
    }
}

// Render BOM table
function renderBomTable() {
    const tbody = document.getElementById('bomTableBody');
    const emptyMsg = document.getElementById('bomEmpty');
    
    if (projectData.elements.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    
    emptyMsg.style.display = 'none';
    
    tbody.innerHTML = projectData.elements.map((el, index) => {
        const config = BOM_FIELDS[el.element_type] || BOM_FIELDS.other;
        const typeLabel = config?.label || el.element_type || 'Other';
        
        // Build size string
        let sizeStr = '-';
        if (el.width && el.height) {
            sizeStr = `${el.width} x ${el.height}`;
            if (el.depth) sizeStr += ` x ${el.depth}`;
        }
        
        // Build details string based on type
        let details = getElementDetails(el);
        
        return `
            <tr style="border-bottom: 1px solid #3e3e42;">
                <td style="padding: 10px; color: #4a9eff; font-weight: 600;">${el.element_id || '-'}</td>
                <td style="padding: 10px;">
                    <span style="background: #3e3e42; padding: 2px 8px; border-radius: 4px; font-size: 10px;">${typeLabel}</span>
                </td>
                <td style="padding: 10px;">
                    <div style="color: #e8e2d5;">${el.name}</div>
                    ${el.description ? `<div style="font-size: 10px; color: #888; margin-top: 2px;">${el.description}</div>` : ''}
                </td>
                <td style="padding: 10px; text-align: center;">${sizeStr}</td>
                <td style="padding: 10px;">${el.colour || '-'}</td>
                <td style="padding: 10px; font-size: 11px; color: #888;">${details}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="editBomElement('${el.id}')" style="background: #4a9eff; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-right: 5px;">
                        Edit
                    </button>
                    <button onclick="deleteBomElement('${el.id}')" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get element details string based on type
function getElementDetails(el) {
    const parts = [];
    
    switch (el.element_type) {
        case 'sash':
            if (el.sash_box) parts.push(el.sash_box);
            if (el.opening_type) parts.push(el.opening_type);
            if (el.bars === 'Yes') parts.push('Bars');
            if (el.glass_type) parts.push(el.glass_type);
            break;
        case 'casement':
            if (el.opening_type) parts.push(el.opening_type);
            if (el.bars === 'Yes') parts.push('Bars');
            if (el.glass_type) parts.push(el.glass_type);
            break;
        case 'internalDoors':
            if (el.door_type) parts.push(el.door_type);
            if (el.fire_rating && el.fire_rating !== 'NFR') parts.push(el.fire_rating);
            if (el.door_handing) parts.push(el.door_handing);
            if (el.lock_1) parts.push(el.lock_1);
            if (el.lock_2) parts.push(el.lock_2);
            if (el.lock_3) parts.push(el.lock_3);
            if (el.self_closer && el.self_closer !== 'No Selfcloser') parts.push('Closer: ' + el.self_closer);
            break;
        case 'externalDoors':
            if (el.external_door_type) parts.push(el.external_door_type);
            if (el.threshold) parts.push(el.threshold);
            break;
        case 'kitchen':
            if (el.unit_type) parts.push(el.unit_type);
            if (el.front_style) parts.push(el.front_style);
            if (el.handle_type) parts.push(el.handle_type);
            break;
        case 'wardrobe':
            if (el.wardrobe_shape) parts.push(el.wardrobe_shape);
            if (el.door_style) parts.push(el.door_style);
            break;
        case 'partition':
            if (el.panel_type) parts.push(el.panel_type);
            if (el.door_included === 'Yes') parts.push('With Door');
            break;
        case 'externalSpray':
            if (el.qty > 1) parts.push(`Qty: ${el.qty}`);
            if (el.item_type) parts.push(el.item_type);
            if (el.sheen_level) parts.push(el.sheen_level);
            break;
        default:
            if (el.material) parts.push(el.material);
            if (el.qty > 1) parts.push(`Qty: ${el.qty}`);
    }
    
    return parts.join(' • ') || '-';
}

// Clear entire BOM form
function clearBomForm() {
    document.getElementById('bomElementType').value = '';
    onElementTypeChange();
    editingElementId = null;
}