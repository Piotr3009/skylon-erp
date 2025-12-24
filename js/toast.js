// JC Toast Notification System
// Usage: showToast('Message', 'success') or showToast('Error!', 'error')

function showToast(message, type = 'info', duration = 5000) {
    // Create container if not exists
    let container = document.getElementById('jc-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'jc-toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        document.body.appendChild(container);
    }

    // JC Logo SVG (small version)
    const jcLogo = `<svg width="24" height="24" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="toastBg${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#2a2a2a"/>
                <stop offset="100%" style="stop-color:#1a1a1a"/>
            </linearGradient>
            <linearGradient id="toastText${Date.now()}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#5dd879"/>
                <stop offset="50%" style="stop-color:#4caf50"/>
                <stop offset="100%" style="stop-color:#3d8b40"/>
            </linearGradient>
        </defs>
        <rect width="64" height="64" rx="12" fill="url(#toastBg${Date.now()})"/>
        <text x="32" y="46" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" fill="url(#toastText${Date.now()})" text-anchor="middle" letter-spacing="-2">JC</text>
    </svg>`;

    // Colors based on type (matching system colors)
    const colors = {
        success: { border: '#10b981', icon: '✓' },
        error: { border: '#f97316', icon: '✕' },
        warning: { border: '#f59e0b', icon: '!' },
        info: { border: '#3b82f6', icon: 'i' }
    };
    
    const color = colors[type] || colors.info;

    // Create toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #27272a;
        border: 1px solid #3f3f46;
        border-left: 3px solid ${color.border};
        color: #e4e4e7;
        padding: 12px 14px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 260px;
        max-width: 360px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        animation: jcToastIn 0.3s ease;
    `;
    
    toast.innerHTML = `
        <div style="flex-shrink: 0;">${jcLogo}</div>
        <div style="flex: 1; line-height: 1.4;">${message}</div>
        <div style="
            width: 20px;
            height: 20px;
            background: ${color.border};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: bold;
            flex-shrink: 0;
        ">${color.icon}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.style.animation = 'jcToastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Add CSS animation (only once)
if (!document.getElementById('jc-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'jc-toast-styles';
    style.textContent = `
        @keyframes jcToastIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes jcToastOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}