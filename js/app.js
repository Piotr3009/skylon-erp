// ========== INITIALIZATION WITH AUTH FIX ==========
window.addEventListener('DOMContentLoaded', async () => {
    // NAJPIERW sprawdź autoryzację
    if (typeof supabaseClient !== 'undefined') {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
            // Nie zalogowany - przekieruj
            window.location.href = 'login.html';
            return; // STOP - nie ładuj dalej
        }
        
        // Pobierz profil użytkownika
        const { data: profile } = await supabaseClient
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
        
        window.currentUser = profile;
        
        // Ukryj elementy na podstawie roli
        if (profile && profile.role === 'viewer') {
            // Ukryj przyciski edycji ALE NIE UKRYWAJ ADD PROJECT!
            document.querySelectorAll('.toolbar-btn.primary').forEach(btn => {
                // Sprawdź czy to nie jest Add Project
                if (btn.id !== 'addProjectBtn') {
                    btn.style.display = 'none';
                }
            });
        }
        
        if (profile && profile.role === 'worker') {
            // Ukryj klientów
            document.querySelectorAll('[href="clients.html"]').forEach(link => {
                link.style.display = 'none';
            });
        }
        
        // Dodaj przycisk logout
        const header = document.querySelector('.header');
        if (header && profile) {
            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'toolbar-btn';
            logoutBtn.innerHTML = '🚪 Logout (' + (profile.full_name || profile.email) + ')';
            logoutBtn.onclick = logout;
            logoutBtn.style.marginLeft = 'auto';
            header.appendChild(logoutBtn);
        }
    }
    
    // TERAZ ładuj dane i renderuj TYLKO RAZ
    await loadData(); // Czekaj na załadowanie
    updatePhasesLegend();
    render(); // Renderuj TYLKO RAZ po załadowaniu
});

// LOGOUT
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        supabaseClient.auth.signOut().then(() => {
            window.location.href = 'login.html';
        });
    }
}

// Close modals on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
    }
});