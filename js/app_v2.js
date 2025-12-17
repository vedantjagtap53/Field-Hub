// ========================================
// GeoOps v2.0 - Minimalist Professional Edition
// ========================================

const Toast = {
    show: (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fa-solid fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    success: (msg) => Toast.show(msg, 'success'),
    error: (msg) => Toast.show(msg, 'error'),
    info: (msg) => Toast.show(msg, 'info')
};

const Loading = {
    show: () => {
        let loader = document.querySelector('.global-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'global-loader';
            loader.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(loader);
        }
        loader.classList.add('active');
    },
    hide: () => {
        const loader = document.querySelector('.global-loader');
        if (loader) loader.classList.remove('active');
    }
};

// Initialize
if (window.store) {
    window.store.init();
} else {
    Toast.error("System initialization failed. Please refresh.");
}

// const store = window.store; // Global 'store' is already available from store_v2.js

// DOM Elements
const views = {
    landing: document.getElementById('landing-page'),
    auth: document.getElementById('auth-view'),
    admin: document.getElementById('admin-view'),
    field: document.getElementById('field-view')
};
const loginForm = document.getElementById('login-form');
let map = null;
let attendanceChart = null;


// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkSession();
    setupEventListeners();
    updateDate();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => { });
    }

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

// Function to handle global toggle visibility
function updateGlobalToggle(viewId) {
    const globalToggle = document.getElementById('theme-toggle');
    if (!globalToggle) return;

    // Hide global toggle on dashboard views where we have dedicated buttons
    if (viewId === 'admin-view' || viewId === 'field-view') {
        globalToggle.style.display = 'none';
    } else {
        globalToggle.style.display = 'flex';
    }
}

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector('input[type="password"]').value;

            Loading.show();
            await new Promise(resolve => setTimeout(resolve, 400));

            try {
                // Await the login (now async)
                const res = await store.login(email, password);
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
                console.error(err);
                if (err.message.includes('user-not-found')) Toast.error("User not found");
                else if (err.message.includes('wrong-password')) Toast.error("Invalid password");
                else Toast.error("Authentication failed");
            }
        });
    }

    // Subscribe to store updates for real-time UI
    if (store.subscribe) {
        store.subscribe(() => {
            const user = store.getCurrentUser();
            const currentView = document.querySelector('.view.active');

            // Auto-redirect if on Auth/Landing but user is logged in
            if (user && currentView && (currentView.id === 'auth-view' || currentView.id === 'landing-page')) {
                // If on Landing (index.html) and Admin view is missing (implies split file), redirect to app.html
                if (currentView.id === 'landing-page' && !views.admin) {
                    window.location.href = 'app.html';
                    return;
                }
                // Determine target view
                const target = user.role === 'admin' ? 'admin' : 'field';
                // If we are already attempting to show it, or if we are on auth/landing
                navigate(target);
                return;
            }

            // Refresh the current view if data changes
            if (currentView && currentView.id === 'admin-view') {
                updateAdminStats();
                renderActivityLog();
                // Only re-render chart if needed (optional, typically stats update handles numbers, but chart might need refresh)
                if (window.renderChart) renderChart();

                // We cautiously re-render active tabs to show live updates
                const tabs = ['staff', 'projects', 'tasks', 'attendance', 'reports', 'leave', 'sites'];
                tabs.forEach(t => {
                    const tabEl = document.getElementById('tab-' + t);
                    if (tabEl && !tabEl.classList.contains('hidden')) {
                        if (t === 'staff') { renderStaff(); renderRegistrations(); }
                        if (t === 'projects') renderProjects();
                        if (t === 'sites') renderSites();
                        if (t === 'tasks') renderAdminTasks();
                        if (t === 'attendance') renderAttendanceLogs();
                        if (t === 'reports') renderAdminReports();
                        if (t === 'leave') renderAdminLeaves();
                    }
                });
                renderDropdowns(); // Ensure dropdowns are always fresh with latest data
            } else if (currentView && currentView.id === 'field-view') {
                if (user) {
                    renderFieldTasks(user.id);
                    // Check if Leave tab is active
                    const leaveTab = document.getElementById('field-tab-leave');
                    if (leaveTab && !leaveTab.classList.contains('hidden')) renderFieldLeaves();
                }
            }
        });
    }


    // Logout
    document.querySelectorAll('#logout-btn, #field-logout').forEach(btn => {
        btn.addEventListener('click', () => {
            store.logout();
            Toast.info('Logged out');
            // Check if we are in app.html or index.html
            if (views.landing) {
                // We are in index.html (Landing exists)
                setTimeout(() => navigate('landing'), 400);
            } else {
                // We are in app.html (No Landing view) allow defaults to auth
                setTimeout(() => navigate('auth'), 400);
            }
        });
    });

    // Admin Navigation
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

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

            // Tab-specific actions
            if (targetId === 'map') setTimeout(() => { if (map) map.invalidateSize(); else renderMap(); }, 150);
            if (targetId === 'projects') renderProjects();
            if (targetId === 'sites') renderSites();
            if (targetId === 'staff') renderStaff();
            if (targetId === 'tasks') renderAdminTasks();
            if (targetId === 'reports') renderAdminReports();
            if (targetId === 'attendance') renderAttendanceLogs();
            if (targetId === 'leave') renderAdminLeaves();
        });
    });

    // Project Form
    document.getElementById('project-form')?.addEventListener('submit', handleProjectSubmit);

    // Report FAB
    document.getElementById('new-report-btn')?.addEventListener('click', () => {
        const user = store.getCurrentUser();
        if (store.getWorkerStatus(user.id) !== 'in') {
            Toast.error('Please clock in to submit reports');
            return;
        }
        openModal('report-modal');
    });

    // Field Navigation
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.dataset.target;
            if (!targetId) return;

            e.preventDefault();
            document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.field-tab').forEach(tab => {
                tab.classList.remove('active');
                tab.classList.add('hidden');
            });

            const targetTab = document.getElementById(targetId);
            if (targetTab) {
                setTimeout(() => {
                    targetTab.classList.remove('hidden');
                    setTimeout(() => targetTab.classList.add('active'), 10);
                }, 100);
            }

            if (targetId === 'field-tab-leave') renderFieldLeaves();
            if (targetId === 'field-tab-profile') renderFieldProfile();
        });
    });

    // Forms
    const clockBtn = document.getElementById('clock-btn');
    if (clockBtn) clockBtn.addEventListener('click', handleClockInOut);

    const taskForm = document.getElementById('create-task-form');
    if (taskForm) taskForm.addEventListener('submit', handleCreateTask);

    const leaveForm = document.getElementById('leave-form');
    if (leaveForm) leaveForm.addEventListener('submit', handleLeaveRequest);

    const reportForm = document.getElementById('report-form');
    if (reportForm) reportForm.addEventListener('submit', handleReportSubmit);

    const workerForm = document.getElementById('worker-form');
    if (workerForm) workerForm.addEventListener('submit', handleWorkerSubmit);

    const siteForm = document.getElementById('site-form');
    if (siteForm) siteForm.addEventListener('submit', handleSiteSubmit);

    const fab = document.getElementById('new-report-btn');
    if (fab) fab.addEventListener('click', () => openModal('report-modal'));

    const profileForm = document.getElementById('field-profile-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const profileLogout = document.getElementById('field-tab-logout');
    if (profileLogout) profileLogout.addEventListener('click', () => {
        store.logout();
        Toast.info('Logged out');
        navigate(views.landing ? 'landing' : 'auth');
    });

    // Export to window for modal helpers in HTML
    window.openModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('show'), 10);
        }
    };

    window.closeModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    };

    window.removePhoto = function () {
        document.getElementById('photo-preview').style.display = 'none';
        document.getElementById('upload-area-display').style.display = 'block';
        document.getElementById('report-photo').value = '';
    };
    // Photo upload handling
    const uploadArea = document.getElementById('upload-area-display');
    const photoInput = document.getElementById('report-photo');
    if (uploadArea && photoInput) {
        uploadArea.addEventListener('click', () => photoInput.click());
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    document.getElementById('preview-image').src = event.target.result;
                    document.getElementById('photo-preview').style.display = 'block';
                    uploadArea.style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

// ========================================
// NAVIGATION
// ========================================

function checkSession() {
    const user = store.getCurrentUser();

    if (user) {
        // If we are on the Landing Page (index.html) which doesn't have admin/field views
        // Redirect to the App Page
        if (views.landing && !views.admin) {
            window.location.href = 'app.html';
            return;
        }
        navigate(user.role === 'admin' ? 'admin' : 'field');
    } else {
        // If not logged in:
        // If Landing exists (index.html), show it.
        // If NOT (app.html), show Auth.
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
// ADMIN - DASHBOARD
// ========================================

function initAdminDashboard() {
    updateAdminStats();
    updateUserProfileUI();
    renderActivityLog();
    renderChart();

    renderDropdowns();
    renderAdminTasks();
    renderRegistrations(); // Check for pending approvals on load
}

function renderDropdowns() {
    // Populate staff select
    const staff = store.getUsers().filter(u => u.role === 'field');
    const staffSel = document.getElementById('staff-select');
    if (staffSel) {
        // Preserve value if possible, though easier to rely on simple refresh
        const val = staffSel.value;
        staffSel.innerHTML = staff.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        if (val) staffSel.value = val;
    }

    // Populate site select for worker form
    const sites = store.getAllSites();
    const siteSel = document.getElementById('site-select');
    if (siteSel) {
        const val = siteSel.value;
        siteSel.innerHTML = '<option value="">Select Workplace/Office</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (val) siteSel.value = val;
    }

    // Populate project select for site form
    const projects = store.getProjects();
    const projectSel = document.getElementById('site-project-select');
    if (projectSel) {
        const val = projectSel.value;
        projectSel.innerHTML = '<option value="">-- No Project (General) --</option>' + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        if (val) projectSel.value = val;
    }
}

function updateAdminStats() {
    const stats = store.getStats();
    const update = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.style.opacity = '0.5';
            setTimeout(() => { el.innerText = value; el.style.opacity = '1'; }, 100);
        }
    };

    update('stat-active-staff', stats.activeStaff);
    update('stat-completed-tasks', stats.completedTasks);
    update('stat-leave-reqs', stats.pendingLeaves);
}

function updateUserProfileUI() {
    const user = store.getCurrentUser();
    if (user) {
        const nameEl = document.querySelector('#admin-view .user-info h4');
        if (nameEl) nameEl.innerText = user.name || 'Admin';

        const img = document.querySelector('#admin-view .user-profile img');
        if (img) {
            if (user.avatar) {
                img.src = user.avatar;
            } else {
                const name = user.name || 'Admin';
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;
            }
        }
    }
}

function renderActivityLog() {
    // Wait for data if not loaded yet
    const logs = store.getAttendanceLogs(null, 10);
    const list = document.getElementById('activity-log');
    if (!list) return;

    list.innerHTML = logs.length ? logs.map(log => {
        const date = new Date(log.timestamp);
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Fallback logic
        const displayName = log.userName || (store.getUsers().find(u => u.id === log.userId)?.name) || 'Unknown User';

        return `
        <li style="padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: start;">
            <div style="margin-top:4px; width: 8px; height: 8px; border-radius: 50%; background: ${log.action === 'clock-in' ? '#10b981' : '#6b7280'};"></div>
            <div style="flex: 1;">
                <p style="margin: 0; font-size: 0.9rem; color: var(--text-primary);">
                    <strong>${displayName}</strong>
                </p>
                <p style="margin: 2px 0 0; font-size: 0.8rem; color: var(--text-secondary);">
                    ${log.action === 'clock-in' ? 'Arrived at' : 'Left'} ${log.siteName || 'Location'}
                </p>
            </div>
            <span style="font-size: 0.75rem; color: var(--text-muted); white-space:nowrap;">${time}</span>
        </li>
        `;
    }).join('') : '<li style="padding:20px; color:var(--text-muted); text-align:center; font-style:italic;">No recent activity</li>';
}

// ========================================
// ADMIN - STAFF MANAGEMENT
// ========================================

function renderStaff() {
    const workers = store.getUsers().filter(u => u.role === 'field');
    const grid = document.getElementById('staff-list');
    if (!grid) return;

    grid.innerHTML = workers.map(w => `
        <div class="glass-panel" style="padding:18px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                <img src="${w.avatar}" style="width:48px; height:48px; border-radius:50%; border:2px solid var(--border);">
                <div style="flex:1;">
                    <h4 style="margin:0; font-size:1rem;">${w.name}</h4>
                    <p style="margin:2px 0 0; font-size:0.8rem; color:var(--text-muted);">${w.email}</p>
                    <p style="margin:2px 0 0; font-size:0.75rem; color:var(--primary);">
                        <i class="fa-solid fa-building"></i> ${w.assignedSite ? (store.getAllSites().find(s => s.id === w.assignedSite)?.name || 'Unknown Site') : 'No Site Assigned'}
                    </p>
                </div>
                <span style="font-size:0.7rem; padding:4px 8px; border-radius:4px; background:${w.active ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)'}; color:${w.active ? 'var(--primary)' : 'var(--text-muted)'}; border:1px solid ${w.active ? 'var(--primary)' : 'var(--border)'}; text-transform:uppercase; font-weight:600;">
                    ${w.active ? 'Active' : 'Inactive'}
                </span>
            </div>
            <div style="display:flex; gap:8px; font-size:0.85rem; color:var(--text-secondary); margin-bottom:12px;">
                <span><i class="fa-solid fa-phone"></i> ${w.phone}</span>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-outline" style="flex:1; padding:8px; font-size:0.85rem;" onclick="editWorker('${w.id}')">
                    <i class="fa-solid fa-edit"></i> Edit
                </button>
                <button class="btn-outline" style="flex:1; padding:8px; font-size:0.85rem;" onclick="toggleWorker('${w.id}')">
                    <i class="fa-solid fa-${w.active ? 'ban' : 'check'}"></i> ${w.active ? 'Deactivate' : 'Activate'}
                </button>
            </div>
            <div style="margin-top:8px;">
                <button class="btn-text" style="width:100%; color:#ef4444; font-size:0.8rem;" onclick="deleteWorker('${w.id}')">
                    <i class="fa-solid fa-trash"></i> Permanently Remove
                </button>
            </div>
        </div>
    `).join('');

    // Also render pending registrations here or ensures it is called
    renderRegistrations();
}

window.deleteWorker = async (id) => {
    if (!confirm('⚠️ Are you sure you want to PERMANENTLY REMOVE this staff member? This cannot be undone.')) return;
    try {
        await store.deleteWorker(id);
        Toast.success('Staff member removed');
        renderStaff();
    } catch (e) {
        console.error(e);
        Toast.error(e.message);
    }
};

window.performFullCleanup = async () => {
    if (!confirm('DANGER: This will delete ALL Reports, Attendance Logs, and NON-ADMIN Users. Continue?')) return;
    if (!confirm('Are you strictly sure? All field data will be lost.')) return;

    Loading.show();
    try {
        await store.clearAllData();
        // Also delete non-admin users manually here if store.clearAllData didn't do it
        const users = store.getUsers().filter(u => u.role !== 'admin');
        for (const u of users) {
            await store.deleteWorker(u.id);
        }
        Loading.hide();
        Toast.success('System cleanup complete');
        window.location.reload();
    } catch (e) {
        Loading.hide();
        Toast.error('Cleanup failed: ' + e.message);
    }
};

window.editWorker = (userId) => {
    const user = store.getUsers().find(u => u.id === userId);
    if (!user) return;

    const form = document.getElementById('worker-form');
    form.workerId.value = user.id;
    form.name.value = user.name;
    form.email.value = user.email;
    form.phone.value = user.phone;
    if (form.role) form.role.value = user.role || 'field';
    if (form.assignedSite) form.assignedSite.value = user.assignedSite || '';

    // Handle password field: Optional for edit
    const passInput = form.querySelector('input[name="password"]');
    if (passInput) {
        passInput.required = false;
        passInput.placeholder = "Leave blank to keep current password";
    }

    document.querySelector('#worker-modal h3').innerText = 'Edit Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Update Worker';
    openModal('worker-modal');
};

window.toggleWorker = (userId) => {
    store.toggleWorkerStatus(userId);
    Toast.success('Worker status updated');
    renderStaff();
};

async function handleWorkerSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const workerId = fd.get('workerId');

    Loading.show();
    await new Promise(r => setTimeout(r, 300));

    if (workerId) {
        store.updateWorker(workerId, {
            name: fd.get('name'),
            email: fd.get('email'),
            phone: fd.get('phone'),
            role: fd.get('role'),
            assignedSite: fd.get('assignedSite')
        });
        Toast.success('Worker updated');
    } else {
        const newWorker = await store.addWorker({
            name: fd.get('name'),
            email: fd.get('email'),
            phone: fd.get('phone'),
            password: fd.get('password'),
            role: fd.get('role'),
            assignedSite: fd.get('assignedSite')
        });
        Toast.success(`Worker added! Login: ${newWorker.email}`);
    }

    Loading.hide();
    closeModal('worker-modal');
    e.target.reset();

    // Reset password field to required for next "Add" action
    const passInput = e.target.querySelector('input[name="password"]');
    if (passInput) {
        passInput.required = true;
        passInput.placeholder = "Password (for login)";
    }

    document.querySelector('#worker-modal h3').innerText = 'Add Field Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Add Worker';
    renderStaff();
    initAdminDashboard(); // Refresh staff select
}

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
    openModal('worker-modal');
};

// ========================================
// ADMIN - PROJECTS & SITES
// ========================================

function renderProjects() {
    const projects = store.getProjects();
    const list = document.getElementById('admin-project-list');
    if (!list) return;

    list.innerHTML = projects.length ? projects.map(p => {
        const siteCount = store.getSites().filter(s => s.projectId === p.id).length;
        return `
        <div class="glass-panel" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <div>
                    <h4 style="margin:0; font-size:1rem;">${p.name}</h4>
                    <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-secondary);">${p.manager || 'No Manager'}</p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-text" onclick="editProject('${p.id}')" style="color:var(--primary); padding:4px;" title="Edit">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn-text" onclick="deleteProject('${p.id}')" style="color:var(--text-muted); padding:4px;" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:16px; line-height:1.4;">${p.description || 'No description'}</p>
            <div style="display:flex; gap:12px; font-size:0.8rem; color:var(--text-secondary);">
                <span><i class="fa-solid fa-building"></i> ${siteCount} Sites</span>
            </div>
        </div>`;
    }).join('') : '<div class="glass-panel" style="grid-column:1/-1; padding:40px; text-align:center; color:var(--text-muted);">No projects yet.</div>';
}

async function handleProjectSubmit(e) {
    e.preventDefault();
    Loading.show();
    const fd = new FormData(e.target);
    const editId = e.target.dataset.editId;

    try {
        const projectData = {
            name: fd.get('name'),
            description: fd.get('description'),
            manager: fd.get('manager')
        };

        if (editId) {
            await store.updateProject(editId, projectData);
            Toast.success('Project updated successfully');
        } else {
            await store.addProject(projectData);
            Toast.success('Project created successfully');
        }

        Loading.hide();
        closeModal('project-modal');
        e.target.reset();
        delete e.target.dataset.editId;

        // Reset modal title
        document.querySelector('#project-modal h3').innerText = 'Create New Project';
        document.querySelector('#project-modal button[type=submit]').innerText = 'Create Project';

        renderProjects();
        initAdminDashboard();
    } catch (error) {
        Loading.hide();
        console.error('Error with project:', error);
        Toast.error('Failed to save project: ' + error.message);
    }
}

window.deleteProject = async (id) => {
    if (confirm('Delete this project? Sites under it will remain but be unlinked.')) {
        await store.deleteProject(id);
        renderProjects();
        Toast.success('Project deleted');
    }
};

window.editProject = (projectId) => {
    const project = store.getProjects().find(p => p.id === projectId);
    if (!project) return;

    const form = document.getElementById('project-form');
    form.dataset.editId = projectId;
    form.name.value = project.name;
    form.description.value = project.description || '';
    form.manager.value = project.manager || '';

    document.querySelector('#project-modal h3').innerText = 'Edit Project';
    document.querySelector('#project-modal button[type=submit]').innerText = 'Update Project';
    openModal('project-modal');
};

// ========================================
// ADMIN - ATTENDANCE LOGS
// ========================================

function renderAttendanceLogs() {
    const logs = store.getAttendanceLogs(null, 100);
    const list = document.getElementById('attendance-log-list');
    if (!list) return;

    list.innerHTML = logs.length ? logs.map(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Fallback for older logs without cached name
        const displayName = log.userName || (store.getUsers().find(u => u.id === log.userId)?.name) || 'Unknown User';

        return `
        <div class="glass-panel" style="padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:6px;">
                    <strong>${displayName}</strong>
                    <span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; background:${log.action === 'clock-in' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)'}; color:${log.action === 'clock-in' ? 'var(--primary)' : 'var(--text-muted)'}; border:1px solid ${log.action === 'clock-in' ? 'var(--primary)' : 'var(--border)'}; text-transform:uppercase; font-weight:600;">
                        ${log.action}
                    </span>
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; gap:16px; flex-wrap:wrap;">
                    <span><i class="fa-solid fa-location-dot"></i> ${log.siteName}</span>
                    <span><i class="fa-solid fa-ruler"></i> ${log.distance.toFixed(2)} km</span>
                    <span style="color:${log.withinGeofence ? 'var(--primary)' : '#f59e0b'};">
                        <i class="fa-solid fa-${log.withinGeofence ? 'check-circle' : 'exclamation-triangle'}"></i> 
                        ${log.withinGeofence ? 'Within geofence' : 'Outside geofence'}
                    </span>
                </div>
            </div>
            <div style="text-align:right; color:var(--text-muted); font-size:0.85rem;">
                <div style="font-weight:600; color:var(--text-primary);">${timeStr}</div>
                <div>${dateStr}</div>
            </div>
        </div>
        `;
    }).join('') : '<p style="text-align:center; padding:40px; color:var(--text-muted);">No attendance logs yet.</p>';
}

// ========================================
// ADMIN - TASKS & LEAVE
// ========================================

function renderAdminTasks() {
    const tasks = store.getTasks();
    const list = document.getElementById('admin-task-list');
    if (!list) return;

    list.innerHTML = tasks.length ? tasks.map(t => {
        const u = store.getUsers().find(user => user.id === t.assignedTo);
        return `
        <div class="glass-panel" style="margin-bottom:10px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
                <h4 style="margin:0; font-size:1rem;">${t.title}</h4>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin:4px 0 0;">
                    ${u ? u.name : 'Unassigned'} • ${t.location} • ${t.time}
                </p>
            </div>
            <div style="display:flex; gap:8px;">
                <span style="font-size:0.7rem; padding:4px 10px; border-radius:4px; background:rgba(59,130,246,0.1); color:var(--primary); border:1px solid var(--primary); text-transform:uppercase; font-weight:600;">${t.priority}</span>
                <span style="font-size:0.7rem; padding:4px 10px; border-radius:4px; background:${t.status === 'completed' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)'}; color:${t.status === 'completed' ? 'var(--primary)' : 'var(--text-muted)'}; border:1px solid ${t.status === 'completed' ? 'var(--primary)' : 'var(--border)'}; text-transform:uppercase; font-weight:600;">${t.status}</span>
            </div>
        </div>`;
    }).join('') : '<p style="text-align:center; padding:40px; color:var(--text-muted);">No tasks.</p>';
}


function renderAdminLeaves() {
    const reqs = store.getLeaveRequests();
    const list = document.getElementById('admin-leave-list');
    if (!list) return;

    list.innerHTML = reqs.length ? reqs.map(r => {
        const displayName = r.userName || store.getUsers().find(u => u.id === r.userId)?.name || 'Unknown User';
        return `
        <div class="glass-panel" style="margin-bottom:10px; padding:16px; border-left: 3px solid ${r.status === 'approved' ? '#10b981' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')};">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <h4 style="margin:0; font-size:1rem;">${r.type} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:400;">by ${displayName}</span></h4>
                <span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; background: ${r.status === 'approved' ? 'rgba(59,130,246,0.1)' : (r.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)')}; color:${r.status === 'approved' ? 'var(--primary)' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}; border:1px solid; text-transform:uppercase; font-weight:600;">${r.status}</span>
            </div>
            <p style="margin:6px 0; color:var(--text-secondary); font-size:0.9rem;">${r.date} • ${r.reason}</p>
            ${r.status === 'pending' ? `
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button class="btn-primary" style="padding:8px 16px; font-size:0.85rem; flex:1;" onclick="approveLeave('${r.id}')">Approve</button>
                <button class="btn-outline" style="padding:8px 16px; font-size:0.85rem; flex:1; color:#ef4444; border-color:#ef4444;" onclick="rejectLeave('${r.id}')">Reject</button>
            </div>` : ''}
        </div>
    `;
    }).join('') : '<p style="text-align:center; padding:40px; color:var(--text-muted);">No leave requests.</p>';
}

window.approveLeave = (id) => {
    store.updateLeaveStatus(id, 'approved');
    Toast.success('Leave approved');
    renderAdminLeaves();
    updateAdminStats();
};

// ========================================
// ADMIN - SITES
// ========================================

function renderSites() {
    const sites = store.getSites(); // Only active sites
    const list = document.getElementById('admin-site-list');
    if (!list) return;

    list.innerHTML = sites.length ? sites.map(s => {
        const project = store.getProjects().find(p => p.id === s.projectId);
        return `
        <div class="glass-panel" style="padding:18px;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <div>
                    <h4 style="margin:0; font-size:1rem;">${s.name}</h4>
                    <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-secondary);">
                        <i class="fa-solid fa-folder"></i> ${project ? project.name : 'General Operations'}
                    </p>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-text" onclick="editSite('${s.id}')" style="color:var(--primary); padding:4px;" title="Edit">
                        <i class="fa-solid fa-edit"></i>
                    </button>
                    <button class="btn-text" onclick="deleteSite('${s.id}')" style="color:var(--text-muted); padding:4px;" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div style="display:flex; gap:12px; font-size:0.8rem; color:var(--text-secondary); margin-bottom:8px;">
                <span><i class="fa-solid fa-location-dot"></i> ${s.coords ? s.coords.lat : '?'}, ${s.coords ? s.coords.lng : '?'}</span>
            </div>
            <div style="display:flex; gap:12px; font-size:0.8rem; color:${s.radius < 100 ? '#f59e0b' : 'var(--success)'};">
                 <span><i class="fa-solid fa-circle-dot"></i> Radius: ${s.radius}m</span>
            </div>
        </div>`;
    }).join('') : '<div class="glass-panel" style="grid-column:1/-1; padding:40px; text-align:center; color:var(--text-muted);">No sites configured.</div>';
}

async function handleSiteSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);

    // Validate coordinates
    const lat = parseFloat(fd.get('lat'));
    const lng = parseFloat(fd.get('lng'));
    const radiusVal = parseInt(fd.get('radius')) || 200;

    if (isNaN(lat) || isNaN(lng)) {
        Toast.error('Invalid coordinates. Please enter valid latitude and longitude.');
        return;
    }

    if (lat < -90 || lat > 90) {
        Toast.error('Latitude must be between -90 and 90');
        return;
    }

    if (lng < -180 || lng > 180) {
        Toast.error('Longitude must be between -180 and 180');
        return;
    }

    if (radiusVal < 10 || radiusVal > 10000) {
        Toast.error('Radius must be between 10 and 10000 meters');
        return;
    }

    Loading.show();
    const editId = e.target.dataset.editId;

    try {
        const siteData = {
            name: fd.get('name'),
            projectId: fd.get('projectId') || null,
            coords: {
                lat: lat,
                lng: lng
            },
            radius: radiusVal
        };

        if (editId) {
            await store.updateSite(editId, siteData);
            Toast.success('Site updated successfully');
        } else {
            await store.addSite(siteData);
            Toast.success('Site added successfully');
        }

        Loading.hide();
        closeModal('site-modal');
        e.target.reset();
        delete e.target.dataset.editId;

        // Reset modal title
        document.querySelector('#site-modal h3').innerText = 'Add Workplace / Geofence';
        document.querySelector('#site-modal button[type=submit]').innerText = 'Save Site';

        renderSites();

        // Refresh dropdowns
        initAdminDashboard();
    } catch (error) {
        Loading.hide();
        console.error('Error adding site:', error);
        Toast.error('Failed to add site: ' + error.message);
    }
}

window.deleteSite = async (id) => {
    if (confirm('Deactivate this site?')) {
        await store.deleteSite(id);
        renderSites();
        Toast.success('Site deactivated');
    }
};

window.editSite = (siteId) => {
    const site = store.getAllSites().find(s => s.id === siteId);
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
    openModal('site-modal');
};

window.openAddWorkerModal = function () {
    const form = document.getElementById('worker-form');
    form.reset();
    form.workerId.value = '';
    document.querySelector('#worker-modal h3').innerText = 'Add Field Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Add Worker';
    openModal('worker-modal');
};

function renderAdminReports() {
    const reports = store.getReports();
    const list = document.getElementById('admin-reports-list');
    if (!list) return;

    list.innerHTML = reports.length ? reports.map(r => {
        const user = store.getUsers().find(u => u.id === r.userId);
        const date = new Date(r.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return `
        <div class="glass-panel" style="padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div>
                    <strong style="font-size:1rem;">${user ? user.name : 'Unknown User'}</strong>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin:4px 0 0;">${dateStr} at ${timeStr}</p>
                </div>
                ${r.hasPhoto ? '<span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; background:rgba(59,130,246,0.1); color:var(--primary); border:1px solid var(--primary); height:fit-content;"><i class="fa-solid fa-camera"></i> Photo</span>' : ''}
            </div>
            <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.5; padding:12px; background:var(--bg-darker); border-radius:6px; border-left:3px solid var(--primary);">${r.content}</p>
            ${r.photoData ? `<div style="margin-top:10px; text-align:center;"><img src="${r.photoData}" style="max-width:100%; max-height:300px; border-radius:6px; cursor:pointer; border:1px solid var(--border);" onclick="window.open(this.src)"></div>` : ''}
        </div>
        `;
    }).join('') : '<p style="text-align:center; padding:40px; color:var(--text-muted);">No reports submitted yet.</p>';
}

window.rejectLeave = (id) => {
    store.updateLeaveStatus(id, 'rejected');
    Toast.info('Leave rejected');
    renderAdminLeaves();
    updateAdminStats();
};

async function handleCreateTask(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const assignedId = fd.get('assignedTo');

    const leaves = store.getLeaveRequests(assignedId).filter(r => r.status === 'approved');
    if (leaves.length > 0) {
        if (!confirm('⚠️ This staff member has approved leave. Assign anyway?')) return;
    }

    Loading.show();
    await new Promise(r => setTimeout(r, 300));

    store.addTask({
        title: fd.get('title'),
        location: fd.get('location'),
        assignedTo: assignedId,
        priority: fd.get('priority'),
        time: fd.get('time'),
        coords: [51.5 + Math.random() * 0.1, -0.1 + Math.random() * 0.1],
        siteId: 's1'
    });

    Loading.hide();
    closeModal('task-modal');
    e.target.reset();
    renderAdminTasks();
    updateAdminStats();
    Toast.success('Task assigned');
}

// ========================================
// ADMIN - REGISTRATIONS & LEAVES
// ========================================

function renderRegistrations() {
    const regs = store.getRegistrations();
    const list = document.getElementById('admin-registration-list');
    if (!list) return;

    list.innerHTML = regs.length ? regs.map(r => `
        <div class="glass-panel" style="padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
             <div>
                 <h4 style="margin:0;">${r.name}</h4>
                 <p style="margin:4px 0 0; font-size:0.85rem; color:var(--text-secondary);">${r.email}</p>
                 <p style="margin:2px 0 0; font-size:0.8rem; color:var(--text-muted);">${r.phone || 'No phone'}</p>
             </div>
             <div style="display:flex; gap:8px;">
                 <button class="btn-primary" onclick="approveRegistration('${r.id}')" style="padding:6px 12px; font-size:0.8rem;">Approve</button>
                 <button class="btn-outline" onclick="deleteRegistration('${r.id}')" style="padding:6px 12px; font-size:0.8rem; border-color:#ef4444; color:#ef4444;">Reject</button>
             </div>
        </div>
    `).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted);">No pending registrations.</p>';
}

window.approveRegistration = async (id) => {
    if (!confirm('Approve this user as Field Staff?')) return;
    try {
        await store.approveRegistration(id, 'field');
        Toast.success('User approved and created');
    } catch (e) {
        console.error(e);
        Toast.error('Approval failed: ' + e.message);
    }
};

window.deleteRegistration = async (id) => {
    if (!confirm('Reject and delete request?')) return;
    await store.deleteRegistration(id);
    Toast.success('Request rejected');
};

window.approveLeave = async (id) => {
    if (!confirm('Approve leave request?')) return;
    await store.updateLeaveRequest(id, 'approved');
    Toast.success('Leave approved');
    renderAdminLeaves(); // Explicit re-render if store not subscribing
    updateAdminStats();
};

window.rejectLeave = async (id) => {
    if (!confirm('Reject leave request?')) return;
    await store.updateLeaveRequest(id, 'rejected');
    Toast.success('Leave rejected');
    renderAdminLeaves();
    updateAdminStats();
};

// ========================================
// FIELD - DASHBOARD
// ========================================

function initFieldDashboard() {
    const user = store.getCurrentUser();
    if (!user) return;

    // Ensure Nav exists
    const el = document.getElementById('field-user-name');
    if (el) el.innerText = user.name;

    const att = store.getStaffStatus().find(s => s.id === user.id);
    const status = att ? att.status : 'out';
    updateClockUI(status, att ? att.lastLoc : 'Ready to start');

    renderWorkerStats(user.id);
    renderFieldTasks(user.id);
    renderFieldLeaves();
    renderFieldProfile(); // Pre-load profile data
}

function renderFieldProfile() {
    const user = store.getCurrentUser();
    if (!user) return;

    const form = document.getElementById('field-profile-form');
    if (form) {
        form.elements.name.value = user.name || '';
        form.elements.phone.value = user.phone || '';
        form.elements.skills.value = user.skills || '';
        document.getElementById('profile-email-display').innerText = user.email;
        document.getElementById('profile-avatar-preview').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const user = store.getCurrentUser();
    if (!user) return;

    Loading.show();
    const fd = new FormData(e.target);
    const updates = {
        name: fd.get('name'),
        phone: fd.get('phone'),
        skills: fd.get('skills')
    };

    try {
        await store.updateWorker(user.id, updates);
        Toast.success('Profile updated');
    } catch (err) {
        console.error(err);
        Toast.error('Update failed');
    }
    Loading.hide();
}

function renderWorkerStats(userId) {
    // We inject this into a new container or finding a place. 
    // Let's create a container if it doesn't exist under attendance-card
    let statsContainer = document.getElementById('field-stats-container');
    if (!statsContainer) {
        const authCard = document.querySelector('.attendance-card');
        if (authCard && authCard.parentNode) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'field-stats-container';
            statsContainer.style.display = 'grid';
            statsContainer.style.gridTemplateColumns = '1fr 1fr';
            statsContainer.style.gap = '10px';
            statsContainer.style.marginBottom = '20px';
            authCard.parentNode.insertBefore(statsContainer, authCard.nextSibling);
            // Actually insert AFTER attendance card
        }
    }

    if (!statsContainer) return;

    const stats = store.getWorkerStats(userId);

    statsContainer.innerHTML = `
        <div class="glass-panel" style="padding:15px; text-align:center;">
             <h3 style="margin:0; font-size:1.5rem; color:var(--primary);">${stats.attendanceDays}</h3>
             <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Days Present</p>
        </div>
        <div class="glass-panel" style="padding:15px; text-align:center;">
             <h3 style="margin:0; font-size:1.5rem; color:var(--success);">${stats.completedTasks}</h3>
             <p style="margin:0; font-size:0.8rem; color:var(--text-secondary);">Tasks Done</p>
        </div>
    `;
}

function renderFieldTasks(userId) {
    const list = document.getElementById('field-task-list');
    if (!list) return;

    const status = store.getWorkerStatus(userId);
    if (status !== 'in') {
        list.innerHTML = `
            <div class="glass-panel" style="text-align:center; padding:30px; color:var(--text-muted);">
                <i class="fa-solid fa-lock" style="font-size:2rem; margin-bottom:10px;"></i>
                <h3>Clock In Required</h3>
                <p>You must clock in to view and complete tasks.</p>
            </div>
        `;
        return;
    }

    const tasks = store.getTasks(userId);
    list.innerHTML = tasks.length ? tasks.map(task => `
        <div class="task-card glass-panel">
            <div class="task-header">
                <span class="badge">${task.priority}</span>
                <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${task.time}</span>
            </div>
            <h4>${task.title}</h4>
            <p><i class="fa-solid fa-location-dot"></i> ${task.location}</p>
            ${task.status === 'pending' ?
            `<button class="btn-primary" style="width:100%; padding:10px;" onclick="completeTask('${task.id}')"><i class="fa-solid fa-check"></i> Complete</button>` :
            `<div style="color:var(--primary); text-align:center; padding:10px; background:rgba(59,130,246,0.1); border-radius:6px; border: 1px solid var(--primary);"><i class="fa-solid fa-check-circle"></i> Completed</div>`}
        </div>
    `).join('') : '<p style="text-align:center; opacity:0.6; padding:40px;">No tasks assigned.</p>';
}

window.completeTask = (id) => {
    store.completeTask(id);
    const user = store.getCurrentUser();
    if (user) renderFieldTasks(user.id);
    Toast.success('Task completed');
};

function renderFieldLeaves() {
    const user = store.getCurrentUser();
    const reqs = store.getLeaveRequests(user.id);
    const list = document.getElementById('field-leave-list');
    if (!list) return;

    list.innerHTML = reqs.length ? reqs.map(r => `
        <div class="glass-panel" style="margin-bottom:10px; padding:14px; border-left: 3px solid ${r.status === 'approved' ? '#10b981' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <div style="font-weight:600; font-size:1.05rem;">${r.type}</div>
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-top:4px;">${r.date}</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:4px;">${r.reason || ''}</div>
                </div>
                <span style="
                    font-size:0.75rem; 
                    padding:4px 10px; 
                    border-radius:12px; 
                    background:${r.status === 'approved' ? 'rgba(16, 185, 129, 0.1)' : (r.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)')}; 
                    color:${r.status === 'approved' ? '#10b981' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}; 
                    border:1px solid ${r.status === 'approved' ? '#10b981' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}; 
                    text-transform:uppercase; 
                    font-weight:700;
                    letter-spacing:0.5px;
                ">
                    ${r.status}
                </span>
            </div>
            ${r.status === 'rejected' ? '<div style="margin-top:8px; font-size:0.8rem; color:#ef4444;"><i class="fa-solid fa-circle-info"></i> Request was declined.</div>' : ''}
            ${r.status === 'approved' ? '<div style="margin-top:8px; font-size:0.8rem; color:#10b981;"><i class="fa-solid fa-check-circle"></i> Approved! Enjoy your time off.</div>' : ''}
        </div>
    `).join('') : '<p style="text-align:center; opacity:0.6; padding:40px;">No requests yet.</p>';
}

async function handleClockInOut() {
    const btn = document.getElementById('clock-btn');
    const user = store.getCurrentUser();
    const isClockingIn = btn.innerText.includes('In');

    if (isClockingIn) {
        btn.innerText = 'Locating...';
        btn.disabled = true;
        Loading.show();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const coords = [latitude, longitude];

                    // Find nearest site
                    const nearest = store.findNearestSite(coords);

                    if (!nearest) {
                        Loading.hide();
                        Toast.error('No workplace found nearby');
                        btn.innerText = 'Clock In';
                        btn.disabled = false;
                        return;
                    }

                    const site = nearest;
                    // site.radius is in meters. distance is in meters.
                    const withinGeofence = site.distance <= (site.radius || 200);

                    // ENFORCE GEOFENCE
                    if (!withinGeofence) {
                        Loading.hide();
                        Toast.error(`You are ${(site.distance / 1000).toFixed(2)}km away from ${site.name}. Must be within ${((site.radius || 200) / 1000).toFixed(2)}km.`);
                        btn.innerText = 'Clock In';
                        btn.disabled = false;
                        return;
                    }

                    // Within geofence - allow clock in
                    let statusNote = `${latitude.toFixed(4)}, ${longitude.toFixed(4)} - ${site.name}`;

                    // Call Store
                    // logAttendance: async (userId, action, siteId, location, coords = null)
                    await store.logAttendance(user.id, 'clock-in', site.id, statusNote, { latitude, longitude });

                    updateClockUI('in', statusNote);
                    btn.disabled = false;
                    Loading.hide();
                    Toast.success('Clocked in at ' + site.name);
                },
                () => {
                    Loading.hide();
                    Toast.error("Location access required to clock in");
                    btn.innerText = 'Clock In';
                    btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            Loading.hide();
            Toast.error("Geolocation not supported");
            btn.disabled = false;
        }
    } else {
        Loading.show();
        await new Promise(r => setTimeout(r, 800));

        // Clock Out
        // Get last known location string from UI or just "Clocked Out"
        const lastLoc = document.getElementById('current-location-text').innerText;
        await store.logAttendance(user.id, 'clock-out', null, lastLoc, null);

        updateClockUI('out', 'Ready to start');
        Loading.hide();
        Toast.success('Clocked out');
    }
}

function updateClockUI(status, locText) {
    const btn = document.getElementById('clock-btn');
    const container = document.querySelector('.attendance-card');
    const text = document.getElementById('attendance-text');
    const locEl = document.getElementById('current-location-text');
    if (!btn || !container) return;

    if (status === 'in') {
        btn.innerText = 'Clock Out';
        text.innerText = 'Clocked IN';
        container.classList.add('clocked-in');
        locEl.innerText = locText;
    } else {
        btn.innerText = 'Clock In';
        text.innerText = 'Ready to start';
        container.classList.remove('clocked-in');
        locEl.innerText = locText;
    }
}

async function handleLeaveRequest(e) {
    e.preventDefault();
    const user = store.getCurrentUser();
    const fd = new FormData(e.target);

    Loading.show();
    await new Promise(r => setTimeout(r, 300));

    store.addLeaveRequest({
        userId: user.id,
        type: fd.get('type'),
        date: fd.get('date'),
        reason: fd.get('reason')
    });

    Loading.hide();
    closeModal('leave-modal');
    e.target.reset();
    renderFieldLeaves();
    Toast.success('Leave requested');
}

async function handleReportSubmit(e) {
    e.preventDefault();
    const user = store.getCurrentUser();
    const fd = new FormData(e.target);

    Loading.show();
    await new Promise(r => setTimeout(r, 300));

    const photoFile = fd.get('photo');
    let photoData = null;

    if (photoFile && photoFile.size > 0) {
        // Resize and convert
        try {
            photoData = await resizeImage(photoFile, 800, 600);
        } catch (err) {
            console.error(err);
        }
    }

    store.addReport({
        userId: user.id,
        content: fd.get('content'),
        hasPhoto: !!photoData,
        photoData: photoData
    });

    Loading.hide();
    closeModal('report-modal');
    e.target.reset();
    document.getElementById('photo-preview').style.display = 'none';
    Toast.success('Report submitted');
}

function resizeImage(file, maxWidth, maxHeight) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ========================================
// MAP & CHARTS
// ========================================

function renderMap() {
    const mapEl = document.getElementById('ops-map');
    if (!mapEl || map) return;

    try {
        map = L.map('ops-map').setView([18.457628, 73.850929], 13);

        // OpenStreetMap - Clear, visible tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // All sites
        const sites = store.getSites();
        sites.forEach(site => {
            L.marker(site.coords).addTo(map).bindPopup(`<b>${site.name}</b>`);
            L.circle(site.coords, {
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                radius: site.radius
            }).addTo(map);
        });

        // Active staff
        store.getStaffStatus().filter(s => s.status === 'in').forEach(s => {
            let lat, lng;
            if (s.coords && s.coords.lat && s.coords.lng) {
                lat = s.coords.lat;
                lng = s.coords.lng;
            } else {
                // Fallback (e.g. site location or just unknown)
                // For now, skip mapping if no coords
                return;
            }

            const icon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="background: #3b82f6; width:10px; height:10px; border-radius:50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [14, 14]
            });

            L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${s.name}</b><br>${s.lastLoc || 'Clocked In'}`);
        });

        Toast.success('Map loaded');
    } catch (err) {
        console.error(err);
        Toast.error('Map error');
    }
}

function renderChart() {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;
    if (attendanceChart) attendanceChart.destroy();

    // Calculate last 7 days stats
    const labels = [];
    const dataPoints = [];
    const logs = store.getAttendanceLogs(null, 500); // Get ample history

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayStr);

        // Count UNIQUE people who clocked in this day
        const dayLogs = logs.filter(l => {
            const logDate = new Date(l.timestamp);
            return logDate.getDate() === d.getDate() &&
                logDate.getMonth() === d.getMonth() &&
                logDate.getFullYear() === d.getFullYear() &&
                l.action === 'clock-in';
        });

        const uniqueUsers = new Set(dayLogs.map(l => l.userId));
        dataPoints.push(uniqueUsers.size);
    }

    try {
        attendanceChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Staff Present',
                    data: dataPoints,
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#3b82f6'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { stepSize: 1, color: 'rgba(255,255,255,0.6)' }
                    },
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.6)' } }
                }
            }
        });
    } catch (err) {
        console.error(err);
    }
}

// ========================================
// UTILITIES
// ========================================

function updateDate() {
    const el = document.getElementById('current-date');
    if (el) el.innerText = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// ========================================
// REGISTRATION & LANDING
// ========================================

window.showAuth = function () {
    navigate('auth');
};

async function handleRegistrationSubmit(e) {
    e.preventDefault();
    Loading.show();
    const fd = new FormData(e.target);
    try {
        await store.addRegistration({
            name: fd.get('name'),
            email: fd.get('email'),
            phone: fd.get('phone'),
            skills: fd.get('skills')
        });
        closeModal('registration-modal');
        e.target.reset();
        alert('Registration submitted! An administrator will review your account.');
    } catch (err) {
        console.error(err);
        Toast.error('Registration failed. Try again.');
    } finally {
        Loading.hide();
    }
}

// ========================================
// ADMIN - REGISTRATIONS
// ========================================

function renderRegistrations() {
    const regs = store.getRegistrations();
    const list = document.getElementById('admin-registration-list');
    if (!list) return;

    list.innerHTML = regs.length ? regs.map(r => `
        <div class="glass-panel" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <h4 style="margin:0; font-size:1rem;">${r.name}</h4>
                <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">${new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
            <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:4px;"><i class="fa-solid fa-envelope"></i> ${r.email}</p>
            <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:8px;"><i class="fa-solid fa-phone"></i> ${r.phone}</p>
            ${r.skills ? `<p style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">"${r.skills}"</p>` : ''}
            
            <div style="display:flex; gap:10px; margin-top:12px;">
                <button class="btn-primary" style="flex:1; padding:6px; font-size:0.9rem;" onclick="approveRegistration('${r.id}', 'field')">Approve Field</button>
                <button class="btn-outline" style="flex:1; padding:6px; font-size:0.9rem; color:#ef4444; border-color:#ef4444;" onclick="deleteRegistration('${r.id}')">Reject</button>
            </div>
        </div>
    `).join('') : '<div class="glass-panel" style="grid-column:1/-1; padding:40px; text-align:center; color:var(--text-muted);">No pending registrations.</div>';
}

window.approveRegistration = async (id, role) => {
    if (!confirm('Approve this user? They will be added to the Staff list.')) return;
    try {
        await store.approveRegistration(id, role);
        Toast.success('User Approved');
        renderRegistrations();
        renderStaff();
    } catch (e) {
        console.error(e);
        Toast.error('Error approving user');
    }
};

window.deleteRegistration = async (id) => {
    if (!confirm('Reject request?')) return;
    await store.deleteRegistration(id);
    renderRegistrations();
    Toast.info('Request rejected');
};

// Add to window for modal calls
window.handleRegistrationSubmit = handleRegistrationSubmit;

// Helper to bind the new form
document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('registration-form');
    if (regForm) regForm.addEventListener('submit', handleRegistrationSubmit);
});

window.openModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('show'), 10);
    }
};

window.closeModal = function (id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }
};

// ========================================
// INITIALIZATION
// ========================================

(async () => {
    // Setup listeners
    setupEventListeners();

    // Initialize Store (Check Auth)
    await store.init();

    // Check Status
    const user = store.getCurrentUser();
    if (user) {
        console.log('⚡ Auto-navigating to', user.role);
        navigate(user.role === 'admin' ? 'admin' : 'field');
    } else {
        // Stay on Landing Page (active by default)
    }

    updateDate();
})();
