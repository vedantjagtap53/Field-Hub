// ========================================
// GeoOps Store - Firebase Realtime Edition
// ========================================

const state = {
    users: [],
    projects: [],
    sites: [],
    registrations: [],
    tasks: [],
    attendance: [],
    attendanceLogs: [],
    leaveRequests: [],
    reports: [],
    currentUser: null,
    initialized: false
};

// Observers to notify app when data changes
const observers = [];
const subscribe = (fn) => observers.push(fn);
const notify = () => observers.forEach(fn => fn(state));

// Listener Unsubscribers
let unsubscribers = [];

// ========================================
// INITIALIZATION
// ========================================

async function initStore() {
    if (state.initialized) return;

    // Wait for Auth State
    return new Promise((resolve) => {
        window.auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('🔥 Firebase: User detected:', user.email);
                await loadUserProfile(user);
                startRealtimeListeners();
            } else {
                console.log('🔥 Firebase: No user signed in');
                state.currentUser = null;
                // clearData(); // Optional: clear data on logout
            }
            state.initialized = true;
            resolve();
        });
    });
}

// ... (loadUserProfile omitted for brevity, keeping original if possible or I need to include it)
// I will keep loadUserProfile as is by starting replacement AFTER it if possible.
// But I need to change `startRealtimeListeners` too.

// Let's replace from `const state` down to `startRealtimeListeners` definition.

async function loadUserProfile(firebaseUser) {
    try {
        const uid = firebaseUser.uid;
        const email = firebaseUser.email ? firebaseUser.email.toLowerCase() : '';
        let userDoc = null;
        let finalId = null;

        // Strategy A: Check if this Auth UID already 'owns' a profile (via authId field)
        // This is for workers who have already 'claimed' their admin-created profile
        let snapshot = await window.db.collection('users').where('authId', '==', uid).limit(1).get();

        if (!snapshot.empty) {
            userDoc = snapshot.docs[0];
            finalId = userDoc.id;
            console.log('✅ Found claimed profile by Auth UID');
        }

        // Strategy B: Check if Doc ID itself matches UID (Admin or Self-Registered)
        if (!userDoc) {
            let docRef = window.db.collection('users').doc(uid);
            let doc = await docRef.get();
            if (doc.exists) {
                userDoc = doc;
                finalId = doc.id;
                console.log('✅ Found profile by Document ID');
            }
        }

        // Strategy C: 'Claim' an orphan profile by Email (The "Link" Step)
        if (!userDoc && email) {
            console.log('🔍 Searching for orphan profile by email:', email);
            let emailSnap = await window.db.collection('users').where('email', '==', email).limit(1).get();

            if (!emailSnap.empty) {
                userDoc = emailSnap.docs[0];
                finalId = userDoc.id;
                console.log('🔗 Claiming orphan profile...');

                // DATA MIGRATION: Link this doc to the Auth UID
                // We do NOT change the Doc ID, we just stamp it with authId
                await window.db.collection('users').doc(finalId).update({
                    authId: uid,
                    linkedAt: new Date().toISOString()
                });
            }
        }

        // Final Decision
        if (userDoc) {
            const userData = userDoc.data();
            state.currentUser = { id: finalId, ...userData };
            console.log('✅ Profile loaded:', state.currentUser.role);
        } else {
            console.warn('⚠️ Creating new Field Staff profile.');
            const newProfile = {
                authId: uid,
                email: email,
                role: 'field',
                name: firebaseUser.displayName || 'New User',
                active: true,
                createdAt: new Date().toISOString()
            };
            await window.db.collection('users').doc(uid).set(newProfile);
            state.currentUser = { id: uid, ...newProfile };
        }

        notify();
    } catch (e) {
        console.error('Error loading profile:', e);
        state.currentUser = { id: firebaseUser.uid, name: 'Error', role: 'field' };
        notify();
    }
}

// ========================================
// REALTIME LISTENERS
// ========================================

