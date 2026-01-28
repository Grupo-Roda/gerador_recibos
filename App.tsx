import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Plus, Trash2, Printer, User, Briefcase, Mail, X, 
  Loader2, Image as ImageIcon, AlertCircle, ShieldCheck, 
  Phone as PhoneIcon, MapPin, Upload, Download, Wallet, History, Trash, CheckCircle2
} from 'lucide-react';
import { ReceiptType, ProviderInfo, ReceiptItem, CLIENT_DATA, ReceiptData } from './types';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [provider, setProvider] = useState<ProviderInfo>(() => {
    const saved = localStorage.getItem('rodamoinho_provider');
    return saved ? JSON.parse(saved) : {
      name: '', document: '', address: '', phone: '', email: '', bankInfo: '', signature: ''
    };
  });

  const [logo, setLogo] = useState<string | null>(() => localStorage.getItem('rodamoinho_logo'));
  const [receiptNumber, setReceiptNumber] = useState<string>(() => {
    const lastNum = localStorage.getItem('rodamoinho_last_number');
    const nextNum = lastNum && !isNaN(parseInt(lastNum)) ? parseInt(lastNum) + 1 : 1;
    return nextNum.toString().padStart(4, '0');
  });

  const [receiptType, setReceiptType] = useState<ReceiptType>(ReceiptType.REIMBURSEMENT);
  const [items, setItems] = useState<ReceiptItem[]>([{ id: '1', description: '', value: 0 }]);
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [city, setCity] = useState('Rio de Janeiro');

  const [history, setHistory] = useState<ReceiptData[]>(() => {
    const saved = localStorage.getItem('rodamoinho_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const providerSectionRef = useRef<HTMLElement>(null);
  const itemsSectionRef = useRef<HTMLElement>(null);

  useEffect(() => { localStorage.setItem('rodamoinho_provider', JSON.stringify(provider)); }, [provider]);
  useEffect(() => { if (logo) localStorage.setItem('rodamoinho_logo', logo); else localStorage.removeItem('rodamoinho_logo'); }, [logo]);
  useEffect(() => { localStorage.setItem('rodamoinho_history', JSON.stringify(history)); }, [history]);
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

  const totalLiquido = items.reduce((acc, item) => acc + item.value, 0);

  const getCanvasCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };

  const startDrawing = (e: any) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1f2c';
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (e.cancelable) e.preventDefault();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) setProvider({ ...provider, signature: canvasRef.current.toDataURL() });
  };

  const clearSignature = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setProvider({ ...provider, signature: '' });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};
    if (!provider.name.trim()) newErrors.providerName = true;
    if (!provider.document.trim()) newErrors.providerDoc = true;
    if (!city.trim()) newErrors.city = true;
    if (!provider.bankInfo.trim()) newErrors.bankInfo = true;
    items.forEach((item) => {
      if (!item.description.trim()) newErrors[`itemDesc_${item.id}`] = true;
      if (item.value <= 0) newErrors[`itemValue_${item.id}`] = true;
    });
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setStatusMessage({ type: 'error', text: 'Preencha os campos obrigatórios.' });
      return false;
    }
    return true;
  };

  const generatePDF = async (shouldDownload: boolean = true) => {
    if (!validateForm()) return null;
    setIsPrinting(true);
    const element = document.getElementById('printable-receipt');
    if (!element) return null;
    try {
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      const fileName = `Recibo_${receiptNumber}_Rodamoinho.pdf`;
      if (shouldDownload) pdf.save(fileName);
      setHistory(prev => [{ id: receiptNumber, date, type: receiptType, items: [...items], city, provider: { ...provider }, taxes: { iss: 0, irrf: 0, inss: 0 } }, ...prev]);
      setReceiptNumber((parseInt(receiptNumber) + 1).toString().padStart(4, '0'));
      localStorage.setItem('rodamoinho_last_number', receiptNumber);
      setStatusMessage({type: 'success', text: 'PDF Gerado!'});
      return { fileName, blob: pdf.output('blob') };
    } catch (e) {
      setStatusMessage({type: 'error', text: 'Erro ao gerar PDF.'});
      return null;
    } finally { setIsPrinting(false); }
  };

  const handleEmail = async () => {
    const pdfData = await generatePDF(false);
    if (!pdfData) return;
    const { fileName, blob } = pdfData;
    const subject = `RECIBO ${receiptNumber} - ${provider.name}`;
    const bodyText = `Olá,\n\nSegue recibo nº ${receiptNumber}.\nValor: R$ ${totalLiquido.toFixed(2)}\n\nAtenciosamente,\n${provider.name}`;
    if (navigator.share) {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      try { await navigator.share({ files: [file], title: subject, text: bodyText }); return; } catch (err) {}
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    window.open(`mailto:financeiro@rodamoinho.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`);
  };

  const getFieldClass = (key: string, base: string = "") => `${base} ${errors[key] ? 'border-rose-500' : 'border-slate-100'}`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8fafc]">
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 ${statusMessage.type === 'success' ? 'bg-slate-900 text-emerald-400' : 'bg-rose-600 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-xs font-black uppercase tracking-widest">{statusMessage.text}</span>
        </div>
      )}

      <div className="lg:w-2/5 p-6 lg:p-8 no-print overflow-y-auto max-h-screen border-r border-slate-200 bg-white">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-orange-600 p-2.5 rounded-2xl text-white shadow-xl shadow-orange-600/20"><FileText size={22} /></div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase italic">RODAMOINHO</h1>
              <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1.5">Gerador de Recibos</p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
            <button onClick={() => setActiveTab('form')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl ${activeTab === 'form' ? 'bg-white text-orange-600' : 'text-slate-400'}`}>Gerador</button>
            <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl ${activeTab === 'history' ? 'bg-white text-orange-600' : 'text-slate-400'}`}>Arquivos</button>
          </div>
        </header>

        {activeTab === 'form' ? (
          <div className="space-y-8">
            <section ref={providerSectionRef} className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100">
              <div className="flex items-center gap-3 mb-8 text-orange-600"><User size={18} /><h3 className="font-black uppercase text-[11px] tracking-[0.2em]">Emissor</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                   {logo ? (
                     <div className="relative inline-block border-2 border-white bg-white p-3 rounded-2xl group"><img src={logo} className="h-16 w-auto" /><button onClick={() => setLogo(null)} className="absolute -top-3 -right-3 bg-rose-500 text-white p-1 rounded-full"><X size={12}/></button></div>
                   ) : (
                     <label className="h-24 w-full border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center cursor-pointer hover:bg-white text-slate-400">
                       <Upload size={24} /><span className="text-[9px] font-black mt-2 uppercase">Logo</span>
                       <input type="file" className="hidden" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setLogo(reader.result as string); reader.readAsDataURL(file); } }} />
                     </label>
                   )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Nome *</label>
                  <input type="text" className={getFieldClass('providerName', "w-full px-5 py-3.5 bg-white border rounded-2xl font-bold uppercase text-[13px] outline-none")} value={provider.name} onChange={e => setProvider({...provider, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Doc *</label>
                  <input type="text" className={getFieldClass('providerDoc', "w-full px-5 py-3.5 bg-white border rounded-2xl font-bold text-[13px] outline-none")} value={provider.document} onChange={e => setProvider({...provider, document: maskDocument(e.target.value)})} />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400">Dados Bancários / PIX *</label>
                  <textarea className={getFieldClass('bankInfo', "w-full px-5 py-4 bg-white border rounded-2xl font-bold uppercase text-[13px] h-20 resize-none outline-none")} value={provider.bankInfo} onChange={e => setProvider({...provider, bankInfo: e.target.value})} />
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase text-slate-400">Assinatura</label><button onClick={clearSignature} className="text-[9px] font-black text-orange-600 uppercase">Limpar</button></div>
                  <div className="h-32 bg-white rounded-[24px] border-2 border-slate-100 relative cursor-crosshair overflow-hidden touch-none">
                    <canvas ref={canvasRef} width={800} height={200} className="absolute inset-0 w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                  </div>
                </div>
              </div>
            </section>

            <section ref={itemsSectionRef} className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100">
              <div className="flex items-center justify-between mb-8"><div className="flex items-center gap-3 text-orange-600"><Briefcase size={18}/><h3 className="font-black uppercase text-[11px] tracking-[0.2em]">Itens</h3></div></div>
              <div className="space-y-5">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-6 bg-white rounded-[24px] border border-slate-100/50 space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-grow space-y-1.5">
                        <label className="text-[9px] font-black text-orange-600 uppercase">Item #{idx+1}</label>
                        <input type="text" className={getFieldClass(`itemDesc_${item.id}`, "w-full px-5 py-3.5 bg-slate-50/50 border rounded-2xl font-bold uppercase text-[13px] outline-none")} value={item.description} onChange={e => setItems(items.map(i => i.id === item.id ? {...i, description: e.target.value} : i))} />
                      </div>
                      <div className="w-32 space-y-1.5">
                        <label className="text-[9px] font-black text-orange-600 uppercase">Valor R$</label>
                        <input type="number" className={getFieldClass(`itemValue_${item.id}`, "w-full px-5 py-3.5 bg-slate-50/50 border rounded-2xl font-black text-right text-[15px] outline-none")} value={item.value || ''} onChange={e => setItems(items.map(i => i.id === item.id ? {...i, value: parseFloat(e.target.value) || 0} : i))} />
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={() => setItems([...items, {id: Math.random().toString(), description:'', value:0}])} className="w-full py-4 border-2 border-dashed border-orange-200 rounded-[24px] text-orange-600 font-black uppercase text-[10px] flex items-center justify-center gap-3 hover:bg-orange-50"><Plus size={18}/> Novo Item</button>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-6 sticky bottom-6">
              <button onClick={() => generatePDF(true)} disabled={isPrinting} className="py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[11px] shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50">
                {isPrinting ? <Loader2 size={22} className="animate-spin"/> : <Printer size={22}/>} Baixar PDF
              </button>
              <button onClick={handleEmail} disabled={isPrinting} className="py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase text-[11px] flex items-center justify-center gap-3">
                <Mail size={22}/> Enviar E-mail
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {history.length === 0 ? <div className="text-center py-24 text-slate-200">Vazio</div> : history.map(entry => (
              <div key={entry.id} className="bg-slate-50 p-6 rounded-[28px] flex items-center justify-between border border-slate-100 group shadow-sm">
                <div><p className="text-[12px] font-black uppercase">{entry.provider.name}</p><p className="text-[9px] font-bold text-slate-400 mt-1">{new Date(entry.date).toLocaleDateString()}</p></div>
                <div className="flex items-center gap-4">
                  <p className="text-[15px] font-black">R$ {entry.items.reduce((acc, i) => acc + i.value, 0).toFixed(2)}</p>
                  <button onClick={() => setHistory(prev => prev.filter(h => h.id !== entry.id))} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl"><Trash size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="lg:w-3/5 bg-slate-200/50 p-6 lg:p-12 flex justify-center items-start overflow-y-auto h-screen no-print">
        <div className="bg-white shadow-2xl relative scale-[0.6] md:scale-[0.8] lg:scale-[1] origin-top" id="printable-receipt" style={{ width: '210mm', minHeight: '297mm', padding: '12mm 15mm', boxSizing: 'border-box' }}>
          <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-6">
              {logo && <img src={logo} className="h-14 w-auto object-contain" />}
              <div className="border-l border-slate-100 pl-6"><h1 className="text-[28px] font-black uppercase italic">RODAMOINHO</h1><p className="text-[9px] font-black text-orange-600 uppercase tracking-[0.5em] mt-2">PRODUÇÕES ARTÍSTICAS</p></div>
            </div>
            <div className="text-right"><div className="bg-orange-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase mb-2">DOC Nº {receiptNumber}</div></div>
          </div>
          <h2 className="text-[20px] font-black uppercase tracking-[0.4em] text-center mb-8">RECIBO DE <span className="text-orange-600">{receiptType}</span></h2>
          <div className="grid grid-cols-2 gap-10 mb-8">
             <div className="p-6 bg-slate-50/50 rounded-[24px] space-y-1.5 text-[10px] border border-slate-100/50">
                <p className="font-black text-[11px] mb-0.5">{CLIENT_DATA.name}</p>
                <p className="text-slate-500 font-bold">CNPJ: {CLIENT_DATA.cnpj}</p>
                <p className="text-slate-400 font-bold uppercase">{CLIENT_DATA.address}<br/>{CLIENT_DATA.cep}</p>
             </div>
             <div className="bg-[#1a1f2c] rounded-[36px] p-8 flex flex-col items-center justify-center text-center shadow-xl text-white">
                <Wallet className="text-orange-600 mb-2" size={28}/>
                <p className="text-orange-600 text-[9px] font-black uppercase mb-2">VALOR LÍQUIDO</p>
                <p className="text-[34px] font-black">R$ {totalLiquido.toFixed(2)}</p>
             </div>
          </div>
          <table className="w-full mb-8">
            <thead><tr className="bg-slate-50/80 border-y border-slate-100"><th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase">DESCRIÇÃO</th><th className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase">VALOR (R$)</th></tr></thead>
            <tbody className="divide-y divide-slate-100/60">{items.map((item, i) => (<tr key={item.id}><td className="py-5 px-6 font-black text-[13px] uppercase">{i+1}. {item.description}</td><td className="py-5 px-6 text-right font-black text-[14px]">{item.value.toFixed(2)}</td></tr>))}</tbody>
          </table>
          <div className="pt-8 border-t-4 border-[#1a1f2c] flex flex-col items-center">
             <div className="h-28 flex items-end mb-2">{provider.signature && <img src={provider.signature} className="h-24 w-auto" />}</div>
             <div className="w-72 h-1 bg-[#1a1f2c] mb-4"></div>
             <p className="font-black text-[14px] uppercase">{provider.name || "NOME DO EMISSOR"}</p>
             <p className="text-slate-400 text-[8px] font-black uppercase">{provider.document || "DOCUMENTO"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
