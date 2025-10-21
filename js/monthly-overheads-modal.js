// ========================================
// MONTHLY OVERHEADS MODAL - Dynamic Management
// ========================================

let currentOverheadItems = {
    property: [],
    operations: [],
    admin: [],
    financial: [],
    machinery: [],
    other: []
};

let categoryExpanded = {
    property: true,
    operations: true,
    admin: true,
    financial: true,
    machinery: true,
    other: true
};

// Open modal
function openMonthlySettingsModal() {
    document.getElementById('monthlySettingsModal').style.display = 'block';
    const now = new Date();
    document.getElementById('settingsMonth').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    loadMonthOverheads();
}

// Close modal
function closeMonthlySettingsModal() {
    document.getElementById('monthlySettingsModal').style.display = 'none';
}

// Load overhead data for selected month
async function loadMonthOverheads() {
    const month = document.getElementById('settingsMonth').value;
    
    if (!month) {
        alert('Please select a month');
        return;
    }
    
    try {
        // Load overhead items from database
        const { data, error } = await supabaseClient
            .from('overhead_items')
            .select('*')
            .eq('month', month)
            .order('category', { ascending: true })
            .order('item_name', { ascending: true });
        
        if (error) throw error;
        
        // Reset current items
        currentOverheadItems = {
            property: [],
            operations: [],
            admin: [],
            financial: [],
            machinery: [],
            other: []
        };
        
        // Group by category
        if (data && data.length > 0) {
            data.forEach(item => {
                if (currentOverheadItems[item.category]) {
                    currentOverheadItems[item.category].push(item);
                }
            });
        }
        
        // Render all categories
        renderAllCategories();
        calculateTotals();
        
    } catch (err) {
        console.error('Error loading overheads:', err);
        alert('Error loading data: ' + err.message);
    }
}

// Render all categories
function renderAllCategories() {
    renderCategoryItems('property');
    renderCategoryItems('operations');
    renderCategoryItems('admin');
    renderCategoryItems('financial');
    renderCategoryItems('machinery');
    renderCategoryItems('other');
}

// Render items for a category
function renderCategoryItems(category) {
    const container = document.getElementById(`${category}Items`);
    const items = currentOverheadItems[category];
    
    // Clear existing items (except the add button)
    const addButton = container.querySelector('.add-item-btn');
    container.innerHTML = '';
    
    // Render items
    items.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 50px; gap: 10px; margin-bottom: 10px; align-items: center;';
        
        itemDiv.innerHTML = `
            <input type="text" 
                   value="${item.item_name}" 
                   onchange="updateItemName('${category}', ${index}, this.value)"
                   placeholder="Item name"
                   style="padding: 8px; background: #3e3e42; border: 1px solid #555; color: white; border-radius: 3px;">
            <input type="number" 
                   value="${item.amount}" 
                   onchange="updateItemAmount('${category}', ${index}, this.value)"
                   step="0.01"
                   min="0"
                   placeholder="0.00"
                   style="padding: 8px; background: #3e3e42; border: 1px solid #555; color: white; border-radius: 3px;">
            <button onclick="deleteItem('${category}', ${index})" 
                    style="padding: 8px; background: #ef4444; border: none; color: white; border-radius: 3px; cursor: pointer; font-size: 16px;">
                🗑️
            </button>
        `;
        
        container.appendChild(itemDiv);
    });
    
    // Re-add the add button
    if (addButton) {
        container.appendChild(addButton);
    }
}

// Add new item to category
function addOverheadItem(category) {
    currentOverheadItems[category].push({
        id: null, // Will be generated on save
        month: document.getElementById('settingsMonth').value,
        category: category,
        item_name: '',
        amount: 0,
        notes: null
    });
    
    renderCategoryItems(category);
    calculateTotals();
}

// Update item name
function updateItemName(category, index, newName) {
    if (currentOverheadItems[category][index]) {
        currentOverheadItems[category][index].item_name = newName;
    }
}

// Update item amount
function updateItemAmount(category, index, newAmount) {
    if (currentOverheadItems[category][index]) {
        currentOverheadItems[category][index].amount = parseFloat(newAmount) || 0;
        calculateTotals();
    }
}

// Delete item
function deleteItem(category, index) {
    if (confirm('Delete this item?')) {
        currentOverheadItems[category].splice(index, 1);
        renderCategoryItems(category);
        calculateTotals();
    }
}

// Toggle category expand/collapse
function toggleCategory(category) {
    const itemsDiv = document.getElementById(`${category}Items`);
    const toggleIcon = document.getElementById(`${category}Toggle`);
    
    if (categoryExpanded[category]) {
        // Collapse
        itemsDiv.style.display = 'none';
        toggleIcon.textContent = '▶';
        categoryExpanded[category] = false;
    } else {
        // Expand
        itemsDiv.style.display = 'block';
        toggleIcon.textContent = '▼';
        categoryExpanded[category] = true;
    }
}

// Calculate totals
function calculateTotals() {
    const categories = ['property', 'operations', 'admin', 'financial', 'machinery', 'other'];
    let grandTotal = 0;
    
    categories.forEach(category => {
        const items = currentOverheadItems[category];
        const categoryTotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        
        // Update category total display
        document.getElementById(`${category}Total`).textContent = `£${categoryTotal.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        
        grandTotal += categoryTotal;
    });
    
    // Update grand total
    document.getElementById('totalOverheadsCost').textContent = `£${grandTotal.toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// Save all overhead items
async function saveMonthlyOverheads() {
    const month = document.getElementById('settingsMonth').value;
    
    if (!month) {
        alert('Please select a month');
        return;
    }
    
    try {
        // Collect all items from all categories
        const allItems = [];
        
        Object.keys(currentOverheadItems).forEach(category => {
            currentOverheadItems[category].forEach(item => {
                // Only save items with names
                if (item.item_name && item.item_name.trim() !== '') {
                    allItems.push({
                        month: month,
                        category: category,
                        item_name: item.item_name.trim(),
                        amount: parseFloat(item.amount) || 0,
                        notes: item.notes || null
                    });
                }
            });
        });
        
        if (allItems.length === 0) {
            alert('Please add at least one overhead item');
            return;
        }
        
        // Delete existing items for this month
        const { error: deleteError } = await supabaseClient
            .from('overhead_items')
            .delete()
            .eq('month', month);
        
        if (deleteError) throw deleteError;
        
        // Insert all new items
        const { error: insertError } = await supabaseClient
            .from('overhead_items')
            .insert(allItems);
        
        if (insertError) throw insertError;
        
        // Calculate total and update monthly_overheads table
        const total = allItems.reduce((sum, item) => sum + item.amount, 0);
        const year = parseInt(month.split('-')[0]);
        
        const { error: updateError } = await supabaseClient
            .from('monthly_overheads')
            .upsert({
                month: month,
                year: year,
                overheads_value: total
            }, { onConflict: 'month' });
        
        if (updateError) throw updateError;
        
        alert('✅ Monthly overheads saved successfully!');
        closeMonthlySettingsModal();
        
        // Refresh accounting data
        if (typeof refreshAccountingData === 'function') {
            await refreshAccountingData();
        }
        
    } catch (err) {
        console.error('Error saving overheads:', err);
        alert('Error saving: ' + err.message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Modal click outside to close
    window.onclick = function(event) {
        const modal = document.getElementById('monthlySettingsModal');
        if (event.target === modal) {
            closeMonthlySettingsModal();
        }
    };
});
