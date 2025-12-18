
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
  writeBatch,
  getDocs
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { Candidate, TokenData, ElectionConfig } from "../types";

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

// --- ELECTION CONFIG SERVICES ---
export const subscribeToElectionConfig = (callback: (data: ElectionConfig | null) => void) => {
  const docRef = doc(db, "settings", "electionConfig");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as ElectionConfig);
    } else {
      callback(null);
    }
  }, (error) => {
    if (error.code === 'permission-denied') {
       callback(null);
    }
  });
};

export const updateElectionConfig = async (config: ElectionConfig) => {
  const docRef = doc(db, "settings", "electionConfig");
  await setDoc(docRef, config);
};

// --- CANDIDATE SERVICES ---
export const subscribeToCandidates = (callback: (data: Candidate[]) => void) => {
  const q = query(collection(db, "candidates"), orderBy("noUrut", "asc"));
  return onSnapshot(q, (snapshot) => {
    const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Candidate));
    callback(candidates);
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const registerVoter = async (name: string, block: string) => {
  const tokenStr = generateUniqueToken();
  const tokenRef = doc(db, "tokens", tokenStr);
  await setDoc(tokenRef, {
    id: tokenStr,
    isUsed: false,
    generatedAt: Date.now(),
    voterName: name,
    voterBlock: block
  });
};

// NEW: Batch Registration for Excel Import
export const registerVotersBatch = async (voters: { name: string, block: string }[]) => {
  const BATCH_SIZE = 500;
  for (let i = 0; i < voters.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = voters.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(voter => {
      const tokenStr = generateUniqueToken();
      const tokenRef = doc(db, "tokens", tokenStr);
      batch.set(tokenRef, {
        id: tokenStr,
        isUsed: false,
        generatedAt: Date.now(),
        voterName: voter.name,
        voterBlock: voter.block
      });
    });
    
    await batch.commit();
  }
};

export const deleteToken = async (tokenId: string) => {
  await deleteDoc(doc(db, "tokens", tokenId));
};

export const subscribeToTokens = (callback: (data: TokenData[]) => void) => {
  const q = query(collection(db, "tokens"), orderBy("generatedAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const tokens = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TokenData));
    callback(tokens);
  });
};

// --- RESET DATA SERVICE ---
export const resetElectionData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const tokensQ = query(collection(db, "tokens"));
    const tokensSnap = await getDocs(tokensQ);
    
    const candidatesQ = query(collection(db, "candidates"));
    const candidatesSnap = await getDocs(candidatesQ);

    const operations = [
      ...tokensSnap.docs.map(d => ({ type: 'delete', ref: d.ref })),
      ...candidatesSnap.docs.map(d => ({ type: 'update', ref: d.ref, data: { votes: 0 } }))
    ];

    if (operations.length === 0) return { success: true, message: "Tidak ada data." };

    const BATCH_SIZE = 500;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = operations.slice(i, i + BATCH_SIZE);
        chunk.forEach((op: any) => {
            if (op.type === 'delete') batch.delete(op.ref);
            else batch.update(op.ref, op.data);
        });
        await batch.commit();
    }
    return { success: true, message: "Berhasil direset." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

// --- VOTING LOGIC ---
export const validateToken = async (token: string): Promise<{ valid: boolean; message: string; data?: TokenData }> => {
  try {
    const tokenRef = doc(db, "tokens", token.toUpperCase());
    const tokenSnap = await getDoc(tokenRef);
    if (!tokenSnap.exists()) return { valid: false, message: "Token tidak ditemukan." };
    const data = tokenSnap.data() as TokenData;
    if (!data.voterName) return { valid: false, message: "Token tidak valid." };
    if (data.isUsed) return { valid: false, message: `Sudah digunakan oleh ${data.voterName}.` };
    return { valid: true, message: "Token valid.", data: data };
  } catch (error: any) {
    return { valid: false, message: "Kesalahan koneksi." };
  }
};

export const submitVote = async (
  token: string, 
  candidateId: string,
  voterName: string,
  voterBlock: string 
): Promise<{ success: boolean; message: string }> => {
  if (!auth.currentUser) await signInAnonymously(auth);

  const tokenRef = doc(db, "tokens", token.toUpperCase());
  const candidateRef = doc(db, "candidates", candidateId);

  try {
    await runTransaction(db, async (transaction) => {
      const tokenDoc = await transaction.get(tokenRef);
      if (!tokenDoc.exists()) throw new Error("Token tidak valid!");
      if (tokenDoc.data().isUsed) throw new Error("Token sudah digunakan!");

      const candidateDoc = await transaction.get(candidateRef);
      if (!candidateDoc.exists()) throw new Error("Kandidat tidak ditemukan!");

      transaction.update(tokenRef, { isUsed: true, usedAt: Date.now(), candidateId: candidateId });
      transaction.update(candidateRef, { votes: increment(1) });
    });
    return { success: true, message: "Suara disimpan!" };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
};
