/**
 * Prueba acceso Firestore con auth anónima (mismo flujo que la app).
 */
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';

const config = {
  apiKey: 'AIzaSyCWh3Yf-ZkvZ-ey8Rm_sXSDUA6EC02C9GU',
  authDomain: 'black-coffee-15ccc.firebaseapp.com',
  projectId: 'black-coffee-15ccc',
  storageBucket: 'black-coffee-15ccc.firebasestorage.app',
  messagingSenderId: '1091720202058',
  appId: '1:1091720202058:web:3dacbf4df3b787c34c23b3'
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

try {
  const cred = await signInAnonymously(auth);
  console.log('Auth anónima OK:', cred.user.uid.slice(0, 8) + '...');

  const testRef = doc(db, 'bca_data', 'sync_probe_test');
  await setDoc(testRef, {
    key: 'sync_probe_test',
    payload: { probe: true, at: Date.now() },
    updatedAt: Date.now(),
    deviceId: 'probe-script'
  });
  console.log('Firestore WRITE: OK');

  const snap = await getDoc(testRef);
  console.log('Firestore READ: OK', snap.exists() ? snap.data() : null);
  process.exit(0);
} catch (error) {
  console.error('Firestore BLOCKED:', error.code || error.name, error.message);
  process.exit(1);
}
