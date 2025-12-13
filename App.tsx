
import React, { useState, useEffect } from 'react';
import { validateToken, initAuth } from './services/firebase';
import { Button, Input, Card, Select } from './components/UIComponents';
import { UserVoting } from './components/UserVoting';
import { AdminDashboard } from './components/AdminDashboard';
import { TokenData } from './types';

// --- COMPONENT: USER PAGE (Home) ---
interface UserPageProps {
  onGoToAdmin: () => void;
}

const UserPage: React.FC<UserPageProps> = ({ onGoToAdmin }) => {
  const [tokenInput, setTokenInput] = useState('');
  
  // State for Voter Data (Fetched from Token)
  const [confirmedVoter, setConfirmedVoter] = useState<TokenData | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [activeToken, setActiveToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpeningBallot, setIsOpeningBallot] = useState(false);

  // Step 1: Validate Token & Fetch Voter Data
  const handleCheckToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError("Mohon isi Token.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const sanitizedToken = tokenInput.trim().toUpperCase();
      const result = await validateToken(sanitizedToken);
      
      if (result.valid && result.data) {
        setConfirmedVoter(result.data);
        setShowConfirmation(true);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi. Coba refresh.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm Identity
  const handleConfirmIdentity = () => {
    if (confirmedVoter) {
        setShowConfirmation(false);
        setActiveToken(tokenInput.toUpperCase());
        // UX: Show Opening Ballot Animation
        setIsOpeningBallot(true);
        setTimeout(() => {
          setIsOpeningBallot(false);
        }, 2500);
    }
  };

  const handleCancelIdentity = () => {
    setShowConfirmation(false);
    setConfirmedVoter(null);
    setTokenInput('');
  };

  const handleUserLogout = () => {
    setActiveToken('');
    setTokenInput('');
    setConfirmedVoter(null);
    setShowConfirmation(false);
  };

  // --- VIEW: ANIMATION OPENING BALLOT ---
  if (isOpeningBallot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f0f0] overflow-hidden">
        <div className="envelope-container relative w-64 h-48 mt-10">
            <div className="paper absolute left-4 right-4 bg-white h-48 transition-all duration-1000 ease-out shadow-sm flex flex-col items-center justify-start pt-4 border-t-4 border-blue-600">
               <div className="w-16 h-2 bg-gray-200 mb-2 rounded"></div>
               <div className="w-24 h-2 bg-gray-200 mb-2 rounded"></div>
               <div className="w-20 h-2 bg-gray-200 mb-2 rounded"></div>
               <div className="text-[8px] text-gray-400 font-mono mt-4">RAHASIA</div>
            </div>
            <div className="absolute inset-0 bg-[#e0c097] rounded-b-lg shadow-xl z-10 border-b-2 border-[#cbb08a]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-24 z-20 overflow-hidden">
               <div className="w-0 h-0 border-l-[128px] border-l-transparent border-r-[128px] border-r-transparent border-b-[96px] border-b-[#e6cba6]"></div>
            </div>
            <div className="flap absolute top-0 left-0 right-0 h-24 z-30 origin-top transition-all duration-700 ease-in-out">
                <div className="w-0 h-0 mx-auto border-l-[128px] border-l-transparent border-r-[128px] border-r-transparent border-t-[96px] border-t-[#dcbda0] filter drop-shadow-md"></div>
            </div>
        </div>
        <div className="mt-20 text-center z-40 relative">
          <h2 className="text-xl font-bold text-gray-800 tracking-widest animate-pulse">MEMBUKA SURAT SUARA...</h2>
          <p className="text-sm text-gray-500 mt-2">Mohon tunggu sebentar</p>
        </div>
        <style>{`
          .envelope-container .flap { animation: openFlap 0.6s 0.2s forwards; }
          .envelope-container .paper { bottom: 0; z-index: 15; animation: slidePaper 1s 0.8s forwards; }
          @keyframes openFlap { 0% { transform: rotateX(0deg); z-index: 30; } 100% { transform: rotateX(180deg); z-index: 1; opacity: 0; } }
          @keyframes slidePaper { 0% { transform: translateY(0); } 100% { transform: translateY(-120px); } }
        `}</style>
      </div>
    );
  }

  // --- VIEW: VOTING ---
  if (activeToken && confirmedVoter) {
    return (
      <UserVoting 
        token={activeToken}
        voterName={confirmedVoter.voterName || 'Anonim'}
        voterBlock={confirmedVoter.voterBlock || '-'}
        onSuccess={() => { setActiveToken(''); }} 
        onLogout={handleUserLogout}
      />
    );
  }

  // --- VIEW: CONFIRMATION MODAL (INTERMEDIATE) ---
  if (showConfirmation && confirmedVoter) {
     return (
        <div className="min-h-screen bg-gray-900/50 flex items-center justify-center p-4 backdrop-blur-sm z-50">
           <Card className="w-full max-w-md animate-scale-in">
              <div className="text-center mb-6">
                 <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full mx-auto flex items-center justify-center mb-4">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                 </div>
                 <h2 className="text-xl font-bold text-gray-900">Konfirmasi Identitas</h2>
                 <p className="text-gray-500 text-sm mt-1">Apakah data di bawah ini benar Anda?</p>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 space-y-3">
                 <div className="flex justify-between border-b border-gray-200 pb-2">
                    <span className="text-gray-500 text-sm">Nama Pemilih</span>
                    <span className="font-bold text-gray-900">{confirmedVoter.voterName}</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-gray-500 text-sm">Blok Rumah</span>
                    <span className="font-bold text-gray-900">{confirmedVoter.voterBlock}</span>
                 </div>
              </div>

              <div className="space-y-3">
                 <Button onClick={handleConfirmIdentity} className="w-full py-3 text-lg">
                    Ya, Ini Saya (Lanjut)
                 </Button>
                 <Button variant="secondary" onClick={handleCancelIdentity} className="w-full">
                    Bukan, Batalkan
                 </Button>
              </div>
           </Card>
           <style>{`
             @keyframes scale-in {
                0% { transform: scale(0.9); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
             }
             .animate-scale-in { animation: scale-in 0.2s ease-out forwards; }
           `}</style>
        </div>
     );
  }

  // --- VIEW: LOGIN FORM ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      </div>
      
      {/* Tombol Admin di Pojok Kanan Atas */}
      <div className="absolute top-4 right-4 z-50">
        <button 
          onClick={onGoToAdmin}
          className="bg-white/50 backdrop-blur-sm hover:bg-white text-gray-600 px-4 py-2 rounded-full text-xs font-bold shadow-sm border border-white/60 transition-all flex items-center gap-2"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          Admin Login
        </button>
      </div>

      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight select-none cursor-default">
            E-Voting RT
          </h1>
          <p className="text-lg text-gray-700 font-medium">Sistem Pemilihan Ketua RT yang Jujur & Transparan</p>
        </div>
        <Card className="shadow-xl border-0">
          <form onSubmit={handleCheckToken} className="space-y-6">
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 flex items-start gap-3">
               <svg className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
               <div className="text-sm text-blue-800">
                  <p className="font-bold">Petunjuk:</p>
                  <p>Masukkan kode token unik yang telah diberikan panitia. Sistem akan memverifikasi nama anda otomatis.</p>
               </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Token Pemilihan</label>
              <input
                type="text"
                className="w-full px-4 py-4 text-center text-3xl font-mono tracking-widest border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all uppercase placeholder-gray-300 bg-white text-gray-900"
                placeholder="XXXXXX"
                maxLength={6}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              />
              {error && (
                <div className="mt-3 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center border border-red-100 font-medium animate-pulse">
                   <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                   {error}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full py-4 text-lg shadow-lg shadow-blue-500/30" isLoading={loading}>
              Verifikasi Token
            </Button>
          </form>
        </Card>
        <p className="text-center text-gray-500 text-xs mt-8 font-medium">
          &copy; 2024 Panitia Pemilihan RT. Gunakan hak pilih anda.
        </p>
      </div>
    </div>
  );
};

// --- COMPONENT: ADMIN PAGE ---
interface AdminPageProps {
  onBack: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser === 'admin' && adminPass === 'kamujahat') {
      setIsLoggedIn(true);
      setError(null);
    } else {
      setError("Username atau Password salah!");
    }
  };

  const handleAdminLogout = () => {
    setIsLoggedIn(false);
    setAdminUser('');
    setAdminPass('');
    onBack();
  };

  if (isLoggedIn) {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-800 text-white rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Administrator</h2>
          <p className="text-gray-500">Panel Kontrol E-Voting</p>
        </div>
        <form onSubmit={handleAdminLogin} className="space-y-6">
          <div className="space-y-4">
            <Input 
              label="Username"
              type="text" 
              placeholder="Masukkan username" 
              value={adminUser}
              onChange={(e) => setAdminUser(e.target.value)}
              autoFocus
            />
            <Input 
              label="Password"
              type="password" 
              placeholder="Masukkan password" 
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium border border-red-100">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full bg-gray-900 hover:bg-black text-white">Masuk Dashboard</Button>
          <div className="text-center pt-2">
             <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 underline">Kembali ke Halaman Utama</button>
          </div>
        </form>
      </Card>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'USER' | 'ADMIN'>('USER');

  useEffect(() => {
    const initialize = async () => {
      try {
        await initAuth();
      } catch (err: any) {
        console.error("Initialization error:", err);
        if (err.message === "AUTH_CONFIG_MISSING") {
           setInitError("SETUP_REQUIRED");
        } else {
           setInitError("Gagal terhubung ke sistem. Cek koneksi internet.");
        }
      } finally {
        setIsInitializing(false);
      }
    };
    initialize();
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Memuat Sistem...</h2>
          <p className="text-gray-500 font-medium text-lg">Mohon Tunggu</p>
        </div>
      </div>
    );
  }

  if (initError === "SETUP_REQUIRED") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="max-w-xl w-full">
          <div className="flex items-center gap-3 mb-4 text-amber-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <h2 className="text-xl font-bold">Setup Firebase Diperlukan</h2>
          </div>
          <p className="mb-4 text-gray-700">Agar aplikasi dapat berjalan, Anda perlu mengaktifkan <strong>Anonymous Authentication</strong> di Firebase Console.</p>
          <Button onClick={() => window.location.reload()} className="w-full">Refresh Halaman</Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      {currentView === 'USER' && (
        <UserPage onGoToAdmin={() => setCurrentView('ADMIN')} />
      )}
      {currentView === 'ADMIN' && (
        <AdminPage onBack={() => setCurrentView('USER')} />
      )}
    </>
  );
}

export default App;
