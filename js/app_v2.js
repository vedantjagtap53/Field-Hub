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
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = theme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
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
            // Refresh the current view if data changes
            const currentView = document.querySelector('.view.active');
            if (currentView && currentView.id === 'admin-view') {
                updateAdminStats();
                // We cautiously re-render active tabs to show live updates
                const tabs = ['staff', 'tasks', 'attendance'];
                tabs.forEach(t => {
                    const tabEl = document.getElementById('tab-' + t);
                    if (tabEl && !tabEl.classList.contains('hidden')) {
                        if (t === 'staff') renderStaff();
                        if (t === 'tasks') renderAdminTasks();
                        if (t === 'attendance') renderAttendanceLogs();
                    }
                });
            } else if (currentView && currentView.id === 'field-view') {
                const user = store.getCurrentUser();
                if (user) renderFieldTasks(user.id);
            }
        });
    }


    // Logout
    document.querySelectorAll('#logout-btn, #field-logout').forEach(btn => {
        btn.addEventListener('click', () => {
            store.logout();
            Toast.info('Logged out');
            setTimeout(() => navigate('auth'), 400);
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
            if (targetId === 'sites') renderSites();
            if (targetId === 'staff') renderStaff();
            if (targetId === 'tasks') renderAdminTasks();
            if (targetId === 'reports') renderAdminReports();
            if (targetId === 'attendance') renderAttendanceLogs();
            if (targetId === 'leave') renderAdminLeaves();
        });
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
    navigate(user ? (user.role === 'admin' ? 'admin' : 'field') : 'auth');
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

    // Populate staff select
    const staff = store.getUsers().filter(u => u.role === 'field');
    const staffSel = document.getElementById('staff-select');
    if (staffSel) staffSel.innerHTML = staff.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

    // Populate site select for worker form
    const sites = store.getAllSites();
    const siteSel = document.getElementById('site-select');
    if (siteSel) siteSel.innerHTML = '<option value="">Select Workplace/Office</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    renderAdminTasks();
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
        return `
        <li style="padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; gap: 12px; align-items: start;">
            <div style="margin-top:4px; width: 8px; height: 8px; border-radius: 50%; background: ${log.action === 'clock-in' ? '#10b981' : '#6b7280'};"></div>
            <div style="flex: 1;">
                <p style="margin: 0; font-size: 0.9rem; color: var(--text-primary);">
                    <strong>${log.userName}</strong>
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
        </div>
    `).join('');
}

window.editWorker = (userId) => {
    const user = store.getUsers().find(u => u.id === userId);
    if (!user) return;

    const form = document.getElementById('worker-form');
    form.workerId.value = user.id;
    form.name.value = user.name;
    form.email.value = user.email;
    form.phone.value = user.phone;
    if (form.role) form.role.value = user.role || 'field';

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
    document.querySelector('#worker-modal h3').innerText = 'Add Field Worker';
    document.querySelector('#worker-modal button[type=submit]').innerText = 'Add Worker';
    renderStaff();
    initAdminDashboard(); // Refresh staff select
}

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

        return `
        <div class="glass-panel" style="padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:6px;">
                    <strong>${log.userName}</strong>
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

    list.innerHTML = reqs.length ? reqs.map(r => `
        <div class="glass-panel" style="margin-bottom:10px; padding:16px; border-left: 3px solid ${r.status === 'approved' ? 'var(--primary)' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')};">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <h4 style="margin:0; font-size:1rem;">${r.type} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:400;">by ${r.userName}</span></h4>
                <span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; background: ${r.status === 'approved' ? 'rgba(59,130,246,0.1)' : (r.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)')}; color:${r.status === 'approved' ? 'var(--primary)' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}; border:1px solid; text-transform:uppercase; font-weight:600;">${r.status}</span>
            </div>
            <p style="margin:6px 0; color:var(--text-secondary); font-size:0.9rem;">${r.date} • ${r.reason}</p>
            ${r.status === 'pending' ? `
            <div style="margin-top:10px; display:flex; gap:8px;">
                <button class="btn-primary" style="padding:8px 16px; font-size:0.85rem; flex:1;" onclick="approveLeave('${r.id}')">Approve</button>
                <button class="btn-outline" style="padding:8px 16px; font-size:0.85rem; flex:1; color:#ef4444; border-color:#ef4444;" onclick="rejectLeave('${r.id}')">Reject</button>
            </div>` : ''}
        </div>
    `).join('') : '<p style="text-align:center; padding:40px; color:var(--text-muted);">No leave requests.</p>';
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
    const sites = store.getSites();
    const list = document.getElementById('admin-site-list');
    if (!list) return;

    list.innerHTML = sites.length ? sites.map(s => `
        <div class="glass-panel" style="padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <h4 style="margin:0; font-size:1.1rem; color:var(--text-primary);">${s.name}</h4>
                <button class="icon-btn" onclick="deleteSite('${s.id}')" title="Delete Site" style="color:#ef4444;">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div style="display:grid; gap:8px; font-size:0.9rem; color:var(--text-secondary);">
                <div><i class="fa-solid fa-location-dot" style="width:20px; text-align:center;"></i> ${s.coords ? `${s.coords.lat}, ${s.coords.lng}` : 'No Coords'}</div>
                <div><i class="fa-solid fa-circle-notch" style="width:20px; text-align:center;"></i> Radius: ${s.radius || 200}m</div>
            </div>
        </div>
    `).join('') : '<p style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">No sites configured.</p>';
}

async function handleSiteSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const site = {
        name: fd.get('name'),
        coords: {
            lat: parseFloat(fd.get('lat')),
            lng: parseFloat(fd.get('lng'))
        },
        radius: parseInt(fd.get('radius')) || 200
    };

    Loading.show();
    await store.addSite(site);

    // Refresh
    e.target.reset();
    closeModal('site-modal');
    renderSites();
    Loading.hide();
    Toast.success('Site added successfully');
}

window.deleteSite = async (siteId) => {
    if (confirm('Are you sure you want to delete this workplace?')) {
        await store.deleteSite(siteId);
        renderSites();
        Toast.success('Site deleted');
    }
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
// FIELD - DASHBOARD
// ========================================

function initFieldDashboard() {
    const user = store.getCurrentUser();
    if (!user) return;

    const el = document.getElementById('field-user-name');
    if (el) el.innerText = user.name;

    const att = store.getStaffStatus().find(s => s.id === user.id);
    updateClockUI(att ? att.status : 'out', att ? att.lastLoc : 'Ready to start');

    renderFieldTasks(user.id);
}

function renderFieldTasks(userId) {
    const tasks = store.getTasks(userId);
    const list = document.getElementById('field-task-list');
    if (!list) return;

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
        <div class="glass-panel" style="margin-bottom:10px; padding:14px; border-left: 3px solid ${r.status === 'approved' ? 'var(--primary)' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}">
            <div style="display:flex; justify-content:space-between;">
                <strong>${r.type}</strong>
                <span style="font-size:0.8rem; color:var(--text-muted);">${r.date}</span>
            </div>
            <p style="font-size:0.85rem; margin-top:6px; color:var(--text-secondary);">
                Status: <span style="color:${r.status === 'approved' ? 'var(--primary)' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}; font-weight:600; text-transform:uppercase;">${r.status}</span>
            </p>
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
            const lat = 18.457628 + (Math.random() - 0.5) * 0.02;
            const lng = 73.850929 + (Math.random() - 0.5) * 0.02;

            const icon = L.divIcon({
                className: 'custom-marker',
                html: '<div style="background: #3b82f6; width:10px; height:10px; border-radius:50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [14, 14]
            });

            L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${s.name}</b><br>${s.lastLoc}`);
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
