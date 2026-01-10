
// ... (previous content)
export const ChartUtils = {
    adminCharts: [],
    workerChart: null,

    renderAdminCharts: () => {
        ChartUtils.adminCharts.forEach(c => c.destroy());
        ChartUtils.adminCharts = [];

        // 1. Volunteer Engagement (Bar Chart) - Active Users vs Tasks
        const ctx1 = document.getElementById('engagementChart');
        if (ctx1) {
            const labels = [];
            const activeUsersData = [];
            const completedTasksData = [];

            const logs = window.store.getAttendanceLogs(null, 500);
            const tasks = window.store.getTasks();

            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));

                // Active Users
                const dailyLogs = logs.filter(l => {
                    const ld = new Date(l.timestamp);
                    return ld.toDateString() === d.toDateString() && l.action === 'clock-in';
                });
                activeUsersData.push(new Set(dailyLogs.map(l => l.userId)).size);

                // Completed Tasks (Mocking completion date as created date for now roughly, or real if available)
                // Since we don't track 'completedAt' strictly in this mock store, we'll estimate based on 'createdAt' or just mock data for demo visual
                // Ideally: tasks.filter(t => t.status === 'completed' && new Date(t.completedAt).toDateString() === d.toDateString())
                // For Demo: Randomize slightly or use createdAt
                const dailyTasks = tasks.filter(t => new Date(t.createdAt).toDateString() === d.toDateString()).length;
                completedTasksData.push(dailyTasks);
            }

            ChartUtils.adminCharts.push(new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Active Volunteers', data: activeUsersData, backgroundColor: '#3b82f6', borderRadius: 4 },
                        { label: 'Tasks Created', data: completedTasksData, backgroundColor: '#10b981', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { grid: { display: false } }
                    },
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
                }
            }));
        }

        // 2. Task Distribution (Doughnut)
        const ctx2 = document.getElementById('taskDistChart');
        if (ctx2) {
            const tasks = window.store.getTasks();
            const pending = tasks.filter(t => t.status === 'pending').length;
            const completed = tasks.filter(t => t.status === 'completed').length;
            const highPri = tasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;

            ChartUtils.adminCharts.push(new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: ['Pending', 'Completed', 'High Priority'],
                    datasets: [{
                        data: [pending, completed, highPri],
                        backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } }
                    },
                    cutout: '70%'
                }
            }));
        }
    },

    renderWorkerCharts: (userId) => {
        if (ChartUtils.workerChart) ChartUtils.workerChart.destroy();

        const ctx = document.getElementById('workerPieChart');
        if (!ctx || !userId) return;

        const myTasks = window.store.getTasks(userId);
        const completed = myTasks.filter(t => t.status === 'completed').length;
        const pending = myTasks.length - completed;

        // Update Text Counter
        const countEl = document.getElementById('worker-task-count');
        if (countEl) countEl.innerText = completed;

        ChartUtils.workerChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Done', 'Todo'],
                datasets: [{
                    data: [completed, pending],
                    backgroundColor: ['#10b981', '#3b82f640'], // Green, Transparent Blue
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    },

    modalCharts: [],

    renderAnalyticsModalCharts: () => {
        // Destroy existing modal charts
        ChartUtils.modalCharts.forEach(c => c.destroy());
        ChartUtils.modalCharts = [];

        const logs = window.store.getAttendanceLogs(null, 500);
        const tasks = window.store.getTasks();

        // 1. Weekly Engagement (Line Chart)
        const ctx1 = document.getElementById('modalEngagementChart');
        if (ctx1) {
            const labels = [];
            const data = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
                const dailyLogs = logs.filter(l => new Date(l.timestamp).toDateString() === d.toDateString() && l.action === 'clock-in');
                data.push(new Set(dailyLogs.map(l => l.userId)).size);
            }
            ChartUtils.modalCharts.push(new Chart(ctx1, {
                type: 'line',
                data: { labels, datasets: [{ label: 'Active Users', data, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
            }));
        }

        // 2. Task Distribution (Doughnut)
        const ctx2 = document.getElementById('modalTaskChart');
        if (ctx2) {
            const pending = tasks.filter(t => t.status === 'pending').length;
            const completed = tasks.filter(t => t.status === 'completed').length;
            const inProgress = tasks.filter(t => t.status === 'in-progress').length;
            ChartUtils.modalCharts.push(new Chart(ctx2, {
                type: 'doughnut',
                data: { labels: ['Pending', 'Completed', 'In Progress'], datasets: [{ data: [pending, completed, inProgress], backgroundColor: ['#f59e0b', '#10b981', '#3b82f6'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '60%' }
            }));
        }

        // 3. Monthly Attendance (Bar Chart)
        const ctx3 = document.getElementById('modalAttendanceChart');
        if (ctx3) {
            const labels = [];
            const data = [];
            for (let i = 29; i >= 0; i -= 5) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                const dailyLogs = logs.filter(l => {
                    const ld = new Date(l.timestamp);
                    return Math.abs(ld - d) < 3 * 24 * 60 * 60 * 1000 && l.action === 'clock-in';
                });
                data.push(new Set(dailyLogs.map(l => l.userId)).size);
            }
            ChartUtils.modalCharts.push(new Chart(ctx3, {
                type: 'bar',
                data: { labels, datasets: [{ label: 'Unique Check-ins', data, backgroundColor: '#8b5cf6', borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
            }));
        }

        // 4. Project Completion (Horizontal Bar)
        const ctx4 = document.getElementById('modalProjectChart');
        if (ctx4) {
            const projects = window.store.getProjects ? window.store.getProjects() : [];
            const labels = projects.slice(0, 5).map(p => p.name);
            const data = projects.slice(0, 5).map(p => {
                const projectTasks = tasks.filter(t => t.projectId === p.id);
                const completed = projectTasks.filter(t => t.status === 'completed').length;
                return projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
            });
            ChartUtils.modalCharts.push(new Chart(ctx4, {
                type: 'bar',
                data: { labels: labels.length ? labels : ['No Projects'], datasets: [{ label: 'Completion %', data: data.length ? data : [0], backgroundColor: '#10b981', borderRadius: 4 }] },
                options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', scales: { x: { max: 100, beginAtZero: true } }, plugins: { legend: { display: false } } }
            }));
        }
    }
};
