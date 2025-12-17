// Store - Simulated Database & State Management

const STORAGE_KEY = 'geoOps_db_v3'; // Bump version to reset data

const defaultData = {
    users: [
        { id: 'u1', name: 'Jane Admin', email: 'demo@geoops.org', role: 'admin', avatar: 'https://ui-avatars.com/api/?name=Jane+Admin&background=6366f1&color=fff' },
        { id: 'u2', name: 'John Field', email: 'field@geoops.org', role: 'field', avatar: 'https://ui-avatars.com/api/?name=John+Field&background=10b981&color=fff' },
        { id: 'u3', name: 'Sarah Scout', email: 'sarah@geoops.org', role: 'field', avatar: 'https://ui-avatars.com/api/?name=Sarah+Scout&background=f59e0b&color=fff' }
    ],
    tasks: [
        { id: 't1', title: 'Water Quality Check', location: 'District A', coords: [51.505, -0.09], assignedTo: 'u2', status: 'pending', priority: 'high', time: '09:00 AM' },
        { id: 't2', title: 'Supply Distribution', location: 'Camp 4', coords: [51.51, -0.1], assignedTo: 'u2', status: 'completed', priority: 'medium', time: '02:00 PM' }
    ],
    attendance: [
        { userId: 'u2', status: 'out', location: 'Unknown', lastUpdated: null }
    ],
    leaveRequests: [
        { id: 'l1', userId: 'u3', type: 'Sick Leave', date: '2025-12-20', reason: 'Flu', status: 'pending' }
    ],
    reports: [],
    currentUser: null
};

// Initialize Store
function initStore() {
    try {
        const existing = localStorage.getItem(STORAGE_KEY);
        if (!existing) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
            console.log('GeoOps: Database initialized.');
        } else {
            // Verify integrity
            const db = JSON.parse(existing);
            if (!db.users || !db.tasks) throw new Error('Corrupted DB');
        }
    } catch (e) {
        console.warn('GeoOps: DB Corrupted. Resetting.', e);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    }
}

function getData() {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : defaultData;
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Data Access Methods
window.store = {
    init: initStore,

    reset: () => {
        localStorage.removeItem(STORAGE_KEY);
        initStore();
        alert('System Reset Complete. Reloading...');
        location.reload();
    },

    // Auth
    login: (email, password) => {
        const db = getData();
        const user = db.users.find(u => u.email === email);
        if (user) {
            db.currentUser = user;
            saveData(db);
            return { success: true, user };
        }
        return { success: false, message: 'Invalid credentials. Try: demo@geoops.org' };
    },
    logout: () => {
        const db = getData();
        db.currentUser = null;
        saveData(db);
    },
    getCurrentUser: () => getData().currentUser,
    getUsers: () => getData().users,

    // Tasks
    getTasks: (userId = null) => {
        const db = getData();
        if (userId) return db.tasks.filter(t => t.assignedTo === userId);
        return db.tasks;
    },
    addTask: (task) => {
        const db = getData();
        task.id = 't' + Date.now();
        task.status = 'pending';
        db.tasks.push(task);
        saveData(db);
        return task;
    },
    completeTask: (taskId) => {
        const db = getData();
        const task = db.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            saveData(db);
        }
    },

    // Stats
    getStats: () => {
        const db = getData();
        const activeStaff = db.attendance ? db.attendance.filter(a => a.status === 'in').length : 0;
        const completedTasks = db.tasks ? db.tasks.filter(t => t.status === 'completed').length : 0;
        const pendingLeaves = db.leaveRequests ? db.leaveRequests.filter(l => l.status === 'pending').length : 0;
        return { activeStaff, completedTasks, totalTasks: db.tasks.length, pendingLeaves };
    },

    // Attendance
    updateAttendance: (userId, status, locationStr, coords) => {
        const db = getData();
        if (!db.attendance) db.attendance = [];
        let record = db.attendance.find(a => a.userId === userId);
        if (!record) {
            record = { userId, status, location: locationStr, lastUpdated: new Date().toISOString() };
            db.attendance.push(record);
        } else {
            record.status = status;
            record.location = locationStr;
            record.lastUpdated = new Date().toISOString();
        }
        saveData(db);
        return record;
    },
    getStaffStatus: () => {
        const db = getData();
        return db.users
            .filter(u => u.role === 'field')
            .map(u => {
                const att = db.attendance ? db.attendance.find(a => a.userId === u.id) : null;
                return { ...u, status: att ? att.status : 'out', lastLoc: att ? att.location : 'Unknown' };
            });
    },

    // Leave
    getLeaveRequests: (userId = null) => {
        const db = getData();
        let reqs = db.leaveRequests || [];
        if (userId) reqs = reqs.filter(r => r.userId === userId);

        // Enrich with user names for Admin
        return reqs.map(r => {
            const u = db.users.find(user => user.id === r.userId);
            return { ...r, userName: u ? u.name : 'Unknown' };
        });
    },
    addLeaveRequest: (req) => {
        const db = getData();
        if (!db.leaveRequests) db.leaveRequests = [];
        req.id = 'l' + Date.now();
        req.status = 'pending';
        db.leaveRequests.push(req);
        saveData(db);
    },
    updateLeaveStatus: (reqId, status) => {
        const db = getData();
        const req = db.leaveRequests.find(r => r.id === reqId);
        if (req) {
            req.status = status;
            saveData(db);
        }
    },

    // Reports
    addReport: (report) => {
        const db = getData();
        if (!db.reports) db.reports = [];
        report.id = 'r' + Date.now();
        report.timestamp = new Date().toISOString();
        db.reports.push(report);
        saveData(db);
    },
    getReports: () => {
        const db = getData();
        return db.reports || [];
    }
};
