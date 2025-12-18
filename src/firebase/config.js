import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyArH-lmQW0Qny4t3jUT_sH1oA1Ac8Y_KkI", // This key is public and safe to expose
    authDomain: "akash-portfolio-eb550.firebaseapp.com",
    databaseURL: "https://akash-portfolio-eb550-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "akash-portfolio-eb550",
    storageBucket: "akash-portfolio-eb550.appspot.com",
    messagingSenderId: "408538652640",
    appId: "1:408538652640:web:df4542859eda945d10d585"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the database instance to be used in other parts of the app
export const db = getDatabase(app);