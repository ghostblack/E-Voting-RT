
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
import { Candidate, TokenData } from '../types';
import { 
  subscribeToCandidates, 
  subscribeToTokens, 
  createTokens, 
  addCandidate, 
  updateCandidateData,
  deleteCandidate 
} from '../services/firebase';
import { Button, Input, Card, Badge, Select } from './UIComponents';

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
  const [activeTab, setActiveTab] = useState<'results' | 'candidates' | 'tokens' | 'voters' | 'live_count'>('results');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  
  // State untuk melacak ID kandidat yang suaranya baru saja bertambah (untuk animasi)
  const [flashingCandidates, setFlashingCandidates] = useState<Record<string, boolean>>({});
  const prevVotesRef = useRef<Record<string, number>>({});
  
  // Analisis Blok State
  const [selectedAnalysisBlock, setSelectedAnalysisBlock] = useState('Blok A');

  // Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCandidate, setFormCandidate] = useState({ 
    name: '', 
    address: 'Blok A', 
    noUrut: 0, 
    photoUrl: 'https://picsum.photos/200' 
  });
  
  const [tokenAmount, setTokenAmount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const unsubC = subscribeToCandidates(setCandidates);
    const unsubT = subscribeToTokens(setTokens);
    return () => {
      unsubC();
      unsubT();
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

  const handleGenerateTokens = async () => {
    setIsGenerating(true);
    await createTokens(tokenAmount);
    setIsGenerating(false);
    setTokenAmount(1);
  };

  // --- NEW FEATURE: PRINT TOKENS ---
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
          <title>Cetak Token Pemilihan</title>
          <style>
            body { font-family: monospace; padding: 20px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .token-card { 
              border: 1px dashed #000; 
              padding: 15px; 
              text-align: center; 
              border-radius: 8px;
            }
            .token-code { font-size: 24px; font-weight: bold; margin: 10px 0; letter-spacing: 2px; }
            .token-label { font-size: 10px; color: #555; }
            .voter-field { 
              margin-top: 15px; 
              border-bottom: 1px solid #000; 
              height: 20px; 
              text-align: left;
              font-size: 12px;
            }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1 style="text-align:center; margin-bottom: 20px;">TOKEN PEMILIHAN KETUA RT</h1>
          <div class="grid">
            ${unusedTokens.map(t => `
              <div class="token-card">
                <div class="token-label">KODE AKSES</div>
                <div class="token-code">${t.id}</div>
                <div class="voter-field">Nama: </div>
                <div class="voter-field">Blok: </div>
                <div style="font-size: 9px; margin-top: 10px;">Rahasiakan token ini sampai bilik suara.</div>
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

  // --- NEW FEATURE: EXPORT CSV ---
  const handleExportCSV = () => {
    const usedTokens = tokens.filter(t => t.isUsed);
    if (usedTokens.length === 0) {
      alert("Belum ada data pemilih.");
      return;
    }

    // CSV Header
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nama Pemilih,Blok,Token,Waktu Memilih\n";

    // CSV Rows
    usedTokens.forEach(t => {
      // Escape commas in name just in case
      const cleanName = t.voterName?.replace(/,/g, " ") || "Anonim";
      const time = t.usedAt ? new Date(t.usedAt).toLocaleString() : "-";
      csvContent += `${cleanName},${t.voterBlock},${t.id},${time}\n`;
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

  // --- STATISTICS CALCULATION ---
  const totalVotes = candidates.reduce((acc, curr) => acc + (curr.votes || 0), 0);
  const usedTokens = tokens.filter(t => t.isUsed).length;
  const participationRate = tokens.length > 0 ? Math.round((usedTokens / tokens.length) * 100) : 0;
  const usedTokensList = tokens.filter(t => t.isUsed);
  const unusedTokensList = tokens.filter(t => !t.isUsed);

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
          <Button variant="secondary" onClick={onLogout} className="text-sm">Keluar</Button>
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
            <button onClick={() => setActiveTab('candidates')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'candidates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Kelola Kandidat
            </button>
            <button onClick={() => setActiveTab('tokens')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'tokens' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Manajemen Token
            </button>
            <button onClick={() => setActiveTab('voters')} className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${activeTab === 'voters' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Daftar Pemilih
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
                        { value: 'Blok E', label: 'Blok E' },
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
                      { value: 'Blok E', label: 'Blok E' },
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

        {/* --- TAB: MANAJEMEN TOKEN (Generator & Unused) --- */}
        {activeTab === 'tokens' && (
          <div className="space-y-6">
            <Card className="p-6">
               <div className="flex flex-col sm:flex-row items-end gap-4">
                 <div className="w-full sm:w-auto flex-grow">
                   <Input 
                     label="Buat Token Baru (Acak)" 
                     type="number" 
                     min="1" 
                     max="100"
                     value={tokenAmount}
                     onChange={(e) => setTokenAmount(parseInt(e.target.value))} 
                   />
                 </div>
                 <Button onClick={handleGenerateTokens} disabled={isGenerating} className="w-full sm:w-auto">
                   {isGenerating ? 'Membuat...' : 'Generate Token'}
                 </Button>
               </div>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    Token Tersedia (Siap Dibagikan)
                  </h3>
                  <div className="flex gap-2">
                     <Button variant="secondary" onClick={handlePrintTokens} className="text-xs h-8">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        Cetak Token (PDF)
                     </Button>
                     <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full font-bold flex items-center">{unusedTokensList.length}</span>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-h-96 overflow-y-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-green-50 border-b border-green-100 sticky top-0">
                        <tr>
                          <th className="px-6 py-4 font-semibold text-green-800">Kode Token</th>
                          <th className="px-6 py-4 font-semibold text-green-800 text-right">Dibuat Pada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {unusedTokensList.map((token) => (
                          <tr key={token.id} className="hover:bg-green-50/50">
                             <td className="px-6 py-4 font-mono text-2xl font-bold text-gray-700 tracking-widest">
                                {token.id}
                             </td>
                             <td className="px-6 py-4 text-right text-gray-400 text-sm">
                                {new Date(token.generatedAt).toLocaleDateString()}
                             </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
            </div>
          </div>
        )}

        {/* --- TAB: DAFTAR PEMILIH (Used Tokens) --- */}
        {activeTab === 'voters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                Daftar Riwayat Pemilih
              </h3>
              <div className="flex gap-2 items-center">
                 <Button variant="secondary" onClick={handleExportCSV} className="text-xs h-8">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Export CSV
                 </Button>
                 <Badge type="neutral">Total: {usedTokensList.length} Suara</Badge>
              </div>
            </div>

            <Card className="p-0 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-blue-50 border-b border-blue-100">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-blue-900">Nama Pemilih</th>
                        <th className="px-6 py-4 font-semibold text-blue-900">Blok Rumah</th>
                        <th className="px-6 py-4 font-semibold text-blue-900">Token Digunakan</th>
                        <th className="px-6 py-4 font-semibold text-blue-900 text-right">Waktu Memilih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usedTokensList.map((token) => (
                        <tr key={token.id} className="hover:bg-blue-50/30 transition-colors">
                           <td className="px-6 py-4 font-medium text-gray-900">
                              {token.voterName || 'Anonim'}
                           </td>
                           <td className="px-6 py-4 text-gray-600">
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-bold border border-gray-200">{token.voterBlock}</span>
                           </td>
                           <td className="px-6 py-4 font-mono text-gray-500">
                              {token.id}
                           </td>
                           <td className="px-6 py-4 text-right text-gray-500">
                              {token.usedAt ? new Date(token.usedAt).toLocaleString() : '-'}
                           </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
};
