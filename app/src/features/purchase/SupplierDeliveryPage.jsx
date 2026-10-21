import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Boxes,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  X,
  Check,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';
import PageHeader from '../../components/ui/PageHeader';
import TablePagination from '../../components/ui/TablePagination';

const STATUS_PILLS = {
  'Pending Dispatch': 'bg-amber-50 text-amber-700 border-amber-200',
  'Dispatched': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Transit': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Partially Delivered': 'bg-purple-50 text-purple-700 border-purple-200',
  'Delivered': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Delayed': 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function SupplierDeliveryPage() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [searchParams] = useSearchParams();
  const poQuery = searchParams.get('po') || searchParams.get('poId') || '';
  const projectQuery = searchParams.get('project') || searchParams.get('projectId') || '';
  const { purchaseOrders, showToast } = useERP();
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activePoId, setActivePoId] = useState(poQuery);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [allPage, setAllPage] = useState(1);
  const [allPageSize, setAllPageSize] = useState(10);

  useEffect(() => {
    setHistoryPage(1);
  }, [activePoId]);

  useEffect(() => {
    setAllPage(1);
  }, [search, statusFilter]);

  const [isUpdateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const initialDispatchState = {
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

  const [dispatchForm, setDispatchForm] = useState(initialDispatchState);

  const [updateForm, setUpdateForm] = useState({
    status: 'Delivered',
    actualDeliveryDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  const loadDeliveries = async () => {
    try {
      const res = await api.get('/purchase/deliveries/');
      const list = Array.isArray(res) ? res : res?.data || res?.results || [];
      setDeliveries(list);
    } catch (err) {
      console.warn('Failed to load deliveries:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadDeliveries().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (poQuery) {
      setActivePoId(poQuery);
    } else if (!activePoId && purchaseOrders.length > 0) {
      setActivePoId(String(purchaseOrders[0].id));
    }
  }, [poQuery, purchaseOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeliveries();
    setRefreshing(false);
    toast.info('Supplier delivery records refreshed.');
  };

  const selectedPo = useMemo(() => {
    if (!activePoId || activePoId === 'ALL') return null;
    return (
      purchaseOrders.find(
        (p) => String(p.id) === String(activePoId) || p.poNumber === activePoId
      ) || null
    );
  }, [activePoId, purchaseOrders]);

  const poLineItems = useMemo(() => {
    if (!selectedPo) return [];
    return selectedPo.items || selectedPo.lineItems || selectedPo.line_items || [];
  }, [selectedPo]);

  const primaryFabric = useMemo(() => {
    if (!poLineItems.length) return null;
    return poLineItems[0];
  }, [poLineItems]);

  const currentPoDeliveries = useMemo(() => {
    if (!selectedPo) return deliveries;
    return deliveries.filter(
      (d) => String(d.purchaseOrderId || d.purchaseOrder) === String(selectedPo.id)
    );
  }, [deliveries, selectedPo]);

  const totalOrderedQty = useMemo(() => {
    if (!selectedPo) return 0;
    return poLineItems.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  }, [selectedPo, poLineItems]);

  const totalDispatchedQty = useMemo(() => {
    return currentPoDeliveries.reduce((s, d) => s + (Number(d.dispatchedQty) || 0), 0);
  }, [currentPoDeliveries]);

  const totalReceivedQty = useMemo(() => {
    return currentPoDeliveries.reduce((s, d) => s + (Number(d.receivedQty) || 0), 0);
  }, [currentPoDeliveries]);

  const pendingDispatch = Math.max(0, totalOrderedQty - totalDispatchedQty);

  const pagedCurrentDeliveries = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return currentPoDeliveries.slice(start, start + historyPageSize);
  }, [currentPoDeliveries, historyPage, historyPageSize]);

  const allFilteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (statusFilter !== 'All' && d.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${d.deliveryNumber || ''} ${d.poNumber || ''} ${d.supplierName || ''} ${d.supplierChallanNo || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [deliveries, statusFilter, search]);

  const pagedAllDeliveries = useMemo(() => {
    const start = (allPage - 1) * allPageSize;
    return allFilteredDeliveries.slice(start, start + allPageSize);
  }, [allFilteredDeliveries, allPage, allPageSize]);

  const handleClearForm = () => {
    setDispatchForm(initialDispatchState);
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (!selectedPo) {
      toast.error('Please select a Purchase Order.');
      return;
    }
    const qty = Number(dispatchForm.dispatchedQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid dispatch quantity.');
      return;
    }

    if (pendingDispatch > 0 && qty > pendingDispatch) {
      toast.error(`Dispatch quantity cannot exceed remaining order quantity (${pendingDispatch.toLocaleString('en-IN')} M).`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        purchaseOrderId: selectedPo.id,
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
      toast.success('Supplier dispatch saved successfully.');
      setDispatchForm(initialDispatchState);
      await loadDeliveries();
    } catch (err) {
      toast.error('Failed to save dispatch: ' + (err?.message || 'Server error'));
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
      toast.success(`Delivery status updated to ${updateForm.status}.`);
      setUpdateModalOpen(false);
      setSelectedDelivery(null);
      await loadDeliveries();
    } catch (err) {
      toast.error('Failed to update delivery: ' + (err?.message || 'Server error'));
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

  const handleCreateGrn = (delivery) => {
    navigate('/purchase/receipts', {
      state: {
        grnForPo: delivery.purchaseOrderId || delivery.purchaseOrder,
        supplierChallanNo: delivery.supplierChallanNo,
        supplierChallanDate: delivery.supplierChallanDate,
        dispatchQty: delivery.dispatchedQty,
      },
    });
  };

  const handleAddAnotherDispatch = () => {
    setDispatchForm(initialDispatchState);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (projectQuery) {
      navigate(`/pms/projects/${projectQuery}`);
    } else {
      navigate('/purchase/orders');
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-2xs"
            title="Go Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                Stage 2
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#17294e]">
                Supplier Delivery & Dispatch Tracking
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Record supplier dispatches, vehicle LR details, transit status, and delivery history linked to Purchase Orders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={activePoId}
            onChange={(e) => setActivePoId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold bg-white text-slate-700 shadow-2xs"
          >
            <option value="ALL">All Purchase Orders</option>
            {purchaseOrders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.poNumber} — {p.vendor || p.party_name || 'Supplier'}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-2xs"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          {selectedPo && (
            <button
              type="button"
              onClick={handleAddAnotherDispatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
            >
              <Plus size={15} /> Add Dispatch
            </button>
          )}
        </div>
      </div>

      {selectedPo ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  1. Purchase Order & Fabric Reference Details
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {selectedPo.poNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Supplier / Vendor</span>
                <p className="font-bold text-slate-800 truncate mt-0.5">{selectedPo.vendor || selectedPo.party_name || '—'}</p>
                <p className="text-[10px] text-slate-500 font-mono">{selectedPo.vendorCode || selectedPo.party_gstin || 'VEND-001'}</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Fabric Quality</span>
                <p className="font-bold text-slate-800 truncate mt-0.5">
                  {primaryFabric?.name || primaryFabric?.description || selectedPo.fabricName || 'Grey Fabric'}
                </p>
                <p className="text-[10px] text-slate-500">{primaryFabric?.uom || 'Mtr'} · {primaryFabric?.gsm ? `${primaryFabric.gsm} GSM` : 'Standard'}</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Ordered Quantity</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                  {totalOrderedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">M</span>
                </p>
                <p className="text-[10px] text-slate-400">Total ordered meters</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Unit Rate</span>
                <p className="font-mono font-bold text-slate-800 text-sm mt-0.5">
                  ₹{Number(primaryFabric?.rate || selectedPo.rate || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-slate-400">Per meter rate</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Total PO Value</span>
                <p className="font-mono font-black text-slate-900 text-sm mt-0.5">
                  ₹{Number(selectedPo.total || selectedPo.amount || 0).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-emerald-600 font-medium">Approved Value</p>
              </div>

              <div>
                <span className="text-[10.5px] font-semibold text-slate-400 block uppercase">Project Association</span>
                <p className="font-bold text-slate-800 truncate mt-0.5">
                  {selectedPo.projectCode || selectedPo.projectName || 'General Warehouse Stock'}
                </p>
                <p className="text-[10px] text-indigo-600 font-mono">{selectedPo.projectCode || 'NO-PROJECT'}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Boxes size={16} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Delivery Summary & Fulfillment Status
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ordered Quantity</span>
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <FileText size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900 mt-2 font-mono">
                  {totalOrderedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">M</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Total contracted requirement</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-emerald-200/90 shadow-2xs bg-emerald-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Dispatched</span>
                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                    <Truck size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-900 mt-2 font-mono">
                  {totalDispatchedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-emerald-700">M</span>
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {totalOrderedQty > 0
                    ? `${Math.round((totalDispatchedQty / totalOrderedQty) * 100)}% of PO dispatched`
                    : '0 dispatches'}
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-purple-200/90 shadow-2xs bg-purple-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Received via GRN</span>
                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                    <Boxes size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black text-purple-900 mt-2 font-mono">
                  {totalReceivedQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-purple-700">M</span>
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5">Physical intake in dock</p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-amber-200/90 shadow-2xs bg-amber-50/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Pending Dispatch</span>
                  <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                    <Clock size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black text-amber-900 mt-2 font-mono">
                  {pendingDispatch.toLocaleString('en-IN')} <span className="text-xs font-normal text-amber-700">M</span>
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">Remaining vendor shipment</p>
              </div>
            </div>
          </div>

          <div ref={formRef} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck size={17} className="text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Record Supplier Dispatch
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Remaining to dispatch: <strong className="font-mono text-indigo-700">{pendingDispatch.toLocaleString('en-IN')} M</strong>
              </span>
            </div>

            <form onSubmit={handleSaveDispatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-900 font-mono font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must be ≤ {pendingDispatch.toLocaleString('en-IN')} Mtrs
                  </span>
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
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={dispatchForm.expectedDeliveryDate}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, expectedDeliveryDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Delivery Status</label>
                  <select
                    value={dispatchForm.status}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier Challan No.</label>
                  <input
                    type="text"
                    value={dispatchForm.supplierChallanNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanNo: e.target.value })}
                    placeholder="e.g. CH-2026-9041"
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier Challan Date</label>
                  <input
                    type="date"
                    value={dispatchForm.supplierChallanDate}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, supplierChallanDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Transporter Name</label>
                  <input
                    type="text"
                    value={dispatchForm.transporterName}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                    placeholder="e.g. VRL Logistics / Mahavir Roadways"
                    className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle & LR / Bilty Number</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={dispatchForm.vehicleNumber}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                      placeholder="GJ 05 BX 4512"
                      className="border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                    <input
                      type="text"
                      value={dispatchForm.lrBiltyNumber}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, lrBiltyNumber: e.target.value })}
                      placeholder="LR-889012"
                      className="border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks & Dispatch Notes</label>
                <textarea
                  rows={2}
                  value={dispatchForm.remarks}
                  onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                  placeholder="e.g. 20 bales dispatched in good condition, expected arrival tomorrow."
                  className="w-full border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold shadow-2xs"
                >
                  <RotateCcw size={14} /> Clear
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50"
                >
                  <Check size={15} />
                  {submitting ? 'Saving Dispatch...' : 'Save Dispatch'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-slate-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  4. Dispatch / Delivery History ({currentPoDeliveries.length})
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-slate-500">
                  Total Dispatched: <strong className="font-mono text-slate-900">{totalDispatchedQty.toLocaleString('en-IN')} M</strong>
                </span>
                <button
                  type="button"
                  onClick={handleAddAnotherDispatch}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                >
                  <Plus size={13} /> Add Another Dispatch
                </button>
              </div>
            </div>

            {currentPoDeliveries.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                <Truck size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-700">No dispatches logged for this Purchase Order</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Use the form above to record the first dispatch when the vendor ships fabric.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3">Delivery #</th>
                      <th className="py-3 px-3">Challan No & Date</th>
                      <th className="py-3 px-3">Dispatch Date</th>
                      <th className="py-3 px-3 text-right">Dispatched Qty</th>
                      <th className="py-3 px-3">Transporter / Vehicle</th>
                      <th className="py-3 px-3">LR / Bilty</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedCurrentDeliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-mono font-bold text-blue-700">
                          {d.deliveryNumber}
                          {d.remarks && (
                            <p className="font-sans text-[10px] text-slate-400 font-normal truncate max-w-[130px]" title={d.remarks}>
                              {d.remarks}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{d.supplierChallanNo || '—'}</p>
                          {d.supplierChallanDate && (
                            <p className="text-[10px] text-slate-400 font-mono">{d.supplierChallanDate}</p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-slate-800 font-medium">{d.dispatchDate || '—'}</p>
                          {d.expectedDeliveryDate && (
                            <p className="text-[10px] text-slate-400">Exp: {d.expectedDeliveryDate}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {Number(d.dispatchedQty || 0).toLocaleString('en-IN')} M
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-slate-800 font-medium">{d.transporterName || '—'}</p>
                          {d.vehicleNumber && (
                            <p className="text-[10px] font-mono text-slate-500">{d.vehicleNumber}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-indigo-700 font-semibold">
                          {d.lrBiltyNumber || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              STATUS_PILLS[d.status] || STATUS_PILLS.Dispatched
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openUpdateModal(d)}
                              className="px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateGrn(d)}
                              className="px-2 py-1 text-[11px] font-bold rounded-md bg-sky-600 hover:bg-sky-700 text-white shadow-2xs flex items-center gap-1"
                            >
                              <Boxes size={11} /> Receive GRN
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  page={historyPage}
                  pageSize={historyPageSize}
                  totalItems={currentPoDeliveries.length}
                  onPageChange={setHistoryPage}
                  onPageSizeChange={(sz) => { setHistoryPageSize(sz); setHistoryPage(1); }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Delivery #, PO #, Challan #..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-700 font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Pending Dispatch">Pending Dispatch</option>
              <option value="Dispatched">Dispatched</option>
              <option value="In Transit">In Transit</option>
              <option value="Partially Delivered">Partially Delivered</option>
              <option value="Delivered">Delivered</option>
              <option value="Delayed">Delayed</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                All Supplier Deliveries ({allFilteredDeliveries.length})
              </h3>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                <p className="text-xs font-semibold">Loading supplier deliveries...</p>
              </div>
            ) : allFilteredDeliveries.length === 0 ? (
              <div className="p-12 text-center">
                <Truck size={36} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-bold text-slate-700">No supplier deliveries found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Select a Purchase Order above to record the first supplier dispatch.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Delivery #</th>
                      <th className="py-3 px-4">Purchase Order</th>
                      <th className="py-3 px-4">Supplier & Fabric</th>
                      <th className="py-3 px-4 text-right">Dispatched Qty</th>
                      <th className="py-3 px-4">Dispatch / Expected</th>
                      <th className="py-3 px-4">Challan & Transporter</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pagedAllDeliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-bold text-blue-700">{d.deliveryNumber}</td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setActivePoId(String(d.purchaseOrderId || d.purchaseOrder))}
                            className="font-mono font-bold text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                          >
                            {d.poNumber || 'PO'}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{d.supplierName || '—'}</p>
                          <p className="text-[11px] text-slate-500">{d.fabricName || 'Grey Fabric'}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {Number(d.dispatchedQty || 0).toLocaleString('en-IN')} M
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-800">Disp: {d.dispatchDate || '—'}</p>
                          <p className="text-[11px] text-slate-500">Exp: {d.expectedDeliveryDate || '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-800">{d.supplierChallanNo || '—'}</p>
                          <p className="text-[10px] text-slate-500">{d.transporterName || '—'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${STATUS_PILLS[d.status] || STATUS_PILLS.Dispatched}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openUpdateModal(d)}
                              className="px-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
                            >
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateGrn(d)}
                              className="px-2 py-1 text-xs font-bold rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-2xs flex items-center gap-1"
                            >
                              <Boxes size={12} /> Receive GRN
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <TablePagination
                  page={allPage}
                  pageSize={allPageSize}
                  totalItems={allFilteredDeliveries.length}
                  onPageChange={setAllPage}
                  onPageSizeChange={(sz) => { setAllPageSize(sz); setAllPage(1); }}
                />
              </div>
            )}
          </div>
        </div>
      )}

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
