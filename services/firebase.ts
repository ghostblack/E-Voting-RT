
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  runTransaction,
  deleteDoc,
  increment
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { Candidate, TokenData } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyAt0sDHF4TptOxpg62NwmP1KfE4206LICY",
  authDomain: "pemilihan-ketua-rt-1b452.firebaseapp.com",
  projectId: "pemilihan-ketua-rt-1b452",
  storageBucket: "pemilihan-ketua-rt-1b452.firebasestorage.app",
  messagingSenderId: "610114623674",
  appId: "1:610114623674:web:2efa29a2bc50b5ccd40a83",
  measurementId: "G-PDCKXX4FKG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Authentication
export const initAuth = async () => {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
      console.log("Signed in anonymously");
    } catch (error: any) {
      console.error("Error signing in anonymously:", error);
      if (error.code === 'auth/configuration-not-found' || error.message.includes('configuration-not-found')) {
        throw new Error("AUTH_CONFIG_MISSING");
      }
      throw error;
    }
  }
};

// --- CANDIDATE SERVICES ---

export const subscribeToCandidates = (callback: (data: Candidate[]) => void) => {
  const q = query(collection(db, "candidates"), orderBy("noUrut", "asc"));
  return onSnapshot(q, (snapshot) => {
    const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate));
    callback(candidates);
  }, (error) => {
    console.error("Error subscribing to candidates:", error);
    if (error.code === 'permission-denied') {
        console.warn("Permission denied. Salin rules dari file 'firestore.rules' ke Firebase Console.");
    }
  });
};

export const addCandidate = async (candidate: Omit<Candidate, 'id' | 'votes'>) => {
  await addDoc(collection(db, "candidates"), {
    ...candidate,
    votes: 0
  });
};

export const updateCandidateData = async (id: string, data: Partial<Omit<Candidate, 'id' | 'votes'>>) => {
  const candidateRef = doc(db, "candidates", id);
  await updateDoc(candidateRef, data);
};

export const deleteCandidate = async (id: string) => {
  await deleteDoc(doc(db, "candidates", id));
};

// --- TOKEN SERVICES ---

export const generateUniqueToken = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 to avoid confusion
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const createTokens = async (amount: number) => {
  const batchProms = [];
  for (let i = 0; i < amount; i++) {
    const tokenStr = generateUniqueToken();
    const tokenRef = doc(db, "tokens", tokenStr);
    batchProms.push(setDoc(tokenRef, {
      isUsed: false,
      generatedAt: Date.now()
    }));
  }
  await Promise.all(batchProms);
};

export const subscribeToTokens = (callback: (data: TokenData[]) => void) => {
  const q = query(collection(db, "tokens"), orderBy("generatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const tokens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TokenData));
    callback(tokens);
  }, (error) => {
    console.error("Error subscribing to tokens:", error);
  });
};

// --- VOTING LOGIC ---

export const validateToken = async (token: string): Promise<{ valid: boolean; message: string }> => {
  try {
    const tokenRef = doc(db, "tokens", token.toUpperCase());
    const tokenSnap = await getDoc(tokenRef);

    if (!tokenSnap.exists()) {
      return { valid: false, message: "Token tidak ditemukan." };
    }

    const data = tokenSnap.data() as TokenData;
    if (data.isUsed) {
      return { valid: false, message: "Token sudah digunakan." };
    }

    return { valid: true, message: "Token valid." };
  } catch (error: any) {
    console.error("Error validating token:", error);
    if (error.code === 'permission-denied') {
      return { valid: false, message: "Akses ditolak. Mohon set Firebase Rules di Console." };
    }
    return { valid: false, message: "Terjadi kesalahan sistem. Cek koneksi internet." };
  }
};

export const submitVote = async (
  token: string, 
  candidateId: string, 
  voterName: string, 
  voterBlock: string
): Promise<{ success: boolean; message: string }> => {
  // SAFETY CHECK: Pastikan auth active sebelum transaksi
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      return { success: false, message: "Gagal autentikasi ke server. Coba refresh halaman." };
    }
  }

  const tokenRef = doc(db, "tokens", token.toUpperCase());
  const candidateRef = doc(db, "candidates", candidateId);

  console.log(`[VOTE START] Token: ${token}, Candidate: ${candidateId}, Voter: ${voterName}, Block: ${voterBlock}`);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Check Token
      const tokenDoc = await transaction.get(tokenRef);
      if (!tokenDoc.exists()) {
        throw new Error("Token tidak valid/ditemukan di database!");
      }
      
      const tokenData = tokenDoc.data() as TokenData;
      if (tokenData.isUsed) {
        throw new Error("Maaf, Token ini sudah digunakan!");
      }

      // 2. Check Candidate
      const candidateDoc = await transaction.get(candidateRef);
      if (!candidateDoc.exists()) {
        throw new Error("Data kandidat tidak ditemukan!");
      }

      console.log("[VOTE CHECK PASS] Updating data...");

      // 3. Update Token (Mark as used AND save voter data AND save chosen candidate)
      transaction.update(tokenRef, {
        isUsed: true,
        usedAt: Date.now(),
        voterName: voterName,
        voterBlock: voterBlock,
        candidateId: candidateId // Penting untuk analisis per blok
      });

      // 4. Update Candidate (Increment vote atomically)
      transaction.update(candidateRef, {
        votes: increment(1)
      });
    });

    console.log("[VOTE SUCCESS] Transaction committed.");
    return { success: true, message: "Suara berhasil disimpan!" };
  } catch (e: any) {
    console.error("[VOTE FAILED]", e);
    
    // Handle Permission Error specifically
    if (e.code === 'permission-denied' || (e.message && e.message.includes('permission-denied'))) {
      return { success: false, message: "PERMISSION DENIED: Cek tab 'Rules' di Firebase Console Anda." };
    }

    // Return specific error message
    return { success: false, message: e.message || "Terjadi kesalahan saat menyimpan suara." };
  }
};
