// ========== GOOGLE DRIVE PICKER CONFIGURATION ==========

// KONFIGURACJA DLA SKYLON JOINERY
const GOOGLE_CONFIG = {
    API_KEY: 'AIzaSyCGCY0cLvJWS0RApvTxOVn15bhhEYHvP1w',
    CLIENT_ID: '320768714420-ov2q2b39khn2o803kv5mumf5slqmr6g6.apps.googleusercontent.com',
    APP_ID: '320768714420', // Project number z Client ID
    SCOPE: 'https://www.googleapis.com/auth/drive.readonly'
};

// Global variables
let pickerInited = false;
let gisInited = false;
let tokenClient;
let accessToken;
let currentProjectForPicker = null;

// Load Google APIs
function loadGoogleAPIs() {
    // Load Google Identity Services
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
        gisLoaded();
    };
    document.head.appendChild(gisScript);

    // Load Google Picker API
    const pickerScript = document.createElement('script');
    pickerScript.src = 'https://apis.google.com/js/api.js';
    pickerScript.async = true;
    pickerScript.defer = true;
    pickerScript.onload = () => {
        gapi.load('picker', () => {
            pickerInited = true;
            console.log('✅ Google Picker API loaded');
        });
    };
    document.head.appendChild(pickerScript);
}

// Initialize Google Identity Services
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CONFIG.CLIENT_ID,
        scope: GOOGLE_CONFIG.SCOPE,
        callback: (response) => {
            if (response.error !== undefined) {
                console.error('Token error:', response);
                return;
            }
            accessToken = response.access_token;
            console.log('✅ Access token obtained');
            createPicker();
        }
    });
    gisInited = true;
    console.log('✅ Google Identity Services loaded');
}

// Open Google Drive Picker for a project
function openGoogleDrivePicker(project) {
    currentProjectForPicker = project;
    
    // Check if APIs are loaded
    if (!gisInited || !pickerInited) {
        alert('Google APIs are still loading. Please try again in a moment.');
        return;
    }

    // Request access token
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

// Create and display the picker
function createPicker() {
    if (!accessToken || !currentProjectForPicker) return;

    const view = new google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMode(google.picker.DocsViewMode.LIST);

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setDeveloperKey(GOOGLE_CONFIG.API_KEY)
        .setAppId(GOOGLE_CONFIG.APP_ID)
        .setOAuthToken(accessToken)
        .addView(view)
        .setCallback(pickerCallback)
        .setTitle(`Select folder for: ${currentProjectForPicker.name}`)
        .build();

    picker.setVisible(true);
}

// Handle picker selection
async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const folder = data.docs[0];
        console.log('Selected folder:', folder);

        // Save to project
        currentProjectForPicker.googleDriveFolder = {
            id: folder.id,
            name: folder.name,
            url: folder.url || `https://drive.google.com/drive/folders/${folder.id}`,
            iconUrl: folder.iconUrl,
            linkedAt: new Date().toISOString()
        };

        // Save to Supabase
        if (typeof supabaseClient !== 'undefined') {
            const { error } = await supabaseClient
                .from('projects')
                .update({ 
                    google_drive_folder: currentProjectForPicker.googleDriveFolder 
                })
                .eq('project_number', currentProjectForPicker.projectNumber);

            if (error) {
                console.error('Error saving to Supabase:', error);
                alert('Failed to save Google Drive folder');
            } else {
                console.log('✅ Google Drive folder saved!');
                alert(`Folder "${folder.name}" linked successfully!`);
                
                // Re-render to show the change
                if (typeof render !== 'undefined') render();
            }
        }

        // Save locally
        saveData();
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    // Check if we have API keys configured
    if (GOOGLE_CONFIG.API_KEY === 'YOUR_API_KEY_HERE') {
        console.warn('⚠️ Google Drive Picker: Please configure API keys in google-drive-picker.js');
        return;
    }
    
    // Load Google APIs
    loadGoogleAPIs();
});

// Export for use in other files
window.openGoogleDrivePicker = openGoogleDrivePicker;