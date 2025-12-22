
import React, { useState, useEffect } from 'react';
import { Candidate } from '../types';
import { submitVote, subscribeToCandidates } from '../services/firebase';
import { Button, Card, Modal } from './UIComponents';

interface UserVotingProps {
  token: string;
  voterName: string;
  voterBlock: string;
  onSuccess: () => void;
  onLogout: () => void;
}

export const UserVoting: React.FC<UserVotingProps> = ({ token, voterName, voterBlock, onSuccess, onLogout }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  
  // State Voting Process
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmittingAnimation, setIsSubmittingAnimation] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  
  // New UX State: Digital Ink
  const [hasDippedInk, setHasDippedInk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToCandidates((data) => {
      setCandidates(data);
    });
    return () => unsubscribe();
  }, []);

  const handleVoteClick = () => {
    if (!selectedCandidate) return;
    setShowConfirmModal(true);
  };

  const handleConfirmVote = async () => {
    setShowConfirmModal(false);
    setIsSubmittingAnimation(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 2500));
      const result = await submitVote(token, selectedCandidate!, voterName, voterBlock);
      
      if (result.success) {
        setVoteSuccess(true);
      } else {
        alert("Gagal: " + result.message);
        setError(result.message);
      }
    } catch (err: any) {
      console.error(err);
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setIsSubmittingAnimation(false);
    }
  };

  const selectedCandidateName = candidates.find(c => c.id === selectedCandidate)?.name || "Kandidat";

  // --- VIEW: ANIMASI MEMASUKKAN SUARA ---
  if (isSubmittingAnimation) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center relative overflow-hidden">
         <div className="relative w-64 h-64 flex flex-col items-center justify-end">
            <div className="absolute w-32 h-40 bg-white border-2 border-gray-300 flex items-center justify-center shadow-md animate-slide-down top-0 z-10">
               <div className="text-gray-300 text-xs text-center font-mono p-2">SURAT SUARA</div>
            </div>
            <div className="w-48 h-32 bg-gray-800 rounded-b-lg rounded-t-sm relative z-20 flex items-center justify-center border-t-8 border-gray-900 shadow-2xl">
               <div className="w-32 h-2 bg-black rounded-full mb-16 opacity-50"></div>
               <div className="absolute bottom-4 text-gray-500 font-bold tracking-widest text-xs">KOTAK SUARA</div>
            </div>
         </div>
         <h2 className="text-xl font-bold text-gray-800 mt-8 animate-pulse">Memasukkan Suara...</h2>
         <style>{`
            @keyframes slide-down {
               0% { transform: translateY(-50px) rotate(0deg); opacity: 1; }
               50% { transform: translateY(60px) rotate(5deg); opacity: 1; }
               90% { transform: translateY(120px) rotate(0deg); opacity: 0; }
               100% { transform: translateY(150px); opacity: 0; }
            }
            .animate-slide-down {
               animation: slide-down 2s ease-in-out forwards;
            }
         `}</style>
      </div>
    );
  }

  // --- VIEW: SUKSES & CELUP TINTA ---
  if (voteSuccess) {
    if (!hasDippedInk) {
       // --- FASE 1: CELUP TINTA ---
       return (
          <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
             <h2 className="text-2xl font-bold text-gray-900 mb-2">Satu Langkah Lagi!</h2>
             <p className="text-gray-500 mb-8 text-center">Silakan celupkan jari anda ke dalam tinta virtual sebagai bukti sah telah memilih.</p>
             
             <div 
               onClick={() => setHasDippedInk(true)}
               className="cursor-pointer group relative w-40 h-40"
             >
                {/* Ink Pot */}
                <div className="absolute inset-0 bg-indigo-900 rounded-full border-4 border-gray-300 shadow-xl overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                   {/* Liquid */}
                   <div className="absolute inset-2 bg-indigo-800 rounded-full animate-pulse-slow">
                      <div className="w-full h-full opacity-50 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]"></div>
                   </div>
                   <span className="relative text-indigo-200 font-bold text-sm z-10 animate-bounce">KLIK SINI</span>
                </div>
                
                {/* Finger Hint (Optional visual) */}
                <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-sm text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                   Celupkan Jari
                </div>
             </div>
             
             <style>{`
                @keyframes pulse-slow {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.02); }
                }
                .animate-pulse-slow { animation: pulse-slow 3s infinite; }
             `}</style>
          </div>
       )
    }

    // --- FASE 2: KARTU BUKTI (SHAREABLE) ---
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl overflow-hidden relative">
          
          {/* Header Card */}
          <div className="bg-indigo-900 p-6 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
             <h2 className="text-2xl font-black text-white tracking-wider relative z-10">SAYA SUDAH<br/>MEMILIH</h2>
             <p className="text-indigo-200 text-xs mt-1 relative z-10">Pemilihan Ketua RT Masa Bakti 2024-2027</p>
          </div>

          {/* Body Card */}
          <div className="p-8 text-center">
             {/* Fingerprint Icon with Purple Tint */}
             <div className="w-24 h-24 mx-auto mb-6 relative">
                <svg className="w-full h-full text-indigo-100" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94.12 0 .24-.02.36-.06.26-.08.54.06.63.32.09.26-.06.54-.32.63-.29.1-.58.15-.84.15-1.7 0-3.08-1.27-3.08-2.94 0-1.07-.93-1.94-2.08-1.94-1.15 0-2.08.87-2.08 1.94 0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/>
                </svg>
                {/* INK STAIN OVERLAY */}
                <div className="absolute inset-0 bg-indigo-700 mix-blend-multiply opacity-80 rounded-full blur-md animate-scale-in" style={{ clipPath: 'circle(40% at 50% 50%)' }}></div>
             </div>

             <h3 className="text-xl font-bold text-gray-800 mb-1">{voterName}</h3>
             <div className="inline-block bg-gray-100 px-3 py-1 rounded text-xs font-mono text-gray-600 mb-6">{voterBlock}</div>

             <div className="text-sm text-gray-400 mb-8 font-medium">Terima kasih telah berpartisipasi dalam demokrasi warga kita.</div>
             
             <Button onClick={onLogout} className="w-full bg-gray-900 hover:bg-black text-white shadow-xl">
                Selesai / Keluar
             </Button>
          </div>

          {/* Footer Card */}
          <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
             <p className="text-[10px] text-gray-400">Screenshot layar ini sebagai status WhatsApp anda!</p>
          </div>

        </div>

        <style>{`
           @keyframes scale-in {
              0% { transform: scale(0); opacity: 0; }
              100% { transform: scale(1); opacity: 0.8; }
           }
           .animate-scale-in { animation: scale-in 0.5s ease-out forwards; }
        `}</style>
      </div>
    );
  }

  // --- VIEW: KERTAS SUARA (UTAMA) ---
  return (
    <div className="min-h-screen bg-stone-300 flex flex-col items-center py-4 px-2 md:px-4">
      
      {/* HEADER INFO COMPACT */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-4 bg-white px-4 py-2 rounded shadow-sm border-l-4 border-blue-600">
         <div className="text-xs md:text-sm">
            <span className="text-gray-500">Pemilih:</span>
            <span className="font-bold text-gray-900 ml-1 block md:inline">{voterName} ({voterBlock})</span>
         </div>
         <button onClick={onLogout} className="text-xs text-red-600 font-bold hover:underline">BATAL</button>
      </div>

      {error && (
        <div className="bg-red-500 text-white p-3 rounded mb-4 font-bold shadow-lg animate-bounce w-full max-w-lg text-center">
          {error}
        </div>
      )}

      {/* KERTAS SUARA CONTAINER */}
      <div className="bg-[#fdfbf7] w-full max-w-6xl shadow-2xl border-[1px] border-gray-400 relative flex flex-col overflow-hidden pb-24">
         
         {/* HEADER KERTAS */}
         <div className="text-center py-4 bg-gray-100 border-b-2 border-gray-400 border-dashed">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-widest uppercase">SURAT SUARA</h1>
            <p className="text-xs md:text-sm text-gray-600 font-serif italic mt-1">Gunakan hak pilih anda dengan bijak</p>
         </div>

         {/* GRID KANDIDAT COMPACT */}
         <div className="flex-grow p-2 md:p-6 overflow-y-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 auto-rows-fr">
                {candidates.map((candidate) => {
                   const isSelected = selectedCandidate === candidate.id;
                   return (
                      <div 
                         key={candidate.id}
                         onClick={() => setSelectedCandidate(candidate.id)}
                         className={`
                            relative cursor-pointer transition-all duration-150 flex flex-col
                            border-2 md:border-4 box-border
                            ${isSelected 
                                ? 'bg-yellow-50 border-red-800 shadow-[0_0_0_2px_rgba(153,27,27,0.5)] transform scale-[1.01] z-10' 
                                : 'bg-white border-gray-300 hover:border-gray-500'}
                         `}
                      >
                         {/* NOMOR URUT - Penyesuaian agar tidak terpotong dan center */}
                         <div className="absolute top-0 left-0 right-0 z-20 flex justify-center -mt-3 md:-mt-5">
                            <div className={`
                                w-10 h-10 md:w-16 md:h-16 
                                flex items-center justify-center 
                                font-black text-xl md:text-3xl 
                                rounded-lg shadow-xl border-4 border-white
                                ${isSelected ? 'bg-red-800 text-white' : 'bg-black text-white'}
                            `}>
                                {candidate.noUrut}
                            </div>
                         </div>

                         {/* Foto Area */}
                         <div className="relative w-full pt-[100%] md:pt-[100%] overflow-hidden bg-gray-200 mt-5 md:mt-7">
                            <img 
                               src={candidate.photoUrl} 
                               alt={candidate.name} 
                               className={`
                                  absolute inset-0 w-full h-full object-cover transition-all duration-300
                                  ${isSelected ? 'grayscale-0' : 'grayscale contrast-125 opacity-90'}
                               `}
                            />
                            
                            {/* EFEK COBLOS REALISTIS */}
                            {isSelected && (
                               <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                  <div className="w-16 h-16 md:w-24 md:h-24 relative animate-punch-impact flex items-center justify-center">
                                      <div 
                                        className="absolute w-full h-full bg-white opacity-80"
                                        style={{ 
                                            clipPath: 'polygon(10% 0%, 28% 8%, 46% 1%, 63% 10%, 82% 2%, 92% 18%, 100% 35%, 90% 52%, 100% 70%, 88% 85%, 70% 100%, 50% 90%, 30% 100%, 12% 85%, 0% 70%, 10% 50%, 0% 30%, 10% 15%)',
                                            transform: 'scale(1.1)' 
                                        }}
                                      ></div>
                                      <div 
                                        className="absolute w-full h-full bg-[#111]"
                                        style={{ 
                                            clipPath: 'polygon(10% 0%, 28% 8%, 46% 1%, 63% 10%, 82% 2%, 92% 18%, 100% 35%, 90% 52%, 100% 70%, 88% 85%, 70% 100%, 50% 90%, 30% 100%, 12% 85%, 0% 70%, 10% 50%, 0% 30%, 10% 15%)',
                                            boxShadow: 'inset 0 0 20px black' 
                                        }}
                                      >
                                          <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-transparent opacity-80"></div>
                                      </div>
                                  </div>
                               </div>
                            )}
                         </div>

                         {/* Detail Kandidat */}
                         <div className={`
                            p-2 text-center flex flex-col items-center justify-center min-h-[5rem]
                            ${isSelected ? 'bg-red-50 text-red-900' : 'bg-white text-gray-900'}
                         `}>
                            <h3 className="text-sm md:text-lg font-bold uppercase leading-tight line-clamp-2">
                               {candidate.name}
                            </h3>
                            <p className={`
                                text-[10px] md:text-xs font-semibold mt-1 px-2 py-0.5 rounded border
                                ${isSelected 
                                    ? 'text-red-700 border-red-200 bg-red-100' 
                                    : 'text-gray-500 border-gray-200 bg-gray-50'}
                            `}>
                                {candidate.address || 'BLOK -'}
                            </p>
                         </div>
                      </div>
                   );
                })}
            </div>
         </div>

         {/* FOOTER INSTRUKSI */}
         <div className="bg-stone-200 p-2 text-center text-xs text-gray-600 font-mono border-t border-gray-300">
            Klik pada kotak kandidat untuk memilih.
         </div>

      </div>

      {/* FLOATING ACTION BUTTON (SUBMIT) */}
      <div className="fixed bottom-6 z-50 animate-bounce-slight">
         <button 
            onClick={handleVoteClick}
            disabled={!selectedCandidate}
            className={`
               px-8 py-3 md:px-12 md:py-4 rounded-full shadow-2xl font-bold text-lg md:text-xl tracking-wider
               flex items-center gap-2 border-4 border-white transition-all
               ${selectedCandidate 
                  ? 'bg-gradient-to-r from-red-700 to-red-800 text-white hover:scale-105 hover:shadow-red-500/50' 
                  : 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-0 translate-y-20'} 
            `}
            style={{ transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
         >
            <span>MASUKKAN SUARA</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
         </button>
      </div>

      {/* CSS Animation Definitions */}
      <style>{`
         @keyframes punch-impact {
            0% { transform: scale(3); opacity: 0; }
            50% { transform: scale(0.9); opacity: 1; }
            70% { transform: scale(1.05); }
            100% { transform: scale(1); opacity: 1; }
         }
         @keyframes bounce-slight {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
         }
         .animate-bounce-slight { animation: bounce-slight 2s infinite; }
      `}</style>

      {/* MODAL KONFIRMASI */}
      <Modal
        isOpen={showConfirmModal}
        title="Konfirmasi Pilihan"
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmVote}
        confirmText="YA, SUDAH BENAR"
        cancelText="Batal"
      >
        <div className="text-center py-4">
          <p className="text-gray-600 mb-2">Anda yakin memilih nomor urut <strong className="text-black text-lg">{candidates.find(c => c.id === selectedCandidate)?.noUrut}</strong>?</p>
          <div className="text-2xl font-black text-gray-900 uppercase border-y-2 border-gray-200 py-3 my-3 bg-gray-50">
             {selectedCandidateName}
          </div>
          <p className="text-sm text-red-500 font-bold">
            Peringatan: Pilihan tidak dapat diubah setelah dimasukkan ke kotak suara.
          </p>
        </div>
      </Modal>

    </div>
  );
};
