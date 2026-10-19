import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Search,
  RefreshCw,
  CheckCircle2,
  ShoppingCart,
  Factory,
  FileText,
  Layers,
  AlertTriangle,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { getGreyStockAllocation, saveGreyStockAllocation } from '../../../../services/pmsSync';
import { usePmsStore } from '../../../../stores/pmsStore';

export function Stage1GreyStockWorkspace({
  project,
  stage,
  onSyncPipeline,
  onHandoff,
}) {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [fabricFilter, setFabricFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const [isPoModalOpen, setPoModalOpen] = useState(false);
  const [isProdModalOpen, setProdModalOpen] = useState(false);

  const [stageMeta, setStageMeta] = useState({
    stageName: 'Stage 1: Grey Stock Check & Allocation',
    stageSubtitle: 'Check available grey fabric stock in OSCAR and allocate for this project.',
    stageWeight: 10,
    plannedDurationDays: 5,
    startDate: '01/10/2026',
    endDate: '05/10/2026',
    requiredMeters: 3000,
    shortageAction: null,
  });

  const [lots, setLots] = useState([]);

  const [poForm, setPoForm] = useState({
    supplierName: 'Apex Textiles Ltd',
    orderNumber: 'PO-2026-0881',
    ratePerMeter: 48.5,
    deliveryDate: '2026-10-04',
    notes: 'Urgent procurement for PMS Project allocation shortage.',
  });

  const [prodForm, setProdForm] = useState({
    weavingUnit: 'Vendor A Production (Loom Unit 3)',
    orderNumber: 'PROD-2026-0412',
    ratePerMeter: 32.0,
    completionDate: '2026-10-05',
    notes: 'In-house weaving job order for shortage balance.',
  });

  const loadData = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await getGreyStockAllocation(projectId);
      if (res) {
        const payload = res.data || res;
        const lotsList = Array.isArray(payload.lots) ? payload.lots : (Array.isArray(res.lots) ? res.lots : []);
        setLots(lotsList);
        setStageMeta({
          stageName: payload.stageName || res.stageName || 'Stage 1: Grey Stock Check & Allocation',
          stageSubtitle: payload.stageSubtitle || res.stageSubtitle || 'Check available grey fabric stock in OSCAR and allocate for this project.',
          stageWeight: payload.stageWeight ?? res.stageWeight ?? 10,
          plannedDurationDays: payload.plannedDurationDays ?? res.plannedDurationDays ?? 5,
          startDate: payload.startDate || res.startDate || '01/10/2026',
          endDate: payload.expectedCompletionDate || res.expectedCompletionDate || '05/10/2026',
          requiredMeters: Number(payload.requiredMeters || res.requiredMeters || project?.requirementMeters || project?.quantity || 3000),
          shortageAction: payload.shortageAction || res.shortageAction || null,
        });
      }
    } catch (err) {
      console.warn('load grey stock error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleAllocateQtyChange = (lotId, newQty) => {
    setLots((prevLots) => {
      const updated = prevLots.map((lot) => {
        if (lot.id !== lotId) return lot;
        const val = Math.max(0, Math.min(lot.usable, Number(newQty) || 0));
        return {
          ...lot,
          allocateQty: val,
          balance: Math.max(0, lot.usable - val),
          status: val > 0 ? 'Selected' : 'Available',
        };
      });
      syncAllocation(updated);
      return updated;
    });
  };

  const handleToggleLot = (lotId) => {
    setLots((prevLots) => {
      const updated = prevLots.map((lot) => {
        if (lot.id !== lotId) return lot;
        const isSelected = lot.allocateQty > 0;
        const val = isSelected ? 0 : lot.usable;
        return {
          ...lot,
          allocateQty: val,
          balance: Math.max(0, lot.usable - val),
          status: val > 0 ? 'Selected' : 'Available',
        };
      });
      syncAllocation(updated);
      return updated;
    });
  };

  const handleToggleAll = (checked) => {
    setLots((prevLots) => {
      const updated = prevLots.map((lot) => {
        const val = checked ? lot.usable : 0;
        return {
          ...lot,
          allocateQty: val,
          balance: Math.max(0, lot.usable - val),
          status: val > 0 ? 'Selected' : 'Available',
        };
      });
      syncAllocation(updated);
      return updated;
    });
  };

  const syncAllocation = async (currentLots) => {
    try {
      const totalAlloc = currentLots.reduce((acc, l) => acc + (Number(l.allocateQty) || 0), 0);
      const isFulfilled = totalAlloc >= projectRequirement;
      const nextShortageAction = isFulfilled ? null : stageMeta.shortageAction;
      if (isFulfilled && stageMeta.shortageAction) {
        setStageMeta((prev) => ({ ...prev, shortageAction: null }));
      }
      await saveGreyStockAllocation(projectId, {
        allocations: currentLots.map((l) => ({
          id: l.id,
          lotId: l.id,
          fabricQuality: l.fabricQuality,
          lotNumber: l.lotNumber,
          allocateQty: l.allocateQty,
        })),
        shortageAction: nextShortageAction,
      });
      if (onSyncPipeline) onSyncPipeline();
    } catch (err) {
      console.error('sync allocation error:', err);
    }
  };

  const handleSelectShortageAction = async (actionType) => {
    try {
      setStageMeta((prev) => ({ ...prev, shortageAction: actionType }));
      await saveGreyStockAllocation(projectId, {
        allocations: lots.map((l) => ({
          id: l.id,
          lotId: l.id,
          fabricQuality: l.fabricQuality,
          lotNumber: l.lotNumber,
          allocateQty: l.allocateQty,
        })),
        shortageAction: actionType,
      });
      if (actionType === 'PURCHASE_PO') {
        toast.success(`Purchase Order route selected for ${shortageQty.toLocaleString('en-IN')} m shortage`);
      } else {
        toast.success(`Vendor A Production route selected for ${shortageQty.toLocaleString('en-IN')} m shortage`);
      }
      if (onSyncPipeline) onSyncPipeline();
    } catch (err) {
      toast.error('Failed to select shortage route: ' + (err?.message || 'Server error'));
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveGreyStockAllocation(projectId, {
        allocations: lots.map((l) => ({
          id: l.id,
          lotId: l.id,
          fabricQuality: l.fabricQuality,
          lotNumber: l.lotNumber,
          allocateQty: l.allocateQty,
        })),
        shortageAction: stageMeta.shortageAction,
      });
      toast.success('Allocation draft saved successfully.');
      if (onSyncPipeline) onSyncPipeline();
    } catch (err) {
      toast.error('Failed to save draft: ' + (err?.message || 'Server error'));
    }
  };

  const handleNextReview = async () => {
    try {
      await saveGreyStockAllocation(projectId, {
        allocations: lots.map((l) => ({
          id: l.id,
          lotId: l.id,
          fabricQuality: l.fabricQuality,
          lotNumber: l.lotNumber,
          allocateQty: l.allocateQty,
        })),
        shortageAction: stageMeta.shortageAction,
      });
      if (onSyncPipeline) onSyncPipeline();
      if (onHandoff) onHandoff(2);
    } catch (err) {
      toast.error('Failed to proceed: ' + (err?.message || 'Server error'));
    }
  };

  const handleConfirmPurchaseOrder = async () => {
    const payload = {
      ...poForm,
      quantity: shortageQty,
      status: 'Drafted',
      createdAt: new Date().toISOString(),
    };
    try {
      await saveGreyStockAllocation(projectId, {
        allocations: lots.map((l) => ({ id: l.id, allocateQty: l.allocateQty })),
        shortageAction: 'PURCHASE_PO',
        purchaseOrder: payload,
      });
      setStageMeta((prev) => ({ ...prev, shortageAction: 'PURCHASE_PO' }));
      setPoModalOpen(false);
      toast.success(`Purchase Order ${payload.orderNumber} created for ${shortageQty.toLocaleString('en-IN')} m`);
      if (onSyncPipeline) onSyncPipeline();
    } catch (err) {
      toast.error('Failed to create Purchase Order: ' + (err?.message || 'Server error'));
    }
  };

  const handleConfirmProductionOrder = async () => {
    const payload = {
      ...prodForm,
      quantity: shortageQty,
      status: 'Scheduled',
      createdAt: new Date().toISOString(),
    };
    try {
      await saveGreyStockAllocation(projectId, {
        allocations: lots.map((l) => ({ id: l.id, allocateQty: l.allocateQty })),
        shortageAction: 'PRODUCTION_ORDER',
        productionOrder: payload,
      });
      setStageMeta((prev) => ({ ...prev, shortageAction: 'PRODUCTION_ORDER' }));
      setProdModalOpen(false);
      toast.success(`Production Order ${payload.orderNumber} issued for ${shortageQty.toLocaleString('en-IN')} m`);
      if (onSyncPipeline) onSyncPipeline();
    } catch (err) {
      toast.error('Failed to issue Production Order: ' + (err?.message || 'Server error'));
    }
  };

  const fabricOptions = useMemo(() => {
    return Array.from(new Set(lots.map((l) => l.fabricQuality).filter(Boolean)));
  }, [lots]);

  const locationOptions = useMemo(() => {
    return Array.from(new Set(lots.map((l) => l.location).filter(Boolean)));
  }, [lots]);

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => {
      if (fabricFilter !== 'ALL' && lot.fabricQuality !== fabricFilter) return false;
      if (locationFilter !== 'ALL' && lot.location !== locationFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mFabric = (lot.fabricQuality || '').toLowerCase().includes(q);
        const mLot = (lot.lotNumber || '').toLowerCase().includes(q);
        const mLoc = (lot.location || '').toLowerCase().includes(q);
        if (!mFabric && !mLot && !mLoc) return false;
      }
      return true;
    });
  }, [lots, fabricFilter, locationFilter, searchQuery]);

  const totalStock = useMemo(() => filteredLots.reduce((acc, l) => acc + (Number(l.totalStock) || 0), 0), [filteredLots]);
  const totalReserved = useMemo(() => filteredLots.reduce((acc, l) => acc + (Number(l.reserved) || 0), 0), [filteredLots]);
  const totalUsable = useMemo(() => filteredLots.reduce((acc, l) => acc + (Number(l.usable) || 0), 0), [filteredLots]);
  const totalAllocated = useMemo(() => filteredLots.reduce((acc, l) => acc + (Number(l.allocateQty) || 0), 0), [filteredLots]);
  const totalBalance = useMemo(() => filteredLots.reduce((acc, l) => acc + (Number(l.balance) || 0), 0), [filteredLots]);

  const projectRequirement = Number(stageMeta.requiredMeters || 3000);
  const shortageQty = Math.max(0, projectRequirement - totalAllocated);
  const allocatedPct = projectRequirement > 0 ? Math.round((totalAllocated / projectRequirement) * 100) : 0;
  const shortagePct = projectRequirement > 0 ? Math.round((shortageQty / projectRequirement) * 100) : 0;

  const selectedCount = filteredLots.filter((l) => l.allocateQty > 0).length;
  const allSelected = filteredLots.length > 0 && selectedCount === filteredLots.length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-blue-200 bg-blue-50/60 text-blue-600">
              <Box size={24} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {stageMeta.stageName}
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                {stageMeta.stageSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Stage Weight</p>
              <p className="text-sm font-bold text-slate-900">{stageMeta.stageWeight}%</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Planned Duration</p>
              <p className="text-sm font-bold text-slate-900">{stageMeta.plannedDurationDays} Days</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Start Date</p>
              <p className="text-sm font-bold text-slate-900">{stageMeta.startDate}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">End Date</p>
              <p className="text-sm font-bold text-slate-900">{stageMeta.endDate}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-7 rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-3.5">
          <h3 className="text-xs font-bold text-blue-600 tracking-wide uppercase">
            Available Grey Stock
          </h3>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Fabric, Lot/Taka, Location..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <select
              value={fabricFilter}
              onChange={(e) => setFabricFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Fabrics</option>
              {fabricOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Locations</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 text-xs font-semibold cursor-pointer transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                  <th className="py-2.5 px-3 w-10 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => handleToggleAll(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400">{selectedCount}</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-2.5">Fabric / Quality</th>
                  <th className="py-2.5 px-2.5">Lot / Taka</th>
                  <th className="py-2.5 px-2.5">Location</th>
                  <th className="py-2.5 px-2 text-right">Total Stock (m)</th>
                  <th className="py-2.5 px-2 text-right">Reserved (m)</th>
                  <th className="py-2.5 px-2 text-right">Usable Qty (m)</th>
                  <th className="py-2.5 px-2 text-center">Allocate Qty (m)</th>
                  <th className="py-2.5 px-2 text-right">Balance (m)</th>
                  <th className="py-2.5 px-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLots.map((lot) => {
                  const isSelected = lot.allocateQty > 0;
                  return (
                    <tr
                      key={lot.id || lot.lotNumber}
                      className={isSelected ? 'bg-blue-50/20' : 'hover:bg-slate-50/50'}
                    >
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleLot(lot.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-2.5 font-medium text-slate-800 whitespace-nowrap">
                        {lot.fabricQuality}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                        {lot.lotNumber}
                      </td>
                      <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                        {lot.location}
                      </td>
                      <td className="py-2 px-2 text-right font-medium">
                        {Number(lot.totalStock || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-right text-slate-500 font-medium">
                        {Number(lot.reserved || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-800">
                        {Number(lot.usable || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-1 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max={lot.usable}
                          value={lot.allocateQty}
                          onChange={(e) => handleAllocateQtyChange(lot.id, e.target.value)}
                          className="w-16 text-center text-xs font-semibold py-1 px-1 rounded border border-slate-300 focus:border-blue-500 focus:outline-none bg-white shadow-2xs"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-600">
                        {Number(lot.balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 size={11} className="text-emerald-700" />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/70 border-t border-slate-200 font-bold text-slate-800">
                  <td className="py-2.5 px-3 text-center" />
                  <td colSpan={3} className="py-2.5 px-2.5 text-xs font-bold text-slate-700">
                    Σ TOTAL FILTERED LOTS ({filteredLots.length})
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    {totalStock.toLocaleString('en-IN')} m
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-500">
                    {totalReserved.toLocaleString('en-IN')} m
                  </td>
                  <td className="py-2.5 px-2 text-right text-emerald-600 font-bold">
                    {totalUsable.toLocaleString('en-IN')} m
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="inline-block bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 rounded shadow-2xs">
                      {totalAllocated.toLocaleString('en-IN')} m
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-medium text-slate-700">
                    {totalBalance.toLocaleString('en-IN')} m
                  </td>
                  <td className="py-2.5 px-2.5 text-center" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="xl:col-span-5 rounded-xl border border-[#dce5f4] bg-white p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 tracking-wide">
              Requirement & Allocation Progress
            </h3>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
            >
              View Details
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-blue-600">Stock Allocated: {allocatedPct}%</span>
              <span className="text-rose-600">Shortage: {shortagePct}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, allocatedPct)}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${Math.min(100, shortagePct)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl p-3 bg-blue-50/70 border border-blue-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">Project Requirement</p>
                <p className="text-base font-bold text-slate-900 leading-tight">
                  {projectRequirement.toLocaleString('en-IN')} m
                </p>
              </div>
            </div>

            <div className="rounded-xl p-3 bg-emerald-50/70 border border-emerald-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-slate-500">Allocated from Stock</p>
                <p className="text-base font-bold text-emerald-600 leading-tight">
                  {totalAllocated.toLocaleString('en-IN')} m
                </p>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">{allocatedPct}%</p>
              </div>
            </div>

            <div className="rounded-xl p-3 bg-rose-50/70 border border-rose-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-rose-500">Shortage Quantity</p>
                <p className="text-base font-bold text-rose-600 leading-tight">
                  {shortageQty.toLocaleString('en-IN')} m
                </p>
                <p className="text-[10px] font-bold text-rose-600 mt-0.5">{shortagePct}%</p>
              </div>
            </div>
          </div>

          {shortageQty > 0 ? (
            <div className="space-y-3">
              <div className="rounded-xl p-3 bg-rose-50 border border-rose-200 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  !
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-700">
                    Stock shortage detected for {shortageQty.toLocaleString('en-IN')} m
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Choose one of the options below to fulfill the shortage quantity.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Shortage Resolution Options
                </p>

                <div className="space-y-2.5">
                  <div className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${stageMeta.shortageAction === 'PURCHASE_PO' ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-300' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <ShoppingCart size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Purchase from Supplier</p>
                        <p className="text-[11px] text-slate-500">Procure grey fabric from external supplier via PO</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectShortageAction('PURCHASE_PO')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        + Create Purchase PO
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoModalOpen(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        View Options
                      </button>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${stageMeta.shortageAction === 'PRODUCTION_ORDER' ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-300' : 'bg-white border-slate-200 hover:border-purple-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <Factory size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">Vendor A Production</p>
                        <p className="text-[11px] text-slate-500">Send yarn to Vendor A loom for weaving</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSelectShortageAction('PRODUCTION_ORDER')}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        + Issue Production Order
                      </button>
                      <button
                        type="button"
                        onClick={() => setProdModalOpen(true)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        View Options
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-800">
                All requirement fulfilled from stock. Ready for Stage 2 / Processing Plan.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#dce5f4] bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <p className="text-xs text-slate-500 font-medium">
          Tip: Enter required quantity per lot or check rows to auto-allocate max usable meters.
        </p>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2 rounded-lg border border-blue-500 bg-white hover:bg-blue-50 text-blue-600 font-bold text-xs transition-colors cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={handleNextReview}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span>Next: Review Allocation</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-800">Project Requirement Details</h4>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-xs space-y-2 text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Project Code:</span>
                <span className="font-semibold text-slate-800">{project?.code || 'PRJ-2026-001'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Total Requirement:</span>
                <span className="font-semibold text-slate-800">{projectRequirement.toLocaleString('en-IN')} m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Allocated from Godown:</span>
                <span className="font-semibold text-emerald-600">{totalAllocated.toLocaleString('en-IN')} m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-400">Shortage to Procure:</span>
                <span className="font-semibold text-rose-600">{shortageQty.toLocaleString('en-IN')} m</span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-blue-600">
                <ShoppingCart size={18} />
                <h4 className="text-sm font-bold text-slate-800">Create Grey Fabric Purchase PO</h4>
              </div>
              <button
                type="button"
                onClick={() => setPoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Supplier</label>
                <input
                  type="text"
                  value={poForm.supplierName}
                  onChange={(e) => setPoForm({ ...poForm, supplierName: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">PO Number</label>
                  <input
                    type="text"
                    value={poForm.orderNumber}
                    onChange={(e) => setPoForm({ ...poForm, orderNumber: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Quantity (m)</label>
                  <input
                    type="number"
                    readOnly
                    value={shortageQty}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Rate / Meter (₹)</label>
                  <input
                    type="number"
                    value={poForm.ratePerMeter}
                    onChange={(e) => setPoForm({ ...poForm, ratePerMeter: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Target Delivery</label>
                  <input
                    type="date"
                    value={poForm.deliveryDate}
                    onChange={(e) => setPoForm({ ...poForm, deliveryDate: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPoModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPurchaseOrder}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white cursor-pointer"
              >
                Confirm & Create PO
              </button>
            </div>
          </div>
        </div>
      )}

      {isProdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-purple-600">
                <Factory size={18} />
                <h4 className="text-sm font-bold text-slate-800">Create Vendor A Production Order</h4>
              </div>
              <button
                type="button"
                onClick={() => setProdModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Weaving Production Unit</label>
                <input
                  type="text"
                  value={prodForm.weavingUnit}
                  onChange={(e) => setProdForm({ ...prodForm, weavingUnit: e.target.value })}
                  className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Order Number</label>
                  <input
                    type="text"
                    value={prodForm.orderNumber}
                    onChange={(e) => setProdForm({ ...prodForm, orderNumber: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Quantity (m)</label>
                  <input
                    type="number"
                    readOnly
                    value={shortageQty}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-bold text-slate-800"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Weaving Rate / m (₹)</label>
                  <input
                    type="number"
                    value={prodForm.ratePerMeter}
                    onChange={(e) => setProdForm({ ...prodForm, ratePerMeter: Number(e.target.value) })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-medium mb-1">Completion Date</label>
                  <input
                    type="date"
                    value={prodForm.completionDate}
                    onChange={(e) => setProdForm({ ...prodForm, completionDate: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProdModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmProductionOrder}
                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white cursor-pointer"
              >
                Confirm & Issue Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stage1GreyStockWorkspace;
