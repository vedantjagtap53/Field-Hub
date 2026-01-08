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
    leaveRequests: [],
    reports: [],
    messages: [],
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

    // 5. Leave Requests (Admin & Field needs this usually, but filter for security in rules)
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

    // 9. Messages (Last 100)
    track(db.collection('messages').orderBy('timestamp', 'desc').limit(100).onSnapshot(snap => {
        state.messages = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        notify();
    }));

    // 10. Registrations (Admin Only - but try to listen, if permission denied, it will catch error)
    // We remove the strict `if admin` check here because rules handle permissions, and sometimes `state.currentUser` isn't fully ready synchronously.
    // Better to attempt and fail gracefully, or rely on rules.
    track(db.collection('registrations').onSnapshot(snap => {
        state.registrations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        notify();
    }, err => console.log('Registrations listener ignored (permission denied or not admin)')));
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
        let authId = null;

        // 1. Create Auth User (if password provided)
        if (userData.password) {
            try {
                // Secondary App Workaround to create user without logging out Admin
                const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
                const secondaryAuth = secondaryApp.auth();
                const userCred = await secondaryAuth.createUserWithEmailAndPassword(userData.email, userData.password);
                authId = userCred.user.uid;
                await secondaryApp.delete(); // Cleanup
            } catch (e) {
                console.error("Auth creation failed:", e);
                throw new Error("Failed to create login: " + e.message);
            }
        }

        const newUser = {
            email: userData.email.toLowerCase(),
            name: userData.name,
            phone: userData.phone,
            role: userData.role || 'field', // Default to field if not specified
            active: true,
            createdAt: new Date().toISOString(),
            assignedSite: userData.assignedSite || null,
            authId: authId
        };

        // Use authId as Doc ID if available to ensure 1:1 mapping easily, otherwise auto-id
        if (authId) {
            await window.db.collection('users').doc(authId).set(newUser);
            return { id: authId, ...newUser };
        } else {
            return await window.db.collection('users').add(newUser);
        }
    },

    updateWorker: async (id, data) => {
        return await window.db.collection('users').doc(id).update(data);
    },

    updateProfile: async (data) => {
        if (!state.currentUser) throw new Error("Not logged in");
        const id = state.currentUser.id;
        await window.db.collection('users').doc(id).update(data);
        // Update local state immediately
        const u = state.users.find(u => u.id === id);
        if (u) Object.assign(u, data);
        if (state.currentUser.id === id) Object.assign(state.currentUser, data);
        notify();
    },

    deleteWorker: async (id) => {
        // Soft delete or Hard delete? User asked to "remove". Hard delete for now to be clean.
        return await window.db.collection('users').doc(id).delete();
    },

    clearAllData: async () => {
        // Helper to clear collections
        const clearCol = async (col) => {
            const snap = await window.db.collection(col).get();
            const batch = window.db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        };
        await clearCol('attendance');
        await clearCol('attendanceLogs');
        await clearCol('reports');
        // We DO NOT clear users (except maybe non-admins, but risky), projects, or sites automatically.
        // User asked: "cleare previous data of staff, reports, attendance"
        // Clearing 'staff' might mean deleting all field users? 
        // I'll stick to operational data (reports, attendance) + maybe 'inactive' staff?
        // User said "previous data of staff", implies staff records themselves.
        // I'll provide a targeted clear function.
    },

    // --- PROJECTS ---
    getProjects: () => state.projects,

    addProject: async (project) => {
        return await window.db.collection('projects').add({
            ...project,
            createdAt: new Date().toISOString()
        });
    },

    updateProject: async (id, data) => {
        return await window.db.collection('projects').doc(id).update(data);
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
    getSites: () => state.sites.filter(s => s.active !== false),
    getAllSites: () => state.sites,

    addSite: async (site) => {
        // site now includes projectId hopefully
        return await window.db.collection('sites').add({
            ...site,
            projectId: site.projectId || null, // Ensure ID is saved if passed
            active: true
        });
    },

    updateSite: async (id, data) => {
        return await window.db.collection('sites').doc(id).update(data);
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

    // --- LEAVE REQUESTS ---
    getLeaveRequests: (userId = null) => userId ? state.leaveRequests.filter(l => l.userId === userId) : state.leaveRequests,

    addLeaveRequest: async (req) => {
        return await window.db.collection('leaveRequests').add({
            ...req,
            userName: state.currentUser ? state.currentUser.name : 'Unknown',
            userAvatar: state.currentUser ? state.currentUser.avatar : null,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    },

    updateLeaveRequest: async (id, status) => {
        return await window.db.collection('leaveRequests').doc(id).update({ status });
    },

    approveLeave: async (id) => {
        return await store.updateLeaveRequest(id, 'approved');
    },

    rejectLeave: async (id) => {
        return await store.updateLeaveRequest(id, 'rejected');
    },

    getReports: () => state.reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),

    addReport: async (report) => {
        return await window.db.collection('reports').add({
            ...report,
            createdAt: new Date().toISOString()
        });
    },

    addReport: async (report) => {
        return await window.db.collection('reports').add({
            ...report,
            createdAt: new Date().toISOString()
        });
    },

    // --- MESSAGING ---
    getMessages: (counterpartId = null) => {
        if (!state.currentUser) return [];
        const myId = state.currentUser.id;

        // Broadcasts (receiverId == 'all')
        if (counterpartId === 'all') {
            return state.messages.filter(m => m.receiverId === 'all' || m.senderId === 'all');
        }

        const broadcasts = state.messages.filter(m => m.receiverId === 'all');
        if (counterpartId === 'broadcast') return broadcasts; // Legacy support check

        // 1:1 Chat
        if (counterpartId) {
            return state.messages.filter(m =>
                (m.senderId === myId && m.receiverId === counterpartId) ||
                (m.senderId === counterpartId && m.receiverId === myId)
            );
        }

        // Return all visible messages for current user
        return state.messages.filter(m =>
            m.receiverId === 'all' ||
            m.senderId === myId ||
            m.receiverId === myId
        );
    },

    sendMessage: async (receiverId, content) => {
        if (!state.currentUser) throw new Error('Not logged in');
        return await window.db.collection('messages').add({
            senderId: state.currentUser.id,
            receiverId: receiverId,
            content: content,
            timestamp: new Date().toISOString(),
            read: false,
            senderName: state.currentUser.name
        });
    },

    markAsRead: async (msgId) => {
        // Optional: implement if needed
        // return await window.db.collection('messages').doc(msgId).update({ read: true });
    },

    // --- ATTENDANCE ---
    getAttendanceLogs: (userId = null, limit = 50) => {
        let logs = state.attendanceLogs;
        if (userId) logs = logs.filter(l => l.userId === userId);
        return logs.slice(0, limit);
    },

    logAttendance: async (userId, action, siteId, location, coords = null) => {
        let distance = 0;
        let withinGeofence = false;

        let site = null;
        if (siteId) {
            site = state.sites.find(s => s.id === siteId);
        }

        if (site && coords && site.coords) {
            // Calculate distance
            const R = 6371; // km
            const dLat = (site.coords.lat - coords.latitude) * Math.PI / 180;
            const dLon = (site.coords.lng - coords.longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(coords.latitude * Math.PI / 180) * Math.cos(site.coords.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance = R * c;

            // Check geofence (radius is in meters, distance in km)
            const radiusKm = (site.radius || 200) / 1000;
            withinGeofence = distance <= radiusKm;
        }

        // Get User Name (Critical Fix)
        let userName = 'Unknown User';
        if (state.currentUser && state.currentUser.id === userId) {
            userName = state.currentUser.name;
        } else {
            const u = state.users.find(u => u.id === userId);
            if (u) userName = u.name;
        }

        const log = {
            userId,
            userName,
            action,
            siteId,
            siteName: site ? site.name : (siteId ? 'Unknown Site' : 'No Site'),
            location,
            coords: coords ? { lat: coords.latitude, lng: coords.longitude } : null,
            distance: distance || 0,
            withinGeofence: withinGeofence,
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
