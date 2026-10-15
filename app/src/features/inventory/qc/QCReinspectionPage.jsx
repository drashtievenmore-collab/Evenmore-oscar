import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Save,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  ShieldCheck,
  FileText,
  Truck,
  Inbox,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';

export default function QCReinspectionPage() {
  const { vendors = [], items = [] } = useERP();

  // Active Tab
  const [activeTab, setActiveTab] = useState('Pending Reprocess'); // 'Pending Reprocess' | 'Sent for Reprocess' | 'Received from Reprocess' | 'Reinspection'

  // Loading & Data
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [filtersData, setFiltersData] = useState({
    vendors: [],
    statuses: ['All', 'Pending', 'In Progress', 'Completed'],
    items: [],
  });

  // Filters State
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vendorFilter, setVendorFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [itemFilter, setItemFilter] = useState('All');

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const PAGE_SIZE = 10;

  // Active Selected Inspection for Bottom Entry Form
  const [activeItem, setActiveItem] = useState(null);

  // Bottom Form State (Reinspection Entry & Result)
  const [entryReprocessNo, setEntryReprocessNo] = useState('');
  const [entrySourceQcNo, setEntrySourceQcNo] = useState('');
  const [entryItemCode, setEntryItemCode] = useState('');
  const [entryFabricItem, setEntryFabricItem] = useState('');
  const [entryLotNo, setEntryLotNo] = useState('');
  const [entryVendor, setEntryVendor] = useState('');
  const [entryMeasurements, setEntryMeasurements] = useState([]);

  // Disposition Quantities
  const [goodQty, setGoodQty] = useState('0');
  const [holdQty, setHoldQty] = useState('0');
  const [reprocessQty, setReprocessQty] = useState('0');
  const [rejectedQty, setRejectedQty] = useState('0');
  const [remarks, setRemarks] = useState('');

  // Modals & Action State
  const [showNewModal, setShowNewModal] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // New Reinspection Form
  const [newSourceQcNo, setNewSourceQcNo] = useState('');
  const [newVendor, setNewVendor] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newFabricItem, setNewFabricItem] = useState('');
  const [newLotNo, setNewLotNo] = useState('');
  const [newSentQty, setNewSentQty] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newReason, setNewReason] = useState('Shade variation reprocessing');
  const [creating, setCreating] = useState(false);

  // Fetch Reinspection Records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getQCReinspection({
        tab: activeTab,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        vendor: vendorFilter !== 'All' ? vendorFilter : undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        item_code: itemFilter !== 'All' ? itemFilter : undefined,
      });

      const list = (res && res.data ? res.data.records : res?.records) || [];
      setRecords(list);

      if (res && res.data?.filters) {
        setFiltersData((prev) => ({
          ...prev,
          vendors: res.data.filters.vendors || [],
          items: res.data.filters.items || [],
        }));
      }

      // Auto-select first row if none selected or if activeItem not in new list
      if (list.length > 0) {
        loadRowIntoEntry(list[0]);
      } else {
        clearEntryForm();
      }
    } catch (err) {
      console.warn('Backend /inventory/qc/reinspection/ call failed:', err);
      setRecords([]);
      clearEntryForm();
    } finally {
      setLoading(false);
    }
  }, [activeTab, fromDate, toDate, vendorFilter, statusFilter, itemFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Toast Auto-hide
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Load a table row into the bottom inspection panels
  const loadRowIntoEntry = (row) => {
    setActiveItem(row);
    setEntryReprocessNo(row.reprocessNo || '');
    setEntrySourceQcNo(row.sourceQcNo || '');
    setEntryItemCode(row.itemCode || '');
    setEntryFabricItem(row.fabricItem || '');
    setEntryLotNo(row.lotNo || '');
    setEntryVendor(row.vendor || '');
    setEntryMeasurements(
      row.measurements && row.measurements.length > 0
        ? row.measurements
        : (row.sentQty || row.receivedQty)
          ? [{ srNo: 1, takaNo: 1, actualQty: Number(row.sentQty || row.receivedQty || 0), width: row.width ?? null, remarks: '-' }]
          : []
    );

    const totalQ = row.sentQty || row.receivedQty || 0;
    if (row.goodQty || row.holdQty || row.reprocessQty || row.rejectedQty) {
      setGoodQty(String(row.goodQty || 0));
      setHoldQty(String(row.holdQty || 0));
      setReprocessQty(String(row.reprocessQty || 0));
      setRejectedQty(String(row.rejectedQty || 0));
    } else {
      // Default to 100% good on inspect
      setGoodQty(String(totalQ));
      setHoldQty('0');
      setReprocessQty('0');
      setRejectedQty('0');
    }

    setRemarks(row.remarks || '');
  };

  const clearEntryForm = () => {
    setActiveItem(null);
    setEntryReprocessNo('');
    setEntrySourceQcNo('');
    setEntryItemCode('');
    setEntryFabricItem('');
    setEntryLotNo('');
    setEntryVendor('');
    setEntryMeasurements([]);
    setGoodQty('0');
    setHoldQty('0');
    setReprocessQty('0');
    setRejectedQty('0');
    setRemarks('');
  };

  // Math & Reconciliation for active inspection
  const totalTargetQty = Number(activeItem?.sentQty || activeItem?.receivedQty || 0);
  const numGood = Number(goodQty) || 0;
  const numHold = Number(holdQty) || 0;
  const numReprocess = Number(reprocessQty) || 0;
  const numRejected = Number(rejectedQty) || 0;
  const sumDisposition = numGood + numHold + numReprocess + numRejected;
  const isReconciled = totalTargetQty > 0 && Math.abs(sumDisposition - totalTargetQty) < 0.001;

  const pctGood = totalTargetQty > 0 ? ((numGood / totalTargetQty) * 100).toFixed(1) : '0.0';
  const pctHold = totalTargetQty > 0 ? ((numHold / totalTargetQty) * 100).toFixed(1) : '0.0';
  const pctReprocess = totalTargetQty > 0 ? ((numReprocess / totalTargetQty) * 100).toFixed(1) : '0.0';
  const pctRejected = totalTargetQty > 0 ? ((numRejected / totalTargetQty) * 100).toFixed(1) : '0.0';

  // Pagination
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return records.slice(start, start + PAGE_SIZE);
  }, [records, currentPage]);

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(new Set(paginatedRows.map((r) => r.id)));
    else setSelectedIds(new Set());
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (!activeItem) {
      alert('Please select an inspection record first.');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await inventoryService.saveQCReinspectionDisposition({
        reprocessId: activeItem.id,
        isDraft: true,
        goodQty: numGood,
        holdQty: numHold,
        reprocessQty: numReprocess,
        rejectedQty: numRejected,
        measurements: entryMeasurements,
        remarks,
      });
      setToastMsg(res?.data?.message || 'Reinspection saved as draft.');
      await fetchRecords();
    } catch (err) {
      alert('Could not save draft: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingDraft(false);
    }
  };

  // Approve & Update Stock
  const handleApproveAndUpdateStock = async () => {
    if (!activeItem) {
      alert('Please select an inspection record first.');
      return;
    }
    if (!isReconciled) {
      alert(
        `Quantity mismatch: Sent/Inspected Qty (${totalTargetQty} m) must equal Good (${numGood}) + Hold (${numHold}) + Reprocess (${numReprocess}) + Rejected (${numRejected}) = ${sumDisposition} m.`
      );
      return;
    }

    setApproving(true);
    try {
      const res = await inventoryService.saveQCReinspectionDisposition({
        reprocessId: activeItem.id,
        isDraft: false,
        goodQty: numGood,
        holdQty: numHold,
        reprocessQty: numReprocess,
        rejectedQty: numRejected,
        measurements: entryMeasurements,
        remarks,
      });
      setToastMsg(res?.data?.message || 'Reinspection approved! Stock Ledger and Stock Position updated.');
      await fetchRecords();
    } catch (err) {
      alert('Could not approve reinspection: ' + (err.response?.data?.detail || err.message));
    } finally {
      setApproving(false);
    }
  };

  // Create New Reinspection
  const handleCreateNewReinspection = async (e) => {
    e.preventDefault();
    if (!newSentQty || Number(newSentQty) <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }
    setCreating(true);
    try {
      const res = await inventoryService.createQCReinspection({
        sourceQcNo: newSourceQcNo || 'QC-001',
        vendor: newVendor || (vendors[0]?.name || 'Processor'),
        itemCode: newItemCode || (items[0]?.sku || 'COT-60S-001'),
        fabricItem: newFabricItem || (items[0]?.name || 'Cotton 60s'),
        sentQty: newSentQty,
        date: newDate,
        reason: newReason,
      });
      setToastMsg(res?.data?.message || 'Reinspection record created successfully.');
      setShowNewModal(false);
      setNewSentQty('');
      await fetchRecords();
    } catch (err) {
      alert('Could not create record: ' + (err.response?.data?.detail || err.message));
    } finally {
      setCreating(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (st) => {
    const s = (st || '').toLowerCase();
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Completed
        </span>
      );
    }
    if (s === 'in progress') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
        Pending
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              5
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Reinspection / Reprocess</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Track reprocessed fabric and record re-inspection results.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span>QC (Quality Check)</span>
          <span>&gt;</span>
          <span className="text-pink-600 font-semibold">Reinspection / Reprocess</span>
        </div>
      </div>

      {/* TABS BAR (Matching reference: Pending Reprocess | Sent for Reprocess | Received from Reprocess | Reinspection) */}
      <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-1">
        {[
          'Pending Reprocess',
          'Sent for Reprocess',
          'Received from Reprocess',
          'Reinspection',
        ].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-xs font-semibold transition ${
              activeTab === tab
                ? 'bg-blue-50 text-blue-700 shadow-2xs border border-blue-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* FILTER BAR & + NEW REINSPECTION BUTTON */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">
          <div>
            <label className="block text-slate-600 font-medium mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Vendor / Processor</label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white text-xs"
            >
              <option value="All">All</option>
              {filtersData.vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">QC Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white text-xs"
            >
              {filtersData.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Item Code</label>
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white text-xs"
            >
              <option value="All">All</option>
              {filtersData.items.map((it) => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2 md:pt-0">
          <button
            onClick={fetchRecords}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition"
          >
            Apply
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-600 border border-blue-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Reinspection</span>
          </button>
        </div>
      </div>

      {/* REINSPECTION REGISTER TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    checked={paginatedRows.length > 0 && selectedIds.size === paginatedRows.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600"
                  />
                </th>
                <th className="p-3">Reprocess No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Source QC No.</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Fabric Item</th>
                <th className="p-3 text-right">Sent Qty (m)</th>
                <th className="p-3 text-right">Received Qty (m)</th>
                <th className="p-3 text-right">Pending Qty (m)</th>
                <th className="p-3">Vendor / Processor</th>
                <th className="p-3 text-center">Reinspection Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="12" className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-pink-600" />
                    <span>Loading reprocess / reinspection entries...</span>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="12" className="p-10 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No reprocess items found in this tab</p>
                      <p className="text-xs text-slate-500">
                        Fabric flagged for reprocessing appears here. You can also log a new reinspection with "+ New Reinspection".
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const isSelected = activeItem?.id === r.id;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => loadRowIntoEntry(r)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/60 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => handleToggleSelect(r.id)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                      </td>
                      <td className="p-3 font-semibold text-blue-700">{r.reprocessNo}</td>
                      <td className="p-3 text-slate-600">{r.date}</td>
                      <td className="p-3 font-mono text-slate-700">{r.sourceQcNo}</td>
                      <td className="p-3 font-mono text-slate-600">{r.itemCode}</td>
                      <td className="p-3 font-medium text-slate-800">{r.fabricItem}</td>
                      <td className="p-3 text-right font-medium">{r.sentQty}</td>
                      <td className="p-3 text-right font-medium">{r.receivedQty}</td>
                      <td className="p-3 text-right font-semibold text-amber-700">{r.pendingQty}</td>
                      <td className="p-3 text-slate-800">{r.vendor}</td>
                      <td className="p-3 text-center">{renderStatusBadge(r.reinspectionStatus)}</td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {r.reinspectionStatus === 'Completed' ? (
                          <button
                            onClick={() => loadRowIntoEntry(r)}
                            className="px-3 py-1 bg-white hover:bg-slate-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold shadow-2xs"
                          >
                            View
                          </button>
                        ) : (
                          <button
                            onClick={() => loadRowIntoEntry(r)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs"
                          >
                            Inspect
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>Showing {records.length ? 1 : 0} to {records.length} of {records.length} entries</div>
          <div className="flex items-center space-x-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">1</span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 6-STEP WORKFLOW GUIDE: "How It Works – Reinspection / Reprocess (Step by Step)" ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            How It Works – Reinspection / Reprocess (Step by Step)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Standard closed-loop procedure linking QC Flags, Job Work Outward/Inward, and final inventory posting.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Step 1 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-blue-700">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                1
              </span>
              <span className="font-bold text-slate-900 text-[11px]">QC Flags Fabric</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              During QC inspection, fabric is marked for Reprocess with quantity and reason.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-emerald-700">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                2
              </span>
              <span className="font-bold text-slate-900 text-[11px]">Create Reprocess Job</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Create reprocess order from existing Reprocess module (Processing / Job Work).
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-amber-700">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-[10px]">
                3
              </span>
              <span className="font-bold text-slate-900 text-[11px]">Send for Reprocess</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Send fabric to vendor/processor through Job Work Outward (challan).
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-purple-700">
              <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[10px]">
                4
              </span>
              <span className="font-bold text-slate-900 text-[11px]">Receive from Reprocess</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Record returned fabric through Job Work Inward with actual received quantity and lot/taka details.
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-3 bg-pink-50 rounded-xl border border-pink-200 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-pink-700">
              <span className="w-5 h-5 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-[10px]">
                5
              </span>
              <span className="font-bold text-pink-900 text-[11px]">Re-Inspect & Record</span>
            </div>
            <p className="text-[11px] text-pink-700 leading-tight font-medium">
              Re-inspect received fabric and record final result as Good / Hold / Reprocess / Rejected.
            </p>
          </div>

          {/* Step 6 */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-emerald-700">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                6
              </span>
              <span className="font-bold text-emerald-900 text-[11px]">Approve & Post</span>
            </div>
            <p className="text-[11px] text-emerald-700 leading-tight font-medium">
              Approve reinspection result to update Stock Ledger and Stock Position automatically.
            </p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM PANELS: 2. Reinspection Entry | 3. Reinspection Result | 4. Audit Trail & Notes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel 2: Reinspection Entry (After Receive) — 4 cols */}
        <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              2
            </span>
            <h3 className="font-bold text-slate-900 text-sm">Reinspection Entry (After Receive)</h3>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="block text-slate-500 font-medium mb-1">Reprocess No.</label>
              <input
                type="text"
                value={entryReprocessNo}
                onChange={(e) => setEntryReprocessNo(e.target.value)}
                placeholder="RP-003"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-semibold"
              />
            </div>
            <div>
              <label className="block text-slate-500 font-medium mb-1">Source QC No.</label>
              <input
                type="text"
                value={entrySourceQcNo}
                onChange={(e) => setEntrySourceQcNo(e.target.value)}
                placeholder="QC-005"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-500 font-medium mb-1">Item Code</label>
              <input
                type="text"
                value={entryItemCode}
                onChange={(e) => setEntryItemCode(e.target.value)}
                placeholder="COT-60S-002"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-slate-500 font-medium mb-1">Fabric Item</label>
              <input
                type="text"
                value={entryFabricItem}
                onChange={(e) => setEntryFabricItem(e.target.value)}
                placeholder="Cotton 60s - Stripe - Black"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Lot No.</label>
              <input
                type="text"
                value={entryLotNo}
                onChange={(e) => setEntryLotNo(e.target.value)}
                placeholder="LT-030"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Vendor / Processor</label>
              <input
                type="text"
                value={entryVendor}
                onChange={(e) => setEntryVendor(e.target.value)}
                placeholder="Fine Dye"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-800"
              />
            </div>
          </div>

          {/* Measurement Details Table */}
          <div className="space-y-1 pt-1">
            <span className="font-semibold text-slate-800 text-xs block">Measurement Details</span>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2">Sr. No.</th>
                    <th className="p-2">Taka No.</th>
                    <th className="p-2 text-right">Actual Qty (m)</th>
                    <th className="p-2 text-right">Width (cm)</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {entryMeasurements.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-3 text-center text-slate-400">
                        No roll measurements entered
                      </td>
                    </tr>
                  ) : (
                    entryMeasurements.map((m, idx) => (
                      <tr key={idx}>
                        <td className="p-2 text-slate-500">{m.srNo || idx + 1}</td>
                        <td className="p-2 font-medium">{m.takaNo || idx + 1}</td>
                        <td className="p-2 text-right font-medium">{m.actualQty}</td>
                        <td className="p-2 text-right">{m.width ? m.width : '—'}</td>
                        <td className="p-2 text-slate-500">{m.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel 3: Reinspection Result — 5 cols */}
        <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs">
              3
            </span>
            <h3 className="font-bold text-slate-900 text-sm">Reinspection Result</h3>
          </div>

          {/* 4 Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-0.5">
              <div className="flex items-center space-x-1 text-emerald-700 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Good Qty</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={goodQty}
                onChange={(e) => setGoodQty(e.target.value)}
                className="w-full text-sm font-bold text-emerald-800 bg-white border border-emerald-300 rounded px-1.5 py-0.5"
              />
              <span className="text-[10px] text-emerald-600 font-semibold">{pctGood}%</span>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-0.5">
              <div className="flex items-center space-x-1 text-amber-700 font-bold text-xs">
                <PauseCircle className="w-3.5 h-3.5" />
                <span>Hold Qty</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={holdQty}
                onChange={(e) => setHoldQty(e.target.value)}
                className="w-full text-sm font-bold text-amber-800 bg-white border border-amber-300 rounded px-1.5 py-0.5"
              />
              <span className="text-[10px] text-amber-600 font-semibold">{pctHold}%</span>
            </div>

            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl space-y-0.5">
              <div className="flex items-center space-x-1 text-purple-700 font-bold text-xs">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reprocess Qty</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={reprocessQty}
                onChange={(e) => setReprocessQty(e.target.value)}
                className="w-full text-sm font-bold text-purple-800 bg-white border border-purple-300 rounded px-1.5 py-0.5"
              />
              <span className="text-[10px] text-purple-600 font-semibold">{pctReprocess}%</span>
            </div>

            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl space-y-0.5">
              <div className="flex items-center space-x-1 text-red-700 font-bold text-xs">
                <XCircle className="w-3.5 h-3.5" />
                <span>Rejected Qty</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={rejectedQty}
                onChange={(e) => setRejectedQty(e.target.value)}
                className="w-full text-sm font-bold text-red-800 bg-white border border-red-300 rounded px-1.5 py-0.5"
              />
              <span className="text-[10px] text-red-600 font-semibold">{pctRejected}%</span>
            </div>
          </div>

          {/* Total Reconciliation Bar */}
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition ${
              isReconciled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <div>
              <span className="font-bold">Total Inspected Qty: </span>
              <span className="font-mono font-bold">{totalTargetQty} m</span>
            </div>
            {isReconciled ? (
              <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] flex items-center space-x-1 shadow-2xs">
                <Check className="w-3 h-3" />
                <span>Quantity Reconciled</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10px] flex items-center space-x-1 shadow-2xs">
                <AlertTriangle className="w-3 h-3" />
                <span>Diff: {(totalTargetQty - sumDisposition).toFixed(2)} m</span>
              </span>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-slate-700 font-semibold text-xs mb-1">Remarks</label>
            <textarea
              rows="2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Fabric quality improved after reprocess..."
              className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              disabled={savingDraft || approving}
              onClick={handleSaveDraft}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-2xs"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>{savingDraft ? 'Saving Draft...' : 'Save as Draft'}</span>
            </button>

            <button
              disabled={approving || savingDraft || !isReconciled}
              onClick={handleApproveAndUpdateStock}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{approving ? 'Posting Stock Updates...' : 'Approve & Update Stock'}</span>
            </button>
          </div>
        </div>

        {/* Panel 4: Audit Trail & Important Notes — 3 cols */}
        <div className="lg:col-span-3 space-y-3">
          {/* Audit Trail */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                4
              </span>
              <h4 className="font-bold text-slate-900 text-xs">Audit Trail</h4>
            </div>

            <div className="overflow-x-auto text-[11px]">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="py-1 px-1.5">Date & Time</th>
                    <th className="py-1 px-1.5">Action</th>
                    <th className="py-1 px-1.5">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {(activeItem?.auditTrail || []).length > 0 ? (
                    activeItem.auditTrail.map((a, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-1.5 font-mono text-[10px]">{a.dateTime}</td>
                        <td className="py-1 px-1.5 font-semibold text-blue-700">{a.action}</td>
                        <td className="py-1 px-1.5">{a.user}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-2 text-center text-slate-400">
                        Select a row above to see audit history
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Important Notes */}
          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 text-xs space-y-1.5 text-blue-900">
            <div className="flex items-center space-x-1.5 font-bold text-blue-800">
              <Info className="w-4 h-4 shrink-0" />
              <span>Important Notes</span>
            </div>
            <ul className="text-[11px] text-blue-800/90 space-y-1 list-disc pl-3.5 leading-tight">
              <li>This screen tracks QC reinspection for fabric that was sent for reprocess.</li>
              <li>Linked with existing modules: Job Work / Processing &gt; Reprocess, Job Work Outward and Job Work Inward.</li>
              <li>Sent Qty = Received Qty + Pending Qty.</li>
              <li>Reinspection disposition (Good + Hold + Reprocess + Rejected) must always equal the inspected quantity.</li>
              <li>After approval, Stock Ledger and Stock Position are updated automatically.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── MODAL: + NEW REINSPECTION ENTRY ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900">Create New Reinspection Entry</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewReinspection} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Source QC No. *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. QC-005"
                    value={newSourceQcNo}
                    onChange={(e) => setNewSourceQcNo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Vendor / Processor *</label>
                  <select
                    required
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.name}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Item Code / Fabric *</label>
                  <select
                    required
                    value={newItemCode}
                    onChange={(e) => {
                      const sel = items.find((it) => it.sku === e.target.value);
                      setNewItemCode(e.target.value);
                      if (sel) setNewFabricItem(sel.name);
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Fabric Item</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.sku}>
                        {it.sku} — {it.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Fabric Description</label>
                  <input
                    type="text"
                    value={newFabricItem}
                    onChange={(e) => setNewFabricItem(e.target.value)}
                    placeholder="Cotton 60s"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Sent Quantity (m) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    placeholder="e.g. 25"
                    value={newSentQty}
                    onChange={(e) => setNewSentQty(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Reprocess Reason</label>
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="e.g. Shade variation reprocessing"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {creating ? 'Saving...' : 'Create Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
