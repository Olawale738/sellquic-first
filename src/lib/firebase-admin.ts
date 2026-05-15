import 'server-only';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

let app: App;

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!serviceAccountJson) {
  throw new Error('The FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. The application will not function correctly.');
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
  throw new Error('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON. Please check the format.');
}

if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'sellquic.firebasestorage.app',
  });
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const authAdmin: Auth = getAuth(app);
const storage: Storage = getStorage(app);

export { db, authAdmin, storage };