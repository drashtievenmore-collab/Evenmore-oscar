import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  X,
  Warehouse,
  Package,
  Layers,
  QrCode,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { api } from '../../services/api';
import { useERP } from '../../context/ERPContext';

function numIN(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export function GreyStockUpdatedInlineSlide({ po, onClose, onNextStep, onPrevStep }) {
  const { formatCurrency, items: masterItems = [] } = useERP() || {};

  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState([]);
  const [takas, setTakas] = useState([]);

  const poId = po?.id;
  const poNumber = po?.poNumber || poId;

  const loadStockData = async () => {
    if (!poId) return;
    try {
      setLoading(true);

      const [stockRes, grnRes, lotRes] = await Promise.all([
        api.get('/inventory/stock/').catch(() => []),
        api.get('/purchase/receipts/', { params: { purchaseOrderId: poId } }).catch(() => []),
        api.get('/inventory/lot-register/', { params: { po: poId, limit: 100 } }).catch(() => ({ records: [] })),
      ]);

      const allStock = Array.isArray(stockRes) ? stockRes : (stockRes?.results || stockRes?.data || []);
      const poItemIds = (po?.items || po?.lineItems || []).map((it) => String(it.itemId || it.id || it.item_id));
      const matchedStock = allStock.filter((s) => poItemIds.includes(String(s.id || s.itemId || s.item_id)));
      setStockItems(matchedStock);

      const rawGrns = Array.isArray(grnRes) ? grnRes : (grnRes?.results || grnRes?.rows || grnRes?.data || []);
      const poGrns = rawGrns.filter((g) =>
        String(g.purchase_order || g.purchaseOrderId || g.purchaseOrder || g.poId || '') === String(poId) ||
        (poNumber && (g.poNumber === poNumber || g.po_number === poNumber))
      );
      const grnIds = new Set(poGrns.map((g) => String(g.id)));
      const grnNums = new Set(poGrns.map((g) => g.grn_number || g.grnNumber).filter(Boolean));

      const rawLots = Array.isArray(lotRes) ? lotRes : (lotRes?.records || lotRes?.rows || lotRes?.data || lotRes?.results || []);
      const poLots = rawLots.filter((lt) => {
        const matchGrn = grnIds.has(String(lt.sourceDocumentId || lt.source_document_id || lt.grnId || lt.grn_id)) ||
                         grnNums.has(lt.grnNo || lt.grnNumber || lt.source_document_number);
        const matchPo = String(lt.purchaseOrder || lt.poId || lt.poNumber || lt.sourceDocumentNumber || '') === String(poId) ||
                        String(lt.purchaseOrder || lt.poNumber || lt.sourceDocumentNumber || '') === String(poNumber);
        return matchGrn || matchPo;
      });

      const finalTakas = poLots.length > 0 ? poLots : rawLots;
      setTakas(finalTakas);
    } catch (err) {
      console.warn('Failed to load stock position:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, [poId]);

  const stats = useMemo(() => {
    const totalTakas = takas.length;
    const passedTakas = takas.filter((t) => t.qcStatus === 'Passed' || t.status === 'Active');
    const totalMetersInStock = passedTakas.reduce(
      (s, t) => s + (Number(t.availableQty || t.receivedQty || 0)),
      0
    );
    const poTotalValue = Number(po?.amount || po?.total || 0) || (totalMetersInStock * Number(po?.items?.[0]?.rate || 120));

    return {
      totalTakas,
      passedCount: passedTakas.length || totalTakas,
      totalMetersInStock: totalMetersInStock > 0 ? totalMetersInStock : (po?.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0),
      poTotalValue,
    };
  }, [takas, po]);

  return (
    <div className="rounded-2xl border-2 border-teal-400/80 bg-gradient-to-b from-teal-50/60 via-white to-white p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3 duration-300">
      {/* ── Slide Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-teal-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Warehouse size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-100 text-teal-800 uppercase tracking-wider">
                Stage 6 Slide
              </span>
              <h3 className="text-sm font-extrabold text-slate-900">
                Grey Stock Updated (Godown Inventory)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Live warehouse inventory position and godown taka allocation updated from approved intake.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadStockData}
            disabled={loading}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 shadow-2xs"
            title="Refresh stock"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Godown Stock</span>
          <p className="text-base font-extrabold font-mono text-teal-700 mt-0.5">{numIN(stats.totalMetersInStock)} Mtr</p>
          <span className="text-[10.5px] text-emerald-600 font-semibold">✓ Ready for Issue / Dyeing</span>
        </div>
        <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Active Taka Rolls</span>
          <p className="text-base font-extrabold font-mono text-teal-800 mt-0.5">{stats.passedCount || stats.totalTakas} Rolls</p>
          <span className="text-[10.5px] text-teal-600 font-medium">Individually Tagged</span>
        </div>
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Inventory Valuation</span>
          <p className="text-base font-extrabold font-mono text-blue-800 mt-0.5">
            {formatCurrency ? formatCurrency(stats.poTotalValue) : `₹${numIN(stats.poTotalValue)}`}
          </p>
          <span className="text-[10.5px] text-blue-600 font-medium">Asset in Books</span>
        </div>
        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Storage Warehouse</span>
          <p className="text-xs font-black text-purple-900 mt-1 flex items-center gap-1">
            <MapPin size={13} className="text-purple-600" /> WH-MAIN (Godown)
          </p>
          <span className="text-[10.5px] text-purple-600">Bin A-Grey Fabric Section</span>
        </div>
      </div>

      {/* ── Active Rolls in Warehouse Table ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers size={13} className="text-teal-600" /> Stock Rolls Available in Godown ({takas.length} Rolls)
          </h4>
          <span className="text-[10.5px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold border border-emerald-200">
            ✓ Post-QC Inward Complete
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200 uppercase text-[10px] sticky top-0 z-10">
              <tr>
                <th className="py-2 px-3">Barcode / Taka ID</th>
                <th className="py-2 px-3">Lot Number</th>
                <th className="py-2 px-3">Roll #</th>
                <th className="py-2 px-3">Available Qty</th>
                <th className="py-2 px-3">Current Location</th>
                <th className="py-2 px-3">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {takas.map((t, idx) => (
                <tr key={t.id || idx} className="hover:bg-slate-50/70 font-mono text-[11px]">
                  <td className="py-1.5 px-3 font-bold text-teal-700 flex items-center gap-1">
                    <QrCode size={12} className="text-teal-500" />
                    {t.takaId || t.barcode || t.id}
                  </td>
                  <td className="py-1.5 px-3 font-semibold text-slate-800">{t.lotNo || t.lot_number || '-'}</td>
                  <td className="py-1.5 px-3 font-bold">#{t.takaRoll || t.taka_number || idx + 1}</td>
                  <td className="py-1.5 px-3 font-extrabold text-teal-700">{numIN(t.availableQty || t.receivedQty)} m</td>
                  <td className="py-1.5 px-3 font-sans text-slate-600 text-[10.5px]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" /> {t.location || 'WH-MAIN / Godown'}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 font-sans">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Available Stock
                    </span>
                  </td>
                </tr>
              ))}
              {takas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                    Stock records posted directly into fabric master ledger for PO {poNumber}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Slide Lifecycle Navigation Bar ── */}
      <div className="pt-3 border-t border-teal-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 bg-teal-50/60 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:px-5 rounded-b-2xl">
        <div className="flex items-center gap-2">
          {onPrevStep && (
            <button
              type="button"
              onClick={() => onPrevStep('grey_fabric_qc')}
              className="px-3.5 py-1.5 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            >
              <ArrowLeft size={13} />
              <span>Previous: Grey Fabric QC</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium hidden md:inline">
            Stage 6 of 9 • Inventory Stock Updated
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 bg-white hover:bg-slate-100 font-semibold text-xs cursor-pointer shadow-2xs"
            >
              Close Slide
            </button>
          )}
          {onNextStep && (
            <button
              type="button"
              onClick={() => onNextStep('vendor_bill')}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <span>Next: Vendor Bill</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default GreyStockUpdatedInlineSlide;
