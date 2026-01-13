// Firebase Configuration Template
// Replace with your actual Firebase config from Firebase Console
// Get your config from: https://console.firebase.google.com/ > Project Settings > Your apps

const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456",
    measurementId: "G-XXXXXXXXXX"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize services
// const analytics = firebase.analytics(); // Uncomment if you want analytics
const db = firebase.firestore();
const auth = firebase.auth();


// Export to window for global access
window.db = db;
window.auth = auth;


// Enable offline persistence
db.enablePersistence()
    .catch((err) => {

        // Set Auth Persistence to LOCAL (Fixes reload issue)
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => console.log('Auth persistence enabled'))
            .catch((error) => console.error('Auth persistence error', error));
        if (err.code == 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.warn('The current browser does not support persistence.');
        }
    });

console.log('Firebase initialized successfully');
