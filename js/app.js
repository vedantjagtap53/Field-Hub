// Init Store
if (window.store) {
    window.store.init();
} else {
    console.error("Critical: Store not loaded.");
    alert("Error: Data Store failed to load. Please refresh.");
}

const store = window.store;

// Constants
const SITE_COORDS = [18.457628, 73.850929]; // HQ
const MAX_DIST_KM = 2.0;

// DOM Elements
const views = {
    auth: document.getElementById('auth-view'),
    admin: document.getElementById('admin-view'),
    field: document.getElementById('field-view')
};
const loginForm = document.getElementById('login-form');
const roleBtns = document.querySelectorAll('.role-btn');
let map = null;
let attendanceChart = null;
let selectedRole = 'admin';

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
    updateDate();

    // SW
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Fail (probably file://):', err));
    }

    // Splash
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('fade-out');
    }, 1500);
});

// --- Event Listeners ---

function setupEventListeners() {
    // Role Switch
    roleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            roleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRole = btn.dataset.role;
            const emailInput = document.querySelector('input[type="email"]');
            if (emailInput) emailInput.value = selectedRole === 'admin' ? 'demo@geoops.org' : 'field@geoops.org';
        });
    });

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log("Login submitted");
            const email = e.target.querySelector('input[type="email"]').value;
            const password = e.target.querySelector('input[type="password"]').value;

            try {
                const res = store.login(email, password);
                if (res.success) {
                    console.log("Login success user:", res.user);
                    alert(`Welcome back, ${res.user.name}!`);
                    navigate(res.user.role === 'admin' ? 'admin' : 'field');
                } else {
                    console.warn("Login failed:", res.message);
                    alert(`Access Denied: ${res.message}`);
                }
            } catch (err) {
                console.error("Login Error:", err);
                alert("System Error during login. Check console.");
            }
        });
    }

    // Logout
    const logoutBtns = document.querySelectorAll('#logout-btn, #field-logout');
    logoutBtns.forEach(btn => btn.addEventListener('click', () => {
        store.logout();
        navigate('auth');
    }));

    // Admin Sidebar
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
            link.parentElement.classList.add('active');

            const targetId = link.getAttribute('href').substring(1);
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            const targetTab = document.getElementById(`tab-${targetId}`);
            if (targetTab) targetTab.classList.remove('hidden');

            if (targetId === 'map') setTimeout(() => { if (map) map.invalidateSize(); }, 100);
            if (targetId === 'tasks') renderAdminTasks();
            if (targetId === 'leave') renderAdminLeaves();
        });
    });

    // Field Bottom Nav
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            if (!link.dataset.target) return;
            e.preventDefault();
            document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.remove('active'));
            link.classList.add('active');

            const targetId = link.dataset.target;
            document.querySelectorAll('.field-tab').forEach(tab => tab.classList.add('hidden'));
            const targetTab = document.getElementById(targetId);
            if (targetTab) {
                targetTab.classList.remove('hidden');
                targetTab.classList.add('active');
            }

            if (targetId === 'field-tab-leave') renderFieldLeaves();
        });
    });

    // Clock In/Out
    const clockBtn = document.getElementById('clock-btn');
    if (clockBtn) clockBtn.addEventListener('click', handleClockInOut);

    // Forms
    const taskForm = document.getElementById('create-task-form');
    if (taskForm) taskForm.addEventListener('submit', handleCreateTask);

    const leaveForm = document.getElementById('leave-form');
    if (leaveForm) leaveForm.addEventListener('submit', handleLeaveRequest);

    const reportForm = document.getElementById('report-form');
    if (reportForm) reportForm.addEventListener('submit', handleReportSubmit);

    // FAB
    const fab = document.getElementById('new-report-btn');
    if (fab) fab.addEventListener('click', () => openModal('report-modal'));
}

// --- Navigation & Views ---

function checkSession() {
    const user = store.getCurrentUser();
    navigate(user ? (user.role === 'admin' ? 'admin' : 'field') : 'auth');
}

function navigate(viewName) {
    Object.values(views).forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });

    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
        setTimeout(() => views[viewName].classList.add('active'), 10);
    }

    if (viewName === 'admin') initAdminDashboard();
    if (viewName === 'field') initFieldDashboard();
}

// --- Admin Logic ---

function initAdminDashboard() {
    updateAdminStats();
    renderChart();
    renderMap();

    // Populate Staff Select
    const staff = store.getUsers().filter(u => u.role === 'field');
    const sel = document.getElementById('staff-select');
    if (sel) sel.innerHTML = staff.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
}

function updateAdminStats() {
    const stats = store.getStats();
    const el1 = document.getElementById('stat-active-staff');
    const el2 = document.getElementById('stat-completed-tasks');
    const el3 = document.getElementById('stat-leave-reqs');
    if (el1) el1.innerText = stats.activeStaff;
    if (el2) el2.innerText = stats.completedTasks;
    if (el3) el3.innerText = stats.pendingLeaves;
}

function renderAdminTasks() {
    const tasks = store.getTasks();
    const list = document.getElementById('admin-task-list');
    if (!list) return;

    list.innerHTML = tasks.length ? tasks.map(t => {
        const u = store.getUsers().find(user => user.id === t.assignedTo);
        return `
        <div class="glass-panel" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h4>${t.title}</h4>
                <p style="font-size:0.8rem; color:var(--text-muted);">${u ? u.name : 'Unassigned'} • ${t.location}</p>
            </div>
            <span class="badge" style="background:${getPriorityColor(t.priority)}; color:white; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${t.status}</span>
        </div>`;
    }).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted);">No tasks found.</p>';
}

function renderAdminLeaves() {
    const reqs = store.getLeaveRequests();
    const list = document.getElementById('admin-leave-list');
    if (!list) return;

    list.innerHTML = reqs.length ? reqs.map(r => `
        <div class="glass-panel" style="margin-bottom:10px; padding:15px;">
            <div style="display:flex; justify-content:space-between;">
                <h3>${r.type} <span style="font-size:0.8rem; color:var(--text-muted);">by ${r.userName}</span></h3>
                <span style="color:${r.status === 'approved' ? 'var(--accent)' : (r.status === 'rejected' ? 'red' : 'orange')}">${r.status.toUpperCase()}</span>
            </div>
            <p style="margin:5px 0; color:var(--text-muted);">${r.reason} on ${r.date}</p>
            ${r.status === 'pending' ? `
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button class="btn-primary" style="padding:5px 15px; font-size:0.8rem;" onclick="window.approveLeave('${r.id}')">Approve</button>
                <button style="background:rgba(255,255,255,0.1); border:none; color:white; padding:5px 15px; border-radius:5px; cursor:pointer;" onclick="window.rejectLeave('${r.id}')">Reject</button>
            </div>` : ''}
        </div>
    `).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted);">No leave requests.</p>';
}

// Global actions for Admin
window.approveLeave = (id) => { store.updateLeaveStatus(id, 'approved'); renderAdminLeaves(); updateAdminStats(); };
window.rejectLeave = (id) => { store.updateLeaveStatus(id, 'rejected'); renderAdminLeaves(); updateAdminStats(); };

function handleCreateTask(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const assignedId = fd.get('assignedTo');

    // Availability Conflict Check
    const leaves = store.getLeaveRequests(assignedId).filter(r => r.status === 'approved');
    if (leaves.length > 0) {
        if (!confirm('Warning: This staff member has approved leave. Assign anyway?')) return;
    }

    store.addTask({
        title: fd.get('title'),
        location: fd.get('location'),
        assignedTo: assignedId,
        priority: fd.get('priority'),
        time: fd.get('time'),
        coords: [51.5 + Math.random() * 0.1, -0.1 + Math.random() * 0.1]
    });

    closeModal('task-modal');
    e.target.reset();
    renderAdminTasks();
    updateAdminStats();
    alert('Task assigned.');
}

// --- Field Logic ---

function initFieldDashboard() {
    const user = store.getCurrentUser();
    if (!user) return;

    const el = document.getElementById('field-user-name');
    if (el) el.innerText = user.name;

    // Sync Clock Status
    const att = store.getStaffStatus().find(s => s.id === user.id);
    updateClockUI(att ? att.status : 'out', att ? att.lastLoc : 'Location service standby');

    renderFieldTasks(user.id);
}

function renderFieldTasks(userId) {
    const tasks = store.getTasks(userId);
    const list = document.getElementById('field-task-list');
    if (!list) return;

    list.innerHTML = tasks.length ? tasks.map(task => `
        <div class="task-card glass-panel">
            <div class="task-header">
                <span class="badge" style="background:${getPriorityColor(task.priority)}; color:white; padding:2px 8px; border-radius:4px; font-size:0.75rem;">${task.priority.toUpperCase()}</span>
                <span class="time">${task.time}</span>
            </div>
            <h4>${task.title}</h4>
            <p style="color:var(--text-muted); margin-bottom:10px;">${task.location}</p>
            ${task.status === 'pending' ?
            `<button class="btn-primary" style="width:100%; padding:8px;" onclick="window.completeTask('${task.id}')">Mark as Done</button>` :
            `<div style="color:var(--accent); text-align:center; padding:8px; background:rgba(16, 185, 129, 0.1); border-radius:8px;"><i class="fa-solid fa-check"></i> Completed</div>`}
        </div>
    `).join('') : '<p style="text-align:center; opacity:0.6;">No tasks assigned.</p>';
}

window.completeTask = (id) => {
    store.completeTask(id);
    const user = store.getCurrentUser();
    if (user) renderFieldTasks(user.id);
};

function renderFieldLeaves() {
    const user = store.getCurrentUser();
    const reqs = store.getLeaveRequests(user.id);
    const list = document.getElementById('field-leave-list');
    if (!list) return;

    list.innerHTML = reqs.length ? reqs.map(r => `
         <div class="glass-panel" style="margin-bottom:10px; padding:15px; border-left: 4px solid ${r.status === 'approved' ? 'var(--accent)' : (r.status === 'rejected' ? 'red' : 'orange')}">
            <div style="display:flex; justify-content:space-between;">
                <strong>${r.type}</strong>
                <span>${r.date}</span>
            </div>
            <p style="font-size:0.9rem; opacity:0.8; margin-top:5px;">Status: ${r.status.toUpperCase()}</p>
         </div>
    `).join('') : '<p style="text-align:center; opacity:0.6;">No requests history.</p>';
}

async function handleClockInOut() {
    const btn = document.getElementById('clock-btn');
    const user = store.getCurrentUser();
    const isClockingIn = btn.innerText.includes('In') || btn.innerText.includes('Locating');

    if (isClockingIn) {
        btn.innerText = 'Locating...';
        btn.disabled = true;

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    const dist = getDistanceFromLatLonInKm(latitude, longitude, SITE_COORDS[0], SITE_COORDS[1]);
                    let statusNote = `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

                    if (dist > MAX_DIST_KM) {
                        alert(`Warning: You are ${dist.toFixed(1)}km from HQ. Clocking in anyway.`);
                        statusNote += ' (Off-Site)';
                    } else {
                        statusNote += ' (On-Site)';
                    }

                    store.updateAttendance(user.id, 'in', statusNote, [latitude, longitude]);
                    updateClockUI('in', statusNote);
                    btn.disabled = false;
                },
                (err) => {
                    console.error(err);
                    alert("Location access denied or unavailable. Using fallback.");
                    store.updateAttendance(user.id, 'in', 'Simulated Loc', [18.457628, 73.8509295]);
                    updateClockUI('in', 'Simulated Loc');
                    btn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            alert("Geolocation not supported.");
            btn.disabled = false;
        }
    } else {
        store.updateAttendance(user.id, 'out', 'Unknown', null);
        updateClockUI('out', 'Location service standby');
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
        btn.style.background = 'rgba(255,255,255,0.1)';
        text.innerText = 'You are clocked IN';
        container.classList.add('clocked-in');
        locEl.innerText = locText;
    } else {
        btn.innerText = 'Clock In';
        btn.style.background = '';
        text.innerText = 'You are clocked OUT';
        container.classList.remove('clocked-in');
        locEl.innerText = locText;
    }
}

function handleLeaveRequest(e) {
    e.preventDefault();
    const user = store.getCurrentUser();
    const fd = new FormData(e.target);
    store.addLeaveRequest({
        userId: user.id,
        type: fd.get('type'),
        date: fd.get('date'),
        reason: fd.get('reason')
    });
    closeModal('leave-modal');
    e.target.reset();
    renderFieldLeaves();
    alert('Leave request submitted.');
}

function handleReportSubmit(e) {
    e.preventDefault();
    const user = store.getCurrentUser();
    const fd = new FormData(e.target);
    store.addReport({
        userId: user.id,
        content: fd.get('content'),
        hasPhoto: true
    });
    closeModal('report-modal');
    e.target.reset();
    alert('Report submitted successfully!');
}

// --- Map & Helpers ---

function renderMap() {
    const mapEl = document.getElementById('ops-map');
    if (!mapEl) return;
    if (map) return; // Already init

    map = L.map('ops-map').setView(SITE_COORDS, 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // HQ Zone
    L.marker(SITE_COORDS).addTo(map).bindPopup('<b>Headquarters</b><br>Geofence Center');
    L.circle(SITE_COORDS, {
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.15,
        radius: MAX_DIST_KM * 1000 // meters
    }).addTo(map);

    // Active Staff
    store.getStaffStatus().filter(s => s.status === 'in').forEach(s => {
        // Mock coords logic if null, else real coords
        // For visual demo, we drift the coords slightly so they don't stack
        const lat = 18.457628 + (Math.random() - 0.5) * 0.02;
        const lng = 73.8509295 + (Math.random() - 0.5) * 0.02;

        L.marker([lat, lng])
            .addTo(map)
            .bindPopup(`<b>${s.name}</b><br>Status: Online<br>${s.lastLoc}`);
    });
}

function renderChart() {
    const ctx = document.getElementById('attendanceChart');
    if (!ctx) return;
    if (attendanceChart) attendanceChart.destroy();

    attendanceChart = new Chart(ctx.getContext('2d'), {
        type: 'bar', // Switched to bar for better visual
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            datasets: [{
                label: 'Staff on Site',
                data: [12, 19, 15, 17, 14],
                backgroundColor: 'rgba(99, 102, 241, 0.5)',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateDate() {
    const el = document.getElementById('current-date');
    if (el) el.innerText = new Date().toLocaleDateString();
}

function getPriorityColor(p) {
    if (p === 'high') return '#ec4899'; // pink
    if (p === 'medium') return '#6366f1'; // indigo
    return '#10b981'; // green
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg) { return deg * (Math.PI / 180) }

// Export to window for modal helpers in HTML
window.openModal = function (id) { document.getElementById(id).classList.remove('hidden'); };
window.closeModal = function (id) { document.getElementById(id).classList.add('hidden'); };
