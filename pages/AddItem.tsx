
import React, { useState, useRef } from 'react';
import { Camera, Save, X, MapPin, Package, MapPinned, Lock, FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { User, CATEGORIAS } from '../types';

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
  onAdd: (item: { concept: string; obra: string; category: string; description: string; imageUrl: string; quantity: number; location: string }) => void | Promise<void>;
  currentUser: User;
}

const AddItem: React.FC<AddItemProps> = ({ onAdd, currentUser }) => {
  const navigate = useNavigate();

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
  const [quantity, setQuantity] = useState<number>(1);
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
    if (!concept || !obra || !description || quantity < 1 || !location.trim() || !category.trim()) return;

    await onAdd({
      concept,
      obra,
      category: category.trim(),
      description,
      imageUrl: imageUrl || '',
      quantity,
      location: location.trim()
    });

    navigate('/inventory');
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
      if (iConcepto < 0 || iObra < 0 || iDesc < 0 || iCant < 0 || iUbi < 0) {
        setImportResult({ ok: 0, errores: ['Faltan columnas. La plantilla debe tener: Concepto, Obra, Categoría (opcional), Descripción, Cantidad, Ubicación.'] });
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
        const location = (row[iUbi] ?? '').toString().trim();
        if (!concept || !obra || !description || !location) {
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
      if (ok > 0) setTimeout(() => navigate('/inventory'), 2000);
    } catch (err) {
      setImportResult({ ok: 0, errores: [err instanceof Error ? err.message : 'Error al leer el Excel.'] });
    }
    setImportando(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Dar entrada a material</h2>
          <p className="text-slate-500 mb-6 text-sm">Completa los datos del material e indica las unidades y la ubicación en el almacén.</p>

          {/* Importar desde Excel */}
          <div className="mb-8 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-emerald-600" /> Importar desde Excel
            </h3>
            <p className="text-xs text-slate-500 mb-3">Descarga la plantilla, rellena las filas y súbela para dar entrada a varios materiales a la vez (sin foto).</p>
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
                {importando ? 'Importando...' : 'Seleccionar Excel'}
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
                {importResult.ok > 0 && <p className="font-medium">Se han importado {importResult.ok} material(es). Redirigiendo al inventario...</p>}
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
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
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
                <Save size={20} /> Dar entrada
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddItem;
