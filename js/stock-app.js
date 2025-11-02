// ========== STOCK MANAGEMENT APP ==========

let stockItems = [];
let filteredItems = [];

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await loadStockItems();
    updateStats();
});

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
                ${item.supplier ? `<div style="font-size: 11px; color: #999;">Supplier: ${item.supplier}</div>` : ''}
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
    alert('Add Stock Modal - Coming in next commit (5 min)');
}

function openStockInModal(itemId) {
    alert('Stock IN Modal - Coming in next commit (5 min)');
}

function openStockOutModal(itemId) {
    alert('Stock OUT Modal - Coming in next commit (5 min)');
}

function editStockItem(itemId) {
    alert('Edit Modal - Coming in next commit (5 min)');
}