function startRealtimeListeners() {
    stopRealtimeListeners(); // Clear any existing
    const db = window.db;

    // Helper to track unsub functions
    const track = (unsub) => unsubscribers.push(unsub);

    // 1. Users
    track(db.collection('users').onSnapshot(snap => {
        state.users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 2. Projects
    track(db.collection('projects').onSnapshot(snap => {
        state.projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 3. Sites
    track(db.collection('sites').onSnapshot(snap => {
        state.sites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 4. Tasks
    track(db.collection('tasks').orderBy('createdAt', 'desc').onSnapshot(snap => {
        state.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 5. Leave Requests
    track(db.collection('leaveRequests').onSnapshot(snap => {
        state.leaveRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 6. Reports
    track(db.collection('reports').onSnapshot(snap => {
        state.reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 7. Attendance Logs
    track(db.collection('attendanceLogs').orderBy('timestamp', 'desc').limit(500).onSnapshot(snap => {
        state.attendanceLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 8. Live Attendance Status
    track(db.collection('attendance').onSnapshot(snap => {
        state.attendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 9. Registrations (Admin Only - but we bind it anyway, Firestore rules will block if unauthorized)
    if (state.currentUser && state.currentUser.role === 'admin') {
        track(db.collection('registrations').onSnapshot(snap => {
            state.registrations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            notify();
        }, err => console.log('Registrations listener ignored (not admin)')));
    }
}

function stopRealtimeListeners() {
    unsubscribers.forEach(unsub => unsub && unsub());
    unsubscribers = [];
}

// ========================================
// ACTIONS
// ========================================

const store = {
    init: initStore,
    subscribe,

    // --- AUTH ---
    login: async (email, password) => {
        try {
            const cred = await window.auth.signInWithEmailAndPassword(email, password);
            await loadUserProfile(cred.user);
            startRealtimeListeners();
            return { success: true, user: state.currentUser };
        } catch (e) {
            console.error(e);
            return { success: false, message: e.message };
        }
    },

    logout: async () => {
        await window.auth.signOut();
        stopRealtimeListeners();
        state.currentUser = null;
        state.initialized = false;
        notify();
    },

    getCurrentUser: () => state.currentUser,

    // --- USERS ---
    getUsers: () => state.users,

    addWorker: async (userData) => {
        const newUser = {
            email: userData.email.toLowerCase(),
            name: userData.name,
            phone: userData.phone,
            role: userData.role || 'field', // Default to field if not specified
            active: true,
            createdAt: new Date().toISOString(),
            authId: null
        };
        return await window.db.collection('users').add(newUser);
    },

    updateWorker: async (id, data) => {
        return await window.db.collection('users').doc(id).update(data);
    },

    // --- PROJECTS ---
    getProjects: () => state.projects,

    addProject: async (project) => {
        return await window.db.collection('projects').add({
            ...project,
            createdAt: new Date().toISOString()
        });
    },

    deleteProject: async (id) => {
        // Warning: This does not delete sub-sites automatically in NoSQL without Cloud Functions
        return await window.db.collection('projects').doc(id).delete();
    },

    // --- REGISTRATIONS ---
    getRegistrations: () => state.registrations,

    addRegistration: async (data) => {
        return await window.db.collection('registrations').add({
            ...data,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    },

    approveRegistration: async (regId, role = 'field') => {
        const reg = state.registrations.find(r => r.id === regId);
        if (!reg) throw new Error('Registration not found');

        // Create User
        await window.db.collection('users').add({
            email: reg.email.toLowerCase(),
            name: reg.name,
            phone: reg.phone,
            role: role,
            active: true,
            createdAt: new Date().toISOString(),
            authId: null
        });

        // Delete Registration
        await window.db.collection('registrations').doc(regId).delete();
    },

    deleteRegistration: async (regId) => {
        return await window.db.collection('registrations').doc(regId).delete();
    },

    // --- SITES ---
    getSites: () => state.sites,
    getAllSites: () => state.sites,

    addSite: async (site) => {
        // site now includes projectId hopefully
        return await window.db.collection('sites').add({
            ...site,
            projectId: site.projectId || null, // Ensure ID is saved if passed
            active: true
        });
    },

    deleteSite: async (id) => {
        return await window.db.collection('sites').doc(id).update({ active: false });
    },

    // --- ACCESSORS ---
    getStaffStatus: () => state.attendance,
    getTasks: (userId = null) => userId ? state.tasks.filter(t => t.assignedTo === userId) : state.tasks,

    addTask: async (task) => {
        return await window.db.collection('tasks').add({
            ...task,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    },

    completeTask: async (id) => {
        return await window.db.collection('tasks').doc(id).update({ status: 'completed' });
    },

    getLeaveRequests: (userId = null) => userId ? state.leaveRequests.filter(l => l.userId === userId) : state.leaveRequests,

    addLeaveRequest: async (req) => {
        return await window.db.collection('leaveRequests').add({
            ...req,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    },

    updateLeaveStatus: async (id, status) => {
        return await window.db.collection('leaveRequests').doc(id).update({ status });
    },

    getReports: () => state.reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),

    addReport: async (report) => {
        return await window.db.collection('reports').add({
            ...report,
            createdAt: new Date().toISOString()
        });
    },

    // --- ATTENDANCE ---
    getAttendanceLogs: (userId = null, limit = 50) => {
        let logs = state.attendanceLogs;
        if (userId) logs = logs.filter(l => l.userId === userId);
        return logs.slice(0, limit);
    },

    logAttendance: async (userId, action, siteId, location, coords = null) => {
        const log = {
            userId,
            action,
            siteId,
            siteName: siteId ? (state.sites.find(s => s.id === siteId)?.name || 'Unknown Site') : null,
            location,
            coords: coords ? { lat: coords.latitude, lng: coords.longitude } : null,
            timestamp: new Date().toISOString()
        };
        await window.db.collection('attendanceLogs').add(log);

        // Update current status
        const status = action === 'clock-in' ? 'in' : 'out';
        await store.updateAttendance(userId, status, location, coords);
    },

    updateAttendance: async (userId, status, location, coords) => {
        let name = 'Unknown';
        const user = state.users.find(u => u.id === userId);
        if (user) name = user.name;
        else if (state.currentUser && state.currentUser.id === userId) name = state.currentUser.name;

        await window.db.collection('attendance').doc(userId).set({
            name: name,
            status,
            lastLoc: location,
            lastUpdate: new Date().toISOString(),
            coords: coords ? { lat: coords.latitude, lng: coords.longitude } : null
        });
    },

    getStats: () => {
        return {
            activeStaff: state.attendance.filter(s => s.status === 'in').length,
            completedTasks: state.tasks.filter(t => t.status === 'completed').length,
            pendingLeaves: state.leaveRequests.filter(l => l.status === 'pending').length
        };
    },

    getWorkerStatus: (userId) => {
        const entry = state.attendance.find(a => a.id === userId);
        return entry ? entry.status : 'out';
    },

    getWorkerStats: (userId) => {
        const completedTasks = state.tasks.filter(t => t.assignedTo === userId && t.status === 'completed').length;
        const pendingTasks = state.tasks.filter(t => t.assignedTo === userId && t.status !== 'completed').length;

        // Count attendance days (unique dates in logs where action = clock-in)
        const logs = state.attendanceLogs.filter(l => l.userId === userId && l.action === 'clock-in');
        const uniqueDays = new Set(logs.map(l => new Date(l.timestamp).toDateString())).size;

        return { completedTasks, pendingTasks, attendanceDays: uniqueDays };
    },

    findNearestSite: (coords) => {
        const sites = state.sites.filter(s => s.active !== false);
        if (!sites.length || !coords) return null;

        let nearest = null;
        let minDist = Infinity; // meters

        sites.forEach(site => {
            if (!site.coords) return;

            let lat, lng;
            if (Array.isArray(site.coords)) {
                lat = site.coords[0];
                lng = site.coords[1];
            } else {
                lat = site.coords.lat;
                lng = site.coords.lng;
            }

            if (!lat || !lng) return;

            // coords is [lat, lng] from app side
            const dist = getDistance(coords[0], coords[1], lat, lng);
            if (dist < minDist) {
                minDist = dist;
                nearest = { ...site, distance: dist };
            }
        });
        return nearest;
    }
};

// Utils
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

window.store = store;
