
// ========================================
// GeoOps v2.0 - Module Controller
// ========================================


import { Toast, Loading, UI, FileUtils } from './utils/ui_helpers.js';

import { MapUtils } from './core/map.js';
import { ChartUtils } from './core/charts.js';
import { AdminRenderers } from './ui/admin_renderers.js';
import { FieldRenderers } from './ui/field_renderers.js';
import { ChatRenderers } from './ui/chat_renderers.js';
import { CalendarRenderer } from './ui/calendar_renderer.js';

// store is global from store_v2.js (loaded before this script)
// ExportUtils is global from export_utils.js

// Make UI helpers globally available for HTML onclicks
window.UI = UI; // Expose full UI object
window.openModal = UI.openModal;
window.closeModal = UI.closeModal;
window.Toast = Toast;
window.Loading = Loading;
window.ChartUtils = ChartUtils; // Expose for analytics modal

// Data Management Handlers (Global for HTML onclicks)
window.exportFullBackup = async () => {
    Loading.show();
    try {
        await ExportUtils.exportFullDatabase();
        Toast.success('Full backup downloaded!');
    } catch (e) {
        console.error(e);
        Toast.error('Backup failed');
    }
    Loading.hide();
};

window.previewArchive = () => {
    const months = parseInt(document.getElementById('archive-months').value) || 6;
    const oldData = ExportUtils.getOldData(months);
    const previewEl = document.getElementById('archive-preview');
    previewEl.style.display = 'block';
    previewEl.innerHTML = `
        <strong>Found ${oldData.totalCount} records older than ${months} months:</strong><br>
        <span style="font-size: 0.9rem;">
            • Attendance Logs: ${oldData.attendanceLogs.length}<br>
            • Reports: ${oldData.reports.length}<br>
            • Completed Tasks: ${oldData.tasks.length}<br>
            • Closed Leave Requests: ${oldData.leaveRequests.length}
        </span>
    `;
};

window.exportArchive = () => {
    const months = parseInt(document.getElementById('archive-months').value) || 6;
    const oldData = ExportUtils.getOldData(months);
    if (oldData.totalCount === 0) {
        Toast.info('No old data found to export.');
        return;
    }
    const date = new Date().toISOString().split('T')[0];
    ExportUtils.exportJSON(oldData, `FieldHub_Archive_${months}mo_${date}`);
    Toast.success(`Exported ${oldData.totalCount} records.`);
};

window.archiveAndPurge = async () => {
    const months = parseInt(document.getElementById('archive-months').value) || 6;
    if (!confirm(`⚠️ This will:\n1. Download archive of data older than ${months} months.\n2. PERMANENTLY DELETE that data from the cloud.\n\nProceed?`)) {
        return;
    }
    Loading.show();
    try {
        const result = await ExportUtils.archiveAndPurge(months);
        if (result.success) {
            Toast.success(result.message);
            if (result.remaining > 0) {
                Toast.info(`${result.remaining} more records remain. Run again to continue.`);
            }
        } else {
            Toast.info(result.message);
        }
    } catch (e) {
        console.error(e);
        Toast.error('Purge operation failed');
    }
    Loading.hide();
};

// Admin Actions (Global Exposure for HTML onclicks)
window.approveLeave = async (id) => {
    if (!confirm('Approve this leave request?')) return;
    try {
        Loading.show();
        await window.store.updateLeaveRequest(id, 'approved');
        AdminRenderers.renderAdminLeaves();
        CalendarRenderer.render(); // Update calendar too
        Loading.hide();
        Toast.success('Leave approved');
    } catch (e) {
        Loading.hide();
        console.error(e);
        Toast.error('Failed to update leave');
    }
};

window.rejectLeave = async (id) => {
    if (!confirm('Reject this leave request?')) return;
    try {
        Loading.show();
        await window.store.updateLeaveRequest(id, 'rejected');
        AdminRenderers.renderAdminLeaves();
        CalendarRenderer.render(); // Update calendar too
        Loading.hide();
        Toast.info('Leave rejected');
    } catch (e) {
        Loading.hide();
        console.error(e);
        Toast.error('Failed to update leave');
    }
};

window.approveRegistration = async (id, role) => {
    try {
        Loading.show();
        await window.store.approveRegistration(id, role);
        AdminRenderers.renderRegistrations();
        AdminRenderers.renderStaff();
        Loading.hide();
        Toast.success('User approved');
    } catch (e) {
        Loading.hide();
        Toast.error(e.message);
    }
};

window.deleteRegistration = async (id) => {
    if (!confirm('Reject and delete this registration?')) return;
    try {
        Loading.show();
        await window.store.deleteRegistration(id);
        AdminRenderers.renderRegistrations();
        Loading.hide();
        Toast.info('Registration rejected');
    } catch (e) {
        Loading.hide();
        Toast.error(e.message);
    }
};

window.sendBroadcast = async (event) => {
    event.preventDefault();
    const input = document.getElementById('broadcast-input');
    const content = input.value.trim();
    if (!content) return;

    Loading.show();
    try {
        await window.store.sendMessage('all', content);
        Toast.success('Broadcast sent');
        UI.closeModal('broadcast-modal');
        input.value = '';
    } catch (e) {
        console.error(e);
        Toast.error('Failed to send broadcast');
    }
    Loading.hide();
};

