import React, { useCallback, useEffect, useState } from 'react';
import { Factory, Plus, RefreshCw, X } from 'lucide-react';
import { DocumentTimeline } from '../../../components/common/DocumentTimeline';
import { useERP } from '../../../context/ERPContext';
import { api } from '../../../services/api';
import { RESOURCES } from '../../../services/backendSync';
import {
  getProjectProductionLifecycle,
  lifecycleStageDetail,
  lifecycleToTimelineSteps,
} from '../../purchase/productionLifecycle';
import { ProductionStageWorkspace } from '../../purchase/ProductionStageWorkspace';
import { CreateProductionPoModal } from './CreateProductionPoModal';

const STATE_PILL = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-slate-50 text-slate-500 border-slate-200',
};
const STATE_LABEL = { completed: 'Completed', active: 'Active', pending: 'Pending' };

const fmtAmount = (v) =>
  v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * The 8-stage Production Lifecycle of every Vendor A Production PO linked to a
 * project. Data comes from GET /pms/projects/:id/production-lifecycle/ (same
 * derivation as the Purchase PO screen). Every stage opens its existing
 * workspace inside this slide -- nothing redirects to another module.
 */
export function ProductionLifecyclePanel({
  project, focusStageKey, refreshKey, onLoaded, compact = false, defaultQty,
  // embedded: the project pipeline above already shows the 8 stages; render
  // only the selected stage's workspace (no second timeline).
  embedded = false, onStageChange, onUpdated,
}) {
  const { purchaseOrders = [] } = useERP();
  const projectId = project?.id;
  const [lifecycles, setLifecycles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openState, setOpen] = useState(null); // { poId, stageKey }
  const [fetchedPo, setFetchedPo] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const res = await getProjectProductionLifecycle(projectId);
      const rows = res?.lifecycles || [];
      setLifecycles(rows);
      onLoaded?.(rows);
    } catch (err) {
      setError(err?.message || 'Could not load the production lifecycle.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const open = embedded
    ? (lifecycles[0] && focusStageKey ? { poId: lifecycles[0].purchaseOrderId, stageKey: focusStageKey } : null)
    : openState;
  const changeStage = (lifecycle, key) => {
    if (embedded) onStageChange?.(key);
    else setOpen({ poId: lifecycle.purchaseOrderId, stageKey: key });
  };
  const afterUpdate = async () => {
    await load();
    onUpdated?.();
  };

  // The stage screens take the PO in the ERP shape the Purchase screen uses.
  const contextPo = open ? purchaseOrders.find((p) => String(p.id) === String(open.poId)) : null;
  useEffect(() => {
    if (!open || contextPo) return;
    let cancelled = false;
    api.get(`/purchase/orders/${open.poId}/`)
      .then((row) => { if (!cancelled && row) setFetchedPo(RESOURCES.purchaseOrders.fromApi(row)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open?.poId, contextPo]);
  const openPo = contextPo || (fetchedPo && String(fetchedPo.id) === String(open?.poId) ? fetchedPo : null);

  const openStage = (lifecycle, stageKey) => changeStage(lifecycle, stageKey);

  return (
    <div className="rounded-2xl border border-[#dce5f4] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Factory size={16} className="text-amber-600" />
          <h3 className="text-sm font-bold text-slate-800">Production Lifecycle</h3>
          <span className="text-[11px] text-slate-400">
            Vendor A Production PO → Disbursement Payment · live from saved records
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus size={13} /> Create Production PO
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      )}

      {!error && !loading && lifecycles.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-5 text-center text-xs text-slate-500">
          No Vendor A Production PO is linked to this project yet. Use “Create Production PO” to start the production lifecycle.
        </div>
      )}

      {lifecycles.map((lifecycle) => {
        const isOpen = open && String(open.poId) === String(lifecycle.purchaseOrderId);
        return (
          <div key={lifecycle.purchaseOrderId} className="space-y-3">
            {embedded ? (() => {
              const stage = lifecycle.stages.find((st) => st.key === open?.stageKey);
              if (!stage) return null;
              return (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-mono font-bold text-[#17294e]">{lifecycle.poNumber}</span>
                  <span className="font-semibold text-slate-700">{stage.label}</span>
                  {stage.docNumber && <span className="font-mono">{stage.docNumber}</span>}
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATE_PILL[stage.state]}`}>
                    {STATE_LABEL[stage.state]}
                  </span>
                  {stage.status && <span className={stage.blocked ? 'text-rose-600 font-bold' : 'text-slate-500'}>{stage.status}</span>}
                  {lifecycleStageDetail(stage) && <span className="text-slate-500">{lifecycleStageDetail(stage)}</span>}
                </div>
              );
            })() : (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-[#17294e]">{lifecycle.poNumber}</span>
                <span className="text-slate-400">
                  {lifecycle.completedCount} of {lifecycle.stages.length} stages completed
                </span>
              </div>
              <button
                type="button"
                onClick={() => openStage(lifecycle, lifecycle.currentStage || 'purchase_order')}
                className="font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Work on current stage
              </button>
            </div>
            )}

            {!embedded && (
              <DocumentTimeline
                steps={lifecycleToTimelineSteps(lifecycle, { activeKey: isOpen ? open.stageKey : focusStageKey })}
                onStepClick={(step) => openStage(lifecycle, step.key)}
              />
            )}

            {isOpen && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    {lifecycle.stages.find((s) => s.key === open.stageKey)?.label} · {lifecycle.poNumber}
                  </span>
                  {!embedded && (
                    <button type="button" onClick={() => setOpen(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" title="Close stage">
                      <X size={14} />
                    </button>
                  )}
                </div>
                {openPo ? (
                  <ProductionStageWorkspace
                    po={openPo}
                    stageKey={open.stageKey}
                    onStageChange={(key) => changeStage(lifecycle, key)}
                    onUpdated={afterUpdate}
                  />
                ) : (
                  <div className="text-xs text-slate-500 p-3">Loading purchase order…</div>
                )}
              </div>
            )}

            {!compact && !embedded && (
              <div className="rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Stage</th>
                      <th className="p-2.5">Document</th>
                      <th className="p-2.5">Details</th>
                      <th className="p-2.5 text-right">Amount</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lifecycle.stages.map((stage) => (
                      <tr
                        key={stage.key}
                        className={stage.key === (isOpen ? open.stageKey : focusStageKey) ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}
                      >
                        <td className="p-2.5 font-mono text-slate-400">{stage.sequence}</td>
                        <td className="p-2.5 font-semibold text-slate-800">{stage.label}</td>
                        <td className="p-2.5 font-mono">{stage.docNumber || '—'}</td>
                        <td className="p-2.5 text-slate-600">{lifecycleStageDetail(stage) || '—'}</td>
                        <td className="p-2.5 text-right font-mono">{fmtAmount(stage.amount)}</td>
                        <td className="p-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATE_PILL[stage.state]}`}>
                            {STATE_LABEL[stage.state]}
                          </span>
                          {stage.status && (
                            <span className={`ml-1.5 text-[11px] ${stage.blocked ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                              {stage.status}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openStage(lifecycle, stage.key)}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!compact && !embedded && (() => {
              const payment = lifecycle.stages.find((s) => s.key === 'disbursement_payment');
              if (!payment?.payments?.length) return null;
              return (
                <div className="rounded-xl border border-slate-200 p-3 text-xs space-y-1.5">
                  <div className="font-bold text-slate-700">Payments against {payment.docNumber}</div>
                  {payment.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-slate-600">
                      <span className="font-mono">{p.paymentNumber}</span>
                      <span>{p.date} · {p.mode}{p.status !== 'Active' ? ` · ${p.status}` : ''}</span>
                      <span className="font-mono font-bold">{fmtAmount(p.amount)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        );
      })}

      {showCreate && (
        <CreateProductionPoModal
          project={project}
          defaultQty={defaultQty}
          onClose={() => setShowCreate(false)}
          onCreated={async (saved) => {
            setShowCreate(false);
            await afterUpdate();
            if (embedded) onStageChange?.('purchase_order');
            else if (saved?.id) setOpen({ poId: saved.id, stageKey: 'purchase_order' });
          }}
        />
      )}
    </div>
  );
}

export default ProductionLifecyclePanel;
