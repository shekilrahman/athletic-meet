import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjCYJmpqdDihdnMglhMFSgFo4qV6_yoRs",
    authDomain: "college-athletic-meet.firebaseapp.com",
    projectId: "college-athletic-meet",
    storageBucket: "college-athletic-meet.firebasestorage.app",
    messagingSenderId: "764642822317",
    appId: "1:764642822317:web:eacf86e4d93fafec179e24",
    measurementId: "G-P6PB53RX13"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
