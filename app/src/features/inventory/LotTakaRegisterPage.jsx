import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Layers,
  Box,
  Package,
  Wallet,
  Clock,
  AlertTriangle,
  Search,
  RotateCcw,
  Download,
  Plus,
  Eye,
  Edit2,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  Building,
  Warehouse,
  Tag,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Barcode,
  Image as ImageIcon,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { inventoryService, partiesService } from '../../services/domainServices';
import { useERP } from '../../context/ERPContext';

// Helper for Indian Currency formatting
function formatINR(val) {
  if (val === null || val === undefined || isNaN(val)) return '₹ 0';
  const num = Math.round(Number(val));
  return '₹ ' + num.toLocaleString('en-IN');
}

// Helper for Quantity formatting
function formatQty(val, uom = 'm') {
  if (val === null || val === undefined || isNaN(val)) return '0' + (uom ? ` ${uom}` : '');
  const num = Number(val);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return uom ? `${formatted} ${uom}` : formatted;
}

// CSV Export Helper
function exportToCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row) =>
        keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString() : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`;
            return cell;
          })
          .join(separator)
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function LotTakaRegisterPage() {
  const { items = [], locations = [], vendors = [], user: currentUser = { name: 'Admin' } } = useERP();

  // Fallback direct-fetched master data if context has not loaded
  const [masterItems, setMasterItems] = useState([]);
  const [masterVendors, setMasterVendors] = useState([]);
  const [masterLocations, setMasterLocations] = useState([]);

  useEffect(() => {
    if (!items || items.length === 0) {
      inventoryService.getItems().then((res) => {
        const arr = Array.isArray(res) ? res : res?.results || [];
        setMasterItems(arr);
      }).catch(() => {});
    }
  }, [items]);

  useEffect(() => {
    if (!vendors || vendors.length === 0) {
      partiesService.getVendors().then((res) => {
        const arr = Array.isArray(res) ? res : res?.results || [];
        setMasterVendors(arr);
      }).catch(() => {});
    }
  }, [vendors]);

  useEffect(() => {
    if (!locations || locations.length === 0) {
      inventoryService.getLocations().then((res) => {
        const arr = Array.isArray(res) ? res : res?.results || [];
        setMasterLocations(arr);
      }).catch(() => {});
    }
  }, [locations]);

  const availableItems = items && items.length > 0 ? items : masterItems;
  const availableVendors = vendors && vendors.length > 0 ? vendors : masterVendors;
  const availableLocations = locations && locations.length > 0 ? locations : masterLocations;

  // Data State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters State
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [selectedQuality, setSelectedQuality] = useState('All');
  const [selectedDesign, setSelectedDesign] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedQCStatus, setSelectedQCStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Selection
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());

  // Side Panel / Drawer State ("Lot / Taka Details")
  const [activeLotRecord, setActiveLotRecord] = useState(null);
  const [detailsTab, setDetailsTab] = useState('movements'); // 'movements' | 'measurements' | 'qc'

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Image 2 Modal Popup
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [isPrintTagModalOpen, setIsPrintTagModalOpen] = useState(false);
  const [tagModalRecord, setTagModalRecord] = useState(null);

  // Add Lot Modal Form State
  const [addForm, setAddForm] = useState({
    itemId: '',
    supplierId: '',
    sourceDoc: 'GRN',
    grnNo: '',
    receivedDate: new Date().toISOString().split('T')[0],
    lotNo: '',
    takaRoll: '1',
    barcode: '',
    receivedQty: '',
    rollWeight: '',
    width: '',
    pieces: '1',
    gsm: '',
    rate: '',
    locationId: '',
    remarks: '',
    tags: ['New Lot'],
    tagInput: '',
    imageUrl: '',
  });
  const [itemPreview, setItemPreview] = useState(null);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState(null);

  // Edit Modal Form State
  const [editForm, setEditForm] = useState({
    locationId: '',
    remarks: '',
    tags: [],
    rollWeight: '',
    width: '',
    gsm: '',
    rate: '',
    qcStatus: 'Passed',
    status: 'Active',
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState(null);

  // Fetch Register Data from Backend
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const query = {};
      if (fromDate) query.from_date = fromDate;
      if (toDate) query.to_date = toDate;
      if (selectedSupplier !== 'All') query.supplier = selectedSupplier;
      if (selectedQuality !== 'All') query.quality = selectedQuality;
      if (selectedDesign !== 'All') query.design = selectedDesign;
      if (selectedStatus !== 'All') query.status = selectedStatus;
      if (selectedQCStatus !== 'All') query.qc_status = selectedQCStatus;
      if (selectedLocation !== 'All') query.location = selectedLocation;
      if (searchQuery) query.search = searchQuery;

      const res = await inventoryService.getLotRegister(query);
      setData(res);

      // Auto-select first record for side panel if none selected
      if (!activeLotRecord && res?.records && res.records.length > 0) {
        setActiveLotRecord(res.records[0]);
      } else if (activeLotRecord && res?.records) {
        const found = res.records.find((r) => r.id === activeLotRecord.id);
        if (found) setActiveLotRecord(found);
      }
    } catch (err) {
      console.error('Failed to fetch lot register:', err);
      setError(err?.message || 'Failed to retrieve lot/taka records from the database.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    fromDate,
    toDate,
    selectedSupplier,
    selectedQuality,
    selectedDesign,
    selectedStatus,
    selectedQCStatus,
    selectedLocation,
    searchQuery,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Search & Filter Reset
  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedSupplier('All');
    setSelectedQuality('All');
    setSelectedDesign('All');
    setSelectedStatus('All');
    setSelectedLocation('All');
    setSelectedQCStatus('All');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Row selection handlers
  const toggleSelectRow = (id) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const paginatedRecords = useMemo(() => {
    const all = data?.records || [];
    const start = (currentPage - 1) * pageSize;
    return all.slice(start, start + pageSize);
  }, [data, currentPage, pageSize]);

  const totalPages = Math.ceil((data?.records?.length || 0) / pageSize) || 1;

  const isAllPageSelected =
    paginatedRecords.length > 0 && paginatedRecords.every((r) => selectedRowIds.has(r.id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const next = new Set(selectedRowIds);
      paginatedRecords.forEach((r) => next.delete(r.id));
      setSelectedRowIds(next);
    } else {
      const next = new Set(selectedRowIds);
      paginatedRecords.forEach((r) => next.add(r.id));
      setSelectedRowIds(next);
    }
  };

  // When selecting an item in Add Lot Modal
  const handleItemSelectInAddModal = async (itemId) => {
    const chosen = availableItems.find((i) => String(i.id) === String(itemId));
    setAddForm((prev) => ({
      ...prev,
      itemId,
      uom: chosen?.uom || 'm',
      rate: chosen?.standard_cost || prev.rate || '',
    }));

    if (itemId) {
      try {
        const res = await inventoryService.getLotRegister({ item_id: itemId });
        if (res?.itemPreview) {
          setItemPreview(res.itemPreview);
        } else if (chosen) {
          setItemPreview({
            itemCode: chosen.sku,
            itemName: chosen.name,
            quality: chosen.fabric_quality || chosen.name,
            design: chosen.fabric_design || 'Plain',
            shade: chosen.fabric_color || 'Default',
            uom: chosen.uom || 'm',
            currentStock: 0,
            recentLots: [],
          });
        }
      } catch (err) {
        console.warn('Failed to load item preview:', err);
      }
    } else {
      setItemPreview(null);
    }
  };

  // Generate Auto Barcode
  const handleGenerateBarcode = () => {
    const lot = addForm.lotNo || 'LT-001';
    const taka = addForm.takaRoll || '1';
    setAddForm((prev) => ({ ...prev, barcode: `${lot}-${taka}` }));
  };

  // Add tag pill in Add Modal
  const handleAddTag = (e) => {
    if (e.key === 'Enter' && addForm.tagInput.trim()) {
      e.preventDefault();
      const val = addForm.tagInput.trim();
      if (!addForm.tags.includes(val)) {
        setAddForm((prev) => ({
          ...prev,
          tags: [...prev.tags, val],
          tagInput: '',
        }));
      }
    }
  };

  const handleRemoveTag = (tToRemove) => {
    setAddForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tToRemove),
    }));
  };

  // Submit Add Lot Form (Image 2)
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.itemId) {
      alert('Please select a fabric item.');
      return;
    }
    if (!addForm.lotNo.trim()) {
      alert('Please enter Lot Number.');
      return;
    }
    if (!addForm.receivedQty || Number(addForm.receivedQty) <= 0) {
      alert('Please enter a valid received quantity greater than 0.');
      return;
    }

    setSubmittingAdd(true);
    setAddSuccessMsg(null);
    try {
      const payload = {
        itemId: addForm.itemId,
        supplierId: addForm.supplierId || undefined,
        supplier: availableVendors.find((v) => String(v.id) === String(addForm.supplierId))?.name || '',
        sourceDoc: addForm.sourceDoc,
        grnNo: addForm.grnNo || `GRN-${new Date().toISOString().split('T')[0]}`,
        receivedDate: addForm.receivedDate,
        lotNo: addForm.lotNo.trim(),
        takaRoll: addForm.takaRoll.trim(),
        barcode: addForm.barcode.trim(),
        receivedQty: Number(addForm.receivedQty),
        rollWeight: addForm.rollWeight ? Number(addForm.rollWeight) : undefined,
        width: addForm.width ? Number(addForm.width) : undefined,
        pieces: Number(addForm.pieces || 1),
        gsm: addForm.gsm ? Number(addForm.gsm) : undefined,
        rate: addForm.rate ? Number(addForm.rate) : 0,
        locationId: addForm.locationId || availableLocations[0]?.id || '',
        remarks: addForm.remarks,
        tags: addForm.tags,
        imageUrl: addForm.imageUrl,
      };

      const res = await inventoryService.createLotTaka(payload);
      setAddSuccessMsg(res?.message || 'Lot / Taka registered and posted to stock ledger!');

      setTimeout(() => {
        setIsAddModalOpen(false);
        setAddSuccessMsg(null);
        setAddForm({
          itemId: '',
          supplierId: '',
          sourceDoc: 'GRN',
          grnNo: '',
          receivedDate: new Date().toISOString().split('T')[0],
          lotNo: '',
          takaRoll: '1',
          barcode: '',
          receivedQty: '',
          rollWeight: '',
          width: '',
          pieces: '1',
          gsm: '',
          rate: '',
          locationId: '',
          remarks: '',
          tags: ['New Lot'],
          tagInput: '',
          imageUrl: '',
        });
        setItemPreview(null);
        fetchData(true);
      }, 1000);
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to create Lot/Taka.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Edit Lot Modal Handler
  const openEditModal = (row) => {
    setEditingRecord(row);
    setEditForm({
      locationId: row.locationId || '',
      remarks: row.remarks === '-' ? '' : row.remarks,
      tags: Array.isArray(row.tags) ? [...row.tags] : [],
      rollWeight: row.rollWeight || '',
      width: row.width || '',
      gsm: row.gsm || '',
      rate: row.rate || '',
      qcStatus: row.qcStatus || 'Passed',
      status: row.status || 'Active',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingRecord) return;
    setSubmittingEdit(true);
    setEditSuccessMsg(null);
    try {
      const payload = {
        locationId: editForm.locationId,
        remarks: editForm.remarks,
        tags: editForm.tags,
        rollWeight: editForm.rollWeight ? Number(editForm.rollWeight) : undefined,
        width: editForm.width ? Number(editForm.width) : undefined,
        gsm: editForm.gsm ? Number(editForm.gsm) : undefined,
        rate: editForm.rate ? Number(editForm.rate) : undefined,
        qcStatus: editForm.qcStatus,
        status: editForm.status,
      };

      const res = await inventoryService.updateLotTaka(editingRecord.id, payload);
      setEditSuccessMsg(res?.message || 'Lot details updated successfully.');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccessMsg(null);
        setEditingRecord(null);
        fetchData(true);
      }, 900);
    } catch (err) {
      alert(err?.response?.data?.detail || err?.message || 'Failed to update Lot.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Print Tag Modal Handler
  const openPrintTagModal = (row) => {
    setTagModalRecord(row);
    setIsPrintTagModalOpen(true);
  };

  // CSV Export
  const handleExport = () => {
    const recordsToExport = data?.records || [];
    exportToCsv(`Lot_Taka_Register_${new Date().toISOString().split('T')[0]}.csv`, recordsToExport);
  };

  const summary = data?.summaryCards || {};

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-4 sm:p-6 space-y-4">
      {/* ── TOP HEADER (Image 1) ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 grid place-items-center shrink-0">
            <Package size={20} className="text-teal-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Lot / Taka Register</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-50 text-teal-700 rounded border border-teal-200">
                Live Register
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Track fabric lot/taka wise details, quantities, stock status and complete movement history.
            </p>
          </div>
        </div>

        {/* Action Buttons: [Print] and [+ Add Lot / Taka] */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer size={13} />
            Print
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <Plus size={14} />
            + Add Lot / Taka
          </button>
        </div>
      </div>

      {/* ── 5 TOP SUMMARY CARDS (Image 1) ──────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Total Lots / Taka */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Lots / Taka
            </span>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              {summary.totalLots?.count ? summary.totalLots.count.toLocaleString('en-IN') : '0'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              Active {summary.totalLots?.active || 0} | Closed {summary.totalLots?.closed || 0}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 grid place-items-center shrink-0">
            <Layers size={17} className="text-blue-600" />
          </div>
        </div>

        {/* 2. Total Quantity */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Quantity
            </span>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              {formatQty(summary.totalQuantity?.qty, summary.totalQuantity?.uom || 'm')}
            </div>
            <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">
              In Stock {formatQty(summary.totalQuantity?.inStock, summary.totalQuantity?.uom || 'm')}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 grid place-items-center shrink-0">
            <Package size={17} className="text-emerald-600" />
          </div>
        </div>

        {/* 3. Total Value */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Value
            </span>
            <div className="text-xl font-black text-slate-900 mt-1 font-mono">
              {formatINR(summary.totalValue?.val)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
              Avg. Rate ₹ {summary.totalValue?.avgRate?.toFixed(2) || '0.00'}/m
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 grid place-items-center shrink-0">
            <Wallet size={17} className="text-blue-600" />
          </div>
        </div>

        {/* 4. Pending QC */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Pending QC
            </span>
            <div className="text-xl font-black text-purple-700 mt-1 font-mono">
              {formatQty(summary.pendingQC?.qty, summary.pendingQC?.uom || 'm')}
            </div>
            <span className="text-[10px] text-purple-500 mt-0.5 block font-medium">
              {summary.pendingQC?.lots || 0} Lots
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 grid place-items-center shrink-0">
            <Clock size={17} className="text-purple-600" />
          </div>
        </div>

        {/* 5. On Hold */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              On Hold
            </span>
            <div className="text-xl font-black text-amber-700 mt-1 font-mono">
              {formatQty(summary.onHold?.qty, summary.onHold?.uom || 'm')}
            </div>
            <span className="text-[10px] text-amber-600 mt-0.5 block font-medium">
              {summary.onHold?.lots || 0} Lots
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 grid place-items-center shrink-0">
            <AlertTriangle size={17} className="text-amber-600" />
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR (Image 1) ────────────────────────────────────────── */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
          {/* From Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.suppliers || []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quality */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Quality</label>
            <select
              value={selectedQuality}
              onChange={(e) => setSelectedQuality(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.qualities || []).map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Design */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Design</label>
            <select
              value={selectedDesign}
              onChange={(e) => setSelectedDesign(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.designs || []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Location / Godown */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All</option>
              {(data?.filters?.locations || []).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Lot No, Taka No, Item code, Supplier..."
              className="w-full h-8 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => fetchData()}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Search size={13} />
              Search
            </button>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={handleExport}
              disabled={!data?.records?.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Download size={13} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA (Split Table & Details Drawer) ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left / Center Table Section */}
        <div className={`${activeLotRecord ? 'lg:col-span-8' : 'lg:col-span-12'} bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200`}>
          {loading ? (
            <div className="py-20 text-center">
              <RotateCcw size={24} className="animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading live lot/taka register...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <ShieldAlert size={28} className="text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Failed to load register</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
              <button
                onClick={() => fetchData()}
                className="mt-3 px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={isAllPageSelected}
                          onChange={toggleSelectAllPage}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-2">#</th>
                      <th className="py-3 px-3">Lot No.</th>
                      <th className="py-3 px-2.5">Taka / Roll No.</th>
                      <th className="py-3 px-3">Item Code</th>
                      <th className="py-3 px-3">Fabric Item</th>
                      <th className="py-3 px-2.5">Quality</th>
                      <th className="py-3 px-2.5">Design</th>
                      <th className="py-3 px-2.5">Shade</th>
                      <th className="py-3 px-3 text-right">Received Qty (m)</th>
                      <th className="py-3 px-3 text-center">QC Status</th>
                      <th className="py-3 px-3 text-right">Available Qty (m)</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Received Date</th>
                      <th className="py-3 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {paginatedRecords.map((row, idx) => {
                      const isSelected = selectedRowIds.has(row.id);
                      const isDrawerActive = activeLotRecord?.id === row.id;

                      return (
                        <tr
                          key={row.id || idx}
                          onClick={() => setActiveLotRecord(row)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                            isDrawerActive
                              ? 'bg-blue-50/40 ring-1 ring-blue-500/20'
                              : isSelected
                              ? 'bg-blue-50/20'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectRow(row.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-2 text-slate-400 font-mono text-[10px]">
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">{row.lotNo}</td>
                          <td className="py-2 px-2.5 font-mono font-semibold text-slate-700">{row.takaRoll}</td>
                          <td className="py-2 px-3 font-mono text-slate-900 font-semibold">{row.itemCode}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">{row.itemName}</td>
                          <td className="py-2 px-2.5 text-slate-700">{row.quality}</td>
                          <td className="py-2 px-2.5 text-slate-600">{row.design}</td>
                          <td className="py-2 px-2.5 text-slate-600">{row.shade}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatQty(row.receivedQty, '')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.qcStatus === 'Passed'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : row.qcStatus === 'Pending'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : row.qcStatus === 'On Hold'
                                  ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                  : row.qcStatus === 'Reprocess'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {row.qcStatus}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-teal-700">
                            {formatQty(row.availableQty, '')}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 text-[10.5px]">{row.location}</td>
                          <td className="py-2 px-3 font-medium text-slate-700 truncate max-w-[120px]">{row.supplier}</td>
                          <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">{row.receivedDate}</td>

                          {/* Action Buttons: [Eye] View, [Pencil] Edit, [Printer] Print Tag */}
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setActiveLotRecord(row)}
                                className="w-6 h-6 rounded border border-blue-200 bg-blue-50/60 text-blue-600 hover:bg-blue-100 grid place-items-center transition cursor-pointer"
                                title="View Lot Details"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                onClick={() => openEditModal(row)}
                                className="w-6 h-6 rounded border border-amber-200 bg-amber-50/60 text-amber-600 hover:bg-amber-100 grid place-items-center transition cursor-pointer"
                                title="Edit Lot Information"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => openPrintTagModal(row)}
                                className="w-6 h-6 rounded border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 grid place-items-center transition cursor-pointer"
                                title="Print Taka Tag"
                              >
                                <Printer size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {paginatedRecords.length === 0 && (
                      <tr>
                        <td colSpan={16} className="py-12 text-center text-slate-400 font-sans text-xs">
                          No lot/taka records found matching current filters. Click &quot;+ Add Lot / Taka&quot; to register a new roll.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                <div>
                  Showing{' '}
                  <span className="font-bold text-slate-900">
                    {data?.records?.length ? (currentPage - 1) * pageSize + 1 : 0}
                  </span>{' '}
                  to{' '}
                  <span className="font-bold text-slate-900">
                    {Math.min(currentPage * pageSize, data?.records?.length || 0)}
                  </span>{' '}
                  of <span className="font-bold text-slate-900">{data?.records?.length || 0}</span> entries
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="w-7 h-7 grid place-items-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 text-xs font-bold text-slate-800">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="w-7 h-7 grid place-items-center bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT SIDE DETAILS PANEL ("Lot / Taka Details" - Image 1) ────── */}
        {activeLotRecord && (
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Lot / Taka Details</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {activeLotRecord.status || 'Active'}
                </span>
              </div>
              <button
                onClick={() => setActiveLotRecord(null)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4 text-xs">
              {/* Fabric Swatch / Image Box */}
              <div className="relative rounded-xl overflow-hidden border border-slate-200 h-36 bg-gradient-to-tr from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center group">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                <div className="text-center z-10 px-3">
                  <span className="font-mono text-xs font-bold text-white tracking-widest uppercase block">
                    {activeLotRecord.lotNo} • TAKA {activeLotRecord.takaRoll}
                  </span>
                  <span className="text-[11px] text-blue-200 block mt-0.5 font-medium">
                    {activeLotRecord.itemName} ({activeLotRecord.shade})
                  </span>
                </div>
                <button
                  onClick={() => openEditModal(activeLotRecord)}
                  className="absolute bottom-2 left-2 px-2.5 py-1 bg-white/90 hover:bg-white text-slate-800 rounded-md text-[10.5px] font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <ImageIcon size={11} />
                  Change Image
                </button>
              </div>

              {/* Key-Value Details List (Image 1) */}
              <div className="space-y-2 text-[11.5px] border-b border-slate-100 pb-3">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Lot No.</span>
                  <span className="font-mono font-bold text-blue-600">{activeLotRecord.lotNo}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Taka / Roll No.</span>
                  <span className="font-mono font-semibold text-slate-800">{activeLotRecord.takaRoll}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Item Code</span>
                  <span className="font-mono font-bold text-slate-900">{activeLotRecord.itemCode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Fabric Item</span>
                  <span className="font-semibold text-slate-800">{activeLotRecord.itemName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Quality</span>
                  <span className="text-slate-700 font-medium">{activeLotRecord.quality}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Design</span>
                  <span className="text-slate-700">{activeLotRecord.design}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Shade</span>
                  <span className="text-slate-700">{activeLotRecord.shade}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">UOM</span>
                  <span className="text-slate-700 uppercase font-semibold">{activeLotRecord.uom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Received Qty</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatQty(activeLotRecord.receivedQty, activeLotRecord.uom)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">QC Status</span>
                  <span className="font-bold text-emerald-700">{activeLotRecord.qcStatus}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Available Qty</span>
                  <span className="font-mono font-extrabold text-teal-700">
                    {formatQty(activeLotRecord.availableQty, activeLotRecord.uom)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Location</span>
                  <span className="font-mono text-slate-700">{activeLotRecord.location}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Supplier</span>
                  <span className="font-medium text-slate-800">{activeLotRecord.supplier}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Received Date</span>
                  <span className="font-mono text-slate-600">{activeLotRecord.receivedDate}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400 font-medium">Remarks</span>
                  <span className="text-slate-600 italic">{activeLotRecord.remarks || '-'}</span>
                </div>
              </div>

              {/* Sub-Tabs: [Stock Movement] [Measurements] [QC Details] */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 border-b border-slate-200 pb-1 text-xs">
                  <button
                    onClick={() => setDetailsTab('movements')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'movements'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Stock Movement
                  </button>
                  <button
                    onClick={() => setDetailsTab('measurements')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'measurements'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Measurements
                  </button>
                  <button
                    onClick={() => setDetailsTab('qc')}
                    className={`px-2.5 py-1 font-bold text-[11px] rounded-lg transition cursor-pointer ${
                      detailsTab === 'qc'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    QC Details
                  </button>
                </div>

                {/* Tab 1: Stock Movement Table */}
                {detailsTab === 'movements' && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[10.5px]">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="py-2 px-2">Date</th>
                          <th className="py-2 px-2">Type</th>
                          <th className="py-2 px-2 text-right">Qty (m)</th>
                          <th className="py-2 px-2 text-right">Balance</th>
                          <th className="py-2 px-2">Ref. No.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {(activeLotRecord.stockMovements || []).map((m, mIdx) => (
                          <tr key={mIdx} className="hover:bg-slate-50/70">
                            <td className="py-1.5 px-2 text-slate-500">{m.date}</td>
                            <td className="py-1.5 px-2 font-sans font-medium text-slate-800">{m.type}</td>
                            <td
                              className={`py-1.5 px-2 text-right font-bold ${
                                m.qty > 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {m.qty > 0 ? `+${m.qty}` : m.qty}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900">{m.balance}</td>
                            <td className="py-1.5 px-2 text-slate-600">{m.refNo}</td>
                          </tr>
                        ))}
                        {(!activeLotRecord.stockMovements || activeLotRecord.stockMovements.length === 0) && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-400 font-sans italic">
                              No movement transactions logged yet for this lot.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 2: Measurements */}
                {detailsTab === 'measurements' && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Roll Weight</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activeLotRecord.rollWeight ? `${activeLotRecord.rollWeight} kg` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Width</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activeLotRecord.width ? `${activeLotRecord.width} Inch` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg. GSM</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {activeLotRecord.gsm ? `${activeLotRecord.gsm} GSM` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Pieces / Rolls</span>
                      <span className="font-mono font-semibold text-slate-800">{activeLotRecord.pieces || 1}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Cost Rate</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₹ {Number(activeLotRecord.rate || 0).toFixed(2)} / {activeLotRecord.uom}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tab 3: QC Details */}
                {detailsTab === 'qc' && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-bold uppercase text-[10px]">QC Inspection Status:</span>
                      <span className="font-bold text-emerald-700">{activeLotRecord.qcStatus}</span>
                    </div>
                    <div className="text-slate-600">
                      Quality check verified against Textile standard for Lot {activeLotRecord.lotNo}.
                    </div>
                    <button
                      onClick={() => openPrintTagModal(activeLotRecord)}
                      className="mt-2 w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer size={13} />
                      Print Tag Slip
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4 BOTTOM FEATURE GUIDANCE CARDS (Image 1) ───────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        {/* 1. Filters */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs grid place-items-center shrink-0 mt-0.5">
            1
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Filters</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Filter data by date, supplier, quality, design, shade and status. Helps to quickly find specific lot/taka records.
            </p>
          </div>
        </div>

        {/* 2. View Details */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs grid place-items-center shrink-0 mt-0.5">
            2
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">View Details</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Click on eye icon to view complete lot/taka details, QC status, current stock, movement history and measurements.
            </p>
          </div>
        </div>

        {/* 3. Edit Lot / Taka */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs grid place-items-center shrink-0 mt-0.5">
            3
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Edit Lot / Taka</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Edit basic information (if allowed), update location or add notes. Quantity can only be changed through proper transactions.
            </p>
          </div>
        </div>

        {/* 4. Print Taka Tag */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-xs flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-black text-xs grid place-items-center shrink-0 mt-0.5">
            4
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Print Taka Tag</h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              Click on print icon to generate taka tag with barcode/QR. Used for physical tagging of rolls/taka.
            </p>
          </div>
        </div>
      </div>

      {/* ── IMAGE 2: + ADD LOT / TAKA MODAL POPUP (Directly inside page) ───── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-900 text-white grid place-items-center">
                  <Box size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Lot / Taka</h3>
                  <p className="text-[11px] text-slate-500">
                    Create a new lot/taka record for received fabric. This will be used in stock, QC, sample, sales and other transactions.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              {addSuccessMsg && (
                <div className="m-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>{addSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[75vh] overflow-y-auto">
                {/* Left Side: Steps indicator */}
                <div className="lg:col-span-2 bg-slate-50/60 p-4 border-r border-slate-200/80 space-y-4 text-xs hidden lg:block">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Steps</span>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Basic Details</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Select item, supplier and fabric details</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Lot / Taka Information</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Enter lot and taka/roll details</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Quantity & Measurement</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Enter received quantity and dimensions</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        4
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-[11px]">Additional Details</div>
                        <div className="text-[10px] text-slate-500 leading-tight">Location, tags, remarks and documents</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle: 4 Form Sections */}
                <div className="lg:col-span-7 p-5 space-y-5 text-xs">
                  {/* 1. Basic Details */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        1
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Basic Details</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Item Code <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={addForm.itemId}
                          onChange={(e) => handleItemSelectInAddModal(e.target.value)}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        >
                          <option value="">Select Item Code</option>
                          {availableItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.sku} ({it.name})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Fabric Item <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.itemName || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Quality <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.quality || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Design <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.design || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Shade / Colour <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={itemPreview?.shade || ''}
                          placeholder="Auto-populated"
                          className="w-full h-8 px-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-semibold text-[11px]"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          UOM <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={addForm.uom}
                          onChange={(e) => setAddForm({ ...addForm, uom: e.target.value })}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="Meter (m)">Meter (m)</option>
                          <option value="Yard">Yard</option>
                          <option value="Kg">Kg</option>
                        </select>
                      </div>

                      <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                            Supplier <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={addForm.supplierId}
                            onChange={(e) => setAddForm({ ...addForm, supplierId: e.target.value })}
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select Supplier</option>
                            {availableVendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">Source Document</label>
                          <select
                            value={addForm.sourceDoc}
                            onChange={(e) => setAddForm({ ...addForm, sourceDoc: e.target.value })}
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="GRN">GRN</option>
                            <option value="Job Work Inward">Job Work Inward</option>
                            <option value="Opening Stock">Opening Stock</option>
                            <option value="Purchase Order">Purchase Order</option>
                          </select>
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                            GRN No. <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={addForm.grnNo}
                            onChange={(e) => setAddForm({ ...addForm, grnNo: e.target.value })}
                            placeholder="e.g. GRN-001"
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                            Received Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={addForm.receivedDate}
                            onChange={(e) => setAddForm({ ...addForm, receivedDate: e.target.value })}
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Lot / Taka Information */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        2
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Lot / Taka Information</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Lot No. <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={addForm.lotNo}
                          onChange={(e) => setAddForm({ ...addForm, lotNo: e.target.value })}
                          placeholder="e.g. LT-001"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Taka / Roll No. <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={addForm.takaRoll}
                          onChange={(e) => setAddForm({ ...addForm, takaRoll: e.target.value })}
                          placeholder="e.g. 1"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Barcode / QR (Optional)</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={addForm.barcode}
                            onChange={(e) => setAddForm({ ...addForm, barcode: e.target.value })}
                            placeholder="e.g. LT001-1"
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleGenerateBarcode}
                            className="px-2.5 h-8 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-bold hover:bg-blue-100 transition shrink-0 cursor-pointer"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Quantity & Measurement */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        3
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Quantity & Measurement</h4>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Received Quantity (m) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          value={addForm.receivedQty}
                          onChange={(e) => setAddForm({ ...addForm, receivedQty: e.target.value })}
                          placeholder="e.g. 100"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Roll Weight (kg) (Optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={addForm.rollWeight}
                          onChange={(e) => setAddForm({ ...addForm, rollWeight: e.target.value })}
                          placeholder="e.g. 25.50"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Width (Inch) (Optional)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={addForm.width}
                          onChange={(e) => setAddForm({ ...addForm, width: e.target.value })}
                          placeholder="e.g. 58"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">No. of Pieces / Rolls</label>
                        <input
                          type="number"
                          value={addForm.pieces}
                          onChange={(e) => setAddForm({ ...addForm, pieces: e.target.value })}
                          placeholder="e.g. 1"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Avg. GSM (Optional)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={addForm.gsm}
                          onChange={(e) => setAddForm({ ...addForm, gsm: e.target.value })}
                          placeholder="e.g. 120"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Rate (₹/m) (Optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={addForm.rate}
                          onChange={(e) => setAddForm({ ...addForm, rate: e.target.value })}
                          placeholder="e.g. 200.50"
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Additional Details */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold grid place-items-center shrink-0">
                        4
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs">Additional Details</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                          Storage Location <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={addForm.locationId}
                          onChange={(e) => setAddForm({ ...addForm, locationId: e.target.value })}
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select Location / Rack</option>
                          {availableLocations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Tags (Optional)</label>
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={addForm.tagInput}
                            onChange={(e) => setAddForm({ ...addForm, tagInput: e.target.value })}
                            onKeyDown={handleAddTag}
                            placeholder="Type and press Enter (e.g. Premium)"
                            className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                          />
                          <div className="flex flex-wrap gap-1">
                            {addForm.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold"
                              >
                                {t}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTag(t)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-700 mb-1 text-[11px]">Remarks</label>
                        <input
                          type="text"
                          value={addForm.remarks}
                          onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
                          placeholder="e.g. First lot received - good condition."
                          className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column inside Modal: Item Preview & Stock Impact (Image 2) */}
                <div className="lg:col-span-3 bg-slate-50/70 p-4 border-l border-slate-200/80 space-y-4 text-xs">
                  {/* Item Preview */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Item Preview
                    </span>

                    <div className="w-full h-24 rounded-lg bg-gradient-to-tr from-slate-900 to-blue-900 flex items-center justify-center p-2 text-center text-white">
                      <div>
                        <div className="font-mono font-bold text-xs">{itemPreview?.itemCode || 'SELECT ITEM'}</div>
                        <div className="text-[10px] text-blue-200">{itemPreview?.itemName || 'Fabric item preview'}</div>
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px] pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Item Code</span>
                        <span className="font-mono font-bold text-slate-900">{itemPreview?.itemCode || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Quality</span>
                        <span className="font-medium text-slate-800">{itemPreview?.quality || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Design</span>
                        <span className="text-slate-700">{itemPreview?.design || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Shade</span>
                        <span className="text-slate-700">{itemPreview?.shade || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">UOM</span>
                        <span className="text-slate-700 uppercase">{itemPreview?.uom || 'm'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stock & Availability (After Save) */}
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      Stock & Availability (After Save)
                    </span>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between text-slate-600">
                        <span>Current Stock for this Item:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatQty(itemPreview?.currentStock || 0, itemPreview?.uom || 'm')}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>After Adding This Lot:</span>
                        <span className="font-mono font-bold">
                          +{formatQty(Number(addForm.receivedQty || 0), itemPreview?.uom || 'm')}
                        </span>
                      </div>
                      <div className="border-t border-emerald-200/80 pt-1 flex justify-between font-bold text-slate-900">
                        <span>Total Stock (Expected):</span>
                        <span className="font-mono text-emerald-800 text-xs">
                          {formatQty(
                            (Number(itemPreview?.currentStock || 0) + Number(addForm.receivedQty || 0)),
                            itemPreview?.uom || 'm'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Lots for this Item */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Recent Lots for this Item
                      </span>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(itemPreview?.recentLots || []).map((rl, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex items-center justify-between py-1 border-b border-slate-50 text-[10.5px]"
                        >
                          <span className="font-mono font-bold text-blue-600">{rl.lotNo}</span>
                          <span className="text-slate-500 font-mono">Taka {rl.takaRoll}</span>
                          <span className="font-mono font-semibold text-slate-800">{rl.qty} m</span>
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-emerald-50 text-emerald-700 font-bold">
                            {rl.status}
                          </span>
                        </div>
                      ))}
                      {(!itemPreview?.recentLots || itemPreview.recentLots.length === 0) && (
                        <p className="text-[10px] text-slate-400 italic py-2 text-center">
                          No previous lots recorded for this item.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 p-3.5 border-t border-slate-200 bg-slate-50/70">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs disabled:opacity-50 transition cursor-pointer"
                >
                  {submittingAdd ? 'Saving Lot / Taka...' : 'Save Lot / Taka'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT LOT / TAKA MODAL ────────────────────────────────────────── */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Lot: {editingRecord.lotNo} (Taka {editingRecord.takaRoll})
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-3 text-xs">
              {editSuccessMsg && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
                  {editSuccessMsg}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Storage Location</label>
                <select
                  value={editForm.locationId}
                  onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {availableLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">QC Status</label>
                  <select
                    value={editForm.qcStatus}
                    onChange={(e) => setEditForm({ ...editForm, qcStatus: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Passed">Passed</option>
                    <option value="Pending">Pending</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Reprocess">Reprocess</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Record Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.rollWeight}
                    onChange={(e) => setEditForm({ ...editForm, rollWeight: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Width (in)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.width}
                    onChange={(e) => setEditForm({ ...editForm, width: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSM</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.gsm}
                    onChange={(e) => setEditForm({ ...editForm, gsm: e.target.value })}
                    className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Update remarks..."
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PRINT TAKA TAG MODAL (Feature 4) ──────────────────────────────── */}
      {isPrintTagModalOpen && tagModalRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-3.5 border-b border-slate-200 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Printer size={16} className="text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Physical Taka Tag Preview</h3>
              </div>
              <button
                onClick={() => setIsPrintTagModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Printable Taka Tag Canvas */}
            <div className="p-5 space-y-3.5 text-xs font-sans text-slate-800">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 space-y-3 bg-white">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm tracking-tight">OSCAR TEXTILE ERP</h4>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Fabric Taka Tag</span>
                  </div>
                  <div className="text-right font-mono font-bold text-xs text-blue-600">
                    {tagModalRecord.barcode || `${tagModalRecord.lotNo}-${tagModalRecord.takaRoll}`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Lot Number</span>
                    <span className="font-mono font-bold text-slate-900">{tagModalRecord.lotNo}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Taka / Roll No.</span>
                    <span className="font-mono font-bold text-slate-900">{tagModalRecord.takaRoll}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Item Code</span>
                    <span className="font-mono font-bold text-blue-600">{tagModalRecord.itemCode}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Quality</span>
                    <span className="font-medium text-slate-800">{tagModalRecord.quality}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Design / Shade</span>
                    <span className="font-medium text-slate-800">
                      {tagModalRecord.design} / {tagModalRecord.shade}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Quantity</span>
                    <span className="font-mono font-black text-slate-900">
                      {formatQty(tagModalRecord.receivedQty, tagModalRecord.uom)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Storage Rack</span>
                    <span className="font-mono text-slate-700">{tagModalRecord.location}</span>
                  </div>
                  <div>
                    <span className="text-[9.5px] uppercase font-bold text-slate-400 block">QC Status</span>
                    <span className="font-bold text-emerald-700">{tagModalRecord.qcStatus}</span>
                  </div>
                </div>

                {/* Simulated Barcode Stripe */}
                <div className="pt-2 text-center border-t border-slate-200">
                  <div className="h-8 bg-[repeating-linear-gradient(90deg,#000,#000_2px,transparent_2px,transparent_4px)] w-4/5 mx-auto" />
                  <span className="font-mono text-[9px] text-slate-500 block mt-1">
                    *{tagModalRecord.lotNo}-{tagModalRecord.takaRoll}*
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPrintTagModalOpen(false)}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Printer size={13} />
                  Print Tag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
