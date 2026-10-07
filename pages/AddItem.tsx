
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Camera, Save, X, MapPin, Package, MapPinned, Lock, FileSpreadsheet, Download, Upload, Search, RefreshCw, PlusCircle, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { User, CATEGORIAS, StockItem } from '../types';

const PLANTILLA_COLUMNAS = ['Concepto', 'Obra', 'Categoría', 'Descripción', 'Cantidad', 'Ubicación'] as const;

function descargarPlantilla() {
  const wb = XLSX.utils.book_new();
  const datos = [
    PLANTILLA_COLUMNAS,
    ['Bobina cobre 2.5 mm', 'C.C. La Maquinista', 'ELECTRODOMESTICOS', 'En buen estado', 10, 'Estantería A3'],
    ['Cable flexible 3G1.5', 'Obra Ejemplo', 'CONSTRUCCION', 'Nuevo a estrenar', 5, 'Pasillo 2']
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
  XLSX.writeFile(wb, 'plantilla_entrada_material.xlsx');
}

interface AddItemProps {
  items: StockItem[];
  onRestock: (itemId: string, amount: number, obraProcedencia: string, note: string) => Promise<boolean>;
  onAdd: (item: { concept: string; obra: string; category: string; description: string; imageUrl: string; quantity: number; location: string }) => void | Promise<void>;
  currentUser: User;
}

const AddItem: React.FC<AddItemProps> = ({ items, onAdd, onRestock, currentUser }) => {
  const navigate = useNavigate();
  const isAxis = currentUser.role === 'Axis';
  const [mode, setMode] = useState<'existing' | 'new' | null>(isAxis ? 'new' : null);

  if (currentUser.role === 'SoloLectura') {
    return (
      <div className="max-w-2xl mx-auto animate-in fade-in duration-500 pb-12">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="text-slate-400 w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Sin permisos</h2>
          <p className="text-slate-500 mb-8 text-sm">Tu usuario tiene permisos de solo lectura. No puedes dar entrada a material.</p>
          <button
            onClick={() => navigate('/inventory')}
            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
          >
            Volver al inventario
          </button>
        </div>
      </div>
    );
  }
  const [concept, setConcept] = useState('');
  const [obra, setObra] = useState('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [location, setLocation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; errores: string[] } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantityNumber = parseInt(quantity, 10);
    if (!concept || !obra || !description || !quantity || isNaN(quantityNumber) || quantityNumber < 1 || !category.trim()) return;
    if (currentUser.role !== 'Axis' && !location.trim()) return;

    await onAdd({
      concept,
      obra,
      category: category.trim(),
      description,
      imageUrl: imageUrl || '',
      quantity: quantityNumber,
      location: currentUser.role === 'Axis' ? '' : location.trim()
    });

    navigate(currentUser.role === 'Axis' ? '/requests' : '/inventory');
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportResult(null);
    setImportando(true);
    const errores: string[] = [];
    let ok = 0;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1 }) as unknown[][];
      if (rows.length < 2) {
        setImportResult({ ok: 0, errores: ['El archivo no tiene filas de datos (mínimo cabecera + 1 fila).'] });
        setImportando(false);
        return;
      }
      const header = (rows[0] as string[]).map(h => (h || '').toString().trim());
      const idx = (name: string) => {
        const i = header.findIndex(h => h.toLowerCase() === name.toLowerCase());
        return i >= 0 ? i : -1;
      };
      const iConcepto = idx('Concepto');
      const iObra = idx('Obra');
      const iCategoria = idx('Categoría');
      const iDesc = idx('Descripción');
      const iCant = idx('Cantidad');
      const iUbi = idx('Ubicación');
      if (iConcepto < 0 || iObra < 0 || iDesc < 0 || iCant < 0 || (currentUser.role !== 'Axis' && iUbi < 0)) {
        setImportResult({ ok: 0, errores: [currentUser.role === 'Axis'
          ? 'Faltan columnas. La plantilla debe tener: Concepto, Obra, Categoría (opcional), Descripción y Cantidad.'
          : 'Faltan columnas. La plantilla debe tener: Concepto, Obra, Categoría (opcional), Descripción, Cantidad y Ubicación.'] });
        setImportando(false);
        return;
      }
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] as unknown[];
        if (!row || row.length === 0) continue;
        const concept = (row[iConcepto] ?? '').toString().trim();
        const obra = (row[iObra] ?? '').toString().trim();
        const catRaw = iCategoria >= 0 ? (row[iCategoria] ?? '').toString().trim() : '';
        const category = CATEGORIAS.includes(catRaw as typeof CATEGORIAS[number]) ? catRaw : (CATEGORIAS[0] as string);
        const description = (row[iDesc] ?? '').toString().trim();
        const quantity = Math.max(1, parseInt(String(row[iCant]), 10) || 1);
        const location = currentUser.role === 'Axis' ? '' : (row[iUbi] ?? '').toString().trim();
        if (!concept || !obra || !description || (currentUser.role !== 'Axis' && !location)) {
          errores.push(`Fila ${r + 1}: faltan datos.`);
          continue;
        }
        try {
          await onAdd({ concept, obra, category, description, imageUrl: '', quantity, location });
          ok++;
        } catch (err) {
          errores.push(`Fila ${r + 1}: ${err instanceof Error ? err.message : 'Error al guardar'}.`);
        }
      }
      setImportResult({ ok, errores });
      if (ok > 0) setTimeout(() => navigate(currentUser.role === 'Axis' ? '/requests' : '/inventory'), 2000);
    } catch (err) {
      setImportResult({ ok: 0, errores: [err instanceof Error ? err.message : 'Error al leer el Excel.'] });
    }
    setImportando(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 space-y-6">
      {!isAxis && <ModeSelector mode={mode} onChange={setMode} />}

      {mode === 'existing' && (
        <RestockForm items={items} onRestock={onRestock} onDone={() => navigate('/inventory')} onCancel={() => setMode(null)} />
      )}

      {mode === 'new' && (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">{currentUser.role === 'Axis' ? 'Solicitar entrada de material' : 'Entrada nuevo material'}</h2>
          <p className="text-slate-500 mb-6 text-sm">{currentUser.role === 'Axis' ? 'Completa los datos. IGNASER revisará la solicitud y confirmará la recepción antes de añadirla al stock.' : 'Completa los datos del material e indica las unidades y la ubicación en el almacén.'}</p>

          {/* Importar desde Excel */}
          <div className="mb-8 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-600" /> Importar desde Excel
            </h3>
            <p className="text-xs text-slate-500 mb-3">{currentUser.role === 'Axis'
              ? 'Descarga la plantilla y súbela. La ubicación se dejará en blanco para que IGNASER la indique al recibir el material.'
              : 'Descarga la plantilla, rellena las filas y súbela para dar entrada a varios materiales a la vez (sin foto).'}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={descargarPlantilla}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download size={16} /> Descargar plantilla
              </button>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 cursor-pointer">
                <Upload size={16} />
                {importando ? 'Importando...' : currentUser.role === 'Axis' ? 'Solicitar desde Excel' : 'Seleccionar Excel'}
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelImport}
                  disabled={importando}
                />
              </label>
            </div>
            {importResult && (
              <div className={`mt-3 text-sm p-3 rounded-lg ${importResult.ok > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                {importResult.ok > 0 && <p className="font-medium">{currentUser.role === 'Axis' ? 'Se han enviado' : 'Se han importado'} {importResult.ok} material(es). Redirigiendo...</p>}
                {importResult.errores.length > 0 && (
                  <ul className="list-disc list-inside mt-1">
                    {importResult.errores.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {importResult.errores.length > 5 && <li>... y {importResult.errores.length - 5} más</li>}
                  </ul>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Concepto / Nombre</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Ej. Bobina de cobre 2.5"
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  <MapPin size={14} className="text-blue-600" /> Obra de procedencia
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Ej. C.C. La Maquinista"
                  value={obra}
                  onChange={(e) => setObra(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Categorías</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700"
              >
                <option value="">Seleccione una categoría</option>
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Descripción / Observaciones</label>
              <textarea
                required
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                placeholder="Indica el estado del material o cualquier detalle relevante..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  <Package size={14} className="text-blue-600" /> Unidades
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  placeholder="Cantidad que entra"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              {currentUser.role !== 'Axis' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <MapPinned size={14} className="text-blue-600" /> Ubicación en el almacén
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    placeholder="Ej. Estantería A3, Pasillo 2"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700">Fotografía del Material</label>
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative h-64 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors group overflow-hidden"
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} className="w-full h-full object-cover" alt="Preview" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera className="text-white" size={48} />
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                      <Camera className="text-slate-400 group-hover:text-blue-500" size={32} />
                    </div>
                    <p className="text-slate-600 font-medium">Click para subir foto del material</p>
                    <p className="text-xs text-slate-400 mt-2">Puedes capturar desde el móvil o subir archivo</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <div className="pt-4 flex gap-4">
              <button
                type="button"
                onClick={() => navigate('/inventory')}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <X size={20} /> Cancelar
              </button>
              <button
                type="submit"
                className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Save size={20} /> {currentUser.role === 'Axis' ? 'Enviar solicitud' : 'Dar entrada'}
              </button>
            </div>
          </form>
        </div>
      </div>
      )}
    </div>
  );
};

const ModeSelector: React.FC<{ mode: 'existing' | 'new' | null; onChange: (m: 'existing' | 'new') => void }> = ({ mode, onChange }) => {
  const base = 'flex-1 text-left p-5 rounded-2xl border-2 transition-all flex items-start gap-4';
  return (
    <div>
      {mode === null && (
        <p className="text-slate-500 text-sm mb-3">¿Qué quieres hacer?</p>
      )}
      <div className="flex flex-col md:flex-row gap-4">
        <button
          type="button"
          onClick={() => onChange('existing')}
          className={`${base} ${mode === 'existing' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
        >
          <div className={`p-2.5 rounded-xl ${mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <RefreshCw size={22} />
          </div>
          <div>
            <p className="font-bold text-slate-800">Actualizar material existente</p>
            <p className="text-xs text-slate-500 mt-1">Suma unidades a un material que ya está en el inventario.</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onChange('new')}
          className={`${base} ${mode === 'new' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}
        >
          <div className={`p-2.5 rounded-xl ${mode === 'new' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            <PlusCircle size={22} />
          </div>
          <div>
            <p className="font-bold text-slate-800">Entrada nuevo material</p>
            <p className="text-xs text-slate-500 mt-1">Da de alta un material que todavía no existe.</p>
          </div>
        </button>
      </div>
    </div>
  );
};

const normalizeText = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const RestockForm: React.FC<{
  items: StockItem[];
  onRestock: (itemId: string, amount: number, obraProcedencia: string, note: string) => Promise<boolean>;
  onDone: () => void;
  onCancel: () => void;
}> = ({ items, onRestock, onDone, onCancel }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('1');
  const [obra, setObra] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.concept.localeCompare(b.concept, 'es', { sensitivity: 'base' })),
    [items]
  );

  const filtered = useMemo(() => {
    const q = normalizeText(search.trim());
    if (!q) return sorted;
    return sorted.filter(item =>
      normalizeText(`${item.concept} ${item.obra} ${item.description} ${item.location ?? ''}`).includes(q)
    );
  }, [sorted, search]);

  const selected = items.find(i => i.id === selectedId) ?? null;

  const selectItem = (item: StockItem) => {
    setSelectedId(item.id);
    setObra(item.obra);
    setSearch('');
    setOpen(false);
    setError(null);
  };

  const parsedAmount = Math.floor(Number(amount));
  const canSave = !!selected && Number.isFinite(parsedAmount) && parsedAmount >= 1 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !canSave) return;
    setSaving(true);
    setError(null);
    const ok = await onRestock(selected.id, parsedAmount, obra, note);
    setSaving(false);
    if (ok) onDone();
    else setError('No se pudo guardar la entrada. Inténtalo de nuevo.');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Actualizar material existente</h2>
        <p className="text-slate-500 mb-8 text-sm">Busca el material, elige cuántas unidades entran y guarda.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2" ref={boxRef}>
            <label className="text-sm font-semibold text-slate-700">Material</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between text-left"
              >
                {selected ? (
                  <span className="truncate">
                    <span className="font-semibold text-slate-800">{selected.concept}</span>
                    <span className="text-slate-400 text-sm"> · {selected.obra} · {selected.quantity} uds.</span>
                  </span>
                ) : (
                  <span className="text-slate-400">Selecciona un material...</span>
                )}
                <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="absolute z-20 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-slate-100 relative">
                    <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filtered.length > 0) selectItem(filtered[0]);
                        }
                        if (e.key === 'Escape') setOpen(false);
                      }}
                      placeholder="Buscar por nombre, obra, descripción o ubicación..."
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <ul className="max-h-72 overflow-y-auto">
                    {filtered.length === 0 && (
                      <li className="px-4 py-6 text-center text-sm text-slate-400">
                        {items.length === 0 ? 'No hay materiales en el inventario.' : 'Ningún material coincide con la búsqueda.'}
                      </li>
                    )}
                    {filtered.map(item => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectItem(item)}
                          className={`w-full text-left px-4 py-3 hover:bg-blue-50 flex items-center gap-3 ${item.id === selectedId ? 'bg-blue-50' : ''}`}
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <Package size={18} className="text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate">{item.concept}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {item.obra}{item.location ? ` · ${item.location}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-slate-700 shrink-0">{item.quantity} uds.</span>
                          {item.id === selectedId && <Check size={16} className="text-blue-600 shrink-0" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-slate-100">
                    {filtered.length} de {items.length} materiales
                  </div>
                </div>
              )}
            </div>
          </div>

          {selected && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 space-y-1">
                <p><span className="font-semibold text-slate-700">Descripción:</span> {selected.description}</p>
                {selected.location && <p><span className="font-semibold text-slate-700">Ubicación:</span> {selected.location}</p>}
                <p>
                  <span className="font-semibold text-slate-700">Stock actual:</span> {selected.quantity} uds.
                  {Number.isFinite(parsedAmount) && parsedAmount >= 1 && (
                    <span className="text-emerald-700 font-semibold"> → {selected.quantity + parsedAmount} uds.</span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <Package size={14} className="text-blue-600" /> Unidades que entran
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin size={14} className="text-blue-600" /> Obra de procedencia
                  </label>
                  <input
                    type="text"
                    value={obra}
                    onChange={e => setObra(e.target.value)}
                    placeholder="Ej. C.C. La Maquinista"
                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nota (opcional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Ej. Albarán 1234"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-rose-600 font-medium">{error}</p>}

          <div className="pt-2 flex gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <X size={20} /> Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="flex-[2] px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              <Save size={20} /> {saving ? 'Guardando...' : 'Actualizar stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItem;
