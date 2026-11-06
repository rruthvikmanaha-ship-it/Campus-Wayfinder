// Import the functions you need from the SDKs you need
import { initializeApp } from "https://gstatic.com";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "://firebaseapp.com",
  projectId: "smart-campus",
  storageBucket: "smart-campus.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export { app };