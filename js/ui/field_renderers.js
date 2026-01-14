
// ========================================
// Field UI Renderers
// ========================================
import { Toast, Loading } from '../utils/ui_helpers.js';

export const FieldRenderers = {
    renderWorkerStats: (userId) => {
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
            }
        }

        if (!statsContainer) return;

        const stats = window.store.getWorkerStats(userId);

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
    },

    renderFieldTasks: (userId) => {
        const list = document.getElementById('field-task-list');
        if (!list) return;

        const status = window.store.getWorkerStatus(userId);
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

        const tasks = window.store.getTasks(userId);
        list.innerHTML = tasks.length ? tasks.map((task, index) => {
            const taskText = `${task.title} - ${task.location}`;
            return `
            <div class="task-card glass-panel" id="field-task-${index}">
                <div class="task-header">
                    <span class="badge">${task.priority}</span>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="chip-btn" onclick="window.translateTask(${index}, 'field')"><i class="fa-solid fa-language"></i></button>
                        <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> ${task.time}</span>
                    </div>
                </div>
                <h4>${task.title}</h4>
                <p><i class="fa-solid fa-location-dot"></i> ${task.location}</p>
                <div id="field-task-translation-${index}" style="display:none; margin:10px 0; padding:10px; background:rgba(99, 102, 241, 0.1); border-radius:6px; border-left:3px solid var(--primary); font-size:0.85rem;"></div>
                ${task.status === 'pending' ?
                    `<button class="btn-primary" style="width:100%; padding:10px;" onclick="window.completeTask('${task.id}')"><i class="fa-solid fa-check"></i> Complete</button>` :
                    `<div style="color:var(--primary); text-align:center; padding:10px; background:rgba(59,130,246,0.1); border-radius:6px; border: 1px solid var(--primary);"><i class="fa-solid fa-check-circle"></i> Completed</div>`}
            </div>
        `}).join('') : '<p style="text-align:center; opacity:0.6; padding:40px;">No tasks assigned.</p>';
    },

    renderFieldLeaves: () => {
        const user = window.store.getCurrentUser();
        const reqs = window.store.getLeaveRequests(user.id);
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
                    </span>
                </div>
                <div style="font-size:0.9rem; color:var(--text-primary); margin-bottom:8px;">
                    <i class="fa-regular fa-calendar" style="margin-right:6px; color:var(--primary);"></i>
                    ${(r.startDate && r.endDate) ? `${r.startDate} <span style="color:var(--text-muted); font-size:0.8em; margin:0 4px;">to</span> ${r.endDate}` : (r.date || 'No Date Selected')}
                </div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">
                    ${r.reason}
                </div>
                ${r.status === 'rejected' ? '<div style="margin-top:8px; font-size:0.8rem; color:#ef4444;"><i class="fa-solid fa-circle-info"></i> Request was declined.</div>' : ''}
                ${r.status === 'approved' ? '<div style="margin-top:8px; font-size:0.8rem; color:#10b981;"><i class="fa-solid fa-check-circle"></i> Approved! Enjoy your time off.</div>' : ''}
            </div>
        `).join('') : '<p style="text-align:center; opacity:0.6; padding:40px;">No requests yet.</p>';
    },

    renderFieldProfile: () => {
        const user = window.store.getCurrentUser();
        if (!user) return;

        const form = document.getElementById('field-profile-form');
        if (form) {
            form.elements.name.value = user.name || '';
            form.elements.phone.value = user.phone || '';
            form.elements.skills.value = user.skills || '';
            document.getElementById('profile-email-display').innerText = user.email;
            document.getElementById('profile-avatar-preview').src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;
        }
    },

    updateClockUI: (status, locText) => {
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
    },

    renderFieldReports: () => {
        const user = window.store.getCurrentUser();
        const reports = window.store.getReports().filter(r => r.userId === user.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const list = document.getElementById('field-my-reports-list');
        if (!list) return;

        list.innerHTML = reports.length ? reports.map(r => `
            <div class="glass-panel" style="padding:12px; border-left:3px solid var(--primary);">
                <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">
                    ${new Date(r.createdAt).toLocaleDateString()} • ${new Date(r.createdAt).toLocaleTimeString()}
                </div>
                <div style="font-size:1rem; margin-bottom:8px;">${r.content}</div>
                ${r.hasPhoto ? `<div style="font-size:0.8rem; color:var(--primary);"><i class="fa-solid fa-image"></i> Photo Attached</div>` : ''}
            </div>
        `).join('') : '<p style="text-align:center; opacity:0.6; padding:20px;">No reports submitted yet.</p>';
    }
};
