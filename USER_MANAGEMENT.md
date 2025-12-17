# 👥 User Management Guide (Auto-Magic Link)

We have implemented a **Smart Link** system so you can add users easily without worrying about complex ID matching.

### How to Add a New Field Worker

#### Step 1: Create Profile in App
1. Login as Admin.
2. Go to **Staff** tab -> **Add Worker**.
3. Fill in their **Name**, **Email**, etc.
4. Click **Add**.
   - *This creates a profile data in the database.*

#### Step 2: Enable Login
1. Go to [Firebase Console](https://console.firebase.google.com/) -> **Authentication** -> **Users**.
2. Click **Add user**.
3. Enter the **SAME Email** and a temporary password.
4. Click **Add user**.

#### Step 3: Worker Logs In
1. The worker opens the app.
2. Logs in with that Email and Password.
3. 🪄 **Magic:** The app will detect their email matches the profile you created in Step 1, and automatically link them!
4. They will see their name, assigned site, and tasks immediately.

---

### Troubleshooting
- **User sees "Field Staff (Unlinked)"?**
  - This means the Email in the App Profile didn't match the Email in Firebase Authentication exactly. Check for typos!
