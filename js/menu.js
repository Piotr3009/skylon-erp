// ========== UNIFIED MENU SYSTEM ==========
// One menu to rule them all - no more copy-paste nightmare

function loadUnifiedMenu() {
    const menuHTML = `
        <div class="navigation-links">
            <a href="index.html" class="nav-link nav-link-production">🏭 Production</a>
            <a href="office.html" class="nav-link nav-link-office">🗂️ Office</a>
            <a href="pipeline.html" class="nav-link nav-link-pipeline">📋 Pipeline</a>
            <a href="archive.html" class="nav-link nav-link-archive">📦 Archive</a>
            <a href="accounting.html" class="nav-link nav-link-accounting">💰 Accounting</a>
            <a href="team.html" class="nav-link nav-link-team">🧑‍🤝‍🧑 Team Management</a>
            <a href="clients.html" class="nav-link nav-link-clients">👤 Clients</a>
            <a href="stock.html" class="nav-link nav-link-stock">📦 Stock</a>
            <a href="suppliers.html" class="nav-link nav-link-suppliers">🚚 Suppliers</a>
            <a href="equipment.html" class="nav-link nav-link-equipment">🔧 Machines</a>
        </div>
    `;
    
    // Find the menu container and inject
    const menuContainer = document.querySelector('.header');
    if (menuContainer) {
        const existingMenu = menuContainer.querySelector('.navigation-links');
        if (existingMenu) {
            existingMenu.outerHTML = menuHTML;
        }
    }
}

// Load menu when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUnifiedMenu);
} else {
    loadUnifiedMenu();
}