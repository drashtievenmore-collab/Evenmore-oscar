import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Building2,
  Calendar,
  Download,
  Filter,
  Layers,
  Printer,
  RefreshCw,
  Search,
  Send,
  ArrowDownLeft,
  ArrowDownToLine,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { fetchProcessorLedger } from '../../services/jobWorkSync';
import { numIN } from './jobWorkOrdersStore';
import PageHeader from '../../components/ui/PageHeader';

export default function ProcessorLedgerPage() {
  const navigate = useNavigate();
  const [processors, setProcessors] = useState([]);
  const [selectedProcessorId, setSelectedProcessorId] = useState('');
  const [ledgerData, setLedgerData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Load processors list
  useEffect(() => {
    let live = true;
    api.get('/masters/parties/processors/')
      .then((res) => {
        if (!live) return;
        const list = Array.isArray(res) ? res : (res?.results || []);
        setProcessors(list);
        if (list.length > 0 && !selectedProcessorId) {
          setSelectedProcessorId(list[0].id);
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // Fetch ledger data
  const loadLedger = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProcessorLedger(selectedProcessorId || undefined);
      const rows = Array.isArray(res) ? res : (res?.results || []);
      setLedgerData(rows);
    } catch (err) {
      setError(err?.message || 'Failed to load processor ledger');
      setLedgerData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [selectedProcessorId]);

  // Flatten & compute running balance for current selected processor or all
  const currentSummary = useMemo(() => {
    if (ledgerData.length === 0) return { totalSent: 0, totalReceived: 0, totalLoss: 0, closingBalance: 0 };
    if (selectedProcessorId) {
      const p = ledgerData.find((d) => d.processorId === selectedProcessorId) || ledgerData[0];
      return p || { totalSent: 0, totalReceived: 0, totalLoss: 0, closingBalance: 0 };
    }
    return {
      totalSent: ledgerData.reduce((s, d) => s + (d.totalSent || 0), 0),
      totalReceived: ledgerData.reduce((s, d) => s + (d.totalReceived || 0), 0),
      totalLoss: ledgerData.reduce((s, d) => s + (d.totalLoss || 0), 0),
      closingBalance: ledgerData.reduce((s, d) => s + (d.closingBalance || 0), 0),
    };
  }, [ledgerData, selectedProcessorId]);

  const rawEntries = useMemo(() => {
    if (selectedProcessorId) {
      const p = ledgerData.find((d) => d.processorId === selectedProcessorId);
      return p?.entries || [];
    }
    return ledgerData.flatMap((d) => d.entries || []);
  }, [ledgerData, selectedProcessorId]);

  const sortedEntries = useMemo(() => {
    let list = [...rawEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (dateFrom) list = list.filter((e) => !e.date || e.date >= dateFrom);
    if (dateTo) list = list.filter((e) => !e.date || e.date <= dateTo);

    let running = 0;
    return list.map((e) => {
      running += (e.debitQty || 0) - (e.creditQty || 0) - (e.lossQty || 0);
      return { ...e, runningBalance: running };
    });
  }, [rawEntries, dateFrom, dateTo]);

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      <PageHeader
        title="Processor Fabric Ledger"
        subtitle="Track roll-by-roll grey issues, dyed receipts, approved shrinkage, and running meter balances per job worker."
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'PMS', path: '/pms' },
          { label: 'Job Work / Processing', path: '/job-work/orders' },
          { label: 'Processor Ledger' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <Printer size={13} /> Print Ledger
            </button>
            <button
              onClick={loadLedger}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Send size={15} />
            </div>
            <span className="text-[11.5px] font-semibold text-slate-500">Total Sent (Outward)</span>
          </div>
          <div className="mt-2 text-[18px] font-extrabold text-slate-900">{numIN(currentSummary.totalSent)} M</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <ArrowDownToLine size={15} />
            </div>
            <span className="text-[11.5px] font-semibold text-slate-500">Total Received (Inward)</span>
          </div>
          <div className="mt-2 text-[18px] font-extrabold text-slate-900">{numIN(currentSummary.totalReceived)} M</div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <TrendingDown size={15} />
            </div>
            <span className="text-[11.5px] font-semibold text-slate-500">Approved Loss / Shrinkage</span>
          </div>
          <div className="mt-2 text-[18px] font-extrabold text-amber-600">{numIN(currentSummary.totalLoss)} M</div>
        </div>

        <div className={`rounded-xl border p-3.5 shadow-2xs ${currentSummary.closingBalance > 0 ? 'bg-indigo-50/70 border-indigo-200' : 'bg-white border-slate-200/80'}`}>
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700">
              <BookOpen size={15} />
            </div>
            <span className="text-[11.5px] font-semibold text-slate-600">Pending at Processor</span>
          </div>
          <div className="mt-2 text-[18px] font-extrabold text-indigo-900">{numIN(currentSummary.closingBalance)} M</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-slate-400" />
          <span className="text-[12px] font-bold text-slate-700">Processor:</span>
          <select
            value={selectedProcessorId}
            onChange={(e) => setSelectedProcessorId(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-800 outline-none focus:border-blue-400 bg-white"
          >
            <option value="">All Processors</option>
            {processors.map((p) => (
              <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[12px] font-semibold text-slate-500">From:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 outline-none focus:border-blue-400"
          />
          <span className="text-[12px] font-semibold text-slate-500">To:</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">JWO No.</th>
                <th className="px-3.5 py-2.5">Type</th>
                <th className="px-3.5 py-2.5">Challan / Ref No.</th>
                <th className="px-3.5 py-2.5">Process</th>
                <th className="px-3.5 py-2.5 text-right font-mono">Debit / Sent (M)</th>
                <th className="px-3.5 py-2.5 text-right font-mono">Credit / Recv (M)</th>
                <th className="px-3.5 py-2.5 text-right font-mono">Loss (M)</th>
                <th className="px-3.5 py-2.5 text-right font-mono font-extrabold">Balance (M)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3.5 py-12 text-center text-slate-400">Loading ledger records…</td>
                </tr>
              ) : sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3.5 py-12 text-center text-slate-400">
                    No transactions recorded for the selected processor.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((e, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3.5 py-2.5 text-center text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-700 whitespace-nowrap">{e.date || '—'}</td>
                    <td className="px-3.5 py-2.5 font-mono">
                      <button
                        onClick={() => navigate(`/job-work/orders/${e.jwoId}`)}
                        className="text-blue-600 hover:underline font-bold inline-flex items-center gap-1"
                      >
                        {e.jwoNo} <ExternalLink size={10} />
                      </button>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-bold ${
                        e.type === 'Outward'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : e.type === 'Inward'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-700">{e.refNo || '—'}</td>
                    <td className="px-3.5 py-2.5 text-slate-700 font-medium">{e.process || '—'}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-slate-900 font-semibold">
                      {e.debitQty ? numIN(e.debitQty) : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 font-semibold">
                      {e.creditQty ? numIN(e.creditQty) : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-amber-600 font-semibold">
                      {e.lossQty ? numIN(e.lossQty) : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900">
                      {numIN(e.runningBalance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
