
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
  increment,
  writeBatch, // Added
  getDocs     // Added
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

// --- TOKEN & VOTER SERVICES ---

export const generateUniqueToken = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, 1, O, 0 to avoid confusion
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// NEW: Register Voter (DPT)
export const registerVoter = async (name: string, block: string) => {
  const tokenStr = generateUniqueToken();
  const tokenRef = doc(db, "tokens", tokenStr);
  
  // Create token document predefined with voter info
  await setDoc(tokenRef, {
    id: tokenStr,
    isUsed: false,
    generatedAt: Date.now(),
    voterName: name,
    voterBlock: block
  });
};

// NEW: Delete Voter/Token
export const deleteToken = async (tokenId: string) => {
  try {
    await deleteDoc(doc(db, "tokens", tokenId));
  } catch (error: any) {
    console.error("Error deleting token:", error);
    if (error.code === 'permission-denied') {
      throw new Error("Akses ditolak. Cek Firebase Rules.");
    }
    throw error;
  }
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

// --- RESET DATA SERVICE ---
export const resetElectionData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // 1. Collect ALL operations needed
    const tokensQ = query(collection(db, "tokens"));
    const tokensSnap = await getDocs(tokensQ);
    
    const candidatesQ = query(collection(db, "candidates"));
    const candidatesSnap = await getDocs(candidatesQ);

    const operations = [
      ...tokensSnap.docs.map(d => ({ type: 'delete', ref: d.ref })),
      ...candidatesSnap.docs.map(d => ({ type: 'update', ref: d.ref, data: { votes: 0 } }))
    ];

    if (operations.length === 0) {
        return { success: true, message: "Tidak ada data untuk direset." };
    }

    // 2. Execute in chunks (Batch Limit is 500)
    const BATCH_SIZE = 500;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);
        
        chunk.forEach((op: any) => {
            if (op.type === 'delete') {
                batch.delete(op.ref);
            } else {
                // @ts-ignore
                batch.update(op.ref, op.data);
            }
        });
        
        await batch.commit();
    }

    return { success: true, message: "Data berhasil direset bersih (DPT dihapus, Suara 0)." };
  } catch (error: any) {
    console.error("Error resetting data:", error);
    if (error.code === 'permission-denied') {
        return { success: false, message: "Gagal: Izin ditolak. Mohon update Firebase Rules untuk mengizinkan DELETE." };
    }
    return { success: false, message: error.message };
  }
};

// --- VOTING LOGIC ---

// Updated to return Data if valid
export const validateToken = async (token: string): Promise<{ valid: boolean; message: string; data?: TokenData }> => {
  try {
    const tokenRef = doc(db, "tokens", token.toUpperCase());
    const tokenSnap = await getDoc(tokenRef);

    if (!tokenSnap.exists()) {
      return { valid: false, message: "Token tidak ditemukan / tidak terdaftar." };
    }

    const data = tokenSnap.data() as TokenData;
    
    // Additional security check: Ensure this token actually has voter data assigned (DPT system)
    if (!data.voterName) {
       return { valid: false, message: "Token ini rusak atau belum dikonfigurasi admin." };
    }

    if (data.isUsed) {
      return { valid: false, message: `Token ini sudah digunakan oleh ${data.voterName}.` };
    }

    return { valid: true, message: "Token valid.", data: data };
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

  console.log(`[VOTE START] Token: ${token}, Candidate: ${candidateId}`);

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

      // 3. Update Token (Mark as used & save used time & candidate selection for analysis)
      // Note: voterName and voterBlock are already in the doc from registration, but we keep/ensure them here.
      transaction.update(tokenRef, {
        isUsed: true,
        usedAt: Date.now(),
        candidateId: candidateId
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
