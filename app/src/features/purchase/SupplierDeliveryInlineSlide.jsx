import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Plus,
  RefreshCw,
  Boxes,
  Clock,
  ArrowRight,
  X,
  ExternalLink,
  RotateCcw,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

const STATUS_PILLS = {
  'Pending Dispatch': 'bg-amber-50 text-amber-700 border-amber-200',
  'Dispatched': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Transit': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Partially Delivered': 'bg-purple-50 text-purple-700 border-purple-200',
  'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Delayed': 'bg-rose-50 text-rose-700 border-rose-200',
};

export function SupplierDeliveryInlineSlide({ po, onClose, onDeliverySaved, onNextStep }) {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const { showToast } = useERP() || {};

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isUpdateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  const initialFormState = {
    supplierChallanNo: '',
    supplierChallanDate: new Date().toISOString().split('T')[0],
    dispatchDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    transporterName: '',
    vehicleNumber: '',
    lrBiltyNumber: '',
    dispatchedQty: '',
    status: 'Dispatched',
    remarks: '',
  };

  const [dispatchForm, setDispatchForm] = useState(initialFormState);

  const [updateForm, setUpdateForm] = useState({
    status: 'Delivered',
    actualDeliveryDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const poId = po?.id;

  const loadDeliveries = async () => {
    if (!poId) return;
    try {
      setLoading(true);
      const res = await api.get('/purchase/deliveries/', {
        params: { purchaseOrderId: poId },
      });
      const list = Array.isArray(res) ? res : res?.data || res?.results || [];
      const filtered = list.filter(
        (d) => String(d.purchaseOrderId || d.purchaseOrder) === String(poId)
      );
      setDeliveries(filtered);
    } catch (err) {
      console.warn('Failed to load deliveries for PO:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeliveries();
  }, [poId]);

  const poLineItems = useMemo(() => {
    if (!po) return [];
    return po.items || po.lineItems || po.line_items || [];
  }, [po]);

  const primaryFabric = useMemo(() => {
    if (!poLineItems.length) return null;
    return poLineItems[0];
  }, [poLineItems]);

  const totalOrderedQty = useMemo(() => {
    if (!poLineItems.length) return Number(po?.totalQuantity || po?.qty || 0);
    return poLineItems.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, [poLineItems, po]);

  const totalDispatchedQty = useMemo(() => {
    return deliveries.reduce((s, d) => s + (Number(d.dispatchedQty) || 0), 0);
  }, [deliveries]);

  const totalReceivedQty = useMemo(() => {
    return deliveries.reduce((s, d) => s + (Number(d.receivedQty) || 0), 0);
  }, [deliveries]);

  const pendingDispatch = Math.max(0, totalOrderedQty - totalDispatchedQty);

  const handleClear = () => {
    setDispatchForm(initialFormState);
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (!poId) {
      showToast?.('No purchase order context found.', 'error');
      return;
    }
    const qty = Number(dispatchForm.dispatchedQty);
    if (!qty || qty <= 0) {
      showToast?.('Enter a valid dispatch quantity.', 'error');
      return;
    }

    if (pendingDispatch > 0 && qty > pendingDispatch) {
      showToast?.(
        `Dispatch quantity cannot exceed remaining order quantity (${pendingDispatch.toLocaleString('en-IN')} M).`,
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        purchaseOrderId: poId,
        supplierChallanNo: dispatchForm.supplierChallanNo,
        supplierChallanDate: dispatchForm.supplierChallanDate || null,
        dispatchDate: dispatchForm.dispatchDate,
        expectedDeliveryDate: dispatchForm.expectedDeliveryDate || null,
        transporterName: dispatchForm.transporterName,
        vehicleNumber: dispatchForm.vehicleNumber,
        lrBiltyNumber: dispatchForm.lrBiltyNumber,
        dispatchedQty: qty,
        status: dispatchForm.status,
        remarks: dispatchForm.remarks,
      };

      await api.post('/purchase/deliveries/', payload);
      showToast?.('Supplier dispatch saved successfully.', 'success');
      setDispatchForm(initialFormState);
      await loadDeliveries();
      if (onDeliverySaved) onDeliverySaved();
    } catch (err) {
      showToast?.('Failed to save dispatch: ' + (err?.message || 'Server error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedDelivery) return;

    setSubmitting(true);
    try {
      const payload = {
        status: updateForm.status,
        actualDeliveryDate: updateForm.actualDeliveryDate || null,
        remarks: updateForm.remarks || selectedDelivery.remarks || '',
      };

      await api.patch(`/purchase/deliveries/${selectedDelivery.id}/`, payload);
      showToast?.(`Delivery status updated to ${updateForm.status}.`, 'success');
      setUpdateModalOpen(false);
      setSelectedDelivery(null);
      await loadDeliveries();
      if (onDeliverySaved) onDeliverySaved();
    } catch (err) {
      showToast?.('Failed to update status: ' + (err?.message || 'Server error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateModal = (delivery) => {
    setSelectedDelivery(delivery);
    setUpdateForm({
      status: delivery.status || 'Delivered',
      actualDeliveryDate: delivery.actualDeliveryDate || new Date().toISOString().split('T')[0],
      remarks: delivery.remarks || '',
    });
    setUpdateModalOpen(true);
  };

  const handleAddAnother = () => {
    setDispatchForm(initialFormState);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleReceiveGrn = (delivery) => {
    if (onNextStep) {
      onNextStep('grn_inward');
      return;
    }
    navigate('/purchase/receipts', {
      state: {
        grnForPo: delivery.purchaseOrderId || delivery.purchaseOrder || poId,
        supplierChallanNo: delivery.supplierChallanNo,
        supplierChallanDate: delivery.supplierChallanDate,
        dispatchQty: delivery.dispatchedQty,
      },
    });
  };

  return (
    <div className="rounded-2xl border-2 border-blue-400/80 bg-gradient-to-b from-blue-50/60 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blue-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Truck size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                Stage 2 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Supplier Delivery & Dispatch Tracking
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Manage dispatches, transporter vehicles, and bilty details against PO <strong className="font-mono text-blue-700">{po?.poNumber || ''}</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => navigate(`/purchase/deliveries?po=${poId}`)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-lg shadow-2xs"
            title="Open in full screen page"
          >
            <ExternalLink size={12} /> Full Screen
          </button>

          <button
            type="button"
            onClick={loadDeliveries}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
            title="Refresh Deliveries"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              title="Close Slide"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">Ordered Qty</span>
            <FileText size={13} className="text-blue-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">
            {totalOrderedQty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-slate-500">M</span>
          </p>
        </div>

        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider">Dispatched</span>
            <Truck size={13} className="text-emerald-700" />
          </div>
          <p className="text-lg font-black text-emerald-900 font-mono mt-1">
            {totalDispatchedQty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-emerald-700">M</span>
          </p>
        </div>

        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-purple-800 uppercase tracking-wider">Received GRN</span>
            <Boxes size={13} className="text-purple-700" />
          </div>
          <p className="text-lg font-black text-purple-900 font-mono mt-1">
            {totalReceivedQty.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-purple-700">M</span>
          </p>
        </div>

        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider">Pending Dispatch</span>
            <Clock size={13} className="text-amber-700" />
          </div>
          <p className="text-lg font-black text-amber-900 font-mono mt-1">
            {pendingDispatch.toLocaleString('en-IN')} <span className="text-[10px] font-normal text-amber-700">M</span>
          </p>
        </div>
      </div>

      <div ref={formRef} className="rounded-xl border border-blue-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Plus size={13} className="text-blue-600" /> Record New Dispatch
          </h4>
          <span className="text-[10.5px] font-semibold text-slate-500">
            Available: <strong className="font-mono text-indigo-700">{pendingDispatch.toLocaleString('en-IN')} M</strong>
          </span>
        </div>

        <form onSubmit={handleSaveDispatch} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dispatch Qty (Mtrs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                min="1"
                max={pendingDispatch > 0 ? pendingDispatch : undefined}
                value={dispatchForm.dispatchedQty}
                onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchedQty: e.target.value })}
                placeholder={pendingDispatch > 0 ? String(pendingDispatch) : '1000'}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Dispatch Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dispatchForm.dispatchDate}
                onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={dispatchForm.expectedDeliveryDate}
                onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDeliveryDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status</label>
              <select
                value={dispatchForm.status}
                onChange={(e) => setDispatchForm({ ...dispatchForm, status: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              >
                <option value="Dispatched">Dispatched</option>
                <option value="In Transit">In Transit</option>
                <option value="Partially Delivered">Partially Delivered</option>
                <option value="Delivered">Delivered</option>
                <option value="Pending Dispatch">Pending Dispatch</option>
                <option value="Delayed">Delayed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Challan No.</label>
              <input
                type="text"
                value={dispatchForm.supplierChallanNo}
                onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanNo: e.target.value })}
                placeholder="e.g. CH-2026-9041"
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Challan Date</label>
              <input
                type="date"
                value={dispatchForm.supplierChallanDate}
                onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transporter</label>
              <input
                type="text"
                value={dispatchForm.transporterName}
                onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                placeholder="e.g. VRL Logistics"
                className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Vehicle & LR No.</label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={dispatchForm.vehicleNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                  placeholder="GJ 05 BX 4512"
                  className="border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
                <input
                  type="text"
                  value={dispatchForm.lrBiltyNumber}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, lrBiltyNumber: e.target.value })}
                  placeholder="LR-889012"
                  className="border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Remarks & Notes</label>
            <textarea
              rows={2}
              value={dispatchForm.remarks}
              onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
              placeholder="e.g. Dispatched 25 rolls in good condition."
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-bold"
            >
              <RotateCcw size={13} /> Clear
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-50"
            >
              <Check size={14} />
              {submitting ? 'Saving...' : 'Save Dispatch'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 flex-wrap gap-2">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Truck size={14} className="text-slate-600" /> Dispatches for this PO ({deliveries.length})
          </h4>
          <button
            type="button"
            onClick={handleAddAnother}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
          >
            <Plus size={12} /> Add Another Dispatch
          </button>
        </div>

        {deliveries.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl">
            <Truck size={28} className="mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs font-bold text-slate-700">No supplier dispatches recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Use the form above to record the first shipment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Delivery #</th>
                  <th className="py-2.5 px-3">Challan No & Date</th>
                  <th className="py-2.5 px-3">Dispatch Date</th>
                  <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                  <th className="py-2.5 px-3">Transporter</th>
                  <th className="py-2.5 px-3">LR / Bilty</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono font-bold text-blue-700">{d.deliveryNumber}</td>
                    <td className="py-2 px-3">
                      <p className="font-semibold text-slate-800">{d.supplierChallanNo || '—'}</p>
                      {d.supplierChallanDate && (
                        <p className="text-[10px] text-slate-400 font-mono">{d.supplierChallanDate}</p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-800">{d.dispatchDate || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      {Number(d.dispatchedQty || 0).toLocaleString('en-IN')} M
                    </td>
                    <td className="py-2 px-3 text-slate-700">
                      {d.transporterName || '—'} {d.vehicleNumber ? `(${d.vehicleNumber})` : ''}
                    </td>
                    <td className="py-2 px-3 font-mono text-indigo-700 font-semibold">{d.lrBiltyNumber || '—'}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${STATUS_PILLS[d.status] || STATUS_PILLS.Dispatched}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openUpdateModal(d)}
                          className="px-2 py-1 text-[10.5px] font-semibold rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReceiveGrn(d)}
                          className="px-2 py-1 text-[10.5px] font-bold rounded bg-sky-600 hover:bg-sky-700 text-white shadow-2xs flex items-center gap-1"
                        >
                          <Boxes size={11} /> Receive GRN
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-blue-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-blue-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="text-[11px] text-slate-500 font-medium">
          Stage 2 of 8: <strong className="text-slate-800">Supplier Delivery</strong> • Dispatch tracking & transporter LR
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Close Slide
            </button>
          )}
          <button
            type="button"
            onClick={() => onNextStep && onNextStep('grn_inward')}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <span>Next: Record GRN / Inward</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {isUpdateModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl text-xs flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Update Delivery Status</h3>
              <button
                type="button"
                onClick={() => setUpdateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-3 mt-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                >
                  <option value="Dispatched">Dispatched</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Partially Delivered">Partially Delivered</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Actual Delivery Date</label>
                <input
                  type="date"
                  value={updateForm.actualDeliveryDate}
                  onChange={(e) => setUpdateForm({ ...updateForm, actualDeliveryDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={updateForm.remarks}
                  onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs disabled:opacity-60"
                >
                  {submitting ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierDeliveryInlineSlide;
