// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    updatePhasesLegend();
    render();
});

// Close modals on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});