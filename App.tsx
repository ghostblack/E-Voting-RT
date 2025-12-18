
import React, { useState, useEffect } from 'react';
import { validateToken, initAuth, subscribeToElectionConfig } from './services/firebase';
import { Button, Input, Card, Select } from './components/UIComponents';
import { UserVoting } from './components/UserVoting';
import { AdminDashboard } from './components/AdminDashboard';
import { TokenData, ElectionConfig } from './types';

// --- HELPER COMPONENT: TYPOGRAPHY COUNTDOWN ---
const CountdownTimer: React.FC<{ targetDate: number }> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState(targetDate - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(targetDate - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft < 0) return null;

  const hours = Math.floor((timeLeft / (1000 * 60 * 60)));
  const minutes = Math.floor((timeLeft / (1000 * 60)) % 60);
  const seconds = Math.floor((timeLeft / 1000) % 60);

  // Pad numbers with 0
  const h = hours < 10 ? `0${hours}` : hours;
  const m = minutes < 10 ? `0${minutes}` : minutes;
  const s = seconds < 10 ? `0${seconds}` : seconds;

  return (
    <div className="flex flex-col items-center justify-center my-8">
       {/* Angka Besar */}
       <div className="text-6xl sm:text-8xl font-black font-mono tracking-tighter text-slate-900 leading-none tabular-nums">
          {h}
          <span className="text-slate-300 animate-pulse mx-1">:</span>
          {m}
          <span className="text-slate-300 animate-pulse mx-1">:</span>
          {s}
       </div>
       
       {/* Label Bawah */}
       <div className="flex w-full justify-between px-2 mt-2 max-w-[18rem] sm:max-w-[24rem]">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest text-center w-1/3">Jam</span>
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest text-center w-1/3 pl-2">Menit</span>
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest text-center w-1/3 pl-4">Detik</span>
       </div>
    </div>
  );
};

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

  // --- ELECTION TIME STATE ---
  const [electionConfig, setElectionConfig] = useState<ElectionConfig | null>(null);
  const [electionStatus, setElectionStatus] = useState<'loading' | 'active' | 'not_started' | 'ended'>('loading');

  useEffect(() => {
    // Subscribe to time settings
    const unsubscribe = subscribeToElectionConfig((config) => {
       setElectionConfig(config);
    });
    return () => unsubscribe();
  }, []);

  // Check time interval
  useEffect(() => {
    const checkTime = () => {
       if (!electionConfig) {
          // If no config set, assume open (default behavior)
          setElectionStatus('active'); 
          return;
       }
       const now = Date.now();
       if (now < electionConfig.startTime) {
          setElectionStatus('not_started');
       } else if (now > electionConfig.endTime) {
          setElectionStatus('ended');
       } else {
          setElectionStatus('active');
       }
    };

    checkTime(); // Initial check
    const interval = setInterval(checkTime, 1000); // Re-check every second
    return () => clearInterval(interval);
  }, [electionConfig]);


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

  // --- BACKGROUND WRAPPER ---
  const BackgroundWrapper: React.FC<{children: React.ReactNode, theme?: 'default' | 'dark'}> = ({children, theme = 'default'}) => (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
      
      {/* Admin Button */}
      <div className="absolute top-4 right-4 z-40">
        <button 
          onClick={onGoToAdmin}
          className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border transition-all flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500 border-slate-700 hover:text-white' : 'text-slate-400 border-slate-200 hover:text-slate-800'}`}
        >
          Admin
        </button>
      </div>

      <div className="w-full max-w-lg z-10 relative">
         {children}
      </div>
    </div>
  );

  // --- VIEW: STATUS "NOT STARTED" (SIMPLE TYPOGRAPHY) ---
  if (electionStatus === 'not_started') {
     return (
        <BackgroundWrapper>
           <div className="flex flex-col items-center text-center">
             
             {/* Header */}
             <div className="mb-8">
               <h2 className="text-xs font-bold text-blue-600 tracking-[0.3em] uppercase mb-2">Agenda Pemilihan RT</h2>
               <h1 className="text-3xl sm:text-4xl font-black text-slate-800 leading-tight">
                 BELUM<br/>DIMULAI
               </h1>
             </div>

             {/* Timer */}
             {electionConfig && (
                <div className="w-full">
                   <p className="text-sm text-slate-500 font-medium">Kotak suara dibuka dalam:</p>
                   <CountdownTimer targetDate={electionConfig.startTime} />
                   
                   <div className="mt-8 pt-8 border-t border-slate-100 w-3/4 mx-auto">
                      <div className="text-xs text-slate-400 font-mono mb-1">JADWAL PEMBUKAAN</div>
                      <div className="text-lg font-bold text-slate-800">
                         {new Date(electionConfig.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} <span className="text-xs text-slate-500 font-normal">WIB</span>
                      </div>
                      <div className="text-sm text-slate-500">
                         {new Date(electionConfig.startTime).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                   </div>
                </div>
             )}

             <div className="mt-16 text-[10px] text-slate-300">
                Sistem E-Voting Digital
             </div>
           </div>
        </BackgroundWrapper>
     )
  }

  // --- VIEW: STATUS "ENDED" (SIMPLE TYPOGRAPHY - LIGHT MODE) ---
  if (electionStatus === 'ended') {
     return (
        <BackgroundWrapper>
           <div className="flex flex-col items-center text-center">
             
             {/* Header */}
             <div className="mb-8">
               <h2 className="text-xs font-bold text-red-600 tracking-[0.3em] uppercase mb-2">Sesi Pemilihan</h2>
               <h1 className="text-3xl sm:text-4xl font-black text-slate-800 leading-tight">
                 SUDAH<br/>DITUTUP
               </h1>
             </div>
             
             {/* Content Body */}
             <div className="w-full px-4">
               <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto leading-relaxed">
                  Terima kasih atas partisipasi Anda.<br/>
                  Proses pemungutan suara telah berakhir.
               </p>

               <div className="mt-12 w-full max-w-[200px] mx-auto border-t border-b border-slate-100 py-6">
                  <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 tracking-wide">
                     <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                     </span>
                     REKAPITULASI DATA
                  </div>
               </div>
             </div>

             <div className="mt-16 text-[10px] text-slate-300">
                Sistem E-Voting Digital
             </div>

           </div>
        </BackgroundWrapper>
     )
  }

  // --- VIEW: ACTIVE (LOGIN FORM) ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        
        {/* Background Accent */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>

        <div className="w-full max-w-md z-10">
          <div className="text-center mb-10">
            <h2 className="text-xs font-bold text-blue-600 tracking-[0.2em] uppercase mb-2">Selamat Datang</h2>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">E-VOTING RT</h1>
            <p className="text-sm text-slate-500 mt-2">Silakan masuk untuk menggunakan hak pilih.</p>
          </div>
          
          <Card className="shadow-xl shadow-blue-900/5 border-0 rounded-2xl overflow-hidden">
            <form onSubmit={handleCheckToken} className="space-y-6">
              
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Masukkan Kode Token</label>
                <input
                  type="text"
                  className="w-full px-4 py-5 text-center text-4xl font-mono font-bold tracking-[0.2em] border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-blue-500 outline-none transition-all uppercase placeholder-slate-200 text-slate-800 bg-slate-50/50"
                  placeholder="••••••"
                  maxLength={6}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                />
              </div>

              {error && (
                <div className="text-center">
                  <span className="inline-block bg-red-50 text-red-600 px-3 py-1 rounded text-xs font-bold border border-red-100 animate-pulse">
                     {error}
                  </span>
                </div>
              )}
              
              <Button type="submit" className="w-full py-4 text-base font-bold bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg transition-transform active:scale-[0.98]" isLoading={loading}>
                Verifikasi Token
              </Button>
            </form>
          </Card>

          <div className="text-center mt-8">
             <button onClick={onGoToAdmin} className="text-xs text-slate-300 hover:text-slate-500 transition-colors font-medium">
                Admin Panel Login
             </button>
          </div>
        </div>

      {/* --- CONFIRMATION MODAL OVERLAY --- */}
      {showConfirmation && confirmedVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div 
             className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity"
             onClick={handleCancelIdentity}
           ></div>
           
           <div className="relative z-10 w-full max-w-sm animate-scale-in bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-slate-50 p-6 text-center border-b border-slate-100">
                   <div className="w-16 h-16 bg-white text-blue-600 rounded-full mx-auto flex items-center justify-center font-bold text-2xl shadow-sm border border-slate-100 mb-3">
                      {confirmedVoter.voterName?.charAt(0)}
                   </div>
                   <h2 className="text-lg font-bold text-slate-800">Verifikasi Data</h2>
                </div>
                
                <div className="p-6 text-center">
                   <div className="mb-6">
                      <div className="text-xs text-slate-400 uppercase font-bold mb-1">Nama Pemilih</div>
                      <div className="text-xl font-bold text-slate-900">{confirmedVoter.voterName}</div>
                      <div className="text-sm text-slate-500 mt-1 bg-slate-100 inline-block px-2 py-0.5 rounded">{confirmedVoter.voterBlock}</div>
                   </div>

                   <div className="space-y-3">
                      <Button onClick={handleConfirmIdentity} className="w-full py-3 bg-blue-600 hover:bg-blue-700 font-bold">
                         BENAR, LANJUT
                      </Button>
                      <button onClick={handleCancelIdentity} className="w-full py-2 text-sm text-slate-400 font-medium hover:text-slate-600">
                         Bukan Saya
                      </button>
                   </div>
                </div>
           </div>
           <style>{`
             @keyframes scale-in { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
             .animate-scale-in { animation: scale-in 0.15s ease-out forwards; }
           `}</style>
        </div>
      )}

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
