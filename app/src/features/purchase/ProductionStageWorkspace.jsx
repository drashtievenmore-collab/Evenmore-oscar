import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Factory, Send } from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { api } from '../../services/api';
import { PoProductionInstructionSection } from './PoProductionInstructionSection';
import { PoDailyProductionEntrySection } from './PoDailyProductionEntrySection';
import { PoQualityControlSection } from './PoQualityControlSection';
import { CompletionVerificationInlineSlide } from './CompletionVerificationInlineSlide';
import { FinalJobWorkPoInlineSlide } from './FinalJobWorkPoInlineSlide';
import { AgencyBillMatchingInlineSlide } from './AgencyBillMatchingInlineSlide';
import { SupplierPaymentInlineSlide } from './SupplierPaymentInlineSlide';

/**
 * The existing Vendor A Production stage screens, rendered for one PO and one
 * stage. Used inside the PMS project slide so every lifecycle action happens
 * in place (same components, same APIs as the Purchase PO screen -- no
 * duplicate records, no redirect).
 */
export function ProductionStageWorkspace({ po, stageKey, onStageChange, onUpdated }) {
  const navigate = useNavigate();
  const { updatePurchaseOrderStatus, refreshCollections, showToast } = useERP();
  const [instruction, setInstruction] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadInstruction = useCallback(async () => {
    if (!po?.id) return;
    const res = await api.get(`/purchase/orders/${po.id}/production-instruction/`).catch(() => null);
    setInstruction(res?.instruction || null);
  }, [po?.id]);

  useEffect(() => {
    loadInstruction();
  }, [loadInstruction]);

  const updated = (collections = ['purchaseOrders']) => {
    loadInstruction();
    if (refreshCollections) refreshCollections(collections);
    onUpdated?.();
  };
  const go = (key) => key && onStageChange?.(key);

  if (!po) return null;

  // PO stage: the same server transitions the Purchase screen uses.
  if (stageKey === 'purchase_order') {
    const runTransition = async (status) => {
      setBusy(true);
      try {
        await updatePurchaseOrderStatus(po.id, status);
        updated();
      } finally {
        setBusy(false);
      }
    };
    const startProduction = async () => {
      setBusy(true);
      try {
        const res = await api.post(`/purchase/orders/${po.id}/start-production/`);
        if (res?.po) updatePurchaseOrderStatus(po.id, res.po.status || 'In Production');
        showToast?.(res?.message || 'Production started.');
        updated();
        go('daily_production_entry');
      } catch (err) {
        showToast?.(`Production not started — ${err?.message || 'server error'}`);
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-4 space-y-3 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono font-bold text-[#17294e] text-sm">{po.poNumber}</div>
            <div className="text-slate-500">
              {po.vendor || po.partyName || '—'} · Status: <strong className="text-slate-800">{po.status}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {po.status === 'Draft' && (
              <button type="button" disabled={busy} onClick={() => runTransition('Pending Approval')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60 cursor-pointer">
                <Send size={13} /> Submit for Approval
              </button>
            )}
            {po.status === 'Pending Approval' && (
              <button type="button" disabled={busy} onClick={() => runTransition('Approved')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-60 cursor-pointer">
                <CheckCircle2 size={13} /> Approve PO
              </button>
            )}
            {po.status === 'Approved' && (
              <button type="button" disabled={busy} onClick={startProduction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-60 cursor-pointer">
                <Factory size={13} /> Start Production
              </button>
            )}
          </div>
        </div>
        <p className="text-slate-500">
          Approval follows the normal purchase rules (approver permission, no self-approval).
        </p>
      </div>
    );
  }

  const common = {
    po,
    instruction,
    onClose: () => go('purchase_order'),
    onNextStep: go,
    onPrevStep: go,
  };

  switch (stageKey) {
    case 'production_instruction':
      return (
        <PoProductionInstructionSection
          po={po}
          navigate={navigate}
          defaultCollapsed={false}
          onOpenDailyProduction={() => go('daily_production_entry')}
          onUpdated={() => updated()}
        />
      );
    case 'daily_production_entry':
      return (
        <PoDailyProductionEntrySection
          po={po}
          navigate={navigate}
          onSwitchToInstruction={() => go('production_instruction')}
          onProceedToQc={() => go('grey_fabric_qc')}
          onUpdated={() => updated()}
        />
      );
    case 'grey_fabric_qc':
      return (
        <PoQualityControlSection
          po={po}
          navigate={navigate}
          defaultExpanded
          onProceedToVerification={() => go('completion_verification')}
          onUpdated={() => updated()}
        />
      );
    case 'completion_verification':
      return <CompletionVerificationInlineSlide {...common} onPrevStep={() => go('grey_fabric_qc')} onUpdated={() => updated()} />;
    case 'final_job_work_po':
      return <FinalJobWorkPoInlineSlide {...common} onPrevStep={() => go('completion_verification')} onUpdated={() => updated()} />;
    case 'agency_bill_match':
      return (
        <AgencyBillMatchingInlineSlide
          {...common}
          onBillMatched={() => updated(['purchaseOrders', 'purchaseBills', 'vendorBills'])}
        />
      );
    case 'disbursement_payment':
      return (
        <SupplierPaymentInlineSlide
          {...common}
          onPaymentSaved={() => updated(['purchaseOrders', 'purchaseBills', 'paymentOuts'])}
        />
      );
    default:
      return null;
  }
}

export default ProductionStageWorkspace;
