# Firebase Setup Guide - Spark Plan (FREE)

## 🎯 What You'll Setup
- ✅ Firestore Database (NoSQL, real-time)
- ✅ Authentication (Email/Password)
- ✅ Hosting (Deploy your app)
- ❌ NO Cloud Storage needed (using Firestore for photos)

---

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"**
3. Project name: `geoops-production`
4. **Disable Google Analytics** (optional, saves quota)
5. Click **"Create project"**
6. Wait for setup to complete

---

## Step 2: Enable Firestore Database

1. In left sidebar → **Build** → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll add rules later)
4. Select location: **`asia-south1` (Mumbai)** or nearest to you
5. Click **"Enable"**
6. Wait for database creation (~30 seconds)

---

## Step 3: Enable Authentication

1. In left sidebar → **Build** → **Authentication**
2. Click **"Get started"**
3. Click **"Email/Password"** tab
4. Toggle **"Email/Password"** to **ENABLED**
5. Leave "Email link" disabled
6. Click **"Save"**

---

## Step 4: Get Your Firebase Config

1. Click **⚙️ (Settings icon)** → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **Web icon** `</>`
4. App nickname: `GeoOps Web App`
5. **DO NOT** check "Firebase Hosting" yet
6. Click **"Register app"**

**COPY THIS CONFIG** (you'll need it):
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "geoops-production.firebaseapp.com",
  projectId: "geoops-production",
  storageBucket: "geoops-production.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. Click **"Continue to console"**

---

## Step 5: Create Admin User

1. Go to **Authentication** → **Users** tab
2. Click **"Add user"**
3. Enter:
   - **Email**: `admin@geoops.org`
   - **Password**: (create a strong password - remember it!)
4. Click **"Add user"**
5. **COPY THE USER UID** (looks like: `xYz123AbC...`)

---

## Step 6: Setup Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. **Replace ALL content** with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && 
             request.auth.token.role == 'super_admin';
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             request.auth.token.role in ['super_admin', 'admin', 'manager'];
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users
    match /users/{userId} {
      allow read: if isAdmin() || isOwner(userId);
      allow create: if isSuperAdmin();
      allow update: if isSuperAdmin() || (isOwner(userId) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'active']));
      allow delete: if isSuperAdmin();
    }
    
    // Sites
    match /sites/{siteId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Attendance
    match /attendance/{attendanceId} {
      allow read: if isAdmin() || isOwner(resource.data.userId);
      allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
      allow update, delete: if isAdmin();
    }
    
    // Tasks
    match /tasks/{taskId} {
      allow read: if isAdmin() || isOwner(resource.data.assignedTo);
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || 
                       (isOwner(resource.data.assignedTo) && 
                        request.resource.data.status in ['in_progress', 'completed']);
    }
    
    // Leave Requests
    match /leaveRequests/{requestId} {
      allow read: if isAdmin() || isOwner(resource.data.userId);
      allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
      allow update: if isAdmin();
      allow delete: if isSuperAdmin();
    }
    
    // Reports (with photo data stored in Firestore)
    match /reports/{reportId} {
      allow read: if isAdmin() || isOwner(resource.data.userId);
      allow create: if isAuthenticated() && isOwner(request.resource.data.userId);
      allow delete: if isAdmin();
    }
    
    // Audit Logs
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow write: if false;
    }
  }
}
```

3. Click **"Publish"**

---

## Step 7: Create Firestore Indexes

1. Go to **Firestore Database** → **Indexes** tab
2. Click **"Add index"** (do this 3 times)

**Index 1: Attendance by User**
- Collection ID: `attendance`
- Fields to index:
  - `userId` → Ascending
  - `timestamp` → Descending
- Query scope: Collection
- Click **"Create"**

**Index 2: Tasks by Assignment**
- Collection ID: `tasks`
- Fields to index:
  - `assignedTo` → Ascending
  - `status` → Ascending
  - `createdAt` → Descending
- Query scope: Collection
- Click **"Create"**

**Index 3: Leave Requests**
- Collection ID: `leaveRequests`
- Fields to index:
  - `userId` → Ascending
  - `status` → Ascending
  - `createdAt` → Descending
- Query scope: Collection
- Click **"Create"**

---

## Step 8: Enable Firebase Hosting

1. Go to **Build** → **Hosting**
2. Click **"Get started"**
3. Click **"Next"** (we'll deploy later)
4. Click **"Finish"**

---

## Step 9: Update Your App Config

1. Open `firebase-config.js` in your project
2. Replace the config with YOUR values from Step 4:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

window.db = db;
window.auth = auth;

db.enablePersistence()
  .catch((err) => {
    console.warn('Persistence error:', err.code);
  });

console.log('✅ Firebase initialized');
```

---

## Step 10: Set Super Admin Custom Claim

**You'll need Firebase CLI for this:**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize project
firebase init

# Select: Firestore, Hosting
# Use existing project: geoops-production
```

**Then run this in Firebase Console (Cloud Shell or Functions):**

```javascript
// In Firebase Console → Functions → Add this function
const admin = require('firebase-admin');
admin.initializeApp();

exports.setAdminRole = functions.https.onCall(async (data, context) => {
  await admin.auth().setCustomUserClaims('YOUR_ADMIN_UID_HERE', {
    role: 'super_admin'
  });
  return { success: true };
});
```

**OR use Firebase CLI:**
```bash
firebase functions:shell
admin.auth().setCustomUserClaims('YOUR_ADMIN_UID', { role: 'super_admin' })
```

---

## ✅ Setup Complete Checklist

- [ ] Firebase project created
- [ ] Firestore enabled (production mode)
- [ ] Authentication enabled (Email/Password)
- [ ] Firebase config copied
- [ ] Admin user created (UID saved)
- [ ] Security rules published
- [ ] 3 indexes created
- [ ] Hosting enabled
- [ ] Config file updated
- [ ] Super admin claim set

---

## 🚀 Next Steps

1. **Share with me:**
   - Your Firebase config object
   - Admin user UID

2. **I'll help you:**
   - Integrate Firebase into the app
   - Replace localStorage with Firestore
   - Deploy to Firebase Hosting

---

## 💰 Spark Plan Limits (FREE Forever)

- **Firestore**: 50K reads, 20K writes, 20K deletes per day
- **Authentication**: Unlimited users
- **Hosting**: 10GB storage, 360MB/day bandwidth
- **Photo Storage**: In Firestore (base64, ~500KB each)

**Perfect for:**
- Small to medium teams (up to 50 users)
- Development and testing
- MVP deployment

---

## 🆘 Troubleshooting

**Can't enable Firestore?**
→ Make sure billing is enabled (Spark plan is free, but needs card verification)

**Security rules error?**
→ Copy rules exactly, check for syntax errors

**Can't set custom claims?**
→ Use Firebase CLI or wait for Cloud Functions setup

---

**Ready?** Complete these steps and share your Firebase config!
