
import React, { useState, useEffect } from 'react';
import { ViewState } from './types';
import { validateToken, initAuth } from './services/firebase';
import { Button, Input, Card, Select } from './components/UIComponents';
import { UserVoting } from './components/UserVoting';
import { AdminDashboard } from './components/AdminDashboard';

function App() {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  
  // Login Inputs
  const [tokenInput, setTokenInput] = useState('');
  const [voterName, setVoterName] = useState('');
  const [voterBlock, setVoterBlock] = useState('Blok A');

  const [activeToken, setActiveToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UX State: Membuka Kertas Suara
  const [isOpeningBallot, setIsOpeningBallot] = useState(false);
  
  // Admin Login State
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Initialize Firebase Auth & Check Routing
  useEffect(() => {
    const initialize = async () => {
      try {
        await initAuth();
        
        // Simple Client-Side Routing Check
        const path = window.location.pathname;
        const hash = window.location.hash;
        
        if (path === '/admin' || path.endsWith('/admin') || hash === '#admin') {
          setView(ViewState.ADMIN_LOGIN);
        }

      } catch (err: any) {
        console.error("Initialization error:", err);
        if (err.message === "AUTH_CONFIG_MISSING") {
           setError("SETUP_REQUIRED");
        } else {
           setError("Gagal terhubung ke sistem. Cek koneksi internet.");
        }
      } finally {
        setIsInitializing(false);
      }
    };
    initialize();
  }, []);

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!voterName.trim()) {
      setError("Mohon isi Nama Lengkap.");
      return;
    }
    if (!tokenInput.trim()) {
      setError("Mohon isi Token.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const sanitizedToken = tokenInput.trim().toUpperCase();
      const result = await validateToken(sanitizedToken);
      if (result.valid) {
        setActiveToken(sanitizedToken);
        
        // UX: Show Opening Ballot Animation
        setIsOpeningBallot(true);
        setTimeout(() => {
          setIsOpeningBallot(false);
          setView(ViewState.USER_VOTING);
        }, 2500); // Waktu disesuaikan dengan animasi amplop

      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi Username & Password
    if (adminUser === 'admin' && adminPass === 'kamujahat') {
      setView(ViewState.ADMIN_DASHBOARD);
      setError(null);
    } else {
      setError("Username atau Password salah!");
    }
  };

  // Fungsi Logout Admin
  const handleAdminLogout = () => {
    setAdminUser('');
    setAdminPass('');
    setView(ViewState.HOME);
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      if (url.pathname.endsWith('/admin')) {
        url.pathname = url.pathname.replace(/\/admin$/, "");
      }
      window.history.replaceState({}, document.title, url.toString());
    } catch (e) {
      console.log("Could not update URL", e);
    }
  };

  const handleUserLogout = () => {
    setView(ViewState.HOME);
    setActiveToken('');
    setTokenInput('');
    setVoterName('');
    setVoterBlock('Blok A');
  };

  // --- SECRET ACCESS HANDLER ---
  const handleSecretAccess = (e: React.MouseEvent) => {
    if (e.detail === 5) {
      setView(ViewState.ADMIN_LOGIN);
    }
  };

  // --- LOADING VIEW ---
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Selamat Datang di TPS Ketua RT</h2>
          <p className="text-gray-500 font-medium text-lg">Persiapkan Token Anda</p>
        </div>
      </div>
    );
  }
  
  // --- ANIMATION VIEW: OPENING BALLOT (ENVELOPE) ---
  if (isOpeningBallot) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f0f0] overflow-hidden">
        {/* CSS Only Envelope Animation */}
        <div className="envelope-container relative w-64 h-48 mt-10">
            {/* The Paper inside */}
            <div className="paper absolute left-4 right-4 bg-white h-48 transition-all duration-1000 ease-out shadow-sm flex flex-col items-center justify-start pt-4 border-t-4 border-blue-600">
               <div className="w-16 h-2 bg-gray-200 mb-2 rounded"></div>
               <div className="w-24 h-2 bg-gray-200 mb-2 rounded"></div>
               <div className="w-20 h-2 bg-gray-200 mb-2 rounded"></div>
               <div className="text-[8px] text-gray-400 font-mono mt-4">RAHASIA</div>
            </div>
            
            {/* Envelope Back */}
            <div className="absolute inset-0 bg-[#e0c097] rounded-b-lg shadow-xl z-10 border-b-2 border-[#cbb08a]"></div>
            
            {/* Envelope Flap (Front - Triangle) */}
            <div className="absolute bottom-0 left-0 right-0 h-24 z-20 overflow-hidden">
               <div className="w-0 h-0 
                  border-l-[128px] border-l-transparent
                  border-r-[128px] border-r-transparent
                  border-b-[96px] border-b-[#e6cba6]">
               </div>
            </div>
            
            {/* Envelope Top Flap (Animated) */}
            <div className="flap absolute top-0 left-0 right-0 h-24 z-30 origin-top transition-all duration-700 ease-in-out">
                <div className="w-0 h-0 mx-auto
                  border-l-[128px] border-l-transparent
                  border-r-[128px] border-r-transparent
                  border-t-[96px] border-t-[#dcbda0]
                  filter drop-shadow-md">
               </div>
            </div>
        </div>

        <div className="mt-20 text-center z-40 relative">
          <h2 className="text-xl font-bold text-gray-800 tracking-widest animate-pulse">MEMBUKA SURAT SUARA...</h2>
          <p className="text-sm text-gray-500 mt-2">Mohon tunggu sebentar</p>
        </div>

        <style>{`
          .envelope-container .flap {
            animation: openFlap 0.6s 0.2s forwards;
          }
          .envelope-container .paper {
            bottom: 0;
            z-index: 15;
            animation: slidePaper 1s 0.8s forwards;
          }
          @keyframes openFlap {
            0% { transform: rotateX(0deg); z-index: 30; }
            100% { transform: rotateX(180deg); z-index: 1; opacity: 0; }
          }
          @keyframes slidePaper {
            0% { transform: translateY(0); }
            100% { transform: translateY(-120px); }
          }
        `}</style>
      </div>
    );
  }

  // --- SETUP REQUIRED VIEW ---
  if (error === "SETUP_REQUIRED") {
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

  // --- RENDER VIEWS ---

  if (view === ViewState.ADMIN_DASHBOARD) {
    return <AdminDashboard onLogout={handleAdminLogout} />;
  }

  if (view === ViewState.USER_VOTING) {
    return (
      <UserVoting 
        token={activeToken}
        voterName={voterName}
        voterBlock={voterBlock}
        onSuccess={() => setView(ViewState.HOME)} 
        onLogout={handleUserLogout}
      />
    );
  }

  if (view === ViewState.ADMIN_LOGIN) {
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
               <button onClick={() => setView(ViewState.HOME)} className="text-sm text-gray-500 hover:text-gray-800 underline">Kembali ke Halaman Utama</button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // DEFAULT: HOME / TOKEN INPUT
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex flex-col items-center justify-center p-4 relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      </div>

      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-10">
          <h1 
            onClick={handleSecretAccess}
            className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight select-none cursor-default"
          >
            E-Voting RT
          </h1>
          <p className="text-lg text-gray-700 font-medium">Sistem Pemilihan Ketua RT yang Jujur & Transparan</p>
        </div>

        <Card className="shadow-xl border-0">
          <form onSubmit={handleUserLogin} className="space-y-6">
            
            <Input 
              label="Nama Lengkap" 
              placeholder="Contoh: Budi Santoso"
              value={voterName}
              onChange={(e) => setVoterName(e.target.value)}
              required
            />

            <Select 
              label="Blok Rumah"
              value={voterBlock}
              onChange={(e) => setVoterBlock(e.target.value)}
              options={[
                { value: 'Blok A', label: 'Blok A' },
                { value: 'Blok B', label: 'Blok B' },
                { value: 'Blok C', label: 'Blok C' },
                { value: 'Blok D', label: 'Blok D' },
                { value: 'Blok E', label: 'Blok E' },
              ]}
            />

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">Masukkan Token Pemilihan</label>
              <input
                type="text"
                className="w-full px-4 py-4 text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all uppercase placeholder-gray-400 bg-white text-gray-900"
                placeholder="XXXXXX"
                maxLength={6}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
              />
              {error && (
                <div className="mt-3 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center border border-red-100 font-medium">
                   <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                   {error}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full py-4 text-lg shadow-lg shadow-blue-500/30" isLoading={loading}>
              Masuk & Pilih
            </Button>
          </form>
        </Card>
        
        <p className="text-center text-gray-500 text-xs mt-8 font-medium">
          &copy; 2024 Panitia Pemilihan RT. Gunakan token anda dengan bijak.
        </p>
      </div>
    </div>
  );
}

export default App;
