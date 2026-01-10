
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
        window.store.addTask({
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
                        const site = window.store.findNearestSite([latitude, longitude]);

                        // 1. Must have at least one site in the system
                        if (!site) {
                            Loading.hide();
                            Toast.error('No workplace configured in system.');
                            clockBtn.disabled = false;
                            clockBtn.innerText = 'Clock In';
                            return;
                        }

                        // 2. STRICT CHECK: Must be within radius
                        // site.distance is in meters (calculated in store_v2.js)
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
