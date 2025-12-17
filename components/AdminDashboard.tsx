
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList,
  PieChart, 
  Pie, 
  Legend
} from 'recharts';
import { Candidate, TokenData, ElectionConfig } from '../types';
import { 
  subscribeToCandidates, 
  subscribeToTokens, 
  registerVoter,
  addCandidate, 
  updateCandidateData,
  deleteCandidate,
  deleteToken,
  resetElectionData,
  updateElectionConfig, // Added
  subscribeToElectionConfig // Added
} from '../services/firebase';
import { Button, Input, Card, Badge, Select, Modal } from './UIComponents';

// --- CUSTOM CHART COMPONENT ---
const BarImageLabel = (props: any) => {
  const { x, y, width, index, candidates } = props;
  const candidate = candidates[index];

  return (
    <g>
      <defs>
        <clipPath id={`clip-circle-${index}`}>
           <circle cx={x + width / 2} cy={y - 25} r={20} />
        </clipPath>
      </defs>
      <line x1={x + width/2} y1={y} x2={x + width/2} y2={y-5} stroke="#cbd5e1" strokeWidth="2" />
      <image 
        x={x + width / 2 - 20} 
        y={y - 45} 
        width={40} 
        height={40} 
        href={candidate?.photoUrl || "https://via.placeholder.com/40"}
        clipPath={`url(#clip-circle-${index})`}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
  );
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'results' | 'candidates' | 'voters' | 'live_count' | 'settings'>('results');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [electionConfig, setElectionConfig] = useState<ElectionConfig | null>(null);
  
  // State untuk melacak ID kandidat yang suaranya baru saja bertambah (untuk animasi)
  const [flashingCandidates, setFlashingCandidates] = useState<Record<string, boolean>>({});
  const prevVotesRef = useRef<Record<string, number>>({});
  
  // Analisis Blok State
  const [selectedAnalysisBlock, setSelectedAnalysisBlock] = useState('Blok A');

  // Candidate Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCandidate, setFormCandidate] = useState({ 
    name: '', 
    address: 'Blok A', 
    noUrut: 0, 
    photoUrl: 'https://picsum.photos/200' 
  });
  
  // Voter Registration Form State
  const [newVoterName, setNewVoterName] = useState('');
  const [newVoterBlock, setNewVoterBlock] = useState('Blok A');
  const [isRegistering, setIsRegistering] = useState(false);

  // --- SETTINGS FORM STATE ---
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // --- MODAL STATES ---
  const [isResetting, setIsResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
  const [tokenToDelete, setTokenToDelete] = useState<TokenData | null>(null);
  const [isDeletingToken, setIsDeletingToken] = useState(false);

  // --- NEW: VOTER LIST FILTERS ---
  const [filterBlock, setFilterBlock] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    const unsubC = subscribeToCandidates(setCandidates);
    const unsubT = subscribeToTokens(setTokens);
    const unsubS = subscribeToElectionConfig((config) => {
       setElectionConfig(config);
       if (config) {
         // Convert timestamp to input datetime-local format (YYYY-MM-DDTHH:mm)
         const toLocalISO = (ts: number) => {
            const d = new Date(ts);
            const pad = (n: number) => n < 10 ? '0'+n : n;
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
         };
         setStartTimeInput(toLocalISO(config.startTime));
         setEndTimeInput(toLocalISO(config.endTime));
       }
    });

    return () => {
      unsubC();
      unsubT();
      unsubS();
    };
  }, []);

  // --- LOGIC DETEKSI PENAMBAHAN SUARA ---
  useEffect(() => {
    const newFlashes: Record<string, boolean> = {};
    let hasChange = false;

    candidates.forEach(c => {
      const prev = prevVotesRef.current[c.id];
      // Jika data sebelumnya ada (bukan inisialisasi awal) dan suara bertambah
      if (prev !== undefined && c.votes > prev) {
        newFlashes[c.id] = true;
        hasChange = true;
      }
      // Update ref untuk render berikutnya
      prevVotesRef.current[c.id] = c.votes;
    });

    if (hasChange) {
      setFlashingCandidates(prev => ({ ...prev, ...newFlashes }));
      
      // Matikan animasi setelah 2 detik
      setTimeout(() => {
        setFlashingCandidates(prev => {
           const next = { ...prev };
           Object.keys(newFlashes).forEach(key => delete next[key]);
           return next;
        });
      }, 2000);
    } else if (Object.keys(prevVotesRef.current).length === 0 && candidates.length > 0) {
      // Inisialisasi Ref pertama kali tanpa trigger animasi
      candidates.forEach(c => prevVotesRef.current[c.id] = c.votes);
    }
  }, [candidates]);

  useEffect(() => {
    if (!editingId && candidates.length > 0) {
        const maxNo = Math.max(...candidates.map(c => c.noUrut));
        setFormCandidate(prev => ({ ...prev, noUrut: maxNo + 1 }));
    } else if (!editingId && candidates.length === 0) {
        setFormCandidate(prev => ({ ...prev, noUrut: 1 }));
    }
  }, [candidates, editingId]);

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCandidate.name) return;
    
    if (editingId) {
      await updateCandidateData(editingId, {
        name: formCandidate.name,
        noUrut: formCandidate.noUrut,
        photoUrl: formCandidate.photoUrl,
        address: formCandidate.address
      });
      setEditingId(null);
    } else {
      await addCandidate({
        name: formCandidate.name,
        noUrut: formCandidate.noUrut,
        photoUrl: formCandidate.photoUrl,
        address: formCandidate.address,
        vision: '-', 
        mission: '-'
      });
    }

    setFormCandidate({ 
      name: '', 
      address: 'Blok A', 
      noUrut: candidates.length + 1, 
      photoUrl: 'https://picsum.photos/200' 
    });
  };

  const handleEditClick = (candidate: Candidate) => {
    setEditingId(candidate.id);
    setFormCandidate({
      name: candidate.name,
      address: candidate.address || 'Blok A',
      noUrut: candidate.noUrut,
      photoUrl: candidate.photoUrl
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setFormCandidate({ 
      name: '', 
      address: 'Blok A', 
      noUrut: candidates.length + 1, 
      photoUrl: 'https://picsum.photos/200' 
    });
  };

  const handleDeleteCandidate = async (id: string) => {
    if (window.confirm("Yakin ingin menghapus kandidat ini? Data suara akan hilang.")) {
      await deleteCandidate(id);
      if (editingId === id) {
        handleCancelEdit();
      }
    }
  };

  // --- SETTINGS LOGIC ---
  const handleSaveSettings = async (e: React.FormEvent) => {
     e.preventDefault();
     setSaveStatus('idle');

     if (!startTimeInput || !endTimeInput) {
        alert("Mohon isi waktu mulai dan selesai.");
        return;
     }
     
     const startTs = new Date(startTimeInput).getTime();
     const endTs = new Date(endTimeInput).getTime();

     if (endTs <= startTs) {
        alert("Waktu Selesai harus lebih besar dari Waktu Mulai.");
        return;
     }

     setIsSavingSettings(true);
     try {
        await updateElectionConfig({ startTime: startTs, endTime: endTs });
        setSaveStatus('success');
        
        // Hide success message after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
     } catch(e: any) {
        setSaveStatus('error');
        alert("Gagal menyimpan jadwal: " + e.message);
     } finally {
        setIsSavingSettings(false);
     }
  };


  // --- RESET DATA LOGIC (NOW WITH MODAL) ---
  const handleResetDataClick = () => {
    setShowResetModal(true);
  };

  const confirmResetData = async () => {
      setIsResetting(true);
      const result = await resetElectionData();
      setIsResetting(false);
      setShowResetModal(false);
      
      if (result.success) {
         console.log("Reset Success");
      } else {
         alert("Gagal mereset data: " + result.message);
      }
  };

  // --- VOTER REGISTRATION LOGIC ---
  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newVoterName) return;
    setIsRegistering(true);
    await registerVoter(newVoterName, newVoterBlock);
    setIsRegistering(false);
    setNewVoterName('');
  };

  // --- DELETE TOKEN LOGIC (NOW WITH MODAL) ---
  const handleDeleteTokenClick = (token: TokenData) => {
    setTokenToDelete(token);
  };

  const confirmDeleteToken = async () => {
    if (!tokenToDelete) return;
    setIsDeletingToken(true);
    try {
        await deleteToken(tokenToDelete.id);
        setTokenToDelete(null); // Close modal
    } catch (e: any) {
        alert("Gagal menghapus: " + e.message);
    } finally {
        setIsDeletingToken(false);
    }
  };

  // --- NEW FEATURE: EXPORT CSV ---
  const handleExportCSV = () => {
    if (tokens.length === 0) {
      alert("Belum ada data pemilih.");
      return;
    }

    // CSV Header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Pemilih,Blok,Token,Status,Waktu Memilih\n";

    // CSV Rows
    tokens.forEach(t => {
      // Escape commas in name just in case
      const cleanName = t.voterName?.replace(/,/g, " ") || "Anonim";
      const status = t.isUsed ? "Sudah Memilih" : "Belum Memilih";
      const time = t.usedAt ? new Date(t.usedAt).toLocaleString() : "-";
      csvContent += `${cleanName},${t.voterBlock},${t.id},${status},${time}\n`;
    });

    // Create Download Link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "data_pemilih_rt.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintTokens = () => {
    const unusedTokens = tokens.filter(t => !t.isUsed);
    if (unusedTokens.length === 0) {
      alert("Tidak ada token tersedia untuk dicetak.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Cetak Token Pemilih</title>
          <style>
            body { font-family: monospace; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .token-card { 
              border: 1px dashed #000; 
              padding: 15px; 
              text-align: center; 
              border-radius: 8px;
              page-break-inside: avoid;
            }
            .token-code { font-size: 24px; font-weight: bold; margin: 10px 0; letter-spacing: 2px; }
            .token-label { font-size: 10px; color: #555; }
            .voter-field { 
              margin-top: 10px; 
              text-align: left;
              font-size: 12px;
              font-weight: bold;
            }
            .voter-sub { font-size: 10px; color: #666; font-weight: normal;}
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align:center; margin-bottom: 20px;">KARTU AKSES E-VOTING RT</h1>
          <div class="grid">
            ${unusedTokens.map(t => `
              <div class="token-card">
                <div class="token-label">KODE AKSES</div>
                <div class="token-code">${t.id}</div>
                <div class="voter-field">${t.voterName || '..................'}</div>
                <div class="voter-sub">${t.voterBlock || '..................'}</div>
                <div style="font-size: 9px; margin-top: 10px; border-top: 1px dotted #ccc; pt-2">Rahasiakan token ini.</div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // --- STATISTICS CALCULATION ---
  const totalVotes = candidates.reduce((acc, curr) => acc + (curr.votes || 0), 0);
  const usedTokens = tokens.filter(t => t.isUsed).length;
  const participationRate = tokens.length > 0 ? Math.round((usedTokens / tokens.length) * 100) : 0;

  // Sorting Candidates for Leaderboard
  const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes);

  const blockData = useMemo(() => {
    const filteredTokens = tokens.filter(t => t.isUsed && t.voterBlock === selectedAnalysisBlock);
    const counts: Record<string, number> = {};
    filteredTokens.forEach(t => {
      if (t.candidateId) {
        counts[t.candidateId] = (counts[t.candidateId] || 0) + 1;
      }
    });

    const chartData = candidates.map(c => ({
      name: c.name,
      value: counts[c.id] || 0,
    })).filter(item => item.value > 0);

    return {
      totalVoters: filteredTokens.length,
      data: chartData
    };
  }, [tokens, candidates, selectedAnalysisBlock]);

  // --- NEW: FILTER LOGIC ---
  const filteredTokens = useMemo(() => {
    return tokens.filter(token => {
       // Filter by Block
       const matchBlock = filterBlock === 'ALL' || token.voterBlock === filterBlock;
       
       // Filter by Status
       let matchStatus = true;
       if (filterStatus === 'SUDAH') {
          matchStatus = token.isUsed === true;
       } else if (filterStatus === 'BELUM') {
          matchStatus = token.isUsed === false;
       }

       return matchBlock && matchStatus;
    });
  }, [tokens, filterBlock, filterStatus]);

  // --- VIEW: LIVE COUNT MODE (FULLSCREEN DASHBOARD) ---
  if (activeTab === 'live_count') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col p-6 relative overflow-hidden">
        {/* CSS FOR ANIMATION */}
        <style>{`
          @keyframes text-pop {
            0% { font-size: 32px; fill: #10B981; }
            50% { font-size: 48px; fill: #34D399; font-weight: 900; }
            100% { font-size: 32px; }
          }
          @keyframes row-flash {
            0% { background-color: rgba(16, 185, 129, 0.4); transform: scale(1.02); }
            100% { background-color: rgba(55, 65, 81, 0.5); transform: scale(1); }
          }
          .animate-row-flash {
             animation: row-flash 1.5s ease-out forwards;
             border-left: 4px solid #10B981;
          }
        `}</style>

        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4 relative z-10">
           <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 uppercase tracking-widest">
                LIVE COUNT PEMILIHAN RT
              </h1>
              <p className="text-gray-400 mt-1">Update Real-Time dari TPS</p>
           </div>
           <Button variant="outline" onClick={() => setActiveTab('results')} className="border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white">
             Keluar Mode Layar Penuh
           </Button>
        </div>

        <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
           {/* Main Chart */}
           <div className="lg:col-span-3 bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-700">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candidates} margin={{ top: 80, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      dy={20}
                      tick={{ fill: '#9CA3AF', fontSize: 14, fontWeight: 'bold' }}
                    />
                    <YAxis hide />
                    <Bar dataKey="votes" radius={[12, 12, 0, 0]} isAnimationActive={true}>
                      {candidates.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      <LabelList 
                        dataKey="votes" 
                        position="top" 
                        content={(props: any) => {
                           const { x, y, width, height, index, value } = props;
                           const c = candidates[index];
                           const isSmallBar = height < 50; 
                           const isFlashing = flashingCandidates[c.id];

                           // Posisi Foto (Floating di atas Bar)
                           const imgSize = 60;
                           const imgY = y - imgSize - 15;
                           const imgX = x + width / 2 - imgSize / 2;

                           // Posisi Teks Angka
                           const textY = isSmallBar ? y - 10 : y + 40;
                           const defaultColor = isSmallBar ? "#9CA3AF" : "#FFFFFF";
                           
                           // Animasi Text
                           const animationStyle = isFlashing 
                             ? { animation: 'text-pop 0.5s ease-out alternate infinite', fill: '#10B981' } 
                             : { fill: defaultColor };

                           return (
                             <g>
                                {/* Foto Kandidat */}
                                <defs>
                                  <clipPath id={`clip-live-${index}`}>
                                     <circle cx={imgX + imgSize/2} cy={imgY + imgSize/2} r={imgSize/2} />
                                  </clipPath>
                                </defs>
                                <image 
                                  x={imgX} 
                                  y={imgY} 
                                  width={imgSize} 
                                  height={imgSize} 
                                  href={c.photoUrl} 
                                  clipPath={`url(#clip-live-${index})`}
                                  preserveAspectRatio="xMidYMid slice"
                                />
                                
                                {isSmallBar && value === 0 && (
                                   <rect x={x} y={y} width={width} height={2} fill="#4B5563" />
                                )}

                                {/* Angka Vote dengan Animasi */}
                                <text 
                                  x={x + width/2} 
                                  y={textY} 
                                  textAnchor="middle" 
                                  dominantBaseline="middle"
                                  fontSize="32" 
                                  fontWeight="900"
                                  style={{ 
                                    ...animationStyle,
                                    textShadow: isSmallBar ? 'none' : '0px 2px 4px rgba(0,0,0,0.4)',
                                    filter: isSmallBar ? 'none' : 'drop-shadow(0px 1px 2px rgba(0,0,0,0.5))'
                                  }}
                                >
                                  {c.votes}
                                </text>
                             </g>
                           )
                        }} 
                      />
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
           </div>

           {/* Sidebar Stats */}
           <div className="space-y-6">
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                 <h3 className="text-gray-400 text-sm font-bold uppercase mb-2">Total Suara Masuk</h3>
                 <div className="text-6xl font-black text-white">{totalVotes}</div>
                 <div className="mt-2 text-green-400 text-sm font-mono">Partisipasi: {participationRate}%</div>
              </div>

              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 flex-grow overflow-hidden flex flex-col">
                 <h3 className="text-gray-400 text-sm font-bold uppercase mb-4">Klasemen Sementara</h3>
                 <div className="space-y-4 overflow-y-auto pr-2">
                    {sortedCandidates.map((c, idx) => {
                       const isFlashing = flashingCandidates[c.id];
                       return (
                         <div 
                           key={c.id} 
                           className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${isFlashing ? 'animate-row-flash bg-gray-700' : 'bg-gray-700/50'}`}
                         >
                            <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-600 text-gray-300'}`}>
                               {idx + 1}
                            </div>
                            <img src={c.photoUrl} className="w-10 h-10 rounded-full object-cover bg-gray-600" alt="" />
                            <div className="flex-grow">
                               <div className="font-bold text-white text-sm">{c.name}</div>
                               <div className="text-xs text-gray-400">{c.votes} Suara</div>
                            </div>
                            {isFlashing && (
                               <div className="text-green-400 font-bold animate-pulse">+1</div>
                            )}
                         </div>
                       );
                    })}
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // --- NORMAL DASHBOARD VIEW ---
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold">A</div>
            <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
          </div>
          <div className="flex gap-3">
             <Button variant="danger" onClick={handleResetDataClick} disabled={isResetting} className="text-sm bg-red-100 text-red-700 hover:bg-red-200 shadow-none border border-red-200">
               Reset Data Pemilihan
             </Button>
             <Button variant="secondary" onClick={onLogout} className="text-sm">Keluar</Button>
          </div>
        </div>
        
        {/* Tabs - Updated Navigation */}
        <div className="bg-white border-b overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 flex gap-6">
            <button onClick={() => setActiveTab('results')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'results' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Hasil Suara
            </button>
            <button onClick={() => setActiveTab('live_count')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap text-red-600 border-transparent hover:text-red-800 flex items-center gap-1`}>
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              Live Count (TV)
            </button>
            <button onClick={() => setActiveTab('voters')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'voters' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Daftar Pemilih (DPT)
            </button>
            <button onClick={() => setActiveTab('candidates')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'candidates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Kelola Kandidat
            </button>
            <button onClick={() => setActiveTab('settings')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Pengaturan Jadwal
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* --- TAB: RESULTS --- */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="flex flex-col items-center justify-center py-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
                <span className="text-blue-100 text-sm font-medium">Total Suara Masuk</span>
                <span className="text-4xl font-bold">{totalVotes}</span>
              </Card>
              <Card className="flex flex-col items-center justify-center py-6">
                <span className="text-gray-500 text-sm font-medium">Token Digunakan</span>
                <span className="text-4xl font-bold text-gray-800">{usedTokens} <span className="text-gray-400 text-lg font-normal">/ {tokens.length}</span></span>
              </Card>
              <Card className="flex flex-col items-center justify-center py-6">
                <span className="text-gray-500 text-sm font-medium">Partisipasi Warga</span>
                <span className="text-4xl font-bold text-purple-600">{participationRate}%</span>
              </Card>
            </div>

            {/* MAIN CHART */}
            <Card className="p-6 pt-10">
              <h3 className="text-lg font-bold text-gray-800 mb-8 pl-2 border-l-4 border-blue-500">Perolehan Suara Nasional (RT)</h3>
              <div className="h-96 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candidates} margin={{ top: 50, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      dy={10}
                      style={{ fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <YAxis hide />
                    <Tooltip 
                      cursor={{ fill: '#F3F4F6', opacity: 0.5 }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="votes" radius={[12, 12, 0, 0]} isAnimationActive={true}>
                      {candidates.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                      
                      <LabelList 
                        dataKey="votes" 
                        position="top" 
                        content={<BarImageLabel candidates={candidates} />} 
                      />
                      
                      <LabelList 
                        dataKey="votes" 
                        position="center" 
                        fill="#FFFFFF" 
                        style={{ fontSize: '24px', fontWeight: '900', textShadow: '0px 1px 3px rgba(0,0,0,0.5)' }} 
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* BLOCK ANALYSIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                 <Card className="h-full bg-indigo-50 border-indigo-100">
                    <h3 className="text-lg font-bold text-indigo-900 mb-2">Analisis Per Wilayah</h3>
                    <p className="text-sm text-indigo-700 mb-6">Lihat dominasi kandidat berdasarkan blok rumah warga.</p>
                    
                    <Select 
                      label="Pilih Blok untuk Dianalisis"
                      value={selectedAnalysisBlock}
                      onChange={(e) => setSelectedAnalysisBlock(e.target.value)}
                      options={[
                        { value: 'Blok A', label: 'Blok A' },
                        { value: 'Blok B', label: 'Blok B' },
                        { value: 'Blok C', label: 'Blok C' },
                        { value: 'Blok D', label: 'Blok D' },
                        { value: 'PHI', label: 'PHI' },
                      ]}
                      className="bg-white"
                    />

                    <div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-indigo-100">
                       <span className="text-gray-500 text-xs uppercase tracking-wide font-bold">Total Pemilih di {selectedAnalysisBlock}</span>
                       <div className="text-3xl font-bold text-indigo-600 mt-1">{blockData.totalVoters} <span className="text-base text-gray-400 font-normal">Orang</span></div>
                    </div>
                 </Card>
              </div>

              <div className="md:col-span-2">
                <Card className="h-full flex flex-col items-center justify-center p-6">
                  {blockData.data.length > 0 ? (
                    <div className="w-full h-80 flex flex-col sm:flex-row items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={blockData.data}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {blockData.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36}/>
                          </PieChart>
                        </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 py-10">
                      <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                      <p>Belum ada data suara masuk dari <strong>{selectedAnalysisBlock}</strong></p>
                    </div>
                  )}
                </Card>
              </div>
            </div>

          </div>
        )}

        {/* --- TAB: SETTINGS --- */}
        {activeTab === 'settings' && (
           <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Status Banner Realtime */}
              <div className="grid grid-cols-1">
                 {(() => {
                    if (!electionConfig) {
                        return (
                           <div className="bg-gray-100 border-l-4 border-gray-500 p-4 rounded shadow-sm">
                              <p className="font-bold text-gray-700">Status: Belum Dikonfigurasi</p>
                              <p className="text-sm text-gray-500">Silakan atur waktu mulai dan selesai di bawah.</p>
                           </div>
                        );
                    }
                    const now = Date.now();
                    if (now < electionConfig.startTime) {
                        return (
                           <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded shadow-sm flex items-center gap-3">
                              <div className="text-yellow-600 bg-yellow-100 p-2 rounded-full">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              </div>
                              <div>
                                 <p className="font-bold text-yellow-800">Status: Menunggu Waktu Mulai</p>
                                 <p className="text-sm text-yellow-700">Warga belum bisa melakukan voting.</p>
                              </div>
                           </div>
                        );
                    } else if (now > electionConfig.endTime) {
                        return (
                           <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-center gap-3">
                              <div className="text-red-600 bg-red-100 p-2 rounded-full">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                              </div>
                              <div>
                                 <p className="font-bold text-red-800">Status: Selesai / Ditutup</p>
                                 <p className="text-sm text-red-700">Voting telah ditutup. Warga tidak bisa akses.</p>
                              </div>
                           </div>
                        );
                    } else {
                        return (
                           <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm flex items-center gap-3">
                              <div className="text-green-600 bg-green-100 p-2 rounded-full animate-pulse">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                              </div>
                              <div>
                                 <p className="font-bold text-green-800">Status: SEDANG BERLANGSUNG</p>
                                 <p className="text-sm text-green-700">Voting aktif. Warga dapat memasukkan token.</p>
                              </div>
                           </div>
                        );
                    }
                 })()}
              </div>

              <Card>
                 <div className="flex items-center gap-3 mb-6 border-b pb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    </div>
                    <div>
                       <h3 className="text-lg font-bold text-gray-800">Atur Jadwal Pemilihan</h3>
                       <p className="text-sm text-gray-500">Edit form di bawah untuk mengubah waktu akses.</p>
                    </div>
                 </div>

                 {/* SUCCESS NOTIFICATION */}
                 {saveStatus === 'success' && (
                    <div className="mb-6 bg-green-100 border border-green-200 text-green-800 px-4 py-3 rounded relative animate-bounce-slight flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
                        <span className="font-bold">Jadwal Berhasil Disimpan!</span>
                    </div>
                 )}

                 <form onSubmit={handleSaveSettings} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <Input 
                          label="Waktu Mulai"
                          type="datetime-local"
                          value={startTimeInput}
                          onChange={(e) => setStartTimeInput(e.target.value)}
                          required
                          className="border-gray-300 focus:border-blue-500"
                       />
                       <Input 
                          label="Waktu Selesai"
                          type="datetime-local"
                          value={endTimeInput}
                          onChange={(e) => setEndTimeInput(e.target.value)}
                          required
                          className="border-gray-300 focus:border-blue-500"
                       />
                    </div>
                    
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800">
                        <h4 className="font-bold mb-1">Catatan:</h4>
                        <p>Anda dapat mengubah jadwal ini kapan saja. Sistem akan langsung menyesuaikan akses pengguna secara <em>real-time</em>.</p>
                    </div>

                    <div className="flex justify-end pt-4 border-t mt-4">
                       <Button type="submit" isLoading={isSavingSettings} className="px-8 shadow-lg bg-blue-600 hover:bg-blue-700">
                          {isSavingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
                       </Button>
                    </div>
                 </form>
              </Card>
           </div>
        )}

        {/* --- TAB: CANDIDATES --- */}
        {activeTab === 'candidates' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card className="sticky top-24 border-t-4 border-blue-600">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex justify-between items-center">
                   {editingId ? 'Edit Kandidat' : 'Tambah Kandidat'}
                   {editingId && (
                      <span onClick={handleCancelEdit} className="text-xs text-red-500 cursor-pointer hover:underline">Batal Edit</span>
                   )}
                </h3>
                <form onSubmit={handleSaveCandidate} className="space-y-4">
                  <Input 
                    label="Nama Kandidat" 
                    value={formCandidate.name} 
                    onChange={(e) => setFormCandidate({...formCandidate, name: e.target.value})}
                    placeholder="Contoh: Bpk. Suparman"
                    required
                  />
                  <Input 
                    label="Nomor Urut" 
                    type="number"
                    value={formCandidate.noUrut} 
                    onChange={(e) => setFormCandidate({...formCandidate, noUrut: parseInt(e.target.value)})}
                    required
                  />
                  <Select 
                    label="Alamat / Domisili"
                    value={formCandidate.address}
                    onChange={(e) => setFormCandidate({...formCandidate, address: e.target.value})}
                    options={[
                      { value: 'Blok A', label: 'Blok A' },
                      { value: 'Blok B', label: 'Blok B' },
                      { value: 'Blok C', label: 'Blok C' },
                      { value: 'Blok D', label: 'Blok D' },
                      { value: 'PHI', label: 'PHI' },
                    ]}
                  />
                  <Input 
                    label="URL Foto (Opsional)" 
                    value={formCandidate.photoUrl} 
                    onChange={(e) => setFormCandidate({...formCandidate, photoUrl: e.target.value})}
                    placeholder="https://..."
                  />
                  
                  <div className="flex gap-2 pt-2">
                    {editingId && (
                       <Button type="button" variant="secondary" onClick={handleCancelEdit} className="flex-1">Batal</Button>
                    )}
                    <Button type="submit" variant="primary" className="flex-1">
                       {editingId ? 'Update Data' : 'Simpan Kandidat'}
                    </Button>
                  </div>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
               {candidates.length === 0 && (
                 <div className="text-center py-10 text-gray-400">Belum ada kandidat. Tambahkan di sebelah kiri.</div>
               )}
               {candidates.map((candidate) => (
                 <div key={candidate.id} className={`bg-white p-4 rounded-xl shadow-sm border transition-all ${editingId === candidate.id ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50' : 'border-gray-100'} flex flex-col sm:flex-row items-center gap-4`}>
                    <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 relative">
                       <img src={candidate.photoUrl} alt={candidate.name} className="w-full h-full object-cover" />
                       {editingId === candidate.id && (
                          <div className="absolute inset-0 bg-blue-500 bg-opacity-30 flex items-center justify-center">
                             <svg className="w-6 h-6 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                          </div>
                       )}
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                       <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                         <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded">No. {candidate.noUrut}</span>
                         <h4 className="font-bold text-gray-900">{candidate.name}</h4>
                       </div>
                       <p className="text-sm text-gray-500">{candidate.address || 'Alamat tidak diset'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="text-center px-4 border-r border-gray-100 mr-2">
                          <span className="block text-2xl font-bold text-gray-800">{candidate.votes}</span>
                          <span className="text-xs text-gray-500">Suara</span>
                       </div>
                       <button onClick={() => handleEditClick(candidate)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                       </button>
                       <button onClick={() => handleDeleteCandidate(candidate.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-200">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {/* --- TAB: DAFTAR PEMILIH (DPT & TOKENS) --- */}
        {activeTab === 'voters' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
               {/* FORM REGISTRASI PEMILIH */}
               <div className="w-full md:w-1/3">
                  <Card className="sticky top-24 border-t-4 border-green-600">
                     <h3 className="text-lg font-bold text-gray-800 mb-4">Input Pemilih Tetap (DPT)</h3>
                     <p className="text-xs text-gray-500 mb-4">Sistem akan membuat token unik untuk setiap nama yang didaftarkan.</p>
                     <form onSubmit={handleRegisterVoter} className="space-y-4">
                        <Input 
                           label="Nama Lengkap Warga" 
                           placeholder="Budi Santoso"
                           value={newVoterName}
                           onChange={(e) => setNewVoterName(e.target.value)}
                           required
                        />
                        <Select 
                           label="Blok Rumah"
                           value={newVoterBlock}
                           onChange={(e) => setNewVoterBlock(e.target.value)}
                           options={[
                              { value: 'Blok A', label: 'Blok A' },
                              { value: 'Blok B', label: 'Blok B' },
                              { value: 'Blok C', label: 'Blok C' },
                              { value: 'Blok D', label: 'Blok D' },
                              { value: 'PHI', label: 'PHI' },
                           ]}
                        />
                        <Button type="submit" variant="primary" className="w-full bg-green-600 hover:bg-green-700" isLoading={isRegistering}>
                           {isRegistering ? 'Menyimpan...' : 'Simpan & Buat Token'}
                        </Button>
                     </form>
                  </Card>
               </div>

               {/* TABEL DPT */}
               <div className="w-full md:w-2/3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                     <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        Daftar Pemilih & Status
                     </h3>
                     <div className="flex gap-2 items-center self-end">
                        <Button variant="secondary" onClick={handlePrintTokens} className="text-xs h-8">
                           Cetak Token
                        </Button>
                        <Button variant="secondary" onClick={handleExportCSV} className="text-xs h-8">
                           Export CSV
                        </Button>
                     </div>
                  </div>

                  {/* FILTER BAR */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 flex flex-col sm:flex-row gap-4 items-end">
                    <div className="w-full sm:w-1/3">
                      <Select 
                        label="Filter Blok"
                        value={filterBlock}
                        onChange={(e) => setFilterBlock(e.target.value)}
                        options={[
                          { value: 'ALL', label: 'Semua Blok' },
                          { value: 'Blok A', label: 'Blok A' },
                          { value: 'Blok B', label: 'Blok B' },
                          { value: 'Blok C', label: 'Blok C' },
                          { value: 'Blok D', label: 'Blok D' },
                          { value: 'PHI', label: 'PHI' },
                        ]}
                      />
                    </div>
                    <div className="w-full sm:w-1/3">
                      <Select 
                        label="Filter Status"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        options={[
                          { value: 'ALL', label: 'Semua Status' },
                          { value: 'SUDAH', label: 'Sudah Memilih' },
                          { value: 'BELUM', label: 'Belum Memilih' },
                        ]}
                      />
                    </div>
                     <div className="w-full sm:w-1/3">
                         <Badge type="neutral">Menampilkan: {filteredTokens.length} dari {tokens.length} data</Badge>
                     </div>
                  </div>

                  <Card className="p-0 overflow-hidden">
                     <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-left text-sm relative">
                           <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10">
                              <tr>
                                 <th className="px-6 py-4 font-semibold text-gray-700">Nama Pemilih</th>
                                 <th className="px-6 py-4 font-semibold text-gray-700">Blok</th>
                                 <th className="px-6 py-4 font-semibold text-gray-700">Token</th>
                                 <th className="px-6 py-4 font-semibold text-gray-700">Status</th>
                                 <th className="px-6 py-4 text-right">Aksi</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                              {filteredTokens.length === 0 && (
                                 <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                       {tokens.length === 0 ? "Belum ada pemilih terdaftar." : "Tidak ada data yang cocok dengan filter."}
                                    </td>
                                 </tr>
                              )}
                              {filteredTokens.map((token) => (
                                 <tr key={token.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-900">
                                       {token.voterName || 'Anonim'}
                                    </td>
                                    <td className="px-6 py-3 text-gray-600">
                                       <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold border border-gray-200">{token.voterBlock}</span>
                                    </td>
                                    <td className="px-6 py-3 font-mono text-gray-500 tracking-wider">
                                       {token.id}
                                    </td>
                                    <td className="px-6 py-3">
                                       {token.isUsed ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                             Sudah Memilih
                                          </span>
                                       ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                             Belum Memilih
                                          </span>
                                       )}
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                       <button onClick={() => handleDeleteTokenClick(token)} className="text-red-400 hover:text-red-600">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </Card>
               </div>
            </div>
          </div>
        )}
        
        {/* --- MODAL CONFIRMATION RESET DATA --- */}
        <Modal
           isOpen={showResetModal}
           title="⚠️ Konfirmasi Reset Total"
           onClose={() => setShowResetModal(false)}
           onConfirm={confirmResetData}
           confirmText="YA, HAPUS SEMUA"
           cancelText="Batal"
           isProcessing={isResetting}
        >
           <div className="text-center p-2">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full mx-auto flex items-center justify-center mb-4">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Anda yakin ingin mereset pemilihan?</h4>
              <p className="text-sm text-gray-600 mb-4">
                 Tindakan ini akan <strong>MENGHAPUS SEMUA DATA PEMILIH (DPT)</strong> dan mereset skor suara kandidat menjadi 0.
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3 text-xs text-red-800 font-bold">
                 Data yang dihapus tidak dapat dikembalikan.
              </div>
           </div>
        </Modal>

        {/* --- MODAL CONFIRMATION DELETE TOKEN --- */}
        <Modal
           isOpen={!!tokenToDelete}
           title="Hapus Data Pemilih"
           onClose={() => setTokenToDelete(null)}
           onConfirm={confirmDeleteToken}
           confirmText="Hapus"
           cancelText="Batal"
           isProcessing={isDeletingToken}
        >
           {tokenToDelete && (
             <div className="text-center">
                <p className="text-gray-600 mb-2">Anda akan menghapus data pemilih:</p>
                <div className="bg-gray-100 p-3 rounded font-bold text-gray-800 mb-4">
                   {tokenToDelete.voterName} ({tokenToDelete.voterBlock})
                </div>
                <p className="text-xs text-red-500">
                   Token akses <strong>{tokenToDelete.id}</strong> tidak akan bisa digunakan lagi.
                </p>
             </div>
           )}
        </Modal>

      </main>
    </div>
  );
};