// DOM Elements
const views = {
    landing: document.getElementById('landing-page'),
    auth: document.getElementById('auth-view'),
    admin: document.getElementById('admin-view'),
    field: document.getElementById('field-view')
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    setupEventListeners();
    setupForms(); // Initialize form handlers
    UI.updateDate();

    // Initialize Store
    if (window.store) {
        await window.store.init();

        // Subscribe to store updates to keep UI in sync (Fixes persistence issues)
        window.store.subscribe(() => {
            const user = window.store.getCurrentUser();
            // Only update if we are in field view
            if (user && user.role === 'field' && !views.field.classList.contains('hidden')) {
                // Determine status from store
                const att = window.store.getStaffStatus().find(s => s.id === user.id);
                const status = att ? att.status : 'out';
                const lastLoc = att ? att.lastLoc : 'Ready to start';

                // Update Clock UI
                if (window.FieldRenderers && window.FieldRenderers.updateClockUI) {
                    window.FieldRenderers.updateClockUI(status, lastLoc);
                }

                // Refresh tasks if needed (to show/hide lock screen)
                if (window.FieldRenderers && window.FieldRenderers.renderFieldTasks) {
                    window.FieldRenderers.renderFieldTasks(user.id);
                }
            }
        });

        checkSession();
    } else {
        Toast.error("System initialization failed. Reloading...");
        setTimeout(() => location.reload(), 2000);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

    // Fade splash
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 300);
        }
    }, 1200);
});

// ========================================
// THEME SYSTEM
// ========================================

function initTheme() {
    const savedTheme = localStorage.getItem('geoops-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('geoops-theme', newTheme);
    updateThemeIcon(newTheme);
    Toast.success(`${newTheme === 'light' ? 'Light' : 'Dark'} theme activated`);
}

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-icon');
    icons.forEach(icon => {
        icon.className = `theme-icon ${theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun'}`;
    });
}

window.toggleTheme = toggleTheme; // Make available globally

// ========================================
// NAVIGATION
// ========================================

function checkSession() {
    const user = window.store.getCurrentUser();

    if (user) {
        if (views.landing && !views.admin) {
            window.location.href = 'app.html';
            return;
        }
        navigate(user.role === 'admin' ? 'admin' : 'field');
    } else {
        navigate(views.landing ? 'landing' : 'auth');
    }
}

function navigate(viewName) {
    Object.values(views).forEach(el => {
        if (!el) return;
        el.classList.remove('active');
        el.classList.add('hidden');
    });

    if (views[viewName]) {
        setTimeout(() => {
            views[viewName].classList.remove('hidden');
            setTimeout(() => views[viewName].classList.add('active'), 10);
        }, 150);
    }

    if (viewName === 'admin') initAdminDashboard();
    if (viewName === 'field') initFieldDashboard();
}

// ========================================
// DASHBOARD CONTROLLERS
// ========================================

function initAdminDashboard() {
    AdminRenderers.updateAdminStats();
    AdminRenderers.updateUserProfileUI();
    AdminRenderers.renderActivityLog();

    // Defer heavy chart/map
    setTimeout(() => {
        ChartUtils.renderAdminCharts();
        MapUtils.renderMiniMap(); // Initialize overview mini-map
    }, 100);

    AdminRenderers.renderDropdowns();
    AdminRenderers.renderAdminTasks();
    AdminRenderers.renderRegistrations();

    // Check if chat tab is active
    const chatTab = document.getElementById('tab-messages');
    if (chatTab && !chatTab.classList.contains('hidden')) {
        ChatRenderers.renderAdminChat();
    }
}

function initFieldDashboard() {
    const user = window.store.getCurrentUser();
    if (!user) return;

    // Ensure Nav exists
    const el = document.getElementById('field-user-name');
    if (el) el.innerText = user.name;

    const att = window.store.getStaffStatus().find(s => s.id === user.id);
    const status = att ? att.status : 'out';
    FieldRenderers.updateClockUI(status, att ? att.lastLoc : 'Ready to start');

    FieldRenderers.renderWorkerStats(user.id);
    FieldRenderers.renderFieldTasks(user.id);
    FieldRenderers.renderFieldLeaves();
    FieldRenderers.renderFieldProfile();

    // Render Worker Charts
    setTimeout(() => ChartUtils.renderWorkerCharts(user.id), 100);
}


// ========================================
// GLOBAL ACTIONS (Exposed to Window)
// ========================================

window.toggleDropdown = (id) => {
    const el = document.getElementById(id);
    if (el) {
        document.querySelectorAll('.dropdown-menu').forEach(d => {
            if (d.id !== id) d.classList.add('hidden');
        });
        el.classList.toggle('hidden');
    }
};

window.exportAttendance = (format) => {
    const data = window.store.getAttendanceLogs();

    if (format === 'csv') {
        const columns = [
            { header: 'Date', key: 'timestamp', transform: (v) => new Date(v).toLocaleDateString() },
            { header: 'Time', key: 'timestamp', transform: (v) => new Date(v).toLocaleTimeString() },
            { header: 'User', key: 'userName' },
            { header: 'Action', key: 'action' },
            { header: 'Site', key: 'siteName' },
            { header: 'Within Geofence', key: 'withinGeofence', transform: (v) => v ? 'Yes' : 'No' },
            { header: 'Distance (km)', key: 'distance', transform: (v) => v ? v.toFixed(3) : '0' }
        ];
        window.ExportUtils.exportCSV(data, columns, `Attendance_Log_${new Date().toISOString().split('T')[0]}`);
    } else if (format === 'json') {
        window.ExportUtils.exportJSON(data, `Attendance_Log_${new Date().toISOString().split('T')[0]}`);
    }
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
};

window.exportReports = (format) => {
    const data = window.store.getReports().map(r => ({
        ...r,
        author: window.store.getUsers().find(u => u.id === r.userId)?.name || 'Unknown'
    }));

    if (format === 'csv') {
        const columns = [
            { header: 'Date', key: 'createdAt', transform: (v) => new Date(v).toLocaleDateString() },
            { header: 'Time', key: 'createdAt', transform: (v) => new Date(v).toLocaleTimeString() },
            { header: 'Author', key: 'author' },
            { header: 'Content', key: 'content' },
            { header: 'Has Photo', key: 'hasPhoto', transform: (v) => v ? 'Yes' : 'No' }
        ];
        window.ExportUtils.exportCSV(data, columns, `Field_Reports_${new Date().toISOString().split('T')[0]}`);
    } else if (format === 'json') {
        window.ExportUtils.exportJSON(data, `Field_Reports_${new Date().toISOString().split('T')[0]}`);
    }
    document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
};

// ... Actions for specific entities ...

window.deleteWorker = async (id) => {
    if (!confirm('⚠️ Are you sure you want to PERMANENTLY REMOVE this staff member?')) return;
    try {
        await window.store.deleteWorker(id);
        Toast.success('Staff member removed');
        AdminRenderers.renderStaff();
    } catch (e) {
        Toast.error(e.message);
    }
};

window.editWorker = (userId) => {
    const user = window.store.getUsers().find(u => u.id === userId);
    if (!user) return;

    const form = document.getElementById('worker-form');
    form.workerId.value = user.id;
    form.name.value = user.name;
    form.email.value = user.email;
    form.phone.value = user.phone;
    if (form.role) form.role.value = user.role || 'field';
    if (form.assignedSite) form.assignedSite.value = user.assignedSite || '';

    const passInput = form.querySelector('input[name="password"]');
    if (passInput) {
        passInput.required = false;
        passInput.placeholder = "Leave blank to keep current password";
    }

    document.querySelector('#worker-modal h3').innerText = 'Edit Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Update Worker';
    UI.openModal('worker-modal');
};

window.toggleWorker = (userId) => {
    window.store.toggleWorkerStatus(userId);
    Toast.success('Worker status updated');
    AdminRenderers.renderStaff();
};

window.openAddWorkerModal = () => {
    const form = document.getElementById('worker-form');
    if (form) {
        form.reset();
        form.workerId.value = '';
        const passInput = form.querySelector('input[name="password"]');
        if (passInput) {
            passInput.required = true;
            passInput.placeholder = "Password (for login)";
        }
    }
    document.querySelector('#worker-modal h3').innerText = 'Add Field Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Add Worker';
    UI.openModal('worker-modal');
};

window.editWorker = (workerId) => {
    const worker = window.store.getUsers().find(u => u.id === workerId);
    if (!worker) return;

    const form = document.getElementById('worker-form');
    if (!form) return;

    form.workerId.value = workerId;
    form.name.value = worker.name || '';
    form.email.value = worker.email || '';
    form.phone.value = worker.phone || '';
    if (form.role) form.role.value = worker.role || 'field';
    if (form.assignedSite) form.assignedSite.value = worker.assignedSite || '';

    // Password not required for editing
    const passInput = form.querySelector('input[name="password"]');
    if (passInput) {
        passInput.required = false;
        passInput.placeholder = "New Password (leave blank to keep current)";
    }

    document.querySelector('#worker-modal h3').innerText = 'Edit Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Update Worker';
    UI.openModal('worker-modal');
};

window.toggleWorker = async (workerId) => {
    const worker = window.store.getUsers().find(u => u.id === workerId);
    if (!worker) return;

    const newStatus = !worker.active;
    const action = newStatus ? 'activate' : 'deactivate';

    if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${worker.name}?`)) {
        await window.store.updateWorker(workerId, { active: newStatus });
        AdminRenderers.renderStaff();
        Toast.success(`Worker ${action}d`);
    }
};

window.deleteProject = async (id) => {
    if (confirm('Delete this project?')) {
        await window.store.deleteProject(id);
        AdminRenderers.renderProjects();
        Toast.success('Project deleted');
    }
};

window.editProject = (projectId) => {
    const project = window.store.getProjects().find(p => p.id === projectId);
    if (!project) return;
    const form = document.getElementById('project-form');
    form.dataset.editId = projectId;
    form.name.value = project.name;
    form.description.value = project.description || '';
    form.manager.value = project.manager || '';
    document.querySelector('#project-modal h3').innerText = 'Edit Project';
    document.querySelector('#project-modal button[type=submit]').innerText = 'Update Project';
    UI.openModal('project-modal');
};

// ========================================
// AI TRANSLATION FEATURE
// ========================================

// Store the current report being translated
let currentTranslationIndex = null;
let currentTranslationContent = '';

window.translateReport = (index, content) => {
    currentTranslationIndex = index;
    currentTranslationContent = content;
    UI.openModal('translate-modal');
};

window.performTranslation = async (targetLang) => {
    if (currentTranslationIndex === null || !currentTranslationContent) {
        Toast.error('No report selected for translation');
        return;
    }

    const translationDiv = document.getElementById(`report-translation-${currentTranslationIndex}`);
    if (!translationDiv) return;

    // Show loading state
    translationDiv.style.display = 'block';
    translationDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; color:var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Translating to ${targetLang}...
        </div>
    `;

    UI.closeModal('translate-modal');

    try {
        const translated = await window.AIService.translate(currentTranslationContent, targetLang);
        translationDiv.innerHTML = `
            <div style="margin-bottom:6px; font-weight:600; color:var(--primary); font-size:0.8rem;">
                <i class="fa-solid fa-language"></i> Translated to ${targetLang}
            </div>
            <div>${translated}</div>
        `;
        Toast.success('Translation complete!');
    } catch (error) {
        translationDiv.innerHTML = `
            <div style="color:var(--error);">
                <i class="fa-solid fa-exclamation-triangle"></i> Translation failed. Please try again.
            </div>
        `;
        Toast.error('Translation failed');
    }

    // Reset
    currentTranslationIndex = null;
    currentTranslationContent = '';
};

// Task translation variables
let currentTaskIndex = null;
let currentTaskContent = '';
let currentTaskType = 'admin'; // 'admin' or 'field'

window.translateTask = (index, content, type = 'admin') => {
    currentTaskIndex = index;
    currentTaskContent = content;
    currentTaskType = type;
    UI.openModal('translate-task-modal');
};

window.performTaskTranslation = async (targetLang) => {
    if (currentTaskIndex === null || !currentTaskContent) {
        Toast.error('No task selected for translation');
        return;
    }

    const prefix = currentTaskType === 'field' ? 'field-task-translation' : 'task-translation';
    const translationDiv = document.getElementById(`${prefix}-${currentTaskIndex}`);
    if (!translationDiv) return;

    // Show loading state
    translationDiv.style.display = 'block';
    translationDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; color:var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin"></i>
            Translating to ${targetLang}...
        </div>
    `;

    UI.closeModal('translate-task-modal');

    try {
        const translated = await window.AIService.translate(currentTaskContent, targetLang);
        translationDiv.innerHTML = `
            <div style="margin-bottom:4px; font-weight:600; color:var(--primary); font-size:0.75rem;">
                <i class="fa-solid fa-language"></i> ${targetLang}
            </div>
            <div>${translated}</div>
        `;
        Toast.success('Translation complete!');
    } catch (error) {
        translationDiv.innerHTML = `
            <div style="color:var(--error);">
                <i class="fa-solid fa-exclamation-triangle"></i> Translation failed.
            </div>
        `;
        Toast.error('Translation failed');
    }

    // Reset
    currentTaskIndex = null;
    currentTaskContent = '';
    currentTaskType = 'admin';
};

// ========================================
// REPORT WRITING FEATURES
// ========================================

// Smart Templates
const reportTemplates = {
    daily: `📅 DAILY UPDATE

Location: [Current Site]
Date: ${new Date().toLocaleDateString()}

Activities Completed:
• 

Issues Encountered:
• None

Status: ✅ All tasks completed`,

    issue: `⚠️ ISSUE REPORT

Location: 
Date/Time: ${new Date().toLocaleString()}

Issue Description:


Severity: [ ] Low [ ] Medium [ ] High

Action Taken:


Follow-up Required: [ ] Yes [ ] No`,

    maintenance: `🔧 MAINTENANCE REPORT

Equipment/Asset: 
Location: 

Problem Found:


Repair/Action Taken:


Parts Used:
• 

Status: [ ] Fixed [ ] Needs Parts [ ] Requires Specialist`,

    observation: `👁️ FIELD OBSERVATION

Location: 
Date/Time: ${new Date().toLocaleString()}

Observation:


Recommendation:


Priority: [ ] Low [ ] Medium [ ] High`
};

window.applyTemplate = (templateType) => {
    const textarea = document.getElementById('report-content');
    if (textarea && reportTemplates[templateType]) {
        textarea.value = reportTemplates[templateType];
        textarea.focus();
    }
};

// One-Tap Tags
window.addTag = (tag) => {
    const textarea = document.getElementById('report-content');
    if (textarea) {
        const currentText = textarea.value.trim();
        if (currentText) {
            textarea.value = `${tag}\n\n${currentText}`;
        } else {
            textarea.value = `${tag}\n\n`;
        }
        textarea.focus();
    }
};

// Voice Commands (Web Speech API)
let recognition = null;
let isListening = false;

window.toggleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        Toast.error('Voice input not supported in this browser');
        return;
    }

    if (isListening) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
};

function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    // Get selected language from dropdown
    const langSelect = document.getElementById('voice-language');
    const selectedLang = langSelect ? langSelect.value : 'hi-IN';

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;

    const voiceControls = document.getElementById('voice-controls');
    const micIcon = document.getElementById('mic-icon');
    const statusText = document.getElementById('voice-status-text');
    const textarea = document.getElementById('report-content');

    recognition.onstart = () => {
        isListening = true;
        voiceControls.style.display = 'block';
        micIcon.classList.add('recording');
        micIcon.style.color = '#ef4444';
        const langName = langSelect.options[langSelect.selectedIndex].text;
        statusText.textContent = `Listening in ${langName}...`;
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }

        // Append to textarea
        if (event.results[event.resultIndex].isFinal) {
            textarea.value += transcript + ' ';
        }
        statusText.textContent = `Heard: "${transcript.substring(0, 50)}..."`;
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            Toast.error('Microphone permission denied');
        }
        stopVoiceInput();
    };

    recognition.onend = () => {
        if (isListening) {
            recognition.start(); // Keep listening
        }
    };

    recognition.start();
    Toast.success('Voice input started - speak now!');
}

function stopVoiceInput() {
    if (recognition) {
        isListening = false;
        recognition.stop();
        recognition = null;
    }

    const voiceControls = document.getElementById('voice-controls');
    const micIcon = document.getElementById('mic-icon');

    if (voiceControls) voiceControls.style.display = 'none';
    if (micIcon) {
        micIcon.classList.remove('recording');
        micIcon.style.color = '';
    }

    Toast.success('Voice input stopped');
}

// ========================================
// PHOTO UPLOAD HANDLERS
// ========================================

// Initialize photo upload handlers when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area-display');
    const fileInput = document.getElementById('report-photo');
    const photoPreview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');

    if (uploadArea && fileInput) {
        // Click on upload area triggers file input
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Handle file selection
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    Toast.error('Please select an image file');
                    return;
                }

                if (file.size > 5 * 1024 * 1024) {
                    Toast.error('Image must be less than 5MB');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    previewImage.src = event.target.result;
                    photoPreview.style.display = 'block';
                    uploadArea.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

// Remove photo function
window.removePhoto = () => {
    const uploadArea = document.getElementById('upload-area-display');
    const fileInput = document.getElementById('report-photo');
    const photoPreview = document.getElementById('photo-preview');
    const previewImage = document.getElementById('preview-image');

    if (fileInput) fileInput.value = '';
    if (previewImage) previewImage.src = '';
    if (photoPreview) photoPreview.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
};


// AI Report Helper
const aiHelperQuestions = [
    { id: 'what', question: 'What work did you do today?', placeholder: 'e.g., Fixed pump, delivered materials, inspected site...' },
    { id: 'where', question: 'Where did you do this work?', placeholder: 'e.g., Site 3, Main Office, Village A...' },
    { id: 'issues', question: 'Any problems or issues?', placeholder: 'e.g., No issues, or describe the problem...' },
    { id: 'status', question: 'Is the work complete?', placeholder: 'e.g., Yes, No - needs follow-up...' }
];

let aiHelperAnswers = {};
let currentQuestionIndex = 0;

window.openAIHelper = () => {
    aiHelperAnswers = {};
    currentQuestionIndex = 0;

    const chatDiv = document.getElementById('ai-helper-chat');
    chatDiv.innerHTML = '';

    document.getElementById('ai-helper-input-area').style.display = 'block';
    document.getElementById('ai-helper-generating').style.display = 'none';

    UI.openModal('ai-helper-modal');
    askNextQuestion();
};

function askNextQuestion() {
    if (currentQuestionIndex >= aiHelperQuestions.length) {
        generateAIReport();
        return;
    }

    const q = aiHelperQuestions[currentQuestionIndex];
    const chatDiv = document.getElementById('ai-helper-chat');
    const inputField = document.getElementById('ai-helper-input');

    chatDiv.innerHTML += `
        <div style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: 8px; margin-bottom: 8px;">
            <strong style="color: var(--primary);"><i class="fa-solid fa-robot"></i> AI:</strong>
            <p style="margin: 4px 0 0;">${q.question}</p>
        </div>
    `;

    inputField.placeholder = q.placeholder;
    inputField.value = '';
    inputField.focus();

    chatDiv.scrollTop = chatDiv.scrollHeight;
}

window.sendAIHelperAnswer = () => {
    const inputField = document.getElementById('ai-helper-input');
    const answer = inputField.value.trim();

    if (!answer) return;

    const chatDiv = document.getElementById('ai-helper-chat');
    const q = aiHelperQuestions[currentQuestionIndex];

    // Show user's answer
    chatDiv.innerHTML += `
        <div style="background: var(--bg-hover); padding: 10px; border-radius: 8px; margin-bottom: 8px; margin-left: 20px;">
            <strong><i class="fa-solid fa-user"></i> You:</strong>
            <p style="margin: 4px 0 0;">${answer}</p>
        </div>
    `;

    aiHelperAnswers[q.id] = answer;
    currentQuestionIndex++;

    inputField.value = '';
    chatDiv.scrollTop = chatDiv.scrollHeight;

    setTimeout(() => askNextQuestion(), 500);
};

// Handle Enter key in AI helper input
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('ai-helper-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.sendAIHelperAnswer();
            }
        });
    }
});

async function generateAIReport() {
    document.getElementById('ai-helper-input-area').style.display = 'none';
    document.getElementById('ai-helper-generating').style.display = 'block';

    const prompt = `You are helping a field worker write a professional report. Based on their answers, generate a clear, well-structured field report.

Worker's answers:
- What they did: ${aiHelperAnswers.what}
- Location: ${aiHelperAnswers.where}
- Issues: ${aiHelperAnswers.issues}
- Status: ${aiHelperAnswers.status}

Generate a professional field report (3-5 sentences). Use simple language. Include date/time. Format nicely with bullet points if needed. Start with a status emoji.`;

    try {
        const report = await window.AIService.generate(prompt);

        // Insert into report textarea
        const textarea = document.getElementById('report-content');
        textarea.value = report;

        UI.closeModal('ai-helper-modal');
        Toast.success('Report generated! Review and submit.');
    } catch (error) {
        Toast.error('Failed to generate report. Please try again.');
        document.getElementById('ai-helper-input-area').style.display = 'block';
        document.getElementById('ai-helper-generating').style.display = 'none';
    }
}

window.deleteSite = async (id) => {
    if (confirm('Deactivate this site?')) {
        await window.store.deleteSite(id);
        AdminRenderers.renderSites();
        Toast.success('Site deactivated');
    }
};

window.editSite = (siteId) => {
    const site = window.store.getAllSites().find(s => s.id === siteId);
    if (!site) return;
    const form = document.getElementById('site-form');
    form.dataset.editId = siteId;
    form.name.value = site.name;
    form.projectId.value = site.projectId || '';
    form.lat.value = site.coords ? site.coords.lat : '';
    form.lng.value = site.coords ? site.coords.lng : '';
    form.radius.value = site.radius || 200;
    document.querySelector('#site-modal h3').innerText = 'Edit Site';
    document.querySelector('#site-modal button[type=submit]').innerText = 'Update Site';
    UI.openModal('site-modal');
};



window.completeTask = (id) => {
    window.store.completeTask(id);
    const user = window.store.getCurrentUser();
    if (user) FieldRenderers.renderFieldTasks(user.id);
    Toast.success('Task completed');
};

window.removePhoto = function () {
    document.getElementById('photo-preview').style.display = 'none';
    document.getElementById('upload-area-display').style.display = 'block';
    document.getElementById('report-photo').value = '';
};

// ========================================
// AI FEATURES
// ========================================

window.generateDailyBriefing = async () => {
    const container = document.getElementById('ai-briefing-container');
    const btn = document.getElementById('generate-briefing-btn');
    if (!container || !btn) return;

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
    container.innerHTML = '<p style="color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-brain"></i> AI is analyzing your data...</p>';

    try {
        // Gather data
        const stats = window.store.getStats();
        const logs = window.store.getAttendanceLogs(null, 20);
        const reports = window.store.getReports();
        const leaves = window.store.getLeaveRequests();

        // Call AI Service
        const briefing = await window.AIService.generateBriefing(stats, logs, reports, leaves);

        // Format the response (convert markdown to HTML-safe)
        const formattedBriefing = briefing
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^- /gm, '• ')
            .replace(/\n/g, '<br>');

        container.innerHTML = `<div style="white-space: pre-wrap;">${formattedBriefing}</div>`;
        Toast.success('Briefing generated!');
    } catch (error) {
        console.error('AI Briefing Error:', error);
        container.innerHTML = `<p style="color: #ef4444;"><i class="fa-solid fa-exclamation-triangle"></i> Failed to generate briefing. ${error.message || 'Check console for details.'}</p>`;
        Toast.error('Briefing generation failed');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate';
    }
};

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector('input[type="password"]').value;

            Loading.show();
            await new Promise(resolve => setTimeout(resolve, 400));

            try {
                const res = await window.store.login(email, password);
                if (res.success) {
                    Toast.success(`Welcome, ${res.user.name || 'User'}`);
                    setTimeout(() => {
                        navigate(res.user.role === 'admin' ? 'admin' : 'field');
                        Loading.hide();
                    }, 600);
                } else {
                    Loading.hide();
                    Toast.error(res.message);
                }
            } catch (err) {
                Loading.hide();
                if (err.message.includes('user-not-found')) Toast.error("User not found");
                else if (err.message.includes('wrong-password')) Toast.error("Invalid password");
                else Toast.error("Authentication failed");
            }
        });
    }

    // Subscribe to Store
    if (window.store.subscribe) {
        window.store.subscribe(() => {
            const user = window.store.getCurrentUser();
            const currentView = document.querySelector('.view.active');

            if (user && currentView && (currentView.id === 'auth-view' || currentView.id === 'landing-page')) {
                navigate(user.role === 'admin' ? 'admin' : 'field');
                return;
            }

            if (currentView && currentView.id === 'admin-view') {
                initAdminDashboard();
                AdminRenderers.renderProjects();
                AdminRenderers.renderSites();
                AdminRenderers.renderStaff();
                AdminRenderers.renderAdminTasks();
                AdminRenderers.renderAttendanceLogs();
                AdminRenderers.renderAdminReports();
                AdminRenderers.renderAdminLeaves();
            } else if (currentView && currentView.id === 'field-view') {
                if (user) {
                    FieldRenderers.renderFieldTasks(user.id);
                    FieldRenderers.renderFieldLeaves();
                }
            }
        });
    }

    // Logout
    document.querySelectorAll('#logout-btn, #field-logout, #field-tab-logout').forEach(btn => {
        btn.addEventListener('click', () => {
            window.store.logout();
            Toast.info('Logged out');
            navigate('auth'); // Default to auth
        });
    });

    // Admin Nav
    let dataTabUnlocked = false; // Session-based unlock flag

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            // SECURITY: Data tab requires password re-authentication
            if (targetId === 'data' && !dataTabUnlocked) {
                const password = prompt('🔐 Security Check\n\nThis section contains sensitive operations.\nPlease re-enter your password to continue:');
                if (!password) {
                    Toast.info('Access cancelled');
                    return;
                }

                Loading.show();
                try {
                    const user = firebase.auth().currentUser;
                    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
                    await user.reauthenticateWithCredential(credential);
                    dataTabUnlocked = true; // Unlock for this session
                    Toast.success('Access granted');
                } catch (err) {
                    Loading.hide();
                    Toast.error('Incorrect password');
                    return;
                }
                Loading.hide();
            }

            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            link.parentElement.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
                tab.classList.add('hidden');
            });

            const targetTab = document.getElementById(`tab-${targetId}`);
            if (targetTab) {
                setTimeout(() => {
                    targetTab.classList.remove('hidden');
                    setTimeout(() => targetTab.classList.add('active'), 10);
                }, 100);
            }

            // Trigger renderers AFTER tab is visible to ensure layout calculations work
            setTimeout(() => {
                if (targetId === 'map') MapUtils.renderMap();
                if (targetId === 'projects') AdminRenderers.renderProjects();
                if (targetId === 'sites') AdminRenderers.renderSites();
                if (targetId === 'staff') AdminRenderers.renderStaff();
                if (targetId === 'tasks') AdminRenderers.renderAdminTasks();
                if (targetId === 'reports') AdminRenderers.renderAdminReports();
                if (targetId === 'attendance') AdminRenderers.renderAttendanceLogs();
                if (targetId === 'leave') AdminRenderers.renderAdminLeaves();
                if (targetId === 'messages') ChatRenderers.renderAdminChat();
                if (targetId === 'calendar') CalendarRenderer.render();
            }, 150);
        });
    });

    // Programmatic tab switching function (for buttons)
    window.switchAdminTab = (tabName) => {
        // Update sidebar active state
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        const navLink = document.querySelector(`.nav-links a[href="#${tabName}"]`);
        if (navLink) navLink.parentElement.classList.add('active');

        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
            tab.classList.add('hidden');
        });

        // Show target tab
        const targetTab = document.getElementById(`tab-${tabName}`);
        if (targetTab) {
            setTimeout(() => {
                targetTab.classList.remove('hidden');
                setTimeout(() => targetTab.classList.add('active'), 10);
            }, 100);
        }

        // Trigger renderers
        setTimeout(() => {
            if (tabName === 'overview') { AdminRenderers.updateAdminStats(); ChartUtils.renderAdminCharts(); }
            if (tabName === 'map') MapUtils.renderMap();
            if (tabName === 'projects') AdminRenderers.renderProjects();
            if (tabName === 'sites') AdminRenderers.renderSites();
            if (tabName === 'staff') AdminRenderers.renderStaff();
            if (tabName === 'tasks') AdminRenderers.renderAdminTasks();
            if (tabName === 'reports') AdminRenderers.renderAdminReports();
            if (tabName === 'attendance') AdminRenderers.renderAttendanceLogs();
            if (tabName === 'leave') AdminRenderers.renderAdminLeaves();
            if (tabName === 'messages') ChatRenderers.renderAdminChat();
            if (tabName === 'calendar') CalendarRenderer.render();
        }, 150);
    };

    // Field Nav
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Update Nav
            document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');

            // Show Tab
            document.querySelectorAll('.field-tab').forEach(t => t.classList.add('hidden'));
            const tab = document.getElementById(targetId);
            if (tab) tab.classList.remove('hidden');

            // Trigger Renderers
            if (targetId === 'field-tab-leave') FieldRenderers.renderFieldLeaves();
            if (targetId === 'field-tab-profile') FieldRenderers.renderFieldProfile();
            if (targetId === 'field-tab-messages') ChatRenderers.renderFieldChat();
            if (targetId === 'field-tab-reports') FieldRenderers.renderFieldReports();
        });
    });


}

function setupForms() {
    // Field Profile
    document.getElementById('field-profile-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        Loading.show();
        const fd = new FormData(e.target);
        try {
            await window.store.updateProfile({
                name: fd.get('name'),
                phone: fd.get('phone'),
                skills: fd.get('skills')
            });
            Toast.success('Profile updated');
            FieldRenderers.renderFieldProfile();
        } catch (err) {
            Toast.error(err.message);
        }
        Loading.hide();
    });
    // Project
    document.getElementById('project-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        Loading.show();
        const fd = new FormData(e.target);
        const editId = e.target.dataset.editId;
        try {
            const data = {
                name: fd.get('name'),
                description: fd.get('description'),
                manager: fd.get('manager')
            };
            if (editId) await window.store.updateProject(editId, data);
            else await window.store.addProject(data);
            Toast.success(editId ? 'Project updated' : 'Project created');
            UI.closeModal('project-modal');
            e.target.reset();
            delete e.target.dataset.editId;
            AdminRenderers.renderProjects();
        } catch (err) {
            Toast.error(err.message);
        }
        Loading.hide();
    });

    // Worker
    // Worker
    document.getElementById('worker-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        Loading.show();
        const fd = new FormData(e.target);

        // Validation
        const phone = fd.get('phone').trim();
        const email = fd.get('email').trim();

        if (!/^\d{10}$/.test(phone)) {
            Toast.error('Phone number must be exactly 10 digits');
            Loading.hide();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Toast.error('Invalid email address format');
            Loading.hide();
            return;
        }

        const workerId = fd.get('workerId');
        try {
            if (workerId) {
                await window.store.updateWorker(workerId, {
                    name: fd.get('name'),
                    email: email,
                    phone: phone,
                    role: fd.get('role'),
                    assignedSite: fd.get('assignedSite')
                });
                Toast.success('Worker updated');
            } else {
                await window.store.addWorker({
                    name: fd.get('name'),
                    email: email,
                    phone: phone,
                    password: fd.get('password'),
                    role: fd.get('role'),
                    assignedSite: fd.get('assignedSite')
                });
                Toast.success('Worker added');
            }
            UI.closeModal('worker-modal');
            e.target.reset();
            AdminRenderers.renderStaff();
        } catch (err) {
            Toast.error(err.message);
        }
        Loading.hide();
    });

    // Registration (Public)
    document.getElementById('registration-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        Loading.show();
        const fd = new FormData(e.target);

        // Validation
        const phone = fd.get('phone').trim();
        const email = fd.get('email').trim();

        if (!/^\d{10}$/.test(phone)) {
            Toast.error('Phone number must be exactly 10 digits');
            Loading.hide();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Toast.error('Invalid email address format');
            Loading.hide();
            return;
        }

        try {
            await window.store.registerVolunteer({
                name: fd.get('name'),
                email: email,
                phone: phone,
                skills: fd.get('skills')
            });
            UI.closeModal('registration-modal');
            e.target.reset();
            Toast.success('Registration submitted! We will contact you soon.');
        } catch (err) {
            console.error(err);
            Toast.error('Registration failed');
        }
        Loading.hide();
    });

    // Site
    document.getElementById('site-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        Loading.show();
        const fd = new FormData(e.target);
        const editId = e.target.dataset.editId;
        try {
            const radius = parseInt(fd.get('radius')) || 200;
            const lat = parseFloat(fd.get('lat'));
            const lng = parseFloat(fd.get('lng'));

            if (radius <= 0) throw new Error("Radius must be positive");
            if (isNaN(lat) || isNaN(lng)) throw new Error("Invalid coordinates selected");

            const data = {
                name: fd.get('name'),
                projectId: fd.get('projectId') || null,
                radius: radius,
                coords: { lat, lng }
            };
            if (editId) await window.store.updateSite(editId, data);
            else await window.store.addSite(data);
            Toast.success('Site saved');
            UI.closeModal('site-modal');
            e.target.reset();
            delete e.target.dataset.editId;
            AdminRenderers.renderSites();
        } catch (err) {
            Toast.error(err.message);
        }
        Loading.hide();
    });

    // Task
    document.getElementById('create-task-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const assignedId = fd.get('assignedTo');
        // Simple overlap check
        const leaves = window.store.getLeaveRequests(assignedId).filter(r => r.status === 'approved');
        if (leaves.length > 0 && !confirm('⚠️ Staff on leave. Assign anyway?')) return;

        Loading.show();
        await new Promise(r => setTimeout(r, 300));
        await window.store.addTask({
            title: fd.get('title'),
            location: fd.get('location'),
            assignedTo: assignedId,
            priority: fd.get('priority'),
            time: fd.get('time'),
            coords: [51.5, -0.1], // Mock
            siteId: 's1'
        });
        Loading.hide();
        UI.closeModal('task-modal');
        e.target.reset();
        AdminRenderers.renderAdminTasks();
        Toast.success('Task assigned');
    });

    // Clock In/Out
    const clockBtn = document.getElementById('clock-btn');
    if (clockBtn) {
        clockBtn.addEventListener('click', async () => {
            const user = window.store.getCurrentUser();
            const isClockingIn = clockBtn.innerText.includes('In');

            if (isClockingIn) {
                clockBtn.innerText = 'Locating...';
                clockBtn.disabled = true;
                Loading.show();
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(async (pos) => {
                        const { latitude, longitude } = pos.coords;

                        // PRIORITY 1: Check if worker has an assigned site
                        let site = null;
                        if (user.assignedSite) {
                            const allSites = window.store.getAllSites();
                            const assignedSite = allSites.find(s => s.id === user.assignedSite);
                            if (assignedSite && assignedSite.coords) {
                                // Calculate distance to assigned site
                                const R = 6371e3; // metres
                                let siteLat, siteLng;
                                if (Array.isArray(assignedSite.coords)) {
                                    siteLat = assignedSite.coords[0];
                                    siteLng = assignedSite.coords[1];
                                } else {
                                    siteLat = assignedSite.coords.lat;
                                    siteLng = assignedSite.coords.lng;
                                }
                                const φ1 = latitude * Math.PI / 180;
                                const φ2 = siteLat * Math.PI / 180;
                                const Δφ = (siteLat - latitude) * Math.PI / 180;
                                const Δλ = (siteLng - longitude) * Math.PI / 180;
                                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                                    Math.cos(φ1) * Math.cos(φ2) *
                                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                const distance = R * c;
                                site = { ...assignedSite, distance };
                            }
                        }

                        // PRIORITY 2: Fall back to nearest site if no assigned site
                        if (!site) {
                            site = window.store.findNearestSite([latitude, longitude]);
                        }

                        // 1. Must have at least one site in the system
                        if (!site) {
                            Loading.hide();
                            Toast.error('No workplace configured in system.');
                            clockBtn.disabled = false;
                            clockBtn.innerText = 'Clock In';
                            return;
                        }

                        // 2. STRICT CHECK: Must be within radius
                        // site.distance is in meters (calculated above or in store_v2.js)
                        // site.radius is in meters (default 200)
                        const allowedRadius = site.radius || 200;

                        if (site.distance > allowedRadius) {
                            Loading.hide();
                            Toast.error(`Too far from ${site.name}. You are ${Math.round(site.distance)}m away (Max: ${allowedRadius}m).`);
                            clockBtn.disabled = false;
                            clockBtn.innerText = 'Clock In';
                            return;
                        }

                        await window.store.logAttendance(user.id, 'clock-in', site.id, `${latitude},${longitude}`, { latitude, longitude });

                        FieldRenderers.updateClockUI('in', site.name);
                        Loading.hide(); clockBtn.disabled = false; Toast.success('Clocked In');
                    }, (err) => {
                        Loading.hide();
                        let msg = 'Location denied';
                        if (err.code === 1) msg = 'Location access denied. Please enable permissions.';
                        else if (err.code === 2) msg = 'Location unavailable.';
                        else if (err.code === 3) msg = 'Location timed out.';

                        console.error('Geo Error:', err);
                        Toast.error(msg);
                        clockBtn.disabled = false;
                        clockBtn.innerText = 'Clock In';
                    });
                } else {
                    Loading.hide(); Toast.error('Geolocation not supported by this browser.');
                }
            } else {
                Loading.show();
                await window.store.logAttendance(user.id, 'clock-out', null, 'Manual', null);
                FieldRenderers.updateClockUI('out', 'Ready');
                Loading.hide(); Toast.success('Clocked Out');
            }
        });
    }

    // Leave Request
    document.getElementById('leave-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        Loading.show();
        await window.store.addLeaveRequest({
            userId: window.store.getCurrentUser().id,
            type: fd.get('type'),
            startDate: fd.get('startDate'),
            endDate: fd.get('endDate'),
            reason: fd.get('reason')
        });
        Loading.hide();
        UI.closeModal('leave-modal');
        FieldRenderers.renderFieldLeaves();
        Toast.success('Request sent');
    });

    // Field Report
    document.getElementById('report-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        Loading.show();
        const fileInput = document.getElementById('report-photo');
        let photoData = null;

        if (fileInput.files.length > 0) {
            try {
                photoData = await FileUtils.resizeImage(fileInput.files[0]);
            } catch (e) { console.error("Image resize failed", e); }
        }

        await window.store.addReport({
            userId: window.store.getCurrentUser().id,
            content: fd.get('content'),
            hasPhoto: !!photoData,
            photoData: photoData
        });
        Loading.hide();
        UI.closeModal('report-modal');
        Toast.success('Report submitted');
    });
}
