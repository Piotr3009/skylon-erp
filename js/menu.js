// ========== UNIFIED MENU SYSTEM ==========
// One menu to rule them all - no more copy-paste nightmare

// ========== GLOBAL LOADING SYSTEM ==========
// Automatic loading indicator for all Supabase operations

(function initGlobalLoading() {
    // Create loading overlay HTML
    const loadingHTML = `
        <div id="globalLoadingOverlay" style="
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 99999;
            justify-content: center;
            align-items: center;
        ">
            <div style="
                background: #2a2a2a;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
            ">
                <div id="loadingSpinner" style="
                    width: 60px;
                    height: 60px;
                    border: 4px solid #444;
                    border-top: 4px solid #4CAF50;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                ">
                    <img src="favicon.svg" alt="JC" style="
                        width: 32px;
                        height: 32px;
                        animation: spinReverse 0.8s linear infinite;
                    ">
                </div>
            </div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            @keyframes spinReverse {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(-360deg); }
            }
            #globalLoadingOverlay.error #loadingSpinner {
                border-top-color: #ef4444 !important;
            }
        </style>
    `;
    
    // Inject loading overlay when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.body.insertAdjacentHTML('beforeend', loadingHTML);
            wrapSupabaseClient();
        });
    } else {
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
        wrapSupabaseClient();
    }
    
    // Counter to track concurrent operations
    let activeOperations = 0;
    let hideTimeout = null;
    const overlay = () => document.getElementById('globalLoadingOverlay');
    
    // Show loading
    window.showLoading = function() {
        activeOperations++;
        // Cancel pending hide
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        const el = overlay();
        if (el) {
            el.style.display = 'flex';
            el.classList.remove('error');
        }
    };
    
    // Hide loading with delay
    window.hideLoading = function() {
        activeOperations--;
        if (activeOperations <= 0) {
            activeOperations = 0;
            // Delay hide by 800ms to avoid flickering
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                const el = overlay();
                if (el && activeOperations === 0) {
                    el.style.display = 'none';
                }
                hideTimeout = null;
            }, 800);
        }
    };
    
    // Show error state
    window.showLoadingError = function() {
        const el = overlay();
        if (el) {
            el.classList.add('error');
            setTimeout(() => {
                hideLoading();
            }, 2000);
        }
    };
    
    // Wrap Supabase client to automatically show loading
    function wrapSupabaseClient() {
        // Wait for supabaseClient to be defined
        const checkInterval = setInterval(() => {
            if (typeof supabaseClient !== 'undefined') {
                clearInterval(checkInterval);
                
                // Wrap the 'from' method to intercept all table operations
                const originalFrom = supabaseClient.from.bind(supabaseClient);
                supabaseClient.from = function(table) {
                    const builder = originalFrom(table);
                    
                    // Wrap all query methods
                    ['select', 'insert', 'update', 'delete', 'upsert'].forEach(method => {
                        const original = builder[method];
                        if (original) {
                            builder[method] = function(...args) {
                                const query = original.apply(this, args);
                                
                                // Wrap the final execution (when promise is created)
                                const originalThen = query.then.bind(query);
                                query.then = function(onSuccess, onError) {
                                    showLoading();
                                    return originalThen(
                                        (result) => {
                                            hideLoading();
                                            return onSuccess ? onSuccess(result) : result;
                                        },
                                        (error) => {
                                            showLoadingError();
                                            return onError ? onError(error) : Promise.reject(error);
                                        }
                                    );
                                };
                                
                                return query;
                            };
                        }
                    });
                    
                    return builder;
                };
                
                // Wrap storage operations
                if (supabaseClient.storage) {
                    const originalStorage = supabaseClient.storage.from.bind(supabaseClient.storage);
                    supabaseClient.storage.from = function(bucket) {
                        const bucketObj = originalStorage(bucket);
                        
                        // Wrap storage methods
                        ['upload', 'download', 'remove', 'list'].forEach(method => {
                            const original = bucketObj[method];
                            if (original) {
                                bucketObj[method] = async function(...args) {
                                    showLoading();
                                    try {
                                        const result = await original.apply(this, args);
                                        hideLoading();
                                        return result;
                                    } catch (error) {
                                        showLoadingError();
                                        throw error;
                                    }
                                };
                            }
                        });
                        
                        return bucketObj;
                    };
                }
                
                console.log('✅ Global loading system initialized');
            }
        }, 100);
        
        // Stop checking after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
    }
})();

function loadUnifiedMenu() {
    const menuHTML = `
        <div class="navigation-links">
            <a href="index.html" class="nav-link nav-link-production">🏭 Production</a>
            <a href="office.html" class="nav-link nav-link-office">🗂️ Office</a>
            <a href="pipeline.html" class="nav-link nav-link-pipeline">📋 Pipeline</a>
            <a href="archive.html" class="nav-link nav-link-archive" data-role-required="admin">📦 Archive</a>
            <a href="accounting.html" class="nav-link nav-link-accounting" data-role-required="admin">💰 Accounting</a>
            <a href="team.html" class="nav-link nav-link-team" data-role-required="admin">🧑‍🤝‍🧑 Team Management</a>
            <a href="clients.html" class="nav-link nav-link-clients" data-role-required="admin">👤 Clients</a>
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
    
    // Apply role-based visibility when permissions are loaded
    window.addEventListener('permissionsLoaded', applyMenuPermissions);
    
    // Also try immediately in case permissions already loaded
    setTimeout(applyMenuPermissions, 100);
}

function applyMenuPermissions() {
    if (!window.currentUserRole) {
        return;
    }
    
    // Hide admin-only links for non-admins
    const adminLinks = document.querySelectorAll('[data-role-required="admin"]');
    adminLinks.forEach(link => {
        if (window.currentUserRole !== 'admin') {
            link.style.display = 'none';
        }
    });
    
    console.log('✅ Menu permissions applied for role:', window.currentUserRole);
}

// Load menu when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadUnifiedMenu);
} else {
    loadUnifiedMenu();
}