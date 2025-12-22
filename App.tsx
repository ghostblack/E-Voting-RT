
import React, { useState, useEffect } from 'react';
import { validateToken, initAuth, subscribeToElectionConfig } from './services/firebase';
import { Button, Input, Card, Badge } from './components/UIComponents';
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

  const h = hours < 10 ? `0${hours}` : hours;
  const m = minutes < 10 ? `0${minutes}` : minutes;
  const s = seconds < 10 ? `0${seconds}` : seconds;

  return (
    <div className="flex flex-col items-center justify-center my-8">
       <div className="text-6xl sm:text-8xl font-black font-mono tracking-tighter text-slate-900 leading-none tabular-nums">
          {h}<span className="text-slate-300 animate-pulse mx-1">:</span>{m}<span className="text-slate-300 animate-pulse mx-1">:</span>{s}
       </div>
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
  const [confirmedVoter, setConfirmedVoter] = useState<TokenData | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeToken, setActiveToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpeningBallot, setIsOpeningBallot] = useState(false);

  const [electionConfig, setElectionConfig] = useState<ElectionConfig | null>(null);
  const [electionStatus, setElectionStatus] = useState<'loading' | 'active' | 'not_started' | 'ended'>('loading');

  useEffect(() => {
    const unsubscribe = subscribeToElectionConfig((config) => {
       setElectionConfig(config);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkTime = () => {
       if (!electionConfig) {
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

    checkTime(); 
    const interval = setInterval(checkTime, 1000); 
    return () => clearInterval(interval);
  }, [electionConfig]);


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

  const handleConfirmIdentity = () => {
    if (confirmedVoter) {
        setShowConfirmation(false);
        setActiveToken(tokenInput.toUpperCase());
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

  if (isOpeningBallot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white overflow-hidden">
        <div className="envelope-container relative w-64 h-48 mt-10">
            <div className="paper absolute left-4 right-4 bg-white h-48 transition-all duration-1000 ease-out shadow-sm flex flex-col items-center justify-start pt-4 border-t-4 border-blue-600">
               <div className="w-16 h-2 bg-slate-100 mb-2 rounded"></div>
               <div className="w-24 h-2 bg-slate-100 mb-2 rounded"></div>
               <div className="w-20 h-2 bg-slate-100 mb-2 rounded"></div>
               <div className="text-[8px] text-slate-400 font-mono mt-4 tracking-widest">RAHASIA</div>
            </div>
            <div className="absolute inset-0 bg-[#f3e3d3] rounded-b-lg shadow-xl z-10 border-b-2 border-[#e6d0bb]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-24 z-20 overflow-hidden">
               <div className="w-0 h-0 border-l-[128px] border-l-transparent border-r-[128px] border-r-transparent border-b-[96px] border-b-[#f9ebd9]"></div>
            </div>
            <div className="flap absolute top-0 left-0 right-0 h-24 z-30 origin-top transition-all duration-700 ease-in-out">
                <div className="w-0 h-0 mx-auto border-l-[128px] border-l-transparent border-r-[128px] border-r-transparent border-t-[96px] border-t-[#edd5bf] filter drop-shadow-md"></div>
            </div>
        </div>
        <div className="mt-20 text-center z-40 relative">
          <h2 className="text-xl font-black text-slate-800 tracking-widest animate-pulse uppercase">Membuka Surat...</h2>
          <p className="text-sm text-slate-400 font-bold mt-2">Sistem Enkripsi Digital</p>
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

  const BackgroundWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans bg-[#F4F7FB] text-slate-900">
      <div className="absolute top-4 right-4 z-40">
        <button 
          onClick={onGoToAdmin}
          className="px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 transition-all flex items-center gap-1 bg-white"
        >
          Admin Login
        </button>
      </div>
      <div className="w-full max-w-lg z-10 relative">
         {children}
      </div>
    </div>
  );

  if (electionStatus === 'not_started') {
     return (
        <BackgroundWrapper>
           <div className="flex flex-col items-center text-center">
             <div className="mb-8">
               <h2 className="text-xs font-black text-blue-600 tracking-[0.4em] uppercase mb-2">Agenda Pemilihan</h2>
               <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-none tracking-tighter uppercase">
                 E-VOTING<br/>PEMILIHAN KETUA RT
               </h1>
               <div className="mt-4"><Badge type="warning">BELUM DIMULAI</Badge></div>
             </div>
             {electionConfig && (
                <div className="w-full">
                   <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Dimulai dalam:</p>
                   <CountdownTimer targetDate={electionConfig.startTime} />
                </div>
             )}
           </div>
        </BackgroundWrapper>
     )
  }

  if (electionStatus === 'ended') {
     return (
        <BackgroundWrapper>
           <div className="flex flex-col items-center text-center">
             <div className="mb-8">
               <h2 className="text-xs font-black text-red-600 tracking-[0.4em] uppercase mb-2">Sesi Pemilihan</h2>
               <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-none tracking-tighter uppercase">
                 E-VOTING<br/>DITUTUP
               </h1>
               <div className="mt-4"><Badge type="error">PEMILIHAN SELESAI</Badge></div>
             </div>
             <p className="text-slate-500 font-bold text-center px-4">
                Proses pemungutan suara telah berakhir.
             </p>
           </div>
        </BackgroundWrapper>
     )
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="w-full max-w-md z-10">
          
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-[#1E293B] tracking-tight leading-tight uppercase">
              E-VOTING<br/><span className="text-blue-600">PEMILIHAN KETUA RT</span>
            </h1>
          </div>

          <Card className="shadow-xl border-none rounded-3xl overflow-hidden p-8 bg-white">
            {/* KOTAK PETUNJUK (DESIGN DARI IMAGE USER) */}
            <div className="bg-[#F0F7FF] p-5 rounded-xl flex gap-4 mb-8 items-start border border-[#E1EEFF]">
               <div className="mt-0.5">
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center text-blue-500 font-bold italic text-sm">i</div>
               </div>
               <div>
                  <h4 className="text-[#3661A6] font-bold text-base mb-1">Petunjuk:</h4>
                  <p className="text-[#5578B3] text-sm leading-snug">
                    Masukkan kode token unik yang telah diberikan panitia. Sistem akan memverifikasi nama anda otomatis.
                  </p>
               </div>
            </div>

            <form onSubmit={handleCheckToken} className="space-y-6">
              <div className="space-y-3">
                <label className="text-[#334155] font-bold text-base block">Token Pemilihan</label>
                <input
                  type="text"
                  className="w-full px-4 py-5 text-center text-5xl font-mono font-bold border-2 border-[#E2E8F0] rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all uppercase placeholder-slate-100 text-[#1E293B] bg-white"
                  placeholder=""
                  maxLength={6}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                />
              </div>

              {error && <div className="text-center text-red-600 font-bold text-xs uppercase">{error}</div>}
              
              <Button type="submit" className="w-full py-5 text-lg font-bold tracking-wide bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20" isLoading={loading}>
                Verifikasi Token
              </Button>
            </form>
          </Card>

          <div className="text-center mt-12">
             <button onClick={onGoToAdmin} className="text-[10px] font-black text-slate-300 hover:text-slate-600 transition-colors uppercase tracking-[0.2em]">
                Administrator Panel Access
             </button>
          </div>
        </div>

      {showConfirmation && confirmedVoter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCancelIdentity}></div>
           <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-8 text-center animate-scale-in">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Identitas Terdeteksi</h2>
              <div className="text-3xl font-black text-slate-900 mb-6">{confirmedVoter.voterName}</div>
              <div className="space-y-3">
                 <Button onClick={handleConfirmIdentity} className="w-full py-4 bg-slate-900">YA, LANJUTKAN</Button>
                 <button onClick={handleCancelIdentity} className="text-xs text-slate-400 font-bold">Bukan Saya</button>
              </div>
           </div>
        </div>
      )}
      <style>{`
        @keyframes scale-in { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
      `}</style>
    </div>
  );
};

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
    onBack();
  };

  if (isLoggedIn) return <AdminDashboard onLogout={handleAdminLogout} />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <Card className="w-full max-w-md p-10">
        <h2 className="text-3xl font-black text-center mb-10">ADMIN AUTH</h2>
        <form onSubmit={handleAdminLogin} className="space-y-6">
          <Input label="Username" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
          <Input label="Password" type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
          {error && <div className="text-red-500 text-xs font-bold text-center">{error}</div>}
          <Button type="submit" className="w-full py-4">MASUK</Button>
          <button type="button" onClick={onBack} className="w-full text-xs font-bold text-slate-400 mt-4">KEMBALI</button>
        </form>
      </Card>
    </div>
  );
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentView, setCurrentView] = useState<'USER' | 'ADMIN'>('USER');

  useEffect(() => {
    initAuth().finally(() => setIsInitializing(false));
  }, []);

  if (isInitializing) return <div className="min-h-screen flex items-center justify-center font-black">MEMUAT SISTEM...</div>;

  return currentView === 'USER' ? <UserPage onGoToAdmin={() => setCurrentView('ADMIN')} /> : <AdminPage onBack={() => setCurrentView('USER')} />;
}

export default App;
