import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDM_J5xAq63gDY8R-5QuGTIubvymq-PfmM',
  authDomain: 'rubricas-app.firebaseapp.com',
  projectId: 'rubricas-app',
  storageBucket: 'rubricas-app.firebasestorage.app',
  messagingSenderId: '485229866078',
  appId: '1:485229866078:web:b9eae7e2a3e521f49d58cf',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
