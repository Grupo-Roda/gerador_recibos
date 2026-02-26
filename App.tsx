import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Trash2, Printer, Sparkles, AlertCircle, 
  Eraser, ShieldCheck, Wallet, CheckCircle2, Lock, 
  Building2, Calculator, Percent, MinusCircle
} from 'lucide-react';
import { ReceiptType, ProviderInfo, ReceiptItem, TOMADORES_LIST } from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Função para gerar o ID no formato AAAAMMDD + 3 dígitos
const generateReceiptId = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const randomDigits = Math.floor(100 + Math.random() * 900);
  return `${year}${month}${day}${randomDigits}`;
};

// Cabeçalho Clean com a Logo da Empresa
const ReceiptHeader: React.FC<{ receiptNumber: string, city: string }> = ({ receiptNumber, city }) => (
  <div className="flex justify-between items-end mb-8 pb-6 border-b-2 border-[#ffa800] w-full bg-white">
    <div className="flex flex-col">
      {/* A LOGO DEVE ESTAR NA PASTA PUBLIC */}
      <img src="/LOGO HORIZONTAL.png" alt="Grupo Rodamoinho" className="h-16 w-auto object-contain" />
    </div>
    <div className="text-right">
      <h1 className="text-black text-[22px] font-black uppercase tracking-widest mb-1">
        RECIBO Nº {receiptNumber}
      </h1>
      <p className="text-black text-[10px] font-bold uppercase tracking-[0.2em]">
        {city.toUpperCase()}, {new Date().toLocaleDateString('pt-BR', {day:'2-digit', month:'long', year:'numeric'}).toUpperCase()}
      </p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('recibos_admin') === 'autenticado');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [provider, setProvider] = useState<ProviderInfo>(() => {
    const saved = localStorage.getItem('recibos_provider');
    return saved ? JSON.parse(saved) : { name: '', document: '', address: '', phone: '', email: '', bankInfo: '', signature: '' };
  });
  
  const [selectedTomadorIndex, setSelectedTomadorIndex] = useState(0);

  // Usa a nova lógica de numeração
  const [receiptNumber, setReceiptNumber] = useState<string>(() => generateReceiptId());

  const [items, setItems] = useState<ReceiptItem[]>([{ id: '1', description: '', value: 0 }]);
  const [discount, setDiscount] = useState<number>(0);
  const [taxesPercentage, setTaxesPercentage] = useState<number>(0);
  const [city, setCity] = useState('Rio de Janeiro');
  
  const [date] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [history, setHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('recibos_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isPrinting, setIsPrinting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => { localStorage.setItem('recibos_provider', JSON.stringify(provider)); }, [provider]);
  useEffect(() => { localStorage.setItem('recibos_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { if (statusMessage) { const timer = setTimeout(() => setStatusMessage(null), 4000); return () => clearTimeout(timer); } }, [statusMessage]);

  const maskDocument = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const maskPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
  };

  const selectedTomador = TOMADORES_LIST[selectedTomadorIndex];
  const totalBruto = items.reduce((acc, item) => acc + item.value, 0);
  const taxesValue = totalBruto * (taxesPercentage / 100);
  const totalLiquido = Math.max(0, totalBruto - discount - taxesValue);
  
  const formattedTotalLiquido = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLiquido);
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const getCoordinates = (e: any) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: any) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const coords = getCoordinates(e);
    lastPos.current = coords;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 3.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    lastPos.current = coords;
  };

  const stopDrawing = () => { 
    if (isDrawing) { 
      setIsDrawing(false); 
      setProvider(prev => ({ ...prev, signature: canvasRef.current?.toDataURL('image/png') })); 
    } 
  };

  const clearSignature = () => { 
    const ctx = canvasRef.current?.getContext('2d'); 
    ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); 
    setProvider(prev => ({ ...prev, signature: '' })); 
  };

  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};
    if (!provider.name.trim()) newErrors.providerName = true;
    if (!provider.document.trim()) newErrors.providerDoc = true;
    if (!provider.bankInfo.trim()) newErrors.bankInfo = true;
    if (provider.email.trim() && !validateEmail(provider.email)) newErrors.providerEmail = true;
    
    items.forEach(item => { 
      if (!item.description.trim()) newErrors[`itemDesc_${item.id}`] = true; 
      if (item.value <= 0) newErrors[`itemValue_${item.id}`] = true; 
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generatePDF = async (shouldDownload: boolean = true) => {
    if (!validateForm()) {
      setStatusMessage({ type: 'error', text: 'Preencha os campos obrigatórios corretamente.' });
      return;
    }
    setIsPrinting(true);
    const element = document.getElementById('printable-receipt');
    try {
      const canvas = await html2canvas(element!, { scale: 3, useCORS: true, logging: false });
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
      
      const fileName = `Recibo_${receiptNumber}_${provider.name.split(' ')[0]}.pdf`;
      if (shouldDownload) pdf.save(fileName);
      
      const newEntry = { 
        id: receiptNumber, 
        date, 
        type: ReceiptType.SERVICE, 
        items: [...items], 
        city, 
        provider: { ...provider }, 
        tomador: selectedTomador,
        discount,
        taxesPercentage,
        taxesValue,
        totalLiquido
      };
      setHistory(prev => [newEntry, ...prev]);
      
      // Gera um novo número para o próximo recibo
      setReceiptNumber(generateReceiptId());
      setStatusMessage({ type: 'success', text: 'Recibo gerado com sucesso!' });
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Erro ao processar PDF.' });
    } finally { setIsPrinting(false); }
  };

  const loginAdmin = () => {
    // Substitua 'rodamoinho2024' pela senha que desejar
    if (adminPassword === "rodamoinho2024") {
      setIsAdmin(true);
      localStorage.setItem('recibos_admin', 'autenticado');
    } else { setStatusMessage({ type: 'error', text: 'Senha incorreta.' }); }
  };

  const resetForm = () => {
    setItems([{ id: Date.now().toString(), description: '', value: 0 }]);
    setDiscount(0);
    setTaxesPercentage(0);
    setErrors({});
    setStatusMessage({ type: 'success', text: 'Campos limpos.' });
  };

  const getFieldClass = (key: string, base: string = "") => `${base} ${errors[key] ? 'border-rose-500 ring-rose-200' : 'border-slate-100'}`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8fafc]">
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ${statusMessage.type === 'success' ? 'bg-slate-900 text-emerald-400' : 'bg-rose-600 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-xs font-black uppercase tracking-widest">{statusMessage.text}</span>
        </div>
      )}

      {/* PAINEL DE CONTROLE (Mantido estilo moderno do app) */}
      <div className="lg:w-2/5 p-6 lg:p-8 no-print overflow-y-auto max-h-screen border-r border-slate-200 bg-white no-scrollbar">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-[#ffa800] p-2.5 rounded-2xl text-white shadow-xl shadow-[#ffa800]/20"><FileText size={22} /></div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">GRUPO RODAMOINHO</h1>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setActiveTab('form')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'form' ? 'bg-white text-[#ffa800] shadow-md' : 'text-slate-400'}`}>Gerador</button>
            <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-[#ffa800] shadow-md' : 'text-slate-400'}`}>Histórico</button>
          </div>
        </header>

        {activeTab === 'form' ? (
          <div className="space-y-8 pb-20">
            {/* Empresa Tomadora */}
            <section className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-[#ffa800] mb-6 flex items-center gap-2"><Building2 size={16}/> Empresa Tomadora</h3>
              <div className="space-y-3">
                {TOMADORES_LIST.map((tomador, idx) => (
                  <button key={idx} onClick={() => setSelectedTomadorIndex(idx)} className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${selectedTomadorIndex === idx ? 'bg-white border-[#ffa800] shadow-md' : 'bg-white/50 border-slate-100 hover:border-slate-300'}`}>
                    <div>
                      <p className={`text-[10px] font-black uppercase mb-0.5 ${selectedTomadorIndex === idx ? 'text-[#ffa800]' : 'text-slate-700'}`}>{tomador.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CNPJ: {tomador.cnpj}</p>
                    </div>
                    {selectedTomadorIndex === idx && <CheckCircle2 size={16} className="text-[#ffa800] shrink-0"/>}
                  </button>
                ))}
              </div>
            </section>

            {/* Prestador */}
            <section className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-[#ffa800]">Emissor (Prestador)</h3>
                <button onClick={resetForm} className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 hover:text-rose-500 transition-colors"><Eraser size={14}/> Limpar Campos</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Nome / Razão Social *</label>
                  <input type="text" className={getFieldClass('providerName', "w-full px-5 py-3 bg-white border rounded-2xl font-bold uppercase text-[13px] outline-none")} value={provider.name} onChange={e => setProvider(prev => ({...prev, name: e.target.value}))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Documento (CPF/CNPJ) *</label>
                  <input type="text" className={getFieldClass('providerDoc', "w-full px-5 py-3 bg-white border rounded-2xl font-bold text-[13px] outline-none")} value={provider.document} onChange={e => setProvider(prev => ({...prev, document: maskDocument(e.target.value)}))} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">WhatsApp</label>
                  <input type="text" className="w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-[13px] outline-none" value={provider.phone} onChange={e => setProvider(prev => ({...prev, phone: maskPhone(e.target.value)}))} />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">E-mail</label>
                  <input type="email" className={getFieldClass('providerEmail', "w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl font-bold text-[13px] outline-none")} value={provider.email} onChange={e => setProvider(prev => ({...prev, email: e.target.value}))} placeholder="exemplo@email.com" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Endereço Completo</label>
                  <input type="text" className="w-full px-5 py-3 bg-white border border-slate-100 rounded-2xl font-bold uppercase text-[13px] outline-none" value={provider.address} onChange={e => setProvider(prev => ({...prev, address: e.target.value}))} placeholder="Ex: RUA EXEMPLO, 123 - CENTRO" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Dados Bancários / PIX *</label>
                  <input type="text" className={getFieldClass('bankInfo', "w-full px-5 py-3 bg-white border rounded-2xl font-bold uppercase text-[13px] outline-none")} value={provider.bankInfo} onChange={e => setProvider(prev => ({...prev, bankInfo: e.target.value}))} />
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase text-slate-400">Assinatura Digital</label><button onClick={clearSignature} className="text-[9px] font-black text-[#ffa800] uppercase">Limpar</button></div>
                  <div className="h-40 bg-white rounded-[24px] border-2 border-slate-100 relative cursor-crosshair overflow-hidden touch-none shadow-inner">
                    <canvas ref={canvasRef} width={800} height={250} className="absolute inset-0 w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                  </div>
                </div>
              </div>
            </section>

            {/* Serviços e Resumo Financeiro */}
            <section className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-[#ffa800] mb-6 flex items-center gap-2"><Calculator size={16}/> Detalhamento Financeiro</h3>
              <div className="space-y-4 mb-8">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-5 bg-white rounded-[24px] shadow-sm border border-slate-100/50 space-y-3">
                    <div className="flex gap-4 items-start">
                      <div className="flex-grow space-y-1">
                        <label className="text-[9px] font-black text-[#ffa800] uppercase">Descrição do Serviço *</label>
                        <input type="text" className={getFieldClass(`itemDesc_${item.id}`, "w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-bold uppercase text-[12px]")} value={item.description} onChange={e => setItems(items.map(i => i.id === item.id ? {...i, description: e.target.value} : i))} />
                      </div>
                      <div className="w-28 space-y-1 shrink-0">
                        <label className="text-[9px] font-black text-[#ffa800] uppercase text-right block">Valor R$ *</label>
                        <input type="number" className={getFieldClass(`itemValue_${item.id}`, "w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-black text-right text-[14px]")} value={item.value || ''} onChange={e => setTaxesPercentage(0) || setItems(items.map(i => i.id === item.id ? {...i, value: parseFloat(e.target.value) || 0} : i))} />
                      </div>
                      {items.length > 1 && <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500 mt-8 shrink-0"><Trash2 size={18}/></button>}
                    </div>
                  </div>
                ))}
                <button onClick={() => setItems([...items, {id: Date.now().toString(), description:'', value:0}])} className="w-full py-3 border-2 border-dashed border-[#ffa800] rounded-[20px] text-[#ffa800] font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-orange-50 transition-all"><Plus size={16}/> Novo Item</button>
              </div>

              {/* Deduções */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-6">
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1.5"><MinusCircle size={10} className="text-rose-400"/> Descontos (R$)</label>
                    <input type="number" className="w-full px-4 py-3 bg-white border border-slate-100 rounded-2xl font-black text-rose-500 text-[14px] outline-none" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Percent size={10} className="text-rose-400"/> Impostos (%)</label>
                    <input type="number" className="w-full px-4 py-3 bg-white border border-slate-100 rounded-2xl font-black text-rose-500 text-[14px] outline-none" value={taxesPercentage || ''} onChange={e => setTaxesPercentage(parseFloat(e.target.value) || 0)} placeholder="0" />
                 </div>
              </div>
            </section>

            <div className="sticky bottom-6">
              <button onClick={() => generatePDF(true)} disabled={isPrinting} className="w-full py-5 bg-[#ffa800] text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.25em] shadow-2xl shadow-[#ffa800]/40 hover:bg-[#e69700] transition-all flex items-center justify-center gap-3">
                {isPrinting ? <Loader2 size={22} className="animate-spin"/> : <Printer size={22}/>} Finalizar e Baixar Recibo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right">
            {!isAdmin ? (
              <div className="bg-slate-50 p-12 rounded-[40px] text-center space-y-6 flex flex-col items-center">
                <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-2xl"><Lock size={48} /></div>
                <h3 className="font-black uppercase text-[16px] tracking-[0.2em] text-slate-900">Acesso Restrito</h3>
                <input type="password" placeholder="Senha" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginAdmin()} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-center font-black uppercase tracking-widest text-[14px] outline-none focus:ring-4 ring-orange-50" />
                <button onClick={loginAdmin} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em]">Entrar</button>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="font-black uppercase text-[11px] tracking-[0.4em] text-slate-400">HISTÓRICO RECENTE</h3>
                {history.length === 0 ? (
                  <p className="text-center py-24 text-slate-200 uppercase font-black tracking-widest">Nenhum Registro</p>
                ) : (
                  history.map((entry, idx) => (
                    <div key={idx} className="bg-slate-50 p-5 rounded-[24px] flex items-center justify-between border border-slate-100 shadow-sm">
                      <div>
                        <p className="text-[11px] font-black uppercase text-slate-900 truncate max-w-[140px]">{entry.provider.name}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Nº {entry.id} • {entry.tomador?.name.split(' ')[0]}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-black text-slate-900">{formatCurrency(entry.totalLiquido)}</p>
                        <button onClick={() => setHistory(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 hover:text-rose-700 mt-1"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PRÉ-VISUALIZAÇÃO A4 (LAYOUT CLEAN) */}
      <div className="lg:w-3/5 bg-slate-200/30 p-6 lg:p-12 flex justify-center items-start overflow-y-auto h-screen no-scrollbar no-print">
        <div className="bg-white shadow-2xl flex flex-col relative scale-[0.6] md:scale-[0.8] lg:scale-[1] origin-top" id="printable-receipt" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', color: '#000000', fontFamily: "'Inter', sans-serif" }}>
          
          <ReceiptHeader receiptNumber={receiptNumber} city={city} />

          <div className="grid grid-cols-2 gap-10 mb-8 mt-4">
             <div className="space-y-6">
                <div>
                   <h4 className="text-[10px] font-black text-[#ffa800] uppercase tracking-widest mb-2 italic border-b border-[#ffa800] pb-1 inline-block">PAGADOR (TOMADOR)</h4>
                   <div className="pt-2 space-y-1 text-[10px]">
                      <p className="font-black text-[12px] text-black uppercase">{selectedTomador.name}</p>
                      <p className="text-black font-medium">CNPJ: <span className="font-bold">{selectedTomador.cnpj}</span></p>
                      <p className="text-black font-medium uppercase">{selectedTomador.address}</p>
                      <p className="text-black font-medium uppercase">{selectedTomador.neighborhood} - CEP: {selectedTomador.cep}</p>
                   </div>
                </div>
                <div>
                   <h4 className="text-[10px] font-black text-[#ffa800] uppercase tracking-widest mb-2 italic border-b border-[#ffa800] pb-1 inline-block">RECEBEDOR (PRESTADOR)</h4>
                   <div className="pt-2 space-y-1 text-[10px]">
                      <p className="font-black text-[12px] uppercase text-black">{provider.name || "NOME DO PRESTADOR"}</p>
                      <p className="text-black font-medium">DOC: <span className="font-bold">{provider.document || "---"}</span></p>
                      {provider.address && <p className="text-black font-medium uppercase leading-tight">{provider.address}</p>}
                      {provider.phone && <p className="text-black font-medium">{provider.phone}</p>}
                      {provider.email && <p className="text-black font-medium lowercase italic">{provider.email}</p>}
                   </div>
                </div>
             </div>

             <div className="flex flex-col justify-between items-end">
                <div className="border-2 border-black rounded-[16px] p-6 flex flex-col items-center justify-center text-center w-full max-w-[280px]">
                   <p className="text-[#ffa800] text-[10px] font-black uppercase tracking-[0.3em] mb-2">VALOR TOTAL BRUTO</p>
                   <p className="text-black text-[32px] font-black tracking-tighter leading-none">{formatCurrency(totalBruto)}</p>
                </div>
                <div className="mt-4 w-full max-w-[280px] border border-black p-4 rounded-[12px] text-center">
                   <h4 className="text-[9px] font-black text-[#ffa800] uppercase mb-1">DADOS BANCÁRIOS / PIX:</h4>
                   <p className="text-[11px] font-bold text-black uppercase italic leading-tight">{provider.bankInfo || "A COMBINAR"}</p>
                </div>
             </div>
          </div>

          <div className="flex-grow">
             <table className="w-full">
                <thead>
                   <tr className="border-y-2 border-[#ffa800]">
                      <th className="text-left py-3 px-2 text-[10px] font-black text-black uppercase tracking-[0.2em]">ITEM E DESCRIÇÃO</th>
                      <th className="text-right py-3 px-2 text-[10px] font-black text-black uppercase w-40 tracking-[0.2em]">VALOR BRUTO (R$)</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                   {items.map((item, i) => (
                     <tr key={item.id}>
                        <td className="py-4 px-2">
                           <div className="flex items-center gap-3">
                             <div className="text-[#ffa800] font-black text-[12px]">
                               {String(i+1).padStart(2, '0')}.
                             </div>
                             <p className="text-black font-bold text-[12px] uppercase">{item.description || "SERVIÇOS PRESTADOS"}</p>
                           </div>
                        </td>
                        <td className="py-4 px-2 text-right font-black text-black text-[14px]">
                          {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.value)}
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>

             {/* RESUMO FINANCEIRO CLEAN */}
             <div className="mt-8 flex justify-end">
                <div className="w-[380px] space-y-2">
                   <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                      <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">SUBTOTAL BRUTO</span>
                      <span className="text-[14px] font-black text-black">{formatCurrency(totalBruto)}</span>
                   </div>
                   
                   {discount > 0 && (
                     <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                        <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">(-) DESCONTOS</span>
                        <span className="text-[14px] font-bold text-black">{formatCurrency(discount)}</span>
                     </div>
                   )}
                   
                   {taxesPercentage > 0 && (
                     <div className="flex justify-between items-center py-2 px-4 border-b border-gray-200">
                        <span className="text-[10px] font-black text-black uppercase tracking-[0.2em]">(-) IMPOSTOS ({taxesPercentage}%)</span>
                        <span className="text-[14px] font-bold text-black">{formatCurrency(taxesValue)}</span>
                     </div>
                   )}
                   
                   {/* CAIXA LÍQUIDA CLEAN */}
                   <div className="border-2 border-black bg-white text-black p-5 rounded-[16px] flex justify-between items-center mt-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-[#ffa800] uppercase tracking-[0.4em] mb-1 italic">VALOR LÍQUIDO</span>
                        <span className="text-[11px] font-bold text-black uppercase">TOTAL A RECEBER</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[26px] font-black tracking-tighter leading-none">{formattedTotalLiquido}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* ASSINATURA E RODAPÉ */}
          <div className="pt-8 border-t-[1.5mm] border-black mt-10">
             <div className="flex gap-12 items-end">
                <div className="flex-grow text-center flex flex-col items-center">
                   <div className="relative w-80">
                      <div className="h-24 flex items-end justify-center mb-[-4px]">
                         {provider.signature && <img src={provider.signature} className="max-h-[160%] w-auto object-contain translate-y-7 scale-110" alt="Assinatura" />}
                      </div>
                      <div className="w-full h-[0.6mm] bg-black mb-4"></div>
                      <p className="font-black text-black text-[12px] uppercase leading-none mb-1">{provider.name || "ASSINATURA DO EMISSOR"}</p>
                      <p className="text-black font-bold text-[8px] uppercase tracking-widest italic">VALOR RECEBIDO E QUITADO INTEGRALMENTE</p>
                   </div>
                   <div className="mt-6 flex items-center gap-2.5 border border-black px-5 py-2 rounded-full">
                       <ShieldCheck size={14} className="text-[#ffa800]"/><span className="text-[8px] font-black text-black uppercase tracking-[0.3em]">DOCUMENTO VALIDADO DIGITALMENTE</span>
                   </div>
                </div>
                <div className="w-72">
                   <div className="border-[3px] border-[#ffa800] bg-white rounded-[24px] p-6 text-center">
                      <span className="text-[10px] font-black uppercase text-black tracking-[0.3em] block mb-2 italic">LÍQUIDO A PAGAR</span>
                      <span className="text-[26px] font-black text-black tracking-tighter leading-none block">{formattedTotalLiquido}</span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
