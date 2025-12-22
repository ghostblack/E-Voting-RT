
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
  LabelList
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
  if (!candidate) return null;
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
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Candidate Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCandidate, setFormCandidate] = useState({ name: '', address: 'Blok A', noUrut: 0, photoUrl: 'https://picsum.photos/200' });
  
  // Voter Registration
  const [newVoterName, setNewVoterName] = useState('');
  const [newVoterBlock, setNewVoterBlock] = useState('Blok A');
  const [isRegistering, setIsRegistering] = useState(false);

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

    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => { unsubC(); unsubT(); unsubS(); clearInterval(timer); };
  }, []);

  const currentStatus = useMemo(() => {
    if (!electionConfig) return { label: 'BELUM DIATUR', type: 'neutral' as const };
    if (currentTime < electionConfig.startTime) return { label: 'BELUM MULAI', type: 'warning' as const };
    if (currentTime > electionConfig.endTime) return { label: 'SUDAH TUTUP', type: 'error' as const };
    return { label: 'SEDANG BERJALAN', type: 'success' as const };
  }, [electionConfig, currentTime]);

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

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) await updateCandidateData(editingId, formCandidate);
    else await addCandidate({ ...formCandidate, vision: '-', mission: '-' });
    setEditingId(null);
    setFormCandidate({ name: '', address: 'Blok A', noUrut: candidates.length + 1, photoUrl: 'https://picsum.photos/200' });
  };

  const handleRegisterVoter = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    await registerVoter(newVoterName, newVoterBlock);
    setIsRegistering(false);
    setNewVoterName('');
  };

  const confirmResetData = async () => {
    setIsResetting(true);
    await resetElectionData();
    setIsResetting(false);
    setShowResetModal(false);
  };

  const confirmDeleteToken = async () => {
    setIsDeletingToken(true);
    await deleteToken(tokenToDelete!.id);
    setTokenToDelete(null);
    setIsDeletingToken(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateElectionConfig({
        startTime: new Date(startTimeInput).getTime(),
        endTime: new Date(endTimeInput).getTime()
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const totalVotes = candidates.reduce((acc, curr) => acc + (curr.votes || 0), 0);
  const usedTokens = tokens.filter(t => t.isUsed).length;
  const participationRate = tokens.length > 0 ? Math.round((usedTokens / tokens.length) * 100) : 0;
  const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes);

  const filteredTokens = useMemo(() => {
    return tokens.filter(t => (filterBlock === 'ALL' || t.voterBlock === filterBlock) && (filterStatus === 'ALL' || (filterStatus === 'SUDAH' ? t.isUsed : !t.isUsed)));
  }, [tokens, filterBlock, filterStatus]);

  if (activeTab === 'live_count') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col p-6 overflow-hidden">
        <style>{`@keyframes text-pop {0%{font-size:32px;fill:#10B981;}50%{font-size:48px;fill:#34D399;font-weight:900;}100%{font-size:32px;}}`}</style>
        <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
           <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 uppercase tracking-tighter">Live Count</h1>
              <Badge type={currentStatus.type}>{currentStatus.label}</Badge>
           </div>
           <Button variant="outline" onClick={() => setActiveTab('results')} className="border-gray-600 text-gray-400">Keluar Dashboard</Button>
        </div>
        <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-8">
           <div className="lg:col-span-3 bg-gray-800 rounded-3xl p-8 border border-gray-700 relative flex flex-col">
               <div className="flex-grow min-h-[500px]">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={candidates} margin={{ top: 100, right: 30, left: 20, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} dy={20} tick={{ fill: '#9CA3AF', fontSize: 14, fontWeight: 'bold' }} />
                      <Bar dataKey="votes" radius={[12, 12, 0, 0]}>
                        {candidates.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        <LabelList dataKey="votes" position="top" content={(props: any) => {
                             const { x, y, width, index, value } = props;
                             const c = candidates[index];
                             if (!c) return null;
                             const isFlashing = flashingCandidates[c.id];
                             return (
                               <g>
                                  <defs><clipPath id={`clip-live-${index}`}><circle cx={x+width/2} cy={y-45} r={30}/></clipPath></defs>
                                  <image x={x+width/2-30} y={y-75} width={60} height={60} href={c.photoUrl} clipPath={`url(#clip-live-${index})`} preserveAspectRatio="xMidYMid slice"/>
                                  <text x={x+width/2} y={y-10} textAnchor="middle" fontSize="32" fontWeight="900" style={isFlashing ? {animation:'text-pop 0.5s infinite', fill:'#10B981'} : {fill:'#FFFFFF'}}>{value}</text>
                               </g>
                             )
                          }} />
                      </Bar>
                    </BarChart>
                 </ResponsiveContainer>
               </div>
           </div>
           <div className="space-y-6">
              <Card className="bg-gray-800 border-gray-700 text-white shadow-xl">
                 <h3 className="text-sm font-bold uppercase mb-2 text-gray-400">Total Suara Masuk</h3>
                 <div className="text-6xl font-black">{totalVotes}</div>
              </Card>
              <div className="bg-gray-800 rounded-3xl p-6 border border-gray-700 flex-grow overflow-y-auto space-y-4 max-h-[400px]">
                 <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Peringkat Sementara</h3>
                 {sortedCandidates.map((c, idx) => (
                   <div key={c.id} className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${flashingCandidates[c.id] ? 'bg-green-500/20 border-l-4 border-green-500' : 'bg-gray-700/50'}`}>
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-600 font-bold text-sm">{idx+1}</div>
                      <img src={c.photoUrl} className="w-10 h-10 rounded-full object-cover" />
                      <div className="flex-grow"><div className="font-bold text-sm">{c.name}</div><div className="text-xs text-gray-400">{c.votes} Suara</div></div>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-10">
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                <h1 className="text-xl font-bold">Admin Panel</h1>
             </div>
             <Badge type={currentStatus.type}>{currentStatus.label}</Badge>
          </div>
          <div className="flex gap-3"><Button variant="danger" onClick={() => setShowResetModal(true)} className="text-[10px] font-black uppercase px-4">Reset Data</Button><Button variant="secondary" onClick={onLogout} className="text-[10px] font-black uppercase px-4">Keluar</Button></div>
        </div>
        <div className="bg-white border-b"><div className="max-w-7xl mx-auto px-4 flex gap-6">
            {['results', 'voters', 'candidates', 'settings'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`py-3 px-1 font-bold text-sm border-b-2 capitalize transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-800'}`}>{tab === 'results' ? 'Hasil' : tab === 'voters' ? 'DPT' : tab === 'candidates' ? 'Kandidat' : 'Jadwal'}</button>
            ))}
            <button onClick={() => setActiveTab('live_count')} className="py-3 px-1 font-bold text-sm text-red-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>Live Count</button>
        </div></div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'results' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="flex flex-col items-center py-6 bg-blue-600 text-white border-none"><span className="text-xs font-black uppercase opacity-70">Total Suara</span><span className="text-4xl font-black">{totalVotes}</span></Card>
              <Card className="flex flex-col items-center py-6 bg-white"><span className="text-xs font-black uppercase text-slate-400">DPT Terpakai</span><span className="text-4xl font-black">{usedTokens} / {tokens.length}</span></Card>
              <Card className="flex flex-col items-center py-6 bg-white"><span className="text-xs font-black uppercase text-slate-400">Partisipasi</span><span className="text-4xl font-black text-purple-600">{participationRate}%</span></Card>
              <Card className="flex flex-col items-center py-6 bg-slate-50 border-none"><span className="text-xs font-black uppercase text-slate-400">Status TPS</span><div className="mt-2"><Badge type={currentStatus.type}>{currentStatus.label}</Badge></div></Card>
            </div>
            
            <Card className="p-6 h-[500px]"><h3 className="font-black text-slate-800 mb-10 border-l-4 border-blue-500 pl-2 uppercase">Grafik Perolehan Suara</h3>
              <ResponsiveContainer width="100%" height="100%"><BarChart data={candidates} margin={{ top: 80 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" tick={{fill: '#64748b', fontWeight: 'bold'}} /><Tooltip cursor={{fill: '#f8fafc'}} /><Bar dataKey="votes" radius={[12, 12, 0, 0]}>{candidates.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}<LabelList dataKey="votes" position="top" content={<BarImageLabel candidates={candidates}/>}/></Bar></BarChart></ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === 'voters' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 h-fit"><h3 className="font-black uppercase text-sm mb-4">Tambah Pemilih</h3><form onSubmit={handleRegisterVoter} className="space-y-4"><Input label="Nama" value={newVoterName} onChange={e=>setNewVoterName(e.target.value)} required/><Select label="Blok" value={newVoterBlock} onChange={e=>setNewVoterBlock(e.target.value)} options={[{value:'Blok A',label:'Blok A'},{value:'Blok B',label:'Blok B'},{value:'Blok C',label:'Blok C'},{value:'Blok D',label:'Blok D'},{value:'PHI',label:'PHI'}]}/><Button type="submit" className="w-full" isLoading={isRegistering}>Daftar</Button></form></Card>
            <div className="md:col-span-2 space-y-4">
              <div className="flex justify-between items-center"><h3 className="text-xl font-black uppercase">Daftar Pemilih</h3></div>
              <Card className="p-0 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-6 py-4 font-black uppercase text-[10px]">Nama</th><th className="px-6 py-4 font-black uppercase text-[10px]">Blok</th><th className="px-6 py-4 font-black uppercase text-[10px]">Token</th><th className="px-6 py-4 font-black uppercase text-[10px]">Status</th><th className="px-6 py-4 font-black uppercase text-[10px]">Aksi</th></tr></thead><tbody className="divide-y">{filteredTokens.map(t=>(<tr key={t.id}><td className="px-6 py-4 font-bold">{t.voterName}</td><td className="px-6 py-4">{t.voterBlock}</td><td className="px-6 py-4 font-mono font-bold text-blue-600">{t.id}</td><td className="px-6 py-4"><Badge type={t.isUsed?'success':'neutral'}>{t.isUsed?'Sudah':'Belum'}</Badge></td><td className="px-6 py-4"><button onClick={()=>setTokenToDelete(t)} className="text-red-400 hover:text-red-600">Hapus</button></td></tr>))}</tbody></table></div></Card>
            </div>
          </div>
        )}

        {activeTab === 'candidates' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="h-fit"><h3 className="font-black uppercase text-sm mb-4">Form Kandidat</h3><form onSubmit={handleSaveCandidate} className="space-y-4"><Input label="Nama" value={formCandidate.name} onChange={e=>setFormCandidate({...formCandidate,name:e.target.value})} required/><Input label="No. Urut" type="number" value={formCandidate.noUrut} onChange={e=>setFormCandidate({...formCandidate,noUrut:parseInt(e.target.value)})}/><Input label="Foto URL" value={formCandidate.photoUrl} onChange={e=>setFormCandidate({...formCandidate,photoUrl:e.target.value})}/><Button type="submit" className="w-full">{editingId ? 'Update' : 'Simpan'}</Button></form></Card>
            <div className="md:col-span-2 space-y-3">{candidates.map(c=>(<div key={c.id} className="bg-white p-4 rounded-xl border flex items-center gap-4"><img src={c.photoUrl} className="w-12 h-12 rounded-full object-cover"/><div className="flex-grow font-bold">{c.name} <Badge className="ml-2">No {c.noUrut}</Badge></div><div className="text-xl font-black text-blue-600 px-4">{c.votes} Suara</div><div className="flex gap-2"><button onClick={() => { setEditingId(c.id); setFormCandidate({ name: c.name, address: c.address || 'Blok A', noUrut: c.noUrut, photoUrl: c.photoUrl }); }} className="text-blue-500">Edit</button><button onClick={()=>deleteCandidate(c.id)} className="text-red-500">Hapus</button></div></div>))}</div>
          </div>
        )}

        {activeTab === 'settings' && (
           <Card className="max-w-md mx-auto">
             <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase text-sm">Pengaturan Jadwal TPS</h3>
                <Badge type={currentStatus.type}>{currentStatus.label}</Badge>
             </div>
             
             {saveStatus === 'success' && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-6 text-sm font-bold flex items-center gap-2">
                   <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                   Jadwal Berhasil Disimpan!
                </div>
             )}

             <form onSubmit={handleSaveSettings} className="space-y-6">
                <Input label="Waktu Mulai" type="datetime-local" value={startTimeInput} onChange={e=>setStartTimeInput(e.target.value)} required/>
                <Input label="Waktu Selesai" type="datetime-local" value={endTimeInput} onChange={e=>setEndTimeInput(e.target.value)} required/>
                <Button type="submit" isLoading={isSavingSettings} className="w-full py-4">Aktifkan Jadwal</Button>
             </form>
             
             <div className="mt-8 pt-6 border-t">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">Waktu saat ini: {new Date(currentTime).toLocaleTimeString('id-ID')}</p>
             </div>
           </Card>
        )}
      </main>
      <Modal isOpen={showResetModal} title="Reset Data" onClose={()=>setShowResetModal(false)} onConfirm={confirmResetData} confirmText="YA, RESET SEMUA" isProcessing={isResetting}><p>Menghapus semua pemilih dan mereset suara kandidat ke nol. Lanjutkan?</p></Modal>
      <Modal isOpen={!!tokenToDelete} title="Hapus Pemilih" onClose={()=>setTokenToDelete(null)} onConfirm={confirmDeleteToken} isProcessing={isDeletingToken}><p>Hapus {tokenToDelete?.voterName}?</p></Modal>
    </div>
  );
};
