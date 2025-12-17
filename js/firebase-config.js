// Firebase Configuration Template
// Replace with your actual Firebase config from Firebase Console

const firebaseConfig = {
    apiKey: "AIzaSyBVvNNBGrLFiu5Z6F8nNFKU1YHwB09nmGw",
    authDomain: "thefieldhub.firebaseapp.com",
    projectId: "thefieldhub",
    storageBucket: "thefieldhub.firebasestorage.app",
    messagingSenderId: "29880867810",
    appId: "1:29880867810:web:c76cf00a7015c9c755f7bb",
    measurementId: "G-TW1TB9TC6T"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize services
// const analytics = firebase.analytics(); // Analytics disabled per user request
const db = firebase.firestore();
const auth = firebase.auth();


// Export to window for global access
window.db = db;
window.auth = auth;


// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.warn('The current browser does not support persistence.');
        }
    });

console.log('Firebase initialized successfully');
