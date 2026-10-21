import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RotateCcw, ShieldAlert, ArrowUpRight, Plus, CheckCircle2,
  AlertCircle, Package, Receipt, FileText, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyUtils';

const CONDITION_COLORS = {
  Good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Hold: 'bg-amber-50 text-amber-800 border-amber-200',
  Reprocess: 'bg-violet-50 text-violet-700 border-violet-200',
  'Second Quality': 'bg-orange-50 text-orange-700 border-orange-200',
  Reject: 'bg-rose-50 text-rose-700 border-rose-200',
};

function ConditionBadge({ condition }) {
  const cls = CONDITION_COLORS[condition] || 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {condition || 'Hold'}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'Posted') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 size={11} /> Posted
      </span>
    );
  }
  if (status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle size={11} /> Cancelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
      ● {status || 'Draft'}
    </span>
  );
}

export function CustomerReturnTab({ project }) {
  const [expandedId, setExpandedId] = useState(null);
  const returns = project.customerReturns || [];

  const totalReturnedMeters = returns.reduce((sum, r) => sum + (Number(r.totalReturnedQty) || 0), 0);
  const totalCreditAmount = returns.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
  const postedCount = returns.filter((r) => r.status === 'Posted').length;

  return (
    <div className="space-y-5">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Customer Returns & Credit Notes</h3>
          <p className="text-xs text-slate-400">
            Track fabric returns, credit notes issued, and stock condition routing for this project
          </p>
        </div>
        <Link
          to={`/sales/returns${project.crmOrderId ? `?order=${project.crmOrderId}` : ''}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs"
        >
          <RotateCcw size={13} />
          <span>Open Sales Returns Module</span>
          <ArrowUpRight size={12} className="text-slate-400" />
        </Link>
      </div>

      {/* 2. Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Total Returns</span>
            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <RotateCcw size={12} />
            </div>
          </div>
          <div className="text-lg font-black text-slate-800 mt-1">{returns.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {postedCount} posted credit note{postedCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Returned Fabric</span>
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package size={12} />
            </div>
          </div>
          <div className="text-lg font-black text-slate-800 mt-1">
            {totalReturnedMeters.toLocaleString('en-IN')} m
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Received from customer
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Total Credit Value</span>
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Receipt size={12} />
            </div>
          </div>
          <div className="text-lg font-black text-slate-800 mt-1">
            {formatCurrency(totalCreditAmount)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Credited to customer ledger
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-[#dce5f4] bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Return Location</span>
            <div className="w-6 h-6 rounded-md bg-violet-50 text-violet-600 flex items-center justify-center">
              <FileText size={12} />
            </div>
          </div>
          <div className="text-xs font-bold text-slate-800 mt-2 truncate" title={returns[0]?.locationName || 'OSCAR Main Warehouse'}>
            {returns[0]?.locationName || 'OSCAR Main Warehouse'}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Stock condition routed
          </div>
        </div>
      </div>

      {/* 3. Returns List Table or Empty State */}
      {returns.length === 0 ? (
        <div className="rounded-xl border border-[#dce5f4] bg-white p-10 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <RotateCcw size={22} />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Customer Returns Recorded</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            There are no customer returns or credit notes logged against this project. All dispatched fabric has been accepted without return claims.
          </p>
          <Link
            to="/sales/returns"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs"
          >
            <Plus size={13} />
            <span>Process Sales Return</span>
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[#dce5f4] bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3.5">Return # / Credit Note</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Sales Invoice</th>
                  <th className="py-2.5 px-3 text-right">Returned Qty (m)</th>
                  <th className="py-2.5 px-3 text-right">Credit Value</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((ret) => {
                  const isExpanded = expandedId === ret.id;
                  const lines = ret.lines || [];
                  return (
                    <React.Fragment key={ret.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3.5 font-semibold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <RotateCcw size={13} className="text-slate-400 shrink-0" />
                            <span className="font-mono">{ret.returnNumber}</span>
                          </div>
                          {ret.creditNoteNumber && ret.creditNoteNumber !== ret.returnNumber && (
                            <div className="text-[10px] text-slate-400 font-mono pl-5">
                              CN: {ret.creditNoteNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                          {ret.docDate ? new Date(ret.docDate).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {ret.invoiceNumber && ret.invoiceNumber !== '—' ? (
                            <Link
                              to={`/sales/invoices?id=${ret.invoiceId || ''}`}
                              className="text-blue-600 hover:underline font-mono inline-flex items-center gap-1"
                            >
                              <Receipt size={11} />
                              <span>{ret.invoiceNumber}</span>
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {Number(ret.totalReturnedQty || 0).toLocaleString('en-IN')} m
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(ret.totalAmount || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate" title={ret.reason}>
                          {ret.reason || '—'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <StatusBadge status={ret.status} />
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {lines.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : ret.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                            >
                              <span>{lines.length} {lines.length === 1 ? 'line' : 'lines'}</span>
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Line Items Details Sub-table */}
                      {isExpanded && lines.length > 0 && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="p-3.5 border-t border-slate-100">
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                                <span>Returned Line Items & Taka Traceability</span>
                                <span className="text-slate-400 font-normal">Condition decides stock destination</span>
                              </div>
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400 bg-white">
                                    <th className="py-2 px-3">#</th>
                                    <th className="py-2 px-3">Taka / Lot</th>
                                    <th className="py-2 px-3 text-right">Returned Qty</th>
                                    <th className="py-2 px-3">Condition (Destination)</th>
                                    <th className="py-2 px-3 text-right">Rate</th>
                                    <th className="py-2 px-3 text-right">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {lines.map((ln, idx) => (
                                    <tr key={ln.id || idx} className="hover:bg-slate-50/50">
                                      <td className="py-2 px-3 text-slate-500 font-semibold">{ln.lineNo || idx + 1}</td>
                                      <td className="py-2 px-3 font-mono text-slate-700">
                                        {ln.lotTaka ? `Taka ${ln.lotTaka}` : '—'}
                                        {ln.lotNo ? ` (Lot: ${ln.lotNo})` : ''}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                        {Number(ln.returnedQty || 0).toLocaleString('en-IN')} m
                                      </td>
                                      <td className="py-2 px-3">
                                        <ConditionBadge condition={ln.condition} />
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-600">
                                        {ln.unitPrice ? formatCurrency(ln.unitPrice) : '—'}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                        {ln.lineTotal ? formatCurrency(ln.lineTotal) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerReturnTab;
