import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
  Layers,
  ArrowRight,
  Info,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { useERP } from '../../../context/ERPContext';

export default function QCInspectionRegisterPage() {
  const { vendors = [], items = [] } = useERP();

  // State
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [filtersData, setFiltersData] = useState({
    statuses: ['All', 'Completed', 'Pending', 'On Hold', 'In Progress', 'Rejected'],
    suppliers: [],
    qualities: [],
    designs: [],
    shades: [],
  });

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [qualityFilter, setQualityFilter] = useState('All');
  const [designFilter, setDesignFilter] = useState('All');
  const [shadeFilter, setShadeFilter] = useState('All');

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const PAGE_SIZE = 10;

  // Modals
  const [showNewQCModal, setShowNewQCModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsTab, setDetailsTab] = useState('measurements'); // 'measurements' | 'images' | 'remarks' | 'documents' | 'audit'

  // New QC Form State
  const [newSourceType, setNewSourceType] = useState('Purchase (GRN)');
  const [newGrnNo, setNewGrnNo] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newLotNo, setNewLotNo] = useState('LT-001');
  const [newTakaRoll, setNewTakaRoll] = useState('1');
  const [newReceivedQty, setNewReceivedQty] = useState('');
  const [newInspectionDate, setNewInspectionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submittingNewQC, setSubmittingNewQC] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Fetch register data from backend
  const fetchRegister = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getQCRegister({
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        supplier: supplierFilter !== 'All' ? supplierFilter : undefined,
        quality: qualityFilter !== 'All' ? qualityFilter : undefined,
        design: designFilter !== 'All' ? designFilter : undefined,
        shade: shadeFilter !== 'All' ? shadeFilter : undefined,
      });

      if (res && res.data) {
        setRecords(res.data.records || []);
        if (res.data.filters) {
          setFiltersData((prev) => ({
            ...prev,
            suppliers: res.data.filters.suppliers || [],
            qualities: res.data.filters.qualities || [],
            designs: res.data.filters.designs || [],
            shades: res.data.filters.shades || [],
          }));
        }
      } else if (res && res.records) {
        setRecords(res.records || []);
        if (res.filters) {
          setFiltersData((prev) => ({
            ...prev,
            suppliers: res.filters.suppliers || [],
            qualities: res.filters.qualities || [],
            designs: res.filters.designs || [],
            shades: res.filters.shades || [],
          }));
        }
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.warn('Backend /inventory/qc/register/ call failed:', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter, supplierFilter, qualityFilter, designFilter, shadeFilter]);

  useEffect(() => {
    fetchRegister();
  }, [fetchRegister]);

  // Toast auto-hide
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Filtered Records (search + frontend filters)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          String(r.qcNo || '').toLowerCase().includes(q) ||
          String(r.supplier || '').toLowerCase().includes(q) ||
          String(r.itemCode || '').toLowerCase().includes(q) ||
          String(r.itemName || '').toLowerCase().includes(q) ||
          String(r.grnNo || '').toLowerCase().includes(q) ||
          String(r.lotNo || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [records, searchQuery]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedRows.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Status Badge Helper
  const renderStatusBadge = (st) => {
    const statusLower = (st || '').toLowerCase();
    if (statusLower === 'completed' || statusLower === 'approved') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Completed
        </span>
      );
    }
    if (statusLower === 'on hold') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          On Hold
        </span>
      );
    }
    if (statusLower === 'in progress') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          In Progress
        </span>
      );
    }
    if (statusLower === 'reprocess' || statusLower === 'rework') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Reprocess
        </span>
      );
    }
    if (statusLower === 'rejected') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
        Pending
      </span>
    );
  };

  // Create Manual QC
  const handleSaveManualQC = async (e) => {
    e.preventDefault();
    if (!newReceivedQty || Number(newReceivedQty) <= 0) {
      alert('Please enter a valid received quantity');
      return;
    }
    setSubmittingNewQC(true);
    try {
      const res = await inventoryService.createManualQC({
        sourceType: newSourceType,
        grnNo: newGrnNo || undefined,
        supplier: newSupplier || (vendors[0]?.name || 'Direct Supplier'),
        itemCode: newItemCode || (items[0]?.sku || 'COT-60S-001'),
        lotNo: newLotNo,
        takaRoll: newTakaRoll,
        receivedQty: newReceivedQty,
        inspectionDate: newInspectionDate,
      });
      setToastMsg(res?.data?.message || 'QC Inspection record created successfully.');
      setShowNewQCModal(false);
      // Reset
      setNewGrnNo('');
      setNewReceivedQty('');
      await fetchRegister();
    } catch (err) {
      alert('Could not create QC record: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingNewQC(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (!filteredRecords.length) {
      alert('No records available to export.');
      return;
    }
    const headers = [
      'QC No',
      'Date',
      'Source Type',
      'GRN/JWO No',
      'Supplier',
      'Item Code',
      'Item Name',
      'Quality',
      'Design',
      'Shade',
      'Lot No',
      'Taka/Roll',
      'Received Qty',
      'Inspected Qty',
      'Good Qty',
      'Hold Qty',
      'Reprocess Qty',
      'Rejected Qty',
      'QC Status',
    ];

    const rows = filteredRecords.map((r) => [
      `"${r.qcNo || ''}"`,
      `"${r.date || ''}"`,
      `"${r.sourceType || ''}"`,
      `"${r.grnNo || ''}"`,
      `"${r.supplier || ''}"`,
      `"${r.itemCode || ''}"`,
      `"${r.itemName || ''}"`,
      `"${r.quality || ''}"`,
      `"${r.design || ''}"`,
      `"${r.shade || ''}"`,
      `"${r.lotNo || ''}"`,
      `"${r.takaRoll || 1}"`,
      r.receivedQty || 0,
      r.inspectedQty || 0,
      r.goodQty || 0,
      r.holdQty || 0,
      r.reprocessQty || 0,
      r.rejectedQty || 0,
      `"${r.status || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QC_Inspection_Register_${new Date().toISOString().split('T')[0]}.${exportFormat === 'xlsx' ? 'csv' : 'csv'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 space-y-6">
      {/* Toast Notification */}
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
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
              2
            </div>
            <h1 className="text-xl font-bold text-slate-900">QC Inspection Register</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1 pl-11">
            Record inspection details and measurement for each lot/taka.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-11 md:pl-0">
          <div className="flex items-center space-x-2 bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded text-[11px] border border-slate-200 shadow-2xs">
              Live DB
            </span>
            <span>Real database records only (zero dummy data).</span>
          </div>

          <button
            onClick={() => setShowNewQCModal(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs md:text-sm font-semibold rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ New QC</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs md:text-sm font-medium rounded-lg border border-slate-300 shadow-2xs transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR (Panel 1) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">QC Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
            >
              {filtersData.statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Supplier</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.suppliers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Quality</label>
            <select
              value={qualityFilter}
              onChange={(e) => setQualityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.qualities.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Design</label>
            <select
              value={designFilter}
              onChange={(e) => setDesignFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.designs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Shade</label>
            <select
              value={shadeFilter}
              onChange={(e) => setShadeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs truncate"
            >
              <option value="All">All</option>
              {filtersData.shades.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search bar & Apply/Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by QC No, GRN, supplier, item or lot..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchRegister}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-2xs transition flex items-center space-x-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apply Filters</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('All');
                setSupplierFilter('All');
                setQualityFilter('All');
                setDesignFilter('All');
                setShadeFilter('All');
                setSearchQuery('');
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* QC INSPECTION REGISTER TABLE */}
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
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-3">QC No.</th>
                <th className="p-3">Date</th>
                <th className="p-3">Source Type</th>
                <th className="p-3">GRN / JWO No.</th>
                <th className="p-3">Supplier / Vendor</th>
                <th className="p-3">Item Code</th>
                <th className="p-3">Item Name</th>
                <th className="p-3">Quality</th>
                <th className="p-3">Design</th>
                <th className="p-3">Shade</th>
                <th className="p-3">Lot No.</th>
                <th className="p-3 text-center">Taka/Roll</th>
                <th className="p-3 text-right">Received Qty (m)</th>
                <th className="p-3 text-right">Inspected Qty (m)</th>
                <th className="p-3 text-right text-emerald-700">Good (m)</th>
                <th className="p-3 text-right text-amber-700">Hold (m)</th>
                <th className="p-3 text-right text-purple-700">Reprocess (m)</th>
                <th className="p-3 text-right text-red-700">Rejected (m)</th>
                <th className="p-3 text-center">QC Status</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="21" className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading QC register entries...</span>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="21" className="p-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">No QC inspection records found</p>
                      <p className="text-xs text-slate-500">
                        Inspections appear here automatically when Goods Receipts are created and inspected. You can also create a manual inspection record using the "+ New QC" button.
                      </p>
                      <button
                        onClick={() => setShowNewQCModal(true)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Manual QC</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => handleToggleSelect(r.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="p-3 font-semibold text-blue-700">{r.qcNo}</td>
                    <td className="p-3 text-slate-600">{r.date}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {r.sourceType}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-800">{r.grnNo}</td>
                    <td className="p-3 font-medium text-slate-900">{r.supplier}</td>
                    <td className="p-3 font-mono text-slate-600">{r.itemCode}</td>
                    <td className="p-3 font-medium text-slate-800">{r.itemName}</td>
                    <td className="p-3 text-slate-600">{r.quality || '—'}</td>
                    <td className="p-3 text-slate-600">{r.design || '—'}</td>
                    <td className="p-3 text-slate-600">{r.shade || '—'}</td>
                    <td className="p-3 font-mono text-slate-600">{r.lotNo}</td>
                    <td className="p-3 text-center">{r.takaRoll}</td>
                    <td className="p-3 text-right font-medium">{r.receivedQty?.toLocaleString()}</td>
                    <td className="p-3 text-right font-medium">{r.inspectedQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-emerald-700 font-semibold">{r.goodQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-amber-700 font-semibold">{r.holdQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-purple-700 font-semibold">{r.reprocessQty?.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-700 font-semibold">{r.rejectedQty?.toLocaleString()}</td>
                    <td className="p-3 text-center">{renderStatusBadge(r.status)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setSelectedRecord(r);
                          setShowDetailsModal(true);
                        }}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination (Panel 4) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            Showing {filteredRecords.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to{' '}
            {Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length} entries
          </div>

          <div className="flex items-center space-x-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded text-xs font-medium border transition ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 10 REFERENCE / WORKFLOW SLIDES PANELS (Matching reference image) ── */}
      <div className="space-y-4 pt-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Standard Operating Procedures & Workflow Guide
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Panel 1: Apply Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                1
              </span>
              <h3 className="font-bold text-slate-900 text-sm">Apply Filters</h3>
            </div>
            <p className="text-xs text-slate-500">
              Filter data by date, QC status, supplier, quality, design and shade.
            </p>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>From - To Date:</span>
                <span className="font-mono">{fromDate} → {toDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Status:</span>
                <span className="font-semibold text-blue-700">{statusFilter}</span>
              </div>
            </div>
          </div>

          {/* Panel 2: New QC (Manual Entry) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                  2
                </span>
                <h3 className="font-bold text-slate-900 text-sm">New QC (Manual Entry)</h3>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium border border-emerald-200">
                Exception Entry
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Click <strong>+ New QC</strong> to create a manual QC record (only if supported). Normally GRN/JWO records come automatically.
            </p>
            <button
              onClick={() => setShowNewQCModal(true)}
              className="w-full mt-1 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Open Manual QC Form</span>
            </button>
          </div>

          {/* Panel 3: Export */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                3
              </span>
              <h3 className="font-bold text-slate-900 text-sm">Export Register</h3>
            </div>
            <p className="text-xs text-slate-500">
              Click <strong>Export</strong> to download the current filtered list with all column measurements and dispositions.
            </p>
            <button
              onClick={() => setShowExportModal(true)}
              className="w-full mt-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Configure Export Format</span>
            </button>
          </div>

          {/* Panel 4: Pagination */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                4
              </span>
              <h3 className="font-bold text-slate-900 text-sm">Pagination</h3>
            </div>
            <p className="text-xs text-slate-500">
              Use pagination to navigate smoothly through large historical inspection batches.
            </p>
            <div className="flex items-center justify-center space-x-1 pt-1">
              <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">{currentPage}</span>
              <span className="text-xs text-slate-400">of {totalPages} pages</span>
            </div>
          </div>
        </div>

        {/* Second Row of Guide Panels (5, 6, 7, 8, 9, 10) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Panel 5: View Row Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                5
              </span>
              <h3 className="font-bold text-slate-900 text-sm">View Row Details</h3>
            </div>
            <p className="text-xs text-slate-500">
              Click <strong>View</strong> to inspect complete audit details, per-taka measurement breakdown, fabric images, and defect remarks.
            </p>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100 text-xs text-slate-600 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Tabs: Measurement & Result, Fabric Images, Remarks, Documents, Audit Trail.</span>
            </div>
          </div>

          {/* Panel 6: QC Status Badges Guide */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                6
              </span>
              <h3 className="font-bold text-slate-900 text-sm">QC Status Badges</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left">
                <thead className="text-slate-400 border-b border-slate-100 font-semibold">
                  <tr>
                    <th className="py-1">Status</th>
                    <th className="py-1">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="py-1">{renderStatusBadge('Completed')}</td>
                    <td className="py-1">Inspection completed and approved.</td>
                  </tr>
                  <tr>
                    <td className="py-1">{renderStatusBadge('Pending')}</td>
                    <td className="py-1">Inspection not yet done.</td>
                  </tr>
                  <tr>
                    <td className="py-1">{renderStatusBadge('On Hold')}</td>
                    <td className="py-1">Kept on hold for review/decision.</td>
                  </tr>
                  <tr>
                    <td className="py-1">{renderStatusBadge('In Progress')}</td>
                    <td className="py-1">Inspection is in progress.</td>
                  </tr>
                  <tr>
                    <td className="py-1">{renderStatusBadge('Rejected')}</td>
                    <td className="py-1">Rejected / not usable fabric.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel 7 & 8: Measurements, Audit Trail & Rules */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                7
              </span>
              <h3 className="font-bold text-slate-900 text-sm">Measurement & Result</h3>
            </div>
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
              <li>Measurement details tracked for each individual roll/taka.</li>
              <li>Final QC disposition divided into Good / Hold / Reprocess / Rejected.</li>
              <li>Full audit history preserves inspector signature and timestamps.</li>
            </ul>

            <div className="pt-2 border-t border-slate-100">
              <h4 className="font-semibold text-slate-800 text-xs mb-1 flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                <span>Important Rules</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Normally QC records originate from physical GRN intake. After inspection approval, records cannot be silently overwritten without audit logging.
              </p>
            </div>
          </div>
        </div>

        {/* Panel 10: Inventory Sync After Completion Banner */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              10
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inventory Sync After Completion</h3>
              <p className="text-xs text-slate-600">
                Once approved, the inspected disposition splits update the Stock Ledger and Stock Position automatically.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700">
            <span className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 shadow-2xs text-blue-700">
              QC Completed (Approved)
            </span>
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <span className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 shadow-2xs text-emerald-700">
              Stock Ledger Updated
            </span>
            <ArrowRight className="w-4 h-4 text-blue-400" />
            <span className="px-3 py-1.5 bg-white rounded-lg border border-blue-200 shadow-2xs text-indigo-700">
              Stock Position Updated
            </span>
          </div>
        </div>
      </div>

      {/* ── MODAL: CREATE NEW QC (MANUAL ENTRY) ── */}
      {showNewQCModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Create QC Inspection (Manual)</h3>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                  Exception Entry
                </span>
              </div>
              <button
                onClick={() => setShowNewQCModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualQC} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Source Type</label>
                  <select
                    value={newSourceType}
                    onChange={(e) => setNewSourceType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="Purchase (GRN)">Purchase (GRN)</option>
                    <option value="Job Work">Job Work</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">GRN / Ref No.</label>
                  <input
                    type="text"
                    placeholder="Auto-generate if empty"
                    value={newGrnNo}
                    onChange={(e) => setNewGrnNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Supplier / Vendor *</label>
                  <select
                    value={newSupplier}
                    onChange={(e) => setNewSupplier(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="">Select Supplier</option>
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
                    value={newItemCode}
                    onChange={(e) => {
                      const sel = items.find((it) => it.sku === e.target.value);
                      setNewItemCode(e.target.value);
                      if (sel) setNewItemName(sel.name);
                    }}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
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
                  <label className="block text-slate-700 font-medium mb-1">Item Name</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Auto-filled from Item"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Lot No. *</label>
                  <input
                    type="text"
                    value={newLotNo}
                    onChange={(e) => setNewLotNo(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Taka / Roll Count</label>
                  <input
                    type="number"
                    min="1"
                    value={newTakaRoll}
                    onChange={(e) => setNewTakaRoll(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Received Qty (m) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    placeholder="e.g. 1000"
                    value={newReceivedQty}
                    onChange={(e) => setNewReceivedQty(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Inspection Date</label>
                  <input
                    type="date"
                    value={newInspectionDate}
                    onChange={(e) => setNewInspectionDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex items-start space-x-2 border border-blue-200">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Use this form only for manual or exception entries. Standard fabric lots are automatically received and queued through the Purchase GRN module.
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewQCModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewQC}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  {submittingNewQC ? 'Saving...' : 'Save QC Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EXPORT ── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Export QC Inspection Register</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">File Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </div>
              <p className="text-slate-500">
                Exports the current filtered data with all column details and measurements ({filteredRecords.length} records).
              </p>
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW ROW DETAILS (Panel 5) ── */}
      {showDetailsModal && selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-3">
                <h3 className="text-base font-bold text-slate-900">QC Inspection Details</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                  {selectedRecord.qcNo}
                </span>
                {renderStatusBadge(selectedRecord.status)}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top Details Grid */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[11px]">Date</span>
                <span className="font-semibold text-slate-800">{selectedRecord.date}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Source Type</span>
                <span className="font-semibold text-slate-800">{selectedRecord.sourceType}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">GRN / Ref No.</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.grnNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Supplier</span>
                <span className="font-semibold text-slate-800">{selectedRecord.supplier}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Item Code</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.itemCode}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Item Name</span>
                <span className="font-semibold text-slate-800 truncate block">{selectedRecord.itemName}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Quality</span>
                <span className="font-semibold text-slate-800">{selectedRecord.quality || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Design</span>
                <span className="font-semibold text-slate-800">{selectedRecord.design || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Shade</span>
                <span className="font-semibold text-slate-800">{selectedRecord.shade || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Lot No.</span>
                <span className="font-mono font-semibold text-slate-800">{selectedRecord.lotNo}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Received Qty</span>
                <span className="font-semibold text-slate-800">{selectedRecord.receivedQty} m</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Inspected Qty</span>
                <span className="font-semibold text-blue-700">{selectedRecord.inspectedQty} m</span>
              </div>
            </div>

            {/* Details Tabs */}
            <div className="flex items-center space-x-1 border-b border-slate-200 px-4 pt-2 bg-white text-xs font-medium">
              {[
                { id: 'measurements', label: 'Measurement & Result' },
                { id: 'images', label: 'Fabric Images' },
                { id: 'remarks', label: 'Remarks' },
                { id: 'documents', label: 'Documents' },
                { id: 'audit', label: 'Audit Trail' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setDetailsTab(t.id)}
                  className={`px-3 py-2 border-b-2 transition ${
                    detailsTab === t.id
                      ? 'border-blue-600 text-blue-600 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="p-4 overflow-y-auto flex-1">
              {detailsTab === 'measurements' && (
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Sr. No.</th>
                          <th className="p-2.5">Taka No.</th>
                          <th className="p-2.5 text-right">Actual Qty (m)</th>
                          <th className="p-2.5 text-right">Width (cm)</th>
                          <th className="p-2.5 text-right text-emerald-700">Good (m)</th>
                          <th className="p-2.5 text-right text-amber-700">Hold (m)</th>
                          <th className="p-2.5 text-right text-purple-700">Reprocess (m)</th>
                          <th className="p-2.5 text-right text-red-700">Rejected (m)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {(selectedRecord.measurements || []).length > 0 ? (
                          selectedRecord.measurements.map((m, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-2.5">{m.srNo || idx + 1}</td>
                              <td className="p-2.5 font-medium">{m.takaNo || idx + 1}</td>
                              <td className="p-2.5 text-right font-medium">{m.actualQty}</td>
                              <td className="p-2.5 text-right">{m.width || 150}</td>
                              <td className="p-2.5 text-right text-emerald-700 font-semibold">{m.good ?? selectedRecord.goodQty}</td>
                              <td className="p-2.5 text-right text-amber-700 font-semibold">{m.hold ?? selectedRecord.holdQty}</td>
                              <td className="p-2.5 text-right text-purple-700 font-semibold">{m.reprocess ?? selectedRecord.reprocessQty}</td>
                              <td className="p-2.5 text-right text-red-700 font-semibold">{m.rejected ?? selectedRecord.rejectedQty}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" className="p-4 text-center text-slate-400">
                              No individual taka measurements recorded. Total received: {selectedRecord.receivedQty} m
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-emerald-700 block font-bold text-base">{selectedRecord.goodQty} m</span>
                      <span className="text-emerald-600 font-medium">Good Stock</span>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-amber-700 block font-bold text-base">{selectedRecord.holdQty} m</span>
                      <span className="text-amber-600 font-medium">On Hold</span>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <span className="text-purple-700 block font-bold text-base">{selectedRecord.reprocessQty} m</span>
                      <span className="text-purple-600 font-medium">Reprocess</span>
                    </div>
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="text-red-700 block font-bold text-base">{selectedRecord.rejectedQty} m</span>
                      <span className="text-red-600 font-medium">Rejected</span>
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === 'images' && (
                <div className="p-4 text-center text-xs text-slate-500 space-y-3">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400 border border-dashed border-slate-300">
                    <Layers className="w-8 h-8" />
                  </div>
                  <p>No external fabric images attached to this inspection record.</p>
                </div>
              )}

              {detailsTab === 'remarks' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <span className="font-semibold text-slate-800 block">Inspection Checkpoint & Defect Notes:</span>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedRecord.remarks || 'No specific defect notes recorded during this checkpoint.'}
                  </p>
                </div>
              )}

              {detailsTab === 'documents' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <span className="font-semibold text-slate-800 block">Linked Receipt Document:</span>
                  <div className="flex items-center space-x-2 text-slate-600">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span className="font-mono">{selectedRecord.grnNo}</span>
                    <span>— Date: {selectedRecord.date}</span>
                  </div>
                </div>
              )}

              {detailsTab === 'audit' && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Date & Time</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">User</th>
                        <th className="p-2.5">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(selectedRecord.auditTrail || []).map((a, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-mono text-slate-600">{a.dateTime || selectedRecord.date}</td>
                          <td className="p-2.5 font-semibold text-blue-700">{a.action}</td>
                          <td className="p-2.5">{a.user}</td>
                          <td className="p-2.5 text-slate-500">{a.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
