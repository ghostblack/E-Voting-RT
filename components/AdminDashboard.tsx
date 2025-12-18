
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  registerVotersBatch,
  addCandidate, 
  updateCandidateData,
  deleteCandidate,
  deleteToken,
  resetElectionData,
  updateElectionConfig,
  subscribeToElectionConfig 
} from '../services/firebase';
import { Button, Input, Card, Badge, Select, Modal } from './UIComponents';

const BarImageLabel = (props: any) => {
  const { x, y, width, index, candidates } = props;
  const candidate = candidates[index];
  return (
    <g>
      <defs>
        <clipPath id={`clip-circle-${index}`}><circle cx={x + width / 2} cy={y - 25} r={20} /></clipPath>
      </defs>
      <line x1={x + width/2} y1={y} x2={x + width/2} y2={y-5} stroke="#cbd5e1" strokeWidth="2" />
      <image 
        x={x + width / 2 - 20} y={y - 45} width={40} height={40} 
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
  const [flashingCandidates, setFlashingCandidates] = useState<Record<string, boolean>>({});
  const prevVotesRef = useRef<Record<string, number>>({});
  const [selectedAnalysisBlock, setSelectedAnalysisBlock] = useState('Blok A');

  // Candidate Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCandidate, setFormCandidate] = useState({ name: '', address: 'Blok A', noUrut: 0, photoUrl: 'https://picsum.photos/200' });
  
  // Voter Registration
  const [newVoterName, setNewVoterName] = useState('');
  const [newVoterBlock, setNewVoterBlock] = useState('Blok A');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Modals
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<TokenData | null>(null);
  const [isDeletingToken, setIsDeletingToken] = useState(false);

  // Filters
  const [filterBlock, setFilterBlock] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    const unsubC = subscribeToCandidates(setCandidates);
    const unsubT = subscribeToTokens(setTokens);
    const unsubS = subscribeToElectionConfig((config) => {
       setElectionConfig(config);
       if (config) {
         const toLocalISO = (ts: number) => {
            const d = new Date(ts);
            const pad = (n: number) => n < 10 ? '0'+n : n;
            return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
         };
         setStartTimeInput(toLocalISO(config.startTime));
         setEndTimeInput(toLocalISO(config.endTime));
       }
    });
    return () => { unsubC(); unsubT(); unsubS(); };
  }, []);

  useEffect(() => {
    const newFlashes: Record<string, boolean> = {};
    let hasChange = false;
    candidates.forEach(c => {
      const prev = prevVotesRef.current[c.id];
      if (prev !== undefined && c.votes > prev) { newFlashes[c.id] = true; hasChange = true; }
      prevVotesRef.current[c.id] = c.votes;
    });
    if (hasChange) {
      setFlashingCandidates(prev => ({ ...prev, ...newFlashes }));
      setTimeout(() => setFlashingCandidates(prev => {
        const next = { ...prev };
        Object.keys(newFlashes).forEach(key => delete next[key]);
        return next;
      }), 2000);
    } else if (Object.keys(prevVotesRef.current).length === 0 && candidates.length > 0) {
      candidates.forEach(c => prevVotesRef.current[c.id] = c.votes);
    }
  }, [candidates]);

  // --- EXCEL LOGIC ---
  const handleDownloadTemplate = () => {
    const data = [
      ["Nama", "Blok"],
      ["Budi Santoso", "Blok A"],
      ["Siti Aminah", "Blok B"],
      ["Andi Wijaya", "Blok C"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DPT_Template");
    XLSX.writeFile(wb, "format_import_dpt.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setIsImporting(true);
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Mapping and Validation
        const voters = data.map(row => ({
          name: row["Nama"] || row["nama"] || row["NAME"] || row["Name"],
          block: row["Blok"] || row["blok"] || row["BLOK"] || row["Block"]
        })).filter(v => v.name && v.block);

        if (voters.length === 0) {
          alert("Format file salah atau tidak ada data yang valid.");
          return;
        }

        if (confirm(`Apakah Anda yakin ingin mengimport ${voters.length} data pemilih? Token akan digenerate otomatis.`)) {
          await registerVotersBatch(voters);
          alert(`Berhasil mengimport ${voters.length} data pemilih.`);
        }
      } catch (err) {
        alert("Gagal memproses file. Pastikan format sudah benar.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCandidate.name) return;
    if (editingId) {
      await updateCandidateData(editingId, formCandidate);
      setEditingId(null);
    } else {
      await addCandidate({ ...formCandidate, vision: '-', mission: '-' });
    }
    setFormCandidate({ name: '', address: 'Blok A', noUrut: candidates.length + 1, photoUrl: 'https://picsum.photos/200' });
  };

  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newVoterName) return;
    setIsRegistering(true);
    await registerVoter(newVoterName, newVoterBlock);
    setIsRegistering(false);
    setNewVoterName('');
  };

  const handleResetDataClick = () => setShowResetModal(true);
  const confirmResetData = async () => {
    setIsResetting(true);
    await resetElectionData();
    setIsResetting(false);
    setShowResetModal(false);
  };

  const handleDeleteTokenClick = (token: TokenData) => setTokenToDelete(token);
  const confirmDeleteToken = async () => {
    if (!tokenToDelete) return;
    setIsDeletingToken(true);
    await deleteToken(tokenToDelete.id);
    setTokenToDelete(null);
    setIsDeletingToken(false);
  };

  const handleExportCSV = () => {
    if (tokens.length === 0) return alert("Belum ada data.");
    let csv = "data:text/csv;charset=utf-8,Nama Pemilih,Blok,Token,Status,Waktu Memilih\n";
    tokens.forEach(t => {
      csv += `${t.voterName},${t.voterBlock},${t.id},${t.isUsed ? "Sudah" : "Belum"},${t.usedAt ? new Date(t.usedAt).toLocaleString() : "-"}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "data_pemilih.csv";
    link.click();
  };

  const handlePrintTokens = () => {
    const unused = tokens.filter(t => !t.isUsed);
    if (unused.length === 0) return alert("Tidak ada token tersedia.");
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>Token</title><style>body{font-family:monospace;padding:20px;}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}.card{border:1px dashed #000;padding:15px;text-align:center;border-radius:8px;}.code{font-size:24px;font-weight:bold;margin:10px 0;letter-spacing:2px;}</style></head><body><div class="grid">${unused.map(t => `<div class="card"><div>TOKEN AKSES</div><div class="code">${t.id}</div><div style="font-weight:bold">${t.voterName}</div><div>${t.voterBlock}</div></div>`).join('')}</div><script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
  };

  const totalVotes = candidates.reduce((acc, curr) => acc + (curr.votes || 0), 0);
  const usedTokens = tokens.filter(t => t.isUsed).length;
  const participationRate = tokens.length > 0 ? Math.round((usedTokens / tokens.length) * 100) : 0;
  const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes);

  const blockData = useMemo(() => {
    const filtered = tokens.filter(t => t.isUsed && t.voterBlock === selectedAnalysisBlock);
    const counts: Record<string, number> = {};
    filtered.forEach(t => { if (t.candidateId) counts[t.candidateId] = (counts[t.candidateId] || 0) + 1; });
    const data = candidates.map(c => ({ name: c.name, value: counts[c.id] || 0 })).filter(i => i.value > 0);
    return { totalVoters: filtered.length, data };
  }, [tokens, candidates, selectedAnalysisBlock]);

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => (filterBlock === 'ALL' || t.voterBlock === filterBlock) && (filterStatus === 'ALL' || (filterStatus === 'SUDAH' ? t.isUsed : !t.isUsed)));
  }, [tokens, filterBlock, filterStatus]);

  if (activeTab === 'live_count') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col p-6 overflow-hidden">
        <style>{`@keyframes text-pop {0%{font-size:32px;fill:#10B981;}50%{font-size:48px;fill:#34D399;font-weight:900;}100%{font-size:32px;}} @keyframes row-flash {0%{background-color:rgba(16,185,129,0.4);transform:scale(1.02);}100%{background-color:rgba(55,65,81,0.5);transform:scale(1);}}`}</style>
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
           <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">LIVE COUNT PEMILIHAN RT</h1>
           <Button variant="outline" onClick={() => setActiveTab('results')} className="border-gray-600 text-gray-400">Keluar Layar Penuh</Button>
        </div>
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-3 bg-gray-800 rounded-3xl p-8 border border-gray-700">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={candidates} margin={{ top: 80, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} dy={20} tick={{ fill: '#9CA3AF', fontSize: 14, fontWeight: 'bold' }} />
                    <Bar dataKey="votes" radius={[12, 12, 0, 0]}>
                      {candidates.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      <LabelList dataKey="votes" position="top" content={(props: any) => {
                           const { x, y, width, height, index, value } = props;
                           const c = candidates[index];
                           const isFlashing = flashingCandidates[c.id];
                           const imgSize = 60;
                           return (
                             <g>
                                <defs><clipPath id={`clip-live-${index}`}><circle cx={x+width/2} cy={y-imgSize/2-15} r={imgSize/2}/></clipPath></defs>
                                <image x={x+width/2-imgSize/2} y={y-imgSize-15} width={imgSize} height={imgSize} href={c.photoUrl} clipPath={`url(#clip-live-${index})`} preserveAspectRatio="xMidYMid slice"/>
                                <text x={x+width/2} y={height < 50 ? y-10 : y+40} textAnchor="middle" fontSize="32" fontWeight="900" style={isFlashing ? {animation:'text-pop 0.5s infinite', fill:'#10B981'} : {fill:'#FFFFFF'}}>{value}</text>
                             </g>
                           )
                        }} />
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
           </div>
           <div className="space-y-6">
              <Card className="bg-gray-800 border-gray-700 text-white"><h3 className="text-sm font-bold uppercase mb-2">Total Suara</h3><div className="text-6xl font-black">{totalVotes}</div></Card>
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 flex-grow overflow-y-auto space-y-4">
                 {sortedCandidates.map((c, idx) => (
                   <div key={c.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${flashingCandidates[c.id] ? 'bg-gray-700 border-l-4 border-green-500' : 'bg-gray-700/50'}`}>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-600 font-bold text-sm">{idx+1}</div>
                      <img src={c.photoUrl} className="w-10 h-10 rounded-full object-cover bg-gray-600" />
                      <div className="flex-grow"><div className="font-bold text-sm">{c.name}</div><div className="text-xs text-gray-400">{c.votes} Suara</div></div>
                      {flashingCandidates[c.id] && <div className="text-green-400 font-bold">+1</div>}
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2"><div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold">A</div><h1 className="text-xl font-bold">Admin Panel</h1></div>
          <div className="flex gap-3"><Button variant="danger" onClick={handleResetDataClick} disabled={isResetting} className="text-sm bg-red-50 text-red-700 shadow-none">Reset Pemilihan</Button><Button variant="secondary" onClick={onLogout} className="text-sm">Keluar</Button></div>
        </div>
        <div className="bg-white border-b overflow-x-auto"><div className="max-w-7xl mx-auto px-4 flex gap-6">
            {['results', 'voters', 'candidates', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-3 px-1 font-medium text-sm border-b-2 capitalize transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{tab === 'results' ? 'Hasil' : tab === 'voters' ? 'DPT' : tab === 'candidates' ? 'Kandidat' : 'Jadwal'}</button>
            ))}
            <button onClick={() => setActiveTab('live_count')} className="py-3 px-1 font-medium text-sm text-red-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>Live Count</button>
        </div></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="flex flex-col items-center py-6 bg-blue-600 text-white border-none"><span className="text-sm opacity-80">Total Suara</span><span className="text-4xl font-bold">{totalVotes}</span></Card>
              <Card className="flex flex-col items-center py-6"><span>Token Terpakai</span><span className="text-4xl font-bold">{usedTokens} / {tokens.length}</span></Card>
              <Card className="flex flex-col items-center py-6"><span>Partisipasi</span><span className="text-4xl font-bold text-purple-600">{participationRate}%</span></Card>
            </div>
            <Card className="p-6 pt-10 h-96"><h3 className="font-bold mb-4 border-l-4 border-blue-500 pl-2">Grafik Perolehan Suara</h3>
              <ResponsiveContainer width="100%" height="100%"><BarChart data={candidates}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis hide/><Tooltip/><Bar dataKey="votes" radius={[12, 12, 0, 0]}>{candidates.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}<LabelList dataKey="votes" position="top" content={<BarImageLabel candidates={candidates}/>}/><LabelList dataKey="votes" position="center" fill="#FFF" style={{fontSize:24,fontWeight:900}}/></Bar></BarChart></ResponsiveContainer>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-indigo-50 border-indigo-100"><h3 className="font-bold mb-4">Analisis Per Wilayah</h3><Select value={selectedAnalysisBlock} onChange={e=>setSelectedAnalysisBlock(e.target.value)} options={[{value:'Blok A',label:'Blok A'},{value:'Blok B',label:'Blok B'},{value:'Blok C',label:'Blok C'},{value:'Blok D',label:'Blok D'},{value:'PHI',label:'PHI'}]}/><div className="mt-6 p-4 bg-white rounded-lg shadow-sm border border-indigo-100"><span>Pemilih di {selectedAnalysisBlock}</span><div className="text-3xl font-bold text-indigo-600">{blockData.totalVoters} Orang</div></div></Card>
              <Card className="md:col-span-2 flex items-center justify-center">{blockData.data.length > 0 ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={blockData.data} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name,percent})=>`${name} (${(percent*100).toFixed(0)}%)`}>{blockData.data.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer> : <p className="text-gray-400">Belum ada suara masuk dari {selectedAnalysisBlock}</p>}</Card>
            </div>
          </div>
        )}

        {activeTab === 'voters' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
               <div className="w-full md:w-1/3 space-y-4">
                  <Card className="border-t-4 border-green-600">
                     <h3 className="font-bold mb-4">Pendaftaran Manual</h3>
                     <form onSubmit={handleRegisterVoter} className="space-y-4"><Input label="Nama Lengkap" value={newVoterName} onChange={e=>setNewVoterName(e.target.value)} required/><Select label="Blok Rumah" value={newVoterBlock} onChange={e=>setNewVoterBlock(e.target.value)} options={[{value:'Blok A',label:'Blok A'},{value:'Blok B',label:'Blok B'},{value:'Blok C',label:'Blok C'},{value:'Blok D',label:'Blok D'},{value:'PHI',label:'PHI'}]}/><Button type="submit" className="w-full bg-green-600" isLoading={isRegistering}>Daftar Manual</Button></form>
                  </Card>
                  
                  {/* EXCEL IMPORT CARD */}
                  <Card className="border-t-4 border-blue-600 bg-blue-50/50">
                     <h3 className="font-bold mb-2">Pendaftaran Masal (Excel)</h3>
                     <p className="text-xs text-gray-500 mb-4">Upload ribuan data warga sekaligus dengan format Excel.</p>
                     <div className="space-y-3">
                        <Button onClick={handleDownloadTemplate} variant="outline" className="w-full text-xs py-2 bg-white">1. Unduh Format Excel</Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                        <Button onClick={() => fileInputRef.current?.click()} isLoading={isImporting} className="w-full bg-blue-600">2. Import & Generate Token</Button>
                     </div>
                  </Card>
               </div>

               <div className="w-full md:w-2/3">
                  <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Daftar Pemilih</h3><div className="flex gap-2"><Button variant="secondary" onClick={handlePrintTokens} className="text-xs">Cetak Token</Button><Button variant="secondary" onClick={handleExportCSV} className="text-xs">Export CSV</Button></div></div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4 flex gap-4"><Select value={filterBlock} onChange={e=>setFilterBlock(e.target.value)} options={[{value:'ALL',label:'Semua Blok'},{value:'Blok A',label:'Blok A'},{value:'Blok B',label:'Blok B'},{value:'Blok C',label:'Blok C'},{value:'Blok D',label:'Blok D'},{value:'PHI',label:'PHI'}]}/><Select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} options={[{value:'ALL',label:'Semua Status'},{value:'SUDAH',label:'Sudah'},{value:'BELUM',label:'Belum'}]}/><Badge>{filteredTokens.length} Data</Badge></div>
                  <Card className="p-0 overflow-hidden"><div className="overflow-x-auto max-h-[600px]"><table className="w-full text-left text-sm"><thead className="bg-gray-100 sticky top-0"><tr><th className="px-6 py-4">Nama</th><th className="px-6 py-4">Blok</th><th className="px-6 py-4">Token</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Aksi</th></tr></thead><tbody className="divide-y">{filteredTokens.map(t=>(<tr key={t.id} className="hover:bg-gray-50"><td className="px-6 py-3 font-medium">{t.voterName}</td><td className="px-6 py-3">{t.voterBlock}</td><td className="px-6 py-3 font-mono">{t.id}</td><td className="px-6 py-3"><Badge type={t.isUsed?'success':'error'}>{t.isUsed?'Sudah':'Belum'}</Badge></td><td className="px-6 py-3 text-right"><button onClick={()=>handleDeleteTokenClick(t)} className="text-red-400 hover:text-red-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></td></tr>))}</tbody></table></div></Card>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 border-t-4 border-blue-600"><h3 className="font-bold mb-4">{editingId ? 'Edit Kandidat' : 'Tambah Kandidat'}</h3><form onSubmit={handleSaveCandidate} className="space-y-4"><Input label="Nama" value={formCandidate.name} onChange={e=>setFormCandidate({...formCandidate,name:e.target.value})} required/><Input label="No. Urut" type="number" value={formCandidate.noUrut} onChange={e=>setFormCandidate({...formCandidate,noUrut:parseInt(e.target.value)})}/><Select label="Alamat" value={formCandidate.address} onChange={e=>setFormCandidate({...formCandidate,address:e.target.value})} options={[{value:'Blok A',label:'Blok A'},{value:'Blok B',label:'Blok B'},{value:'Blok C',label:'Blok C'},{value:'Blok D',label:'Blok D'},{value:'PHI',label:'PHI'}]}/><Input label="URL Foto" value={formCandidate.photoUrl} onChange={e=>setFormCandidate({...formCandidate,photoUrl:e.target.value})}/><div className="flex gap-2">{editingId && <Button type="button" variant="secondary" onClick={()=>setEditingId(null)} className="flex-1">Batal</Button>}<Button type="submit" className="flex-1">{editingId ? 'Update' : 'Simpan'}</Button></div></form></Card>
            <div className="lg:col-span-2 space-y-4">{candidates.map(c=>(<div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4"><img src={c.photoUrl} className="w-16 h-16 rounded-full object-cover"/><div className="flex-grow"><div><Badge type="neutral">No. {c.noUrut}</Badge><span className="ml-2 font-bold">{c.name}</span></div><p className="text-sm text-gray-500">{c.address}</p></div><div className="text-center px-4 border-r mr-2"><span className="block text-2xl font-bold">{c.votes}</span><span className="text-xs">Suara</span></div><button onClick={()=>{setEditingId(c.id);setFormCandidate({name:c.name,address:c.address||'Blok A',noUrut:c.noUrut,photoUrl:c.photoUrl})}} className="p-2 border rounded"><svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button><button onClick={()=>{if(confirm('Hapus?'))deleteCandidate(c.id)}} className="p-2 border rounded"><svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div>))}</div>
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="max-w-2xl mx-auto space-y-6"><Card><h3 className="font-bold mb-6">Atur Jadwal Pemilihan</h3><form onSubmit={async e=>{e.preventDefault();setIsSavingSettings(true);await updateElectionConfig({startTime:new Date(startTimeInput).getTime(),endTime:new Date(endTimeInput).getTime()});setIsSavingSettings(false);setSaveStatus('success');setTimeout(()=>setSaveStatus('idle'),3000)}} className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Input label="Mulai" type="datetime-local" value={startTimeInput} onChange={e=>setStartTimeInput(e.target.value)} required/><Input label="Selesai" type="datetime-local" value={endTimeInput} onChange={e=>setEndTimeInput(e.target.value)} required/></div><Button type="submit" isLoading={isSavingSettings} className="w-full">Simpan Jadwal</Button></form></Card></div>
        )}
      </main>
      <Modal isOpen={showResetModal} title="Konfirmasi Reset" onClose={()=>setShowResetModal(false)} onConfirm={confirmResetData} confirmText="YA, RESET" isProcessing={isResetting}><p>Hapus semua DPT dan suara?</p></Modal>
      <Modal isOpen={!!tokenToDelete} title="Hapus Pemilih" onClose={()=>setTokenToDelete(null)} onConfirm={confirmDeleteToken} confirmText="Hapus" isProcessing={isDeletingToken}><p>Hapus {tokenToDelete?.voterName}?</p></Modal>
    </div>
  );
};
