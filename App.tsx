
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  User, 
  Briefcase, 
  Sparkles, 
  Mail, 
  X, 
  Loader2, 
  Image as ImageIcon, 
  AlertCircle, 
  Eraser, 
  ShieldCheck, 
  Phone as PhoneIcon, 
  MapPin,
  Upload,
  Download,
  Wallet,
  ArrowRight,
  Calendar,
  History,
  Trash,
  CheckCircle2,
  Share2
} from 'lucide-react';
import { ReceiptType, ProviderInfo, ReceiptItem, CLIENT_DATA, ReceiptData } from './types';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [provider, setProvider] = useState<ProviderInfo>(() => {
    const saved = localStorage.getItem('rodamoinho_provider');
    return saved ? JSON.parse(saved) : {
      name: '',
      document: '',
      address: '',
      phone: '',
      email: '',
      bankInfo: '',
      signature: ''
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

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [isPrinting, setIsPrinting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Refs para rolagem em caso de erro
  const providerSectionRef = useRef<HTMLElement>(null);
  const itemsSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem('rodamoinho_provider', JSON.stringify(provider));
  }, [provider]);

  useEffect(() => {
    if (logo) localStorage.setItem('rodamoinho_logo', logo);
    else localStorage.removeItem('rodamoinho_logo');
  }, [logo]);

  useEffect(() => {
    localStorage.setItem('rodamoinho_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const maskDocument = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const maskPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const totalBruto = items.reduce((acc, item) => acc + item.value, 0);
  const totalLiquido = totalBruto;

  const getCanvasCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
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
    let hasProviderError = false;
    let hasItemsError = false;

    if (!provider.name.trim()) { newErrors.providerName = true; hasProviderError = true; }
    if (!provider.document.trim()) { newErrors.providerDoc = true; hasProviderError = true; }
    if (!city.trim()) { newErrors.city = true; hasProviderError = true; }
    if (!provider.bankInfo.trim()) { newErrors.bankInfo = true; hasProviderError = true; }

    items.forEach((item) => {
      if (!item.description.trim()) { newErrors[`itemDesc_${item.id}`] = true; hasItemsError = true; }
      if (item.value <= 0) { newErrors[`itemValue_${item.id}`] = true; hasItemsError = true; }
    });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setStatusMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios destacadados em vermelho.' });
      
      // Scroll para o primeiro erro
      if (hasProviderError) {
        providerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (hasItemsError) {
        itemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
      const canvas = await html2canvas(element, { 
        scale: 3, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      const fileName = `Recibo_${receiptNumber}_Rodamoinho.pdf`;
      
      if (shouldDownload) {
        pdf.save(fileName);
      }

      const newEntry: ReceiptData = {
        id: receiptNumber,
        date,
        type: receiptType,
        items: [...items],
        city,
        provider: { ...provider },
        taxes: { iss: 0, irrf: 0, inss: 0 }
      };
      setHistory(prev => [newEntry, ...prev]);

      const nextNum = (parseInt(receiptNumber) + 1).toString().padStart(4, '0');
      setReceiptNumber(nextNum);
      localStorage.setItem('rodamoinho_last_number', receiptNumber);
      
      setStatusMessage({type: 'success', text: shouldDownload ? 'PDF gerado com sucesso!' : 'Documento preparado!'});
      
      return {
        fileName,
        blob: pdf.output('blob'),
        pdf
      };
    } catch (e) {
      console.error(e);
      setStatusMessage({type: 'error', text: 'Erro ao processar o documento.'});
      return null;
    } finally {
      setIsPrinting(false);
    }
  };

  const handleEmail = async () => {
    const pdfData = await generatePDF(false); // Não baixa automaticamente para tentar o share primeiro
    if (!pdfData) return;

    const { fileName, blob } = pdfData;
    const bodyText = `Olá Equipe Financeira,\n\nSegue em anexo o recibo nº ${receiptNumber} referente a ${receiptType}.\n\nValor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLiquido)}\nPrestador: ${provider.name}\n\nAtenciosamente,\n${provider.name}`;
    const subject = `RECIBO ${receiptNumber} - ${provider.name}`;

    // Tenta usar a Web Share API (Nativa em Mobile/Safari/Edge) para anexar o arquivo real
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/pdf' })] })) {
      try {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({
          files: [file],
          title: subject,
          text: bodyText,
        });
        setStatusMessage({type: 'success', text: 'Compartilhamento iniciado!'});
        return;
      } catch (err) {
        console.error("Erro ao compartilhar:", err);
        // Fallback se o usuário cancelar ou der erro
      }
    }

    // Fallback: Baixa o arquivo e abre o cliente de e-mail (Comportamento Desktop Padrão)
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();

    const mailto = `mailto:financeiro@rodamoinho.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.open(mailto, '_blank');
    setStatusMessage({type: 'success', text: 'PDF baixado. Favor anexar ao e-mail aberto.'});
  };

  const enhanceDescription = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.description.length < 3) return;
    
    setIsEnhancing(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Refine esta descrição de despesa para um recibo profissional em português. Mantenha curto e formal: "${item.description}". Retorne APENAS o texto refinado.`
      });
      
      const refinedText = response.text?.trim();
      if (refinedText) {
        setItems(items.map(i => i.id === id ? { ...i, description: refinedText } : i));
        setStatusMessage({type: 'success', text: 'Descrição otimizada pela IA.'});
        if (errors[`itemDesc_${id}`]) {
          const newErrs = { ...errors };
          delete newErrs[`itemDesc_${id}`];
          setErrors(newErrs);
        }
      } else {
        throw new Error("Resposta vazia da IA");
      }
    } catch (err) {
      console.error("Erro no aprimoramento por IA:", err);
      setStatusMessage({type: 'error', text: 'Não foi possível usar a IA agora. Mantendo original.'});
    } finally {
      setIsEnhancing(false);
    }
  };

  const getFieldClass = (key: string, base: string = "") => {
    return `${base} ${errors[key] ? 'border-rose-500 ring-1 ring-rose-200 focus:ring-rose-300' : 'border-slate-100 focus:ring-orange-50'}`;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f8fafc]">
      
      {statusMessage && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 ${statusMessage.type === 'success' ? 'bg-slate-900 text-emerald-400' : 'bg-rose-600 text-white'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={20}/> : <AlertCircle size={20}/>}
          <span className="text-xs font-black uppercase tracking-widest">{statusMessage.text}</span>
        </div>
      )}

      {/* COLUNA ESQUERDA: CONTROLES */}
      <div className="lg:w-2/5 p-6 lg:p-8 no-print overflow-y-auto max-h-screen border-r border-slate-200 bg-white">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-orange-600 p-2.5 rounded-2xl text-white shadow-xl shadow-orange-600/20"><FileText size={22} /></div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none uppercase italic">RODAMOINHO</h1>
              <p className="text-orange-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1.5">Studio Profissional v6.4</p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
            <button 
              onClick={() => setActiveTab('form')}
              className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${activeTab === 'form' ? 'bg-white text-orange-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            >Gerador</button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-5 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all duration-300 ${activeTab === 'history' ? 'bg-white text-orange-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
            >Arquivos</button>
          </div>
        </header>

        {activeTab === 'form' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <section ref={providerSectionRef} className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm scroll-mt-6">
              <div className="flex items-center gap-3 mb-8 text-orange-600">
                <div className="p-2 bg-orange-100 rounded-lg"><User size={18} /></div>
                <h3 className="font-black uppercase text-[11px] tracking-[0.2em]">Perfil do Emissor</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                   <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block tracking-widest">Logo da Empresa</label>
                   {logo ? (
                     <div className="relative inline-block border-2 border-white bg-white p-3 rounded-2xl shadow-sm group">
                       <img src={logo} className="h-16 w-auto object-contain" />
                       <button onClick={() => setLogo(null)} className="absolute -top-3 -right-3 bg-rose-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                     </div>
                   ) : (
                     <label className="h-24 w-full border-2 border-dashed border-slate-200 rounded-[24px] flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-orange-200 transition-all text-slate-400 hover:text-orange-600 group">
                       <Upload size={24} className="group-hover:scale-110 transition-transform" />
                       <span className="text-[9px] font-black mt-2 uppercase tracking-widest">Carregar Logo</span>
                       <input type="file" className="hidden" accept="image/*" onChange={e => {
                         const file = e.target.files?.[0];
                         if (file) {
                           const reader = new FileReader();
                           reader.onloadend = () => setLogo(reader.result as string);
                           reader.readAsDataURL(file);
                         }
                       }} />
                     </label>
                   )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                    Nome / Razão * {errors.providerName && <span className="text-rose-500 animate-pulse">OBRIGATÓRIO</span>}
                  </label>
                  <input 
                    type="text" 
                    className={getFieldClass('providerName', "w-full px-5 py-3.5 bg-white border rounded-2xl font-bold uppercase text-[13px] shadow-sm outline-none transition-all")} 
                    value={provider.name} 
                    onChange={e => {
                      setProvider({...provider, name: e.target.value});
                      if (errors.providerName) setErrors(prev => ({...prev, providerName: false}));
                    }} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                    Documento * {errors.providerDoc && <span className="text-rose-500 animate-pulse">OBRIGATÓRIO</span>}
                  </label>
                  <input 
                    type="text" 
                    className={getFieldClass('providerDoc', "w-full px-5 py-3.5 bg-white border rounded-2xl font-bold text-[13px] shadow-sm outline-none transition-all")} 
                    placeholder="CPF ou CNPJ" 
                    value={provider.document} 
                    onChange={e => {
                      setProvider({...provider, document: maskDocument(e.target.value)});
                      if (errors.providerDoc) setErrors(prev => ({...prev, providerDoc: false}));
                    }} 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Telefone</label>
                  <input type="text" className="w-full px-5 py-3.5 bg-white border border-slate-100 rounded-2xl font-bold text-[13px] shadow-sm focus:ring-2 ring-orange-50 outline-none transition-all" value={provider.phone} onChange={e => setProvider({...provider, phone: maskPhone(e.target.value)})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                    Cidade * {errors.city && <span className="text-rose-500 animate-pulse">OBRIGATÓRIO</span>}
                  </label>
                  <input 
                    type="text" 
                    className={getFieldClass('city', "w-full px-5 py-3.5 bg-white border rounded-2xl font-bold uppercase text-[13px] shadow-sm outline-none transition-all")} 
                    value={city} 
                    onChange={e => {
                      setCity(e.target.value);
                      if (errors.city) setErrors(prev => ({...prev, city: false}));
                    }} 
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                    Dados Bancários / PIX * {errors.bankInfo && <span className="text-rose-500 animate-pulse">OBRIGATÓRIO</span>}
                  </label>
                  <textarea 
                    className={getFieldClass('bankInfo', "w-full px-5 py-4 bg-white border rounded-2xl font-bold uppercase text-[13px] h-20 resize-none shadow-sm outline-none transition-all")} 
                    placeholder="Banco, Agência, Conta ou Chave PIX" 
                    value={provider.bankInfo} 
                    onChange={e => {
                      setProvider({...provider, bankInfo: e.target.value});
                      if (errors.bankInfo) setErrors(prev => ({...prev, bankInfo: false}));
                    }} 
                  />
                </div>
                <div className="md:col-span-2 space-y-4">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Assinatura Digital</label><button onClick={clearSignature} className="text-[9px] font-black text-orange-600 uppercase hover:underline">Limpar Canvas</button></div>
                  <div className="h-32 bg-white rounded-[24px] border-2 border-slate-100 relative cursor-crosshair overflow-hidden touch-none shadow-inner group">
                    <canvas ref={canvasRef} width={800} height={200} className="absolute inset-0 w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                    {!provider.signature && <div className="absolute inset-0 flex items-center justify-center opacity-30 text-slate-300 text-[10px] font-black uppercase tracking-[0.4em] pointer-events-none group-hover:opacity-50 transition-opacity">Assine aqui</div>}
                  </div>
                </div>
              </div>
            </section>

            <section ref={itemsSectionRef} className="bg-slate-50/50 rounded-[32px] p-8 border border-slate-100 shadow-sm scroll-mt-6">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3 text-orange-600"><div className="p-2 bg-orange-100 rounded-lg"><Briefcase size={18}/></div><h3 className="font-black uppercase text-[11px] tracking-[0.2em]">Lançamentos</h3></div>
                <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                   {Object.values(ReceiptType).map(t => (
                     <button key={t} onClick={() => setReceiptType(t)} className={`px-4 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all duration-300 ${receiptType === t ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30' : 'text-slate-400 hover:text-slate-600'}`}>
                       {t === ReceiptType.SERVICE ? 'Serviço' : 'Reembolso'}
                     </button>
                   ))}
                </div>
              </div>
              <div className="space-y-5">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-6 bg-white rounded-[24px] shadow-sm border border-slate-100/50 space-y-4 group">
                    <div className="flex gap-4">
                      <div className="flex-grow space-y-1.5">
                        <label className="text-[9px] font-black text-orange-600 uppercase tracking-widest flex justify-between">
                          Item #{idx+1} {errors[`itemDesc_${item.id}`] && <span className="text-rose-500 animate-pulse">DESCRIÇÃO OBRIGATÓRIA</span>}
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            className={getFieldClass(`itemDesc_${item.id}`, "w-full px-5 py-3.5 bg-slate-50/50 border rounded-2xl font-bold uppercase text-[13px] pr-12 transition-colors")} 
                            value={item.description} 
                            onChange={e => {
                              setItems(items.map(i => i.id === item.id ? {...i, description: e.target.value} : i));
                              if (errors[`itemDesc_${item.id}`]) setErrors(prev => {
                                const newErrs = {...prev};
                                delete newErrs[`itemDesc_${item.id}`];
                                return newErrs;
                              });
                            }} 
                          />
                          <button onClick={() => enhanceDescription(item.id)} className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-orange-500 transition-colors ${isEnhancing ? 'animate-spin text-orange-400' : ''}`} title="Aprimorar com IA"><Sparkles size={18} /></button>
                        </div>
                      </div>
                      <div className="w-32 space-y-1.5">
                        <label className="text-[9px] font-black text-orange-600 uppercase tracking-widest text-right flex justify-between">
                          {errors[`itemValue_${item.id}`] && <span className="text-rose-500 text-[7px] animate-pulse">INVÁLIDO</span>} Valor R$
                        </label>
                        <input 
                          type="number" 
                          className={getFieldClass(`itemValue_${item.id}`, "w-full px-5 py-3.5 bg-slate-50/50 border rounded-2xl font-black text-slate-900 text-right text-[15px] transition-colors")} 
                          value={item.value || ''} 
                          onChange={e => {
                            setItems(items.map(i => i.id === item.id ? {...i, value: parseFloat(e.target.value) || 0} : i));
                            if (errors[`itemValue_${item.id}`]) setErrors(prev => {
                              const newErrs = {...prev};
                              delete newErrs[`itemValue_${item.id}`];
                              return newErrs;
                            });
                          }} 
                        />
                      </div>
                      {items.length > 1 && <button onClick={() => setItems(items.filter(i => i.id !== item.id))} className="mt-8 text-slate-200 hover:text-rose-500 transition-colors"><Trash2 size={20}/></button>}
                    </div>
                  </div>
                ))}
                <button onClick={() => setItems([...items, {id: Math.random().toString(), description:'', value:0}])} className="w-full py-4 border-2 border-dashed border-orange-200 rounded-[24px] text-orange-600 font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-orange-50 hover:border-orange-300 transition-all"><Plus size={18}/> Novo Item</button>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-6 sticky bottom-6 z-10">
              <button onClick={() => generatePDF(true)} disabled={isPrinting} className="py-5 bg-orange-600 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.25em] shadow-2xl shadow-orange-600/40 hover:bg-orange-700 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isPrinting ? <Loader2 size={22} className="animate-spin"/> : <Printer size={22}/>} Baixar PDF
              </button>
              <button onClick={handleEmail} disabled={isPrinting} className="py-5 bg-slate-900 text-white rounded-[24px] font-black uppercase text-[11px] tracking-[0.25em] shadow-xl hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3">
                {isPrinting ? <Loader2 size={22} className="animate-spin"/> : <Mail size={22}/>} Enviar E-mail
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 animate-in slide-in-from-right duration-500">
            {history.length === 0 ? (
              <div className="text-center py-24 text-slate-200"><History className="mx-auto mb-6 opacity-50" size={48}/><p className="text-[11px] font-black uppercase tracking-[0.4em]">Histórico Vazio</p></div>
            ) : (
              history.map(entry => (
                <div key={entry.id} className="bg-slate-50 p-6 rounded-[28px] flex items-center justify-between border border-slate-100 hover:border-orange-200 transition-all group shadow-sm">
                  <div className="flex items-center gap-5">
                    <div className="bg-white p-4 rounded-2xl font-black text-sm text-orange-600 shadow-sm group-hover:shadow-md transition-all">#{entry.id}</div>
                    <div><p className="text-[12px] font-black uppercase text-slate-900 leading-tight">{entry.provider.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{new Date(entry.date).toLocaleDateString('pt-BR')}</p></div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                       <p className="text-[15px] font-black text-slate-900 leading-none">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.items.reduce((acc, i) => acc + i.value, 0))}</p>
                       <p className="text-[8px] font-black text-orange-500 uppercase tracking-widest mt-1 opacity-70">{entry.type.split(' ')[0]}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => {
                        setReceiptNumber(entry.id);
                        setReceiptType(entry.type);
                        setItems(entry.items);
                        setCity(entry.city);
                        setProvider(entry.provider);
                        setActiveTab('form');
                      }} className="p-3 bg-white text-orange-600 rounded-xl shadow-sm hover:bg-orange-600 hover:text-white transition-all"><Download size={16}/></button>
                      <button onClick={() => setHistory(prev => prev.filter(h => h.id !== entry.id))} className="p-3 bg-white text-rose-500 rounded-xl shadow-sm hover:bg-rose-500 hover:text-white transition-all"><Trash size={16}/></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="lg:w-3/5 bg-slate-200/50 p-6 lg:p-12 flex justify-center items-start overflow-y-auto no-scrollbar h-screen no-print">
        <div 
          className="bg-white shadow-2xl flex flex-col relative scale-[0.6] md:scale-[0.8] lg:scale-[1] origin-top" 
          id="printable-receipt"
          style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            padding: '12mm 15mm', 
            boxSizing: 'border-box', 
            backgroundColor: '#ffffff', 
            display: 'flex', 
            flexDirection: 'column',
            color: '#1a1f2c',
            fontFamily: "'Inter', sans-serif"
          }}
        >
          <div className="flex justify-between items-center mb-6 pb-6 border-b-[0.5mm] border-slate-100">
            <div className="flex items-center gap-6">
              {logo ? <img src={logo} className="h-14 w-auto object-contain" /> : <div className="h-12 w-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-200 border border-slate-100"><ImageIcon size={20}/></div>}
              <div className="border-l-[0.6mm] border-slate-100 pl-6">
                <h1 className="text-[28px] font-black tracking-tighter uppercase leading-none italic text-[#1a1f2c]">RODAMOINHO</h1>
                <p className="text-[9px] font-black text-orange-600 uppercase tracking-[0.5em] mt-2">PRODUÇÕES ARTÍSTICAS</p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-orange-600 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 inline-block shadow-md">DOC Nº {receiptNumber}</div>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em]">{city.toUpperCase()}, {new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()}</p>
            </div>
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-[20px] font-black uppercase tracking-[0.4em] leading-none text-slate-900">
              RECIBO DE <span className="text-orange-600">{receiptType}</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-10 mb-8">
             <div className="space-y-6">
                <div>
                   <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-3">
                     <span className="w-4 h-[2mm] bg-orange-600"></span> TOMADOR
                   </h4>
                   <div className="p-6 bg-slate-50/50 rounded-[24px] space-y-1.5 text-[10px] border border-slate-100/50">
                      <p className="font-black text-[11px] leading-tight mb-0.5 text-[#1a1f2c]">{CLIENT_DATA.name}</p>
                      <p className="text-slate-500 font-bold">CNPJ: {CLIENT_DATA.cnpj}</p>
                      <p className="text-slate-400 font-bold leading-relaxed uppercase">{CLIENT_DATA.address}<br/>{CLIENT_DATA.neighborhood}<br/>CEP: {CLIENT_DATA.cep} • I.M: {CLIENT_DATA.im}</p>
                   </div>
                </div>
                <div>
                   <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-3 flex items-center gap-3">
                     <span className="w-4 h-[2mm] bg-orange-600"></span> EMISSOR
                   </h4>
                   <div className="p-6 bg-white border-2 border-slate-50 rounded-[24px] space-y-1.5 text-[10px]">
                      <p className="font-black text-[11px] leading-tight mb-0.5 uppercase text-[#1a1f2c]">{provider.name || "---"}</p>
                      <p className="text-slate-500 font-bold">DOC: {provider.document || "---"}</p>
                      <div className="flex flex-col gap-1 mt-3 text-slate-400 font-bold uppercase tracking-tight">
                        <div className="flex items-center gap-3"><MapPin size={10} className="text-orange-400"/> {city.toUpperCase()}</div>
                        <div className="flex items-center gap-3"><PhoneIcon size={10} className="text-orange-400"/> {provider.phone || "---"}</div>
                      </div>
                   </div>
                </div>
             </div>
             <div className="flex flex-col justify-between">
                <div className="bg-[#1a1f2c] rounded-[36px] p-8 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden min-h-[140px]">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12"></div>
                   <Wallet className="text-orange-600 mb-2" size={28}/>
                   <p className="text-orange-600 text-[9px] font-black uppercase tracking-[0.4em] mb-2 opacity-90">VALOR LÍQUIDO</p>
                   <p className="text-white text-[34px] font-black tracking-tighter leading-none w-full whitespace-nowrap overflow-visible">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLiquido)}
                   </p>
                </div>
                <div className="mt-6 bg-orange-50/50 p-6 rounded-[28px] text-center border-2 border-orange-100/30">
                   <h4 className="text-[9px] font-black text-orange-600 uppercase mb-3 tracking-[0.3em]">FAVOR CREDITAR EM:</h4>
                   <p className="text-[12px] font-black text-[#1a1f2c] uppercase italic leading-tight tracking-wide">{provider.bankInfo || "---"}</p>
                </div>
             </div>
          </div>

          <div className="flex-grow">
             <table className="w-full">
                <thead>
                   <tr className="bg-slate-50/80 border-y-2 border-slate-100">
                      <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase italic tracking-[0.2em]">DESCRIÇÃO DOS ITENS</th>
                      <th className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase italic w-40 tracking-[0.2em]">VALOR (R$)</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                   {items.map((item, i) => (
                     <tr key={item.id}>
                        <td className="py-5 px-6 align-top">
                           <div className="flex gap-5">
                              <span className="bg-orange-600 text-white w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0 shadow-md">{i+1}</span>
                              <p className="text-[#1a1f2c] font-black text-[13px] leading-relaxed uppercase tracking-tight">{item.description || "---"}</p>
                           </div>
                        </td>
                        <td className="py-5 px-6 text-right font-black text-[#1a1f2c] text-[14px]">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.value)}</td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div className="flex justify-end mt-4 mb-2">
            <div className="w-72 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] px-4">
               <span>SUBTOTAL</span>
               <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalBruto)}</span>
            </div>
          </div>

          <div className="pt-8 border-t-[0.8mm] border-[#1a1f2c]">
             <div className="flex gap-12 items-end">
                <div className="flex-grow text-center flex flex-col items-center">
                   <div className="h-28 flex items-end justify-center mb-2">
                     {provider.signature && <img src={provider.signature} className="h-24 w-auto object-contain" />}
                   </div>
                   <div className="w-72 h-[1.5mm] bg-[#1a1f2c] mb-4"></div>
                   <p className="font-black text-[#1a1f2c] text-[14px] uppercase leading-none mb-1 tracking-tight">{provider.name || "NOME DO EMISSOR"}</p>
                   <p className="text-slate-400 text-[8px] font-black uppercase tracking-[0.2em]">{provider.document || "DOCUMENTO"}</p>
                   <div className="mt-6 flex items-center gap-3 bg-slate-50 px-5 py-2 rounded-full border border-slate-200">
                      <ShieldCheck size={12} className="text-orange-500"/>
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.3em]">DOCUMENTO VERIFICADO DIGITALMENTE</span>
                   </div>
                </div>
                <div className="w-72 text-right">
                   <div className="bg-[#ea580c] rounded-[28px] p-6 text-white text-center relative overflow-hidden flex flex-col items-center justify-center shadow-lg">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.3em]">LÍQUIDO</span>
                        <span className="text-[7px] bg-white/20 px-2 py-0.5 rounded-lg font-black italic">FINAL</span>
                      </div>
                      <span className="text-[28px] font-black tracking-tighter leading-none block w-full">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalLiquido)}
                      </span>
                   </div>
                </div>
             </div>
          </div>
          <footer className="mt-8 text-center border-t border-slate-50 pt-6 opacity-30">
            <p className="text-[8px] font-black uppercase tracking-[1em] text-[#1a1f2c]">RODAMOINHO • EVENTOS • PRODUÇÃO • ARTES</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default App;
