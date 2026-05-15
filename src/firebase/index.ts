
'use client';
import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, indexedDBLocalPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;
let appInstance: FirebaseApp | null = null;
let persistenceInitialized = false;

const firebaseConfig: FirebaseOptions = {
    apiKey: "AIzaSyDWH9xun1AvzZFWQOH1GqM2t1VyzRz75FE",
    authDomain: "sellquic.firebaseapp.com",
    projectId: "sellquic",
    storageBucket: "sellquic.firebasestorage.app",
    messagingSenderId: "162539089525",
    appId: "1:162539089525:web:2910cf37e678faecc7123c"
};

export function initializeFirebase() {
  if (appInstance) {
    return {
      firebaseApp: appInstance,
      auth: authInstance!,
      firestore: firestoreInstance!,
      storage: storageInstance!,
    };
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      throw new Error("Firebase initialization failed. Check environment variables.");
  }

  appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  authInstance = getAuth(appInstance);
  firestoreInstance = getFirestore(appInstance);
  storageInstance = getStorage(appInstance);

  if (!persistenceInitialized && typeof window !== 'undefined') {
    persistenceInitialized = true;
    setPersistence(authInstance, indexedDBLocalPersistence)
      .catch(() => {
        setPersistence(authInstance!, browserLocalPersistence)
          .catch(err => console.error('Failed to set persistence:', err));
      });
  }

  return {
    firebaseApp: appInstance,
    auth: authInstance,
    firestore: firestoreInstance,
    storage: storageInstance
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
