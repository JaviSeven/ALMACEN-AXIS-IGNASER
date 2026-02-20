
import React, { useState } from 'react';
import { StockItem, User } from '../types';
import { Search, Trash2, MapPin, MapPinned, ArrowDownCircle, X, Check, Eye } from 'lucide-react';

interface InventoryProps {
  items: StockItem[];
  onMaterialOut: (itemId: string, amount: number, obraDestino: string) => void;
  onDelete: (id: string) => void;
  currentUser: User;
}

const Inventory: React.FC<InventoryProps> = ({ items, onMaterialOut, onDelete, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [salidaModal, setSalidaModal] = useState<{ item: StockItem } | null>(null);
  const [salidaObra, setSalidaObra] = useState('');
  const [salidaUnidades, setSalidaUnidades] = useState(1);
  const [previewItem, setPreviewItem] = useState<StockItem | null>(null);

  const openSalidaModal = (item: StockItem) => {
    setSalidaModal({ item });
    setSalidaObra('');
    setSalidaUnidades(1);
  };

  const closeSalidaModal = () => {
    setSalidaModal(null);
    setSalidaObra('');
    setSalidaUnidades(1);
  };

  const confirmSalida = () => {
    if (!salidaModal || !salidaObra.trim() || salidaUnidades < 1) return;
    const max = Math.min(salidaUnidades, salidaModal.item.quantity);
    if (max < 1) return;
    onMaterialOut(salidaModal.item.id, max, salidaObra.trim());
    closeSalidaModal();
  };

  const filteredItems = items.filter(item => 
    item.concept.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.obra.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por concepto, obra o descripción..."
          className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm group hover:shadow-md transition-shadow"
          >
            <div
              className="relative h-48 bg-slate-100 overflow-hidden cursor-pointer"
              onClick={() => setPreviewItem(item)}
            >
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                  alt={item.concept} 
                />
              ) : null}
              <div className="absolute top-2 right-2">
                {currentUser.role === 'Admin' && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if(confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
                        onDelete(item.id);
                      }
                    }}
                    className="p-2 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1">
                <MapPin size={10} className="text-blue-600" /> {item.obra}
              </div>
            </div>

            <div className="p-5 cursor-pointer" onClick={() => setPreviewItem(item)}>
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-slate-800 text-base line-clamp-3 flex-1 leading-snug">{item.concept}</h4>
                <span className="text-[10px] text-slate-400 font-mono mt-1 shrink-0">ID: {item.id.slice(0, 5)}</span>
              </div>
              <p className="text-slate-500 text-sm mt-1 line-clamp-2 min-h-[40px]">{item.description}</p>
              {item.location && (
                <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
                  <MapPinned size={12} className="text-slate-400 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </p>
              )}
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Stock Almacenado</span>
                  <span className="text-2xl font-black text-slate-800">
                    {item.quantity} <span className="text-xs font-medium text-slate-400">uds.</span>
                  </span>
                </div>
                {currentUser.role !== 'SoloLectura' && (
                  <button
                    onClick={() => openSalidaModal(item)}
                    disabled={item.quantity === 0}
                    className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl font-semibold text-sm hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowDownCircle size={18} /> Salida de material
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-400" size={32} />
            </div>
            <p className="text-slate-500 font-medium">No se encontraron artículos con esos criterios.</p>
          </div>
        )}
      </div>

      {/* Modal Vista previa producto */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setPreviewItem(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative h-56 bg-slate-100">
              {previewItem.imageUrl ? (
                <img src={previewItem.imageUrl} className="w-full h-full object-cover" alt={previewItem.concept} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Eye size={48} />
                </div>
              )}
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="absolute top-3 right-3 p-2 bg-white/90 rounded-lg hover:bg-white"
              >
                <X size={20} className="text-slate-600" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 leading-snug">{previewItem.concept}</h3>
              <p className="text-xs text-slate-400 font-mono mt-1">ID: {previewItem.id}</p>
              <p className="text-slate-600 text-sm mt-3 whitespace-pre-wrap">{previewItem.description}</p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span className="flex items-center gap-1 text-slate-600">
                  <MapPin size={14} className="text-blue-600" /> {previewItem.obra}
                </span>
                {previewItem.location && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPinned size={14} className="text-slate-500" /> {previewItem.location}
                  </span>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-500 text-sm">Stock:</span>
                <span className="text-2xl font-black text-slate-800">{previewItem.quantity} uds.</span>
              </div>
              {currentUser.role !== 'SoloLectura' && previewItem.quantity > 0 && (
                <button
                  type="button"
                  onClick={() => { setPreviewItem(null); openSalidaModal(previewItem); }}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-700 rounded-xl font-semibold hover:bg-rose-100"
                >
                  <ArrowDownCircle size={18} /> Salida de material
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Salida de material */}
      {salidaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeSalidaModal}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-1">Salida de material</h3>
            <p className="text-sm text-slate-500 mb-6">{salidaModal.item.concept}</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Obra de destino</label>
                <input
                  type="text"
                  value={salidaObra}
                  onChange={e => setSalidaObra(e.target.value)}
                  placeholder="Ej. C.C. La Maquinista"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Unidades que salen</label>
                <input
                  type="number"
                  min={1}
                  max={salidaModal.item.quantity}
                  value={salidaUnidades}
                  onChange={e => setSalidaUnidades(Math.max(1, Math.min(salidaModal.item.quantity, parseInt(e.target.value, 10) || 1)))}
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-xs text-slate-400 mt-1">Máximo: {salidaModal.item.quantity} uds.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeSalidaModal}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200"
              >
                <X size={18} /> Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSalida}
                disabled={!salidaObra.trim() || salidaUnidades < 1}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                <Check size={18} /> Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
