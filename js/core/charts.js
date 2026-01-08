
// ========================================
// Chart Logic
// ========================================

let attendanceChart = null;

export const ChartUtils = {
    renderChart: () => {
        const ctx = document.getElementById('attendanceChart');
        if (!ctx) return;
        if (attendanceChart) attendanceChart.destroy();

        // Calculate last 7 days stats

        const dataPoints = [];
        const logs = window.store.getAttendanceLogs(null, 500);

        const labels = [];
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
};
