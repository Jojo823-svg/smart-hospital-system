import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBunUJK90EyL4dD_cjg84ur_hRfMTdnU8U',
  authDomain: 'clinic-connect-23f39.firebaseapp.com',
  projectId: 'clinic-connect-23f39',
  storageBucket: 'clinic-connect-23f39.firebasestorage.app',
  messagingSenderId: '465150536069',
  appId: '1:465150536069:web:dd77586e5a9fcfa258bcec',
  measurementId: 'G-3359754VYF',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
