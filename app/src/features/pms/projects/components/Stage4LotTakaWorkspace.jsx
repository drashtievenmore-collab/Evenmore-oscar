import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useNavigate } from 'react-router-dom';
import LotTakaRegisterPage from '../../../inventory/LotTakaRegisterPage';

export function Stage4LotTakaWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
}) {
  const navigate = useNavigate();
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [poRes, recRes] = await Promise.allSettled([
        getProjectPurchaseOrders(projectId),
        api.get('/purchase/receipts/'),
      ]);

      let poList = [];
      if (poRes.status === 'fulfilled' && poRes.value) {
        poList = Array.isArray(poRes.value) ? poRes.value : (poRes.value.data || poRes.value.results || []);
        setPurchaseOrders(poList);
      }

      if (recRes.status === 'fulfilled' && recRes.value) {
        const raw = Array.isArray(recRes.value) ? recRes.value : (recRes.value.data || recRes.value.results || []);
        const poIds = new Set(poList.map((p) => String(p.id)));
        const poNumbers = new Set(poList.map((p) => p.poNumber));
        const matched = raw.filter((r) => {
          const poId = String(r.purchaseOrderId || r.purchase_order || '');
          const poNum = r.purchaseOrderNumber || r.poNumber;
          return poIds.has(poId) || poNumbers.has(poNum);
        });
        setReceipts(matched);
      }
    } catch (err) {
      console.warn('Error loading lot/taka workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId]);

  const activePo = purchaseOrders[0] || null;
  const activeGrn = receipts[0] || null;

  const handleOpenFullscreenRegister = () => {
    const params = new URLSearchParams();
    if (activePo?.id) params.set('po', activePo.id);
    if (activePo?.poNumber) params.set('poNumber', activePo.poNumber);
    if (activeGrn?.id) params.set('grn', activeGrn.id);
    const grnNo = activeGrn?.grn_number || activeGrn?.grnNumber;
    if (grnNo) params.set('grnNumber', grnNo);

    navigate(`/inventory/lot-register?${params.toString()}`, {
      state: {
        po: activePo,
        poId: activePo?.id,
        poNumber: activePo?.poNumber,
        grn: activeGrn,
        grnId: activeGrn?.id,
        grnNumber: grnNo,
        source: 'pipeline',
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Stage 4 Navigation & Context Header */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                Stage 4
              </span>
              <h2 className="text-base font-extrabold text-[#17294e]">Lot & Taka Creation (Traceability)</h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Traceable fabric rolls generated from GRN inward. Connected directly to the live OSCAR Inventory Lot / Taka Register.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFullscreenRegister}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold shadow-2xs cursor-pointer"
            >
              <ExternalLink size={13} /> Open Fullscreen Register
            </button>
          </div>
        </div>

        {/* Pipeline stage breadcrumb / fast navigation */}
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            onClick={() => onSelectStage && onSelectStage(3)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft size={13} /> Back to Stage 3: GRN / Inward
          </button>

          <button
            type="button"
            onClick={() => onSelectStage && onSelectStage(5)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
          >
            Proceed to Stage 5: Grey Fabric QC <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Embedded Live OSCAR Lot / Taka Register with PO & GRN Context */}
      <LotTakaRegisterPage
        initialPo={activePo}
        initialGrn={activeGrn}
        poId={activePo?.id}
        grnId={activeGrn?.id}
        isEmbedded={true}
      />
    </div>
  );
}

export default Stage4LotTakaWorkspace;
