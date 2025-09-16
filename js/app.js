// ========== INITIALIZATION WITH AUTH FIX ==========
let isInitialized = false; // Zapobiegaj wielokrotnemu uruchomieniu

window.addEventListener('DOMContentLoaded', async () => {
    if (isInitialized) return;
    isInitialized = true;
    
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
            // Ukryj TYLKO przyciski danger i delete
            document.querySelectorAll('.toolbar-btn.danger').forEach(btn => {
                btn.style.display = 'none';
            });
            document.querySelectorAll('.action-btn.delete').forEach(btn => {
                btn.style.display = 'none';
            });
            // NIE UKRYWAJ Add Project!
        }
        
        if (profile && profile.role === 'worker') {
            // Ukryj klientów
            document.querySelectorAll('[href="clients.html"]').forEach(link => {
                link.style.display = 'none';
            });
        }
        
        // Dodaj przycisk logout TYLKO jeśli go nie ma
        const toolbar = document.querySelector('.toolbar');
        if (toolbar && !document.getElementById('logoutBtn') && profile) {
            const logoutBtn = document.createElement('button');
            logoutBtn.id = 'logoutBtn'; // Dodaj ID żeby sprawdzić czy istnieje
            logoutBtn.className = 'toolbar-btn';
            logoutBtn.innerHTML = '🚪 Logout (' + (profile.full_name || profile.email) + ')';
            logoutBtn.onclick = logout;
            logoutBtn.style.marginLeft = 'auto';
            toolbar.appendChild(logoutBtn);
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