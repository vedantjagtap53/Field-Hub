
// ========================================
// Admin UI Renderers
// ========================================
import { Toast, UI } from '../utils/ui_helpers.js';

export const AdminRenderers = {
    renderDropdowns: () => {
        // Populate staff select
        const staff = window.store.getUsers().filter(u => u.role === 'field');
        const staffSel = document.getElementById('staff-select');
        if (staffSel) {
            const val = staffSel.value;
            staffSel.innerHTML = staff.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
            if (val) staffSel.value = val;
        }

        // Populate site select for worker form
        const sites = window.store.getAllSites();
        const siteSel = document.getElementById('site-select');
        if (siteSel) {
            const val = siteSel.value;
            siteSel.innerHTML = '<option value="">Select Workplace/Office</option>' + sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            if (val) siteSel.value = val;
        }

        // Populate project select for site form
        const projects = window.store.getProjects();
        const projectSel = document.getElementById('site-project-select');
        if (projectSel) {
            const val = projectSel.value;
            projectSel.innerHTML = '<option value="">-- No Project (General) --</option>' + projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            if (val) projectSel.value = val;
        }
    },

    updateAdminStats: () => {
        const stats = window.store.getStats();
        const update = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.style.opacity = '0.5';
                setTimeout(() => { el.innerText = value; el.style.opacity = '1'; }, 100);
            }
        };

        // Main dashboard stats
        update('stat-active-staff', stats.activeStaff);
        update('stat-completed-tasks', stats.completedTasks);
        update('stat-leave-reqs', stats.pendingLeaves);
        update('stat-reports', stats.totalReports);
        update('stat-attendance', stats.attendanceRate + '%');
        update('stat-productivity', stats.productivityRate + '%');

        // Update admin name in hero tile
        const user = window.store.getCurrentUser();
        if (user) {
            const adminNameEl = document.getElementById('admin-name');
            if (adminNameEl) adminNameEl.innerText = user.name || 'Admin';
        }

        // Sync modal stats
        update('modal-active', stats.activeStaff);
        update('modal-tasks', stats.completedTasks);
        update('modal-attendance', stats.attendanceRate + '%');
        update('modal-productivity', stats.productivityRate + '%');
    },

    updateUserProfileUI: () => {
        const user = window.store.getCurrentUser();
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
    },

    renderActivityLog: () => {
        const logs = window.store.getAttendanceLogs(null, 10);
        const list = document.getElementById('activity-log');
        if (!list) return;

        list.innerHTML = logs.length ? logs.map(log => {
            const date = new Date(log.timestamp);
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const displayName = log.userName || (window.store.getUsers().find(u => u.id === log.userId)?.name) || 'Unknown User';

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
    },

    renderStaff: () => {
        const workers = window.store.getUsers().filter(u => u.role === 'field');
        const grid = document.getElementById('staff-list');
        if (!grid) return;

        grid.innerHTML = workers.map(w => `
            <div class="glass-panel" style="padding:18px;">
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <img src="${(w.avatar && w.avatar !== 'undefined') ? w.avatar : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(w.name)}" style="width:48px; height:48px; border-radius:50%; border:2px solid var(--border);">
                    <div style="flex:1;">
                        <h4 style="margin:0; font-size:1rem;">${w.name}</h4>
                        <p style="margin:2px 0 0; font-size:0.8rem; color:var(--text-muted);">${w.email}</p>
                        <p style="margin:2px 0 0; font-size:0.75rem; color:var(--primary);">
                            <i class="fa-solid fa-building"></i> ${w.assignedSite ? (window.store.getAllSites().find(s => s.id === w.assignedSite)?.name || 'Unknown Site') : 'No Site Assigned'}
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
                    <button class="btn-outline" style="flex:1; padding:8px; font-size:0.85rem;" onclick="window.editWorker('${w.id}')">
                        <i class="fa-solid fa-edit"></i> Edit
                    </button>
                    <button class="btn-outline" style="flex:1; padding:8px; font-size:0.85rem;" onclick="window.toggleWorker('${w.id}')">
                        <i class="fa-solid fa-${w.active ? 'ban' : 'check'}"></i> ${w.active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
                <div style="margin-top:8px;">
                    <button class="btn-text" style="width:100%; color:#ef4444; font-size:0.8rem;" onclick="window.deleteWorker('${w.id}')">
                        <i class="fa-solid fa-trash"></i> Permanently Remove
                    </button>
                </div>
            </div>
        `).join('');

        // Ensure pending registrations also render
        AdminRenderers.renderRegistrations();
    },

    renderProjects: () => {
        const projects = window.store.getProjects();
        const list = document.getElementById('admin-project-list');
        if (!list) return;

        list.innerHTML = projects.length ? projects.map(p => {
            const siteCount = window.store.getSites().filter(s => s.projectId === p.id).length;
            return `
            <div class="glass-panel" style="padding:18px;">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                    <div>
                        <h4 style="margin:0; font-size:1rem;">${p.name}</h4>
                        <p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-secondary);">${p.manager || 'No Manager'}</p>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-text" onclick="window.editProject('${p.id}')" style="color:var(--primary); padding:4px;" title="Edit">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn-text" onclick="window.deleteProject('${p.id}')" style="color:var(--text-muted); padding:4px;" title="Delete">
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
    },

    renderSites: () => {
        const sites = window.store.getSites();
        const list = document.getElementById('admin-site-list');
        if (!list) return;

        list.innerHTML = sites.length ? sites.map(s => {
            const project = window.store.getProjects().find(p => p.id === s.projectId);
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
                        <button class="btn-text" onclick="window.editSite('${s.id}')" style="color:var(--primary); padding:4px;" title="Edit">
                            <i class="fa-solid fa-edit"></i>
                        </button>
                        <button class="btn-text" onclick="window.deleteSite('${s.id}')" style="color:var(--text-muted); padding:4px;" title="Delete">
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
    },

    renderAdminTasks: () => {
        const tasks = window.store.getTasks();
        const list = document.getElementById('admin-task-list');
        if (!list) return;

        list.innerHTML = tasks.length ? tasks.map(t => {
            const u = window.store.getUsers().find(user => user.id === t.assignedTo);
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
    },

    renderAdminLeaves: () => {
        const reqs = window.store.getLeaveRequests();
        const list = document.getElementById('admin-leave-list');
        if (!list) return;

        list.innerHTML = reqs.length ? reqs.map(r => {
            const displayName = r.userName || window.store.getUsers().find(u => u.id === r.userId)?.name || 'Unknown User';
            return `
            <div class="glass-panel" style="margin-bottom:10px; padding:16px; border-left: 3px solid ${r.status === 'approved' ? '#10b981' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')};">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <h4 style="margin:0; font-size:1rem;">${r.type} <span style="font-size:0.85rem; color:var(--text-muted); font-weight:400;">by ${displayName}</span></h4>
                    <span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; background: ${r.status === 'approved' ? 'rgba(59,130,246,0.1)' : (r.status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)')}; color:${r.status === 'approved' ? 'var(--primary)' : (r.status === 'rejected' ? '#ef4444' : '#f59e0b')}; border:1px solid; text-transform:uppercase; font-weight:600;">${r.status}</span>
                </div>
                <p style="margin:6px 0; color:var(--text-secondary); font-size:0.9rem;">
                    ${(r.startDate && r.endDate) ? `${r.startDate} to ${r.endDate}` : (r.date || 'No Date')} • ${r.reason}
                </p>
                ${r.status === 'pending' ? `
                <div style="margin-top:10px; display:flex; gap:8px;">
                    <button class="btn-primary" style="padding:8px 16px; font-size:0.85rem; flex:1;" onclick="window.approveLeave('${r.id}')">Approve</button>
                    <button class="btn-outline" style="padding:8px 16px; font-size:0.85rem; flex:1; color:#ef4444; border-color:#ef4444;" onclick="window.rejectLeave('${r.id}')">Reject</button>
                </div>` : ''}
            </div>
        `;
        }).join('') : '<p style="text-align:center; padding:40px; color:var(--text-muted);">No leave requests.</p>';
    },

    renderRegistrations: () => {
        const regs = window.store.getRegistrations();
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
                     <button class="btn-primary" onclick="window.approveRegistration('${r.id}', 'field')" style="padding:6px 12px; font-size:0.8rem;">Approve</button>
                     <button class="btn-outline" onclick="window.deleteRegistration('${r.id}')" style="padding:6px 12px; font-size:0.8rem; border-color:#ef4444; color:#ef4444;">Reject</button>
                 </div>
            </div>
        `).join('') : '<p style="text-align:center; padding:20px; color:var(--text-muted);">No pending registrations.</p>';
    },

    renderAttendanceLogs: () => {
        const logs = window.store.getAttendanceLogs(null, 100);
        const list = document.getElementById('attendance-log-list');
        if (!list) return;

        list.innerHTML = logs.length ? logs.map(log => {
            const date = new Date(log.timestamp);
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const displayName = log.userName || (window.store.getUsers().find(u => u.id === log.userId)?.name) || 'Unknown User';

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
                        <span><i class="fa-solid fa-ruler"></i> ${(log.distance !== undefined && log.distance !== null) ? log.distance.toFixed(2) : '--'} km</span>
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
    },

    renderAdminReports: () => {
        const reports = window.store.getReports();
        const list = document.getElementById('admin-reports-list');
        if (!list) return;

        list.innerHTML = reports.length ? reports.map(r => {
            const user = window.store.getUsers().find(u => u.id === r.userId);
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
};
