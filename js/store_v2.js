// ========================================
// GeoOps Store - Firebase Realtime Edition
// ========================================

const state = {
    users: [],
    sites: [],
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

    // 2. Sites
    track(db.collection('sites').onSnapshot(snap => {
        state.sites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 3. Tasks
    track(db.collection('tasks').orderBy('createdAt', 'desc').onSnapshot(snap => {
        state.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 4. Leave Requests
    track(db.collection('leaveRequests').onSnapshot(snap => {
        state.leaveRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 5. Reports
    track(db.collection('reports').onSnapshot(snap => {
        state.reports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 6. Attendance Logs
    track(db.collection('attendanceLogs').orderBy('timestamp', 'desc').limit(500).onSnapshot(snap => {
        state.attendanceLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));

    // 7. Live Attendance Status
    track(db.collection('attendance').onSnapshot(snap => {
        state.attendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }));
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
        try {
            stopRealtimeListeners();
            await window.auth.signOut();
            state.currentUser = null;
            return { success: true };
        } catch (e) {
            console.error(e);
        }
    },

    getCurrentUser: () => state.currentUser,

    // --- DATA GETTERS (Synchronous access to local cache) ---
    getUsers: () => state.users,
    getAllSites: () => state.sites,
    getSites: () => state.sites.filter(s => s.active !== false),

    getTasks: (userId = null) => {
        if (userId) return state.tasks.filter(t => t.assignedTo === userId);
        return state.tasks;
    },

    getLeaveRequests: (userId = null) => {
        let reqs = state.leaveRequests;
        if (userId) reqs = reqs.filter(r => r.userId === userId);

        return reqs.map(r => {
            const u = state.users.find(user => user.id === r.userId);
            return { ...r, userName: u ? u.name : 'Unknown User' };
        }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },

    getReports: () => {
        return state.reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    getAttendanceLogs: (userId = null, limit = 50) => {
        let logs = state.attendanceLogs;
        if (userId) logs = logs.filter(l => l.userId === userId);
        return logs.slice(0, limit);
    },

    getStaffStatus: () => {
        const fieldStaff = state.users.filter(u => u.role === 'field');
        return fieldStaff.map(u => {
            const att = state.attendance.find(a => a.userId === u.id);
            return {
                ...u,
                status: att ? att.status : 'out',
                lastLoc: att ? att.location : 'Unknown'
            };
        });
    },

    getStats: () => {
        const activeStaff = state.attendance.filter(a => a.status === 'in').length;
        const completedTasks = state.tasks.filter(t => t.status === 'completed').length;
        const pendingLeaves = state.leaveRequests.filter(l => l.status === 'pending').length;
        return { activeStaff, completedTasks, totalTasks: state.tasks.length, pendingLeaves };
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
    },

    // --- WRITE ACTIONS (Asynchronous) ---

    addTask: async (task) => {
        try {
            task.createdAt = new Date().toISOString();
            task.status = 'pending';
            await window.db.collection('tasks').add(task);
            return true;
        } catch (e) {
            console.error("Add Task Error:", e);
            throw e;
        }
    },

    completeTask: async (taskId) => {
        try {
            await window.db.collection('tasks').doc(taskId).update({
                status: 'completed',
                completedAt: new Date().toISOString()
            });
        } catch (e) { console.error(e); }
    },

    addLeaveRequest: async (req) => {
        try {
            req.createdAt = new Date().toISOString();
            req.status = 'pending';
            await window.db.collection('leaveRequests').add(req);
        } catch (e) { console.error(e); }
    },

    updateLeaveStatus: async (reqId, status) => {
        try {
            await window.db.collection('leaveRequests').doc(reqId).update({ status });
        } catch (e) { console.error(e); }
    },

    addWorker: async (worker) => {
        try {
            // Create Firestore Document
            const newWorker = {
                ...worker,
                role: worker.role || 'field',
                email: worker.email.toLowerCase(), // Normalize email
                authId: null, // Placeholder for real Auth UID
                active: true,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=3b82f6&color=fff`,
                createdAt: new Date().toISOString()
            };
            delete newWorker.password;

            await window.db.collection('users').add(newWorker);
            return newWorker;
        } catch (e) {
            console.error(e);
            throw e;
        }
    },

    updateWorker: async (userId, updates) => {
        try {
            if (updates.name) {
                updates.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(updates.name)}&background=3b82f6&color=fff`;
            }
            await window.db.collection('users').doc(userId).update(updates);
        } catch (e) { console.error(e); }
    },

    toggleWorkerStatus: async (userId) => {
        try {
            const user = state.users.find(u => u.id === userId);
            if (user) {
                await window.db.collection('users').doc(userId).update({ active: !user.active });
            }
        } catch (e) { console.error(e); }
    },

    addReport: async (report) => {
        try {
            await window.db.collection('reports').add({
                ...report,
                timestamp: new Date().toISOString()
            });
        } catch (e) { console.error(e); }
    },

    addSite: async (site) => {
        try {
            await window.db.collection('sites').add({
                ...site,
                active: true,
                createdAt: new Date().toISOString()
            });
        } catch (e) { console.error(e); }
    },

    deleteSite: async (siteId) => {
        try {
            await window.db.collection('sites').doc(siteId).update({ active: false });
        } catch (e) { console.error(e); }
    },

    // --- ATTENDANCE ---

    logAttendance: async (userId, action, siteId, location, coords = null) => {
        try {
            const userName = state.users.find(u => u.id === userId)?.name || 'Unknown';
            const site = state.sites.find(s => s.id === siteId);
            const siteName = site?.name || 'Unknown';

            // Geofence Check
            let withinGeofence = false;
            let distance = 0;

            if (site && site.coords && coords) {
                distance = getDistance(coords.latitude, coords.longitude, site.coords.lat, site.coords.lng);
                // Default radius 200m if not specified
                const radius = site.radius || 200;
                withinGeofence = distance <= radius;
            }

            // 1. Add to Log History
            await window.db.collection('attendanceLogs').add({
                userId, userName, action, siteId, siteName, location,
                coords: coords ? { lat: coords.latitude, lng: coords.longitude } : null,
                distance,
                withinGeofence,
                timestamp: new Date().toISOString()
            });

            // 2. Update Current Status
            if (action === 'clock-in') {
                // Upsert status
                await window.db.collection('attendance').doc(userId).set({
                    userId, userName, status: 'in', siteId, siteName, location,
                    lastUpdate: new Date().toISOString()
                });
            } else {
                await window.db.collection('attendance').doc(userId).set({
                    userId, userName, status: 'out', siteId, siteName, location,
                    lastUpdate: new Date().toISOString()
                });
            }
        } catch (e) { console.error(e); }
    }
};

// Utilities
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

// Global Access
window.store = store;
