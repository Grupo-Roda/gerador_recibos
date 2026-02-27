
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  Sparkles, 
  X, 
  Loader2, 
  Image as ImageIcon, 
  AlertCircle, 
  Eraser, 
  ShieldCheck, 
  Upload,
  Wallet,
  CheckCircle2,
  Lock,
  Building2,
  Calculator,
  Percent,
  MinusCircle,
  MapPin,
  Mail
} from 'lucide-react';
import { ReceiptType, ProviderInfo, ReceiptItem, TOMADORES_LIST, ReceiptData } from './types';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import extenso from 'extenso';

// Componente de Cabeçalho Reutilizável (Tipográfico - Sem Logo)
const ReceiptHeader: React.FC<{ receiptNumber: string, city: string }> = ({ receiptNumber, city }) => (
  <div className="flex justify-between items-start mb-10 pb-10 border-b border-slate-100 w-full">
    <div className="flex flex-col">
      <img src={logoEmpresa} alt="Grupo Rodamoinho" className="h-12 w-auto object-contain mb-4" />
      <h1 className="text-[28px] font-black tracking-tight uppercase leading-none italic text-slate-900">GRUPO RODAMOINHO</h1>
      <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mt-4 flex items-center gap-3">
        <span className="h-[1px] w-6 bg-slate-900"></span>
        RECIBO SIMPLES
      </p>
    </div>
    <div className="text-right flex flex-col items-end">
      <div className="bg-slate-900 text-white px-14 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] mb-4 shadow-lg">
        NÚMERO: {receiptNumber}
      </div>
      <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.15em] leading-none">
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
  
  // Dados do formulário
  const [provider, setProvider] = useState<ProviderInfo>(() => {
    const saved = localStorage.getItem('recibos_provider');
    return saved ? JSON.parse(saved) : { name: '', document: '', address: '', phone: '', email: '', bankInfo: '', signature: '' };
  });
  
  const [selectedTomadorIndex, setSelectedTomadorIndex] = useState(0);

  const generateReceiptNumber = () => {
    const now = new Date();
    const datePart = now.getFullYear().toString() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
    const randomPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return datePart + randomPart;
  };

  const [receiptNumber, setReceiptNumber] = useState<string>(() => generateReceiptNumber());

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
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isPrinting, setIsPrinting] = useState(false);

  // Refs para Assinatura
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Persistência
  useEffect(() => { localStorage.setItem('recibos_provider', JSON.stringify(provider)); }, [provider]);
  useEffect(() => { localStorage.setItem('recibos_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { if (statusMessage) { const timer = setTimeout(() => setStatusMessage(null), 4000); return () => clearTimeout(timer); } }, [statusMessage]);

  // Validações e Máscaras
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
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
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
      
      setReceiptNumber(generateReceiptNumber());
      localStorage.setItem('recibos_last_number', receiptNumber);
      setStatusMessage({ type: 'success', text: 'Recibo gerado com sucesso!' });
    } catch (e) {
      setStatusMessage({ type: 'error', text: 'Erro ao processar PDF.' });
    } finally { setIsPrinting(false); }
  };

  const loginAdmin = () => {
    if (adminPassword === "senha123") {
      setIsAdmin(true);
      localStorage.setItem('recibos_admin', 'autenticado');
    } else { setStatusMessage({ type: 'error', text: 'Senha incorreta.' }); }
  };

  const resetForm = () => {
    setItems([{ id: Date.now().toString(), description: '', value: 0 }]);
    setDiscount(0);
    setTaxesPercentage(0);
    setReceiptNumber(generateReceiptNumber());
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

      {/* PAINEL DE CONTROLE */}
      <div className="lg:w-2/5 p-6 lg:p-8 no-print overflow-y-auto max-h-screen border-r border-slate-200 bg-white no-scrollbar">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-2.5 rounded-2xl text-white shadow-xl shadow-slate-900/20"><FileText size={22} /></div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">GRUPO RODAMOINHO</h1>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setActiveTab('form')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'form' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Gerador</button>
            <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'}`}>Histórico</button>
          </div>
        </header>

        {activeTab === 'form' ? (
          <div className="space-y-8 pb-20">
            {/* Empresa Tomadora */}
            <section className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-slate-900 mb-6 flex items-center gap-2"><Building2 size={16}/> Empresa Tomadora</h3>
              <div className="space-y-3">
                {TOMADORES_LIST.map((tomador, idx) => (
                  <button key={idx} onClick={() => setSelectedTomadorIndex(idx)} className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${selectedTomadorIndex === idx ? 'bg-white border-slate-900 shadow-md' : 'bg-white/50 border-slate-100 hover:border-slate-300'}`}>
                    <div>
                      <p className={`text-[10px] font-black uppercase mb-0.5 ${selectedTomadorIndex === idx ? 'text-slate-900' : 'text-slate-700'}`}>{tomador.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CNPJ: {tomador.cnpj}</p>
                    </div>
                    {selectedTomadorIndex === idx && <CheckCircle2 size={16} className="text-slate-900 shrink-0"/>}
                  </button>
                ))}
              </div>
            </section>

            {/* Prestador */}
            <section className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-slate-900">Emissor (Prestador)</h3>
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
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase text-slate-400">Assinatura Digital</label><button onClick={clearSignature} className="text-[9px] font-black text-slate-900 uppercase">Limpar</button></div>
                  <div className="h-40 bg-white rounded-[24px] border-2 border-slate-100 relative cursor-crosshair overflow-hidden touch-none shadow-inner">
                    <canvas ref={canvasRef} width={800} height={250} className="absolute inset-0 w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                  </div>
                </div>
              </div>
            </section>

            {/* Serviços e Resumo Financeiro */}
            <section className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm">
              <h3 className="font-black uppercase text-[11px] tracking-[0.2em] text-slate-900 mb-6 flex items-center gap-2"><Calculator size={16}/> Detalhamento Financeiro</h3>
              <div className="space-y-4 mb-8">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-5 bg-white rounded-[24px] shadow-sm border border-slate-100/50 space-y-3">
                    <div className="flex gap-4 items-start">
                      <div className="flex-grow space-y-1">
                        <label className="text-[9px] font-black text-slate-900 uppercase">Descrição do Serviço *</label>
                        <div className="relative">
                          <input type="text" className={getFieldClass(`itemDesc_${item.id}`, "w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-bold uppercase text-[12px] pr-10")} value={item.description} onChange={e => setItems(items.map(i => i.id === item.id ? {...i, description: e.target.value} : i))} />
                        </div>
                      </div>
                      <div className="w-28 space-y-1 shrink-0">
                        <label className="text-[9px] font-black text-slate-900 uppercase text-right block">Valor R$ *</label>
                        <input type="number" className={getFieldClass(`itemValue_${item.id}`, "w-full px-4 py-2.5 bg-slate-50 border rounded-xl font-black text-right text-[14px]")} value={item.value || ''} onChange={e => setTaxesPercentage(0) || setItems(items.map(i => i.id === item.id ? {...i, value: parseFloat(e.target.value) || 0} : i))} />
                      </div>
                      {items.length > 1 && <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-slate-200 hover:text-rose-500 mt-8 shrink-0"><Trash2 size={18}/></button>}
                    </div>
                  </div>
                ))}
                <button onClick={() => setItems([...items, {id: Date.now().toString(), description:'', value:0}])} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-[20px] text-slate-900 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"><Plus size={16}/> Novo Item</button>
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
              <button onClick={() => generatePDF(true)} disabled={isPrinting} className="w-full py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.25em] shadow-2xl shadow-slate-900/40 hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
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
                <input type="password" placeholder="Senha" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && loginAdmin()} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl text-center font-black uppercase tracking-widest text-[14px] outline-none focus:ring-4 ring-slate-100" />
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

      {/* PRÉ-VISUALIZAÇÃO A4 */}
      <div className="lg:w-3/5 bg-slate-200/30 p-6 lg:p-12 flex justify-center items-start overflow-y-auto h-screen no-scrollbar no-print">
        <div className="bg-white shadow-2xl flex flex-col relative scale-[0.6] md:scale-[0.8] lg:scale-[1] origin-top" id="printable-receipt" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 20mm', boxSizing: 'border-box', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', color: '#1a1f2c', fontFamily: "'Inter', sans-serif" }}>
          
          <ReceiptHeader receiptNumber={receiptNumber} city={city} />

          <div className="mb-8 text-center">
            <h2 className="text-[18px] font-black uppercase tracking-[0.2em] text-slate-900">RECIBO DE <span className="text-slate-900">PAGAMENTO</span></h2>
          </div>

          <div className="grid grid-cols-2 gap-10 mb-10">
             <div className="space-y-6">
                <div>
                   <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 italic">01. DADOS DO PAGADOR</h4>
                   <div className="p-6 bg-slate-100 rounded-[28px] space-y-1.5 text-[10px] border border-slate-200 shadow-sm">
                      <p className="font-black text-[12px] text-slate-900 uppercase leading-tight mb-1">{selectedTomador.name}</p>
                      <p className="text-slate-500 font-bold uppercase tracking-normal">CNPJ: {selectedTomador.cnpj}</p>
                      <p className="text-slate-400 font-bold uppercase leading-relaxed tracking-normal">{selectedTomador.address}</p>
                      <p className="text-slate-400 font-bold uppercase tracking-normal">{selectedTomador.neighborhood} - CEP: {selectedTomador.cep}</p>
                   </div>
                </div>
                <div>
                   <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 italic">02. DADOS DO RECEBEDOR</h4>
                   <div className="p-6 bg-slate-100 border border-slate-200 rounded-[28px] space-y-1.5 text-[10px] shadow-sm">
                      <p className="font-black text-[12px] uppercase text-slate-900 leading-tight mb-1">{provider.name || "---"}</p>
                      <p className="text-slate-500 font-bold uppercase tracking-normal">DOC: {provider.document || "---"}</p>
                      {provider.address && <p className="text-slate-400 font-bold uppercase leading-tight tracking-normal">{provider.address}</p>}
                      {provider.phone && <p className="text-slate-400 font-bold tracking-normal">{provider.phone}</p>}
                      {provider.email && <p className="text-slate-400 font-bold lowercase italic tracking-normal">{provider.email}</p>}
                   </div>
                </div>
             </div>
             <div className="flex flex-col gap-6">
                <div className="bg-slate-900 rounded-[40px] p-8 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden flex-grow min-h-[180px]">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                   <Wallet className="text-slate-400 mb-3" size={32}/>
                   <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mb-2">VALOR TOTAL BRUTO</p>
                   <p className="text-white text-[36px] font-black tracking-normal leading-none tabular-nums">{formatCurrency(totalBruto)}</p>
                </div>
                <div className="bg-slate-100 p-6 rounded-[28px] text-center border border-slate-200">
                   <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">FORMA DE CRÉDITO:</h4>
                   <p className="text-[12px] font-black text-slate-900 uppercase italic leading-tight tracking-normal">{provider.bankInfo || "A COMBINAR"}</p>
                </div>
             </div>
          </div>

          <div className="flex-grow">
             <table className="w-full border-collapse">
                <thead>
                   <tr className="bg-slate-50 border-y border-slate-200">
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">ITEM E DESCRIÇÃO DOS SERVIÇOS</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase w-48 tracking-[0.15em]">VALOR BRUTO (R$)</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {items.map((item, i) => (
                     <tr key={item.id}>
                        <td className="py-5 px-6">
                           <div className="flex items-center gap-5">
                              <div className="bg-slate-900 text-white w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-md">
                               {String(i+1).padStart(2, '0')}
                              </div>
                              <p className="text-slate-900 font-black text-[12px] uppercase tracking-normal leading-relaxed">{item.description || "SERVIÇOS PRESTADOS"}</p>
                           </div>
                        </td>
                        <td className="py-5 px-6 text-right font-black text-slate-900 text-[15px] tabular-nums tracking-normal">
                          {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.value)}
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>

             <div className="mt-10">
                <div className="w-full space-y-3">
                   <div className="flex justify-between items-center py-2 px-8 border-b border-slate-50">
                      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">SUBTOTAL BRUTO</span>
                      <span className="text-[16px] font-black text-slate-600 tabular-nums tracking-normal">{formatCurrency(totalBruto)}</span>
                   </div>
                   
                   {discount > 0 && (
                     <div className="flex justify-between items-center py-2 px-8 border-b border-slate-50">
                        <span className="text-[11px] font-black text-rose-500 uppercase tracking-[0.1em]">(-) DESCONTOS</span>
                        <span className="text-[16px] font-black text-rose-500 tabular-nums tracking-normal">{formatCurrency(discount)}</span>
                     </div>
                   )}
                   
                   {taxesPercentage > 0 && (
                     <div className="flex justify-between items-center py-2 px-8 border-b border-slate-50">
                        <span className="text-[11px] font-black text-rose-500 uppercase tracking-[0.1em]">(-) IMPOSTOS ({taxesPercentage}%)</span>
                        <span className="text-[14px] font-black text-rose-500 tabular-nums tracking-normal">{formatCurrency(taxesValue)}</span>
                     </div>
                   )}
                   
                   <div className="bg-slate-900 text-white p-10 rounded-[48px] flex flex-col items-center justify-center text-center shadow-2xl mt-6 relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16"></div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 italic">VALOR LÍQUIDO TOTAL A RECEBER</span>
                      <span className="text-[42px] font-black tracking-normal leading-none tabular-nums mb-4">{formattedTotalLiquido}</span>
                      <div className="max-w-[80%] border-t border-white/10 pt-4">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                          ({extenso(totalLiquido, { mode: 'currency' })})
                        </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="mt-12 pt-10 border-t border-slate-200">
             <div className="flex gap-12 items-start">
                <div className="flex-grow text-center flex flex-col items-center">
                   <div className="relative w-full max-w-sm">
                      <div className="h-24 flex items-end justify-center mb-[-2px]">
                         {provider.signature && <img src={provider.signature} className="max-h-[160%] w-auto object-contain translate-y-7 scale-110 mix-blend-multiply" alt="Assinatura" />}
                      </div>
                      <div className="w-full h-[0.6mm] bg-slate-900 mb-4"></div>
                      <p className="font-black text-slate-900 text-[12px] uppercase leading-none mb-1 tracking-normal">{provider.name || "ASSINATURA DO EMISSOR"}</p>
                      <p className="text-slate-400 font-bold text-[8px] uppercase tracking-[0.15em] italic">VALOR RECEBIDO E QUITADO INTEGRALMENTE</p>
                   </div>
                   <div className="mt-6 flex items-center gap-2.5 bg-slate-50 px-5 py-2 rounded-full border border-slate-200">
                       <ShieldCheck size={12} className="text-slate-900"/><span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">DOCUMENTO VALIDADO DIGITALMENTE</span>
                   </div>
                </div>
                <div className="w-full">
                   <div className="bg-slate-100 border border-slate-200 rounded-[40px] p-10 flex flex-col items-center justify-center text-center gap-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-slate-900/5 rounded-full -mr-10 -mt-10"></div>
                      <div className="bg-slate-900 p-4 rounded-2xl shrink-0 shadow-lg">
                        <div className="grid grid-cols-2 gap-1">
                          <div className="w-2 h-2 bg-white"></div>
                          <div className="w-2 h-2 bg-white"></div>
                          <div className="w-2 h-2 bg-white"></div>
                          <div className="w-2 h-2 bg-white/20"></div>
                        </div>
                      </div>
                      <div className="max-w-md">
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em] block mb-2">VERIFICAÇÃO DIGITAL</span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed tracking-normal">
                          ESTE DOCUMENTO PODE SER VALIDADO ATRAVÉS DO SISTEMA INTERNO DO GRUPO RODAMOINHO.
                        </p>
                      </div>
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
