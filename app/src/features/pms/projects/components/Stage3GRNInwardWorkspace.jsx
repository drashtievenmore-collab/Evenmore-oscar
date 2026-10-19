import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Plus,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../../../../services/api';
import { getProjectPurchaseOrders } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useNavigate } from 'react-router-dom';

export function Stage3GRNInwardWorkspace({
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
  const [refreshing, setRefreshing] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [grnForm, setGrnForm] = useState({
    supplierChallanNo: '',
    supplierChallanDate: new Date().toISOString().split('T')[0],
    receiptDate: new Date().toISOString().split('T')[0],
    receivedQty: '',
    rollCount: 10,
    remarks: '',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [poRes, recRes, delRes] = await Promise.allSettled([
        getProjectPurchaseOrders(projectId),
        api.get('/purchase/receipts/'),
        api.get('/purchase/deliveries/', { params: { projectId } }),
      ]);

      let poList = [];
      if (poRes.status === 'fulfilled' && poRes.value) {
        poList = Array.isArray(poRes.value) ? poRes.value : (poRes.value.data || poRes.value.results || []);
        setPurchaseOrders(poList);
      }

      if (delRes.status === 'fulfilled' && delRes.value) {
        const dList = Array.isArray(delRes.value) ? delRes.value : (delRes.value.data || delRes.value.results || []);
        setDeliveries(dList);
      }

      if (recRes.status === 'fulfilled' && recRes.value) {
        const rList = Array.isArray(recRes.value) ? recRes.value : (recRes.value.data || recRes.value.results || []);
        const poIds = new Set(poList.map((p) => String(p.id)));
        const poNumbers = new Set(poList.map((p) => p.poNumber));
        const matched = rList.filter((r) => {
          const poId = String(r.purchaseOrderId || r.purchase_order || '');
          const poNum = r.purchaseOrderNumber || r.poNumber;
          const notes = (r.supplierChallanNo || '').toLowerCase();
          const pCode = (project?.code || '').toLowerCase();
          return poIds.has(poId) || poNumbers.has(poNum) || (pCode && notes.includes(pCode));
        });
        setReceipts(matched.length > 0 ? matched : rList.filter((r) => poIds.has(String(r.purchase_order))));
      }
    } catch (err) {
      console.warn('Error loading GRN workspace data:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info('GRN records refreshed.');
  };

  const activePo = purchaseOrders[0] || null;

  const totalOrderedQty = useMemo(() => {
    if (!activePo) return 0;
    const lines = activePo.items || activePo.lineItems || [];
    return lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, [activePo]);

  const totalReceivedQty = useMemo(() => {
    return receipts.reduce((sum, r) => {
      const lines = r.lines || [];
      const lineSum = lines.reduce((ls, l) => ls + (Number(l.receivedQty || l.received_qty) || 0), 0);
      return sum + (lineSum > 0 ? lineSum : (Number(r.receivedQty) || 0));
    }, 0);
  }, [receipts]);

  const pendingBalance = Math.max(0, totalOrderedQty - totalReceivedQty);

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    if (!activePo) {
      toast.error('No purchase order found for this project.');
      return;
    }
    const qty = Number(grnForm.receivedQty);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid received quantity.');
      return;
    }

    const lines = activePo.items || activePo.lineItems || [];
    const firstLine = lines[0];

    setSubmitting(true);
    try {
      const payload = {
        partyId: activePo.vendorId || activePo.party_id,
        purchaseOrderId: activePo.id,
        supplierChallanNo: grnForm.supplierChallanNo,
        supplierChallanDate: grnForm.supplierChallanDate || null,
        receiptDate: grnForm.receiptDate,
        lines: [
          {
            itemId: firstLine?.itemId || firstLine?.item?.id,
            orderedQty: Number(firstLine?.qty || totalOrderedQty),
            receivedQty: qty,
            rollCount: Number(grnForm.rollCount) || 10,
            uom: firstLine?.uom || 'Mtr',
            unitCost: Number(firstLine?.rate || 0),
            remarks: grnForm.remarks,
          },
        ],
      };

      await api.post('/purchase/receipts/', payload);
      toast.success('Goods Receipt (GRN) created and posted to QC-Hold.');
      setIsModalOpen(false);
      setGrnForm({
        supplierChallanNo: '',
        supplierChallanDate: new Date().toISOString().split('T')[0],
        receiptDate: new Date().toISOString().split('T')[0],
        receivedQty: '',
        rollCount: 10,
        remarks: '',
      });
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to create GRN: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
              Stage 3
            </span>
            <h2 className="text-base font-extrabold text-[#17294e]">Goods Receipt Note (GRN) / Inward</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Physical dock receipt of grey fabric. Fabric is received into QC Hold location and lot/taka rolls are generated for inspection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={!activePo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Plus size={14} /> Record GRN Inward
          </button>
        </div>
      </div>

      {activePo && (
        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">Purchase Order</span>
            <span className="font-mono font-bold text-blue-700">{activePo.poNumber}</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">Ordered Quantity</span>
            <span className="font-mono font-black text-slate-900">{totalOrderedQty.toLocaleString('en-IN')} M</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">Total Received (GRN)</span>
            <span className="font-mono font-black text-emerald-700">{totalReceivedQty.toLocaleString('en-IN')} M</span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block">Pending Balance</span>
            <span className="font-mono font-black text-amber-700">{pendingBalance.toLocaleString('en-IN')} M</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Receipt Records / GRNs ({receipts.length})
          </h3>
          <span className="text-[11px] text-slate-400">Multiple GRNs against one PO supported</span>
        </div>

        {receipts.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
            <Boxes size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No GRN recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Record physical receipt when the vehicle arrives at the warehouse dock.
            </p>
            {activePo && (
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-sky-700 cursor-pointer"
              >
                <Plus size={13} /> Record GRN Now
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">GRN #</th>
                  <th className="py-2.5 px-3">Receipt Date</th>
                  <th className="py-2.5 px-3">Supplier Challan</th>
                  <th className="py-2.5 px-3 text-right">Received Qty</th>
                  <th className="py-2.5 px-3">QC Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((r) => {
                  const lineQty = (r.lines || []).reduce((s, l) => s + (Number(l.receivedQty || l.received_qty) || 0), 0);
                  const displayQty = lineQty > 0 ? lineQty : (Number(r.receivedQty) || 0);
                  const qc = r.qcStatus || r.qc_status || 'Pending';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                        {r.grnNumber || r.grn_number || f`GRN-${r.id}`}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">{r.receiptDate || r.receipt_date || '—'}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{r.supplierChallanNo || r.supplier_challan_no || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {displayQty.toLocaleString('en-IN')} M
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          qc === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {qc}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectStage && onSelectStage(4)}
                          className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                        >
                          View Takas
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onSelectStage && onSelectStage(2)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={13} /> Back to Supplier Delivery
        </button>

        <button
          type="button"
          onClick={() => onSelectStage && onSelectStage(4)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
        >
          Proceed to Stage 4: Lot & Taka Creation <ArrowRight size={13} />
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Record Physical GRN Inward</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateGrn} className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Received Quantity (Mtrs) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  min="1"
                  value={grnForm.receivedQty}
                  onChange={(e) => setGrnForm({ ...grnForm, receivedQty: e.target.value })}
                  placeholder={pendingBalance ? String(pendingBalance) : '1000'}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                  <input
                    type="date"
                    required
                    value={grnForm.receiptDate}
                    onChange={(e) => setGrnForm({ ...grnForm, receiptDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rolls / Takas Count</label>
                  <input
                    type="number"
                    min="1"
                    value={grnForm.rollCount}
                    onChange={(e) => setGrnForm({ ...grnForm, rollCount: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier Challan No</label>
                  <input
                    type="text"
                    value={grnForm.supplierChallanNo}
                    onChange={(e) => setGrnForm({ ...grnForm, supplierChallanNo: e.target.value })}
                    placeholder="e.g. CH-2026-9811"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Challan Date</label>
                  <input
                    type="date"
                    value={grnForm.supplierChallanDate}
                    onChange={(e) => setGrnForm({ ...grnForm, supplierChallanDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={grnForm.remarks}
                  onChange={(e) => setGrnForm({ ...grnForm, remarks: e.target.value })}
                  placeholder="Dock receipt notes, condition check..."
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'Posting GRN...' : 'Post GRN Inward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Stage3GRNInwardWorkspace;
