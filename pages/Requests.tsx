import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, MapPin, Package, XCircle } from 'lucide-react';
import { InventoryRequest, User } from '../types';

interface RequestsProps {
  requests: InventoryRequest[];
  currentUser: User;
  onReview: (requestId: string, decision: 'approved' | 'rejected') => Promise<void>;
}

const statusLabels = {
  pending: 'Pendiente',
  approved: 'Recibida',
  rejected: 'Rechazada'
} as const;

const Requests: React.FC<RequestsProps> = ({ requests, currentUser, onReview }) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canReview = currentUser.role === 'Admin' || currentUser.role === 'Operario';

  const ordered = useMemo(
    () => [...requests].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return b.requestedAt - a.requestedAt;
    }),
    [requests]
  );

  const review = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessingId(id);
    setError(null);
    try {
      await onReview(id, decision);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido revisar la solicitud.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">
          {canReview ? 'Solicitudes de entrada' : 'Mis solicitudes de entrada'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {canReview
            ? 'Confirma que el material ha llegado al almacén para incorporarlo al inventario.'
            : 'Aquí puedes consultar si IGNASER ha recibido y aprobado el material solicitado.'}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {ordered.map(request => (
          <article key={request.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {request.imageUrl
                      ? <img src={request.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <Package className="text-slate-400" size={28} />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-lg">{request.concept}</h3>
                    <p className="text-sm text-slate-500 mt-1">{request.description}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Package size={14} /> {request.quantity} uds.</span>
                      <span className="flex items-center gap-1"><MapPin size={14} /> {request.obra}</span>
                      {request.location && <span>Ubicación: {request.location}</span>}
                      {request.category && <span>Categoría: {request.category}</span>}
                    </div>
                  </div>
                </div>

                <span className={`inline-flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-xs font-bold ${
                  request.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : request.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                }`}>
                  {request.status === 'pending' && <Clock3 size={14} />}
                  {request.status === 'approved' && <CheckCircle2 size={14} />}
                  {request.status === 'rejected' && <XCircle size={14} />}
                  {statusLabels[request.status]}
                </span>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  <p>Solicitada por {request.requestedByName} · {new Date(request.requestedAt).toLocaleString()}</p>
                  {request.reviewedAt && (
                    <p className="mt-1">Revisada por {request.reviewedByName || 'IGNASER'} · {new Date(request.reviewedAt).toLocaleString()}</p>
                  )}
                </div>

                {canReview && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={processingId === request.id}
                      onClick={() => review(request.id, 'rejected')}
                      className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 font-semibold text-sm hover:bg-rose-100 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      disabled={processingId === request.id}
                      onClick={() => review(request.id, 'approved')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processingId === request.id ? 'Procesando...' : 'Aprobar como recibida'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}

        {ordered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <ClipboardEmpty />
            <h3 className="font-bold text-slate-700 mt-4">No hay solicitudes</h3>
            <p className="text-sm text-slate-500 mt-1">
              {canReview ? 'Cuando AXIS envíe una entrada aparecerá aquí.' : 'Tus solicitudes aparecerán aquí después de enviarlas.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ClipboardEmpty = () => (
  <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
    <Package className="text-slate-400" size={28} />
  </div>
);

export default Requests;
