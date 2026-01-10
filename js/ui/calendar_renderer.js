
// ========================================
// Admin Calendar Renderer
// ========================================

export const CalendarRenderer = {
    calendar: null,

    render: () => {
        const calendarEl = document.getElementById('admin-calendar');
        if (!calendarEl) return;

        // If already initialized, just refetch events
        if (CalendarRenderer.calendar) {
            CalendarRenderer.calendar.refetchEvents();
            CalendarRenderer.calendar.render(); // Ensure size is correct
            return;
        }

        // Initialize FullCalendar
        CalendarRenderer.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek'
            },
            height: '100%',
            events: CalendarRenderer.fetchEvents,
            eventClick: (info) => {
                alert(`Event: ${info.event.title}\nDate: ${info.event.start.toLocaleDateString()}`);
            }
        });

        CalendarRenderer.calendar.render();
    },

    fetchEvents: (fetchInfo, successCallback, failureCallback) => {
        const events = [];

        // 1. Tasks (Use Due Date or Created Date)
        const tasks = window.store.getTasks();
        tasks.forEach(task => {
            // Priority Colors
            let color = '#3b82f6'; // Blue (Normal)
            if (task.priority === 'high') color = '#ef4444'; // Red
            if (task.priority === 'medium') color = '#f59e0b'; // Orange
            if (task.status === 'completed') color = '#10b981'; // Green

            if (task.dueDate || task.createdAt) {
                events.push({
                    title: `Task: ${task.title}`,
                    start: task.dueDate || task.createdAt,
                    color: color,
                    allDay: true
                });
            }
        });

        // 2. Leave Requests
        const leaves = window.store.getLeaveRequests();
        leaves.forEach(leave => {
            let color = '#6b7280'; // Grey (Pending)
            if (leave.status === 'approved') color = '#8b5cf6'; // Purple
            if (leave.status === 'rejected') color = '#ef4444'; // Red

            events.push({
                title: `Leave: ${leave.userName} (${leave.type})`,
                start: leave.startDate || leave.date,
                end: leave.endDate || leave.date, // FullCalendar end date is exclusive, might need +1 day for single dates but this is okay for now
                color: color,
                allDay: true
            });
        });

        successCallback(events);
    }
};
