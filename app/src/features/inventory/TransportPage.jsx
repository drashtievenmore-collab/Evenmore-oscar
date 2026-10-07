import React, { useMemo, useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/common/PageHeader';
import { Plus, Eye, Search, X } from 'lucide-react';

const transportGuide = {
    title: 'Transport / Material Movement',
    subtitle: 'Trip-wise material movement with transporter, vehicle, quantity and amount.',
    purpose: 'Each trip records material moved from one place to another with transporter and vehicle details. Status flows from In Transit to Received on intake confirmation.',
    keyTerms: [
        { term: 'Trip No.', definition: 'Auto-generated trip reference for one material movement.' },
        { term: 'Intake Confirmation', definition: 'Confirm once material is received to mark the trip Completed.' },
    ],
    tips: [
        'Use Search with From / To / Status / Date filters to find trips.',
    ],
    workflow: ['Trip Created', 'Dispatched (In Transit)', 'Intake Confirmed', 'Completed'],
};

const toDDMMYYYY = (d) => {
    const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || '—');
};

const parseTripDate = (d) => {
    let m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    m = String(d || '').match(/^(\d{2})-(\d{2})-(\d{4})/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    return new Date(d);
};

export const TransportPage = () => {
    const { transfers, addTransfer, updateTransferStatus } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [viewing, setViewing] = useState(null);
    const [fromName, setFromName] = useState('');
    const [toName, setToName] = useState('');
    const [tripDate, setTripDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [material, setMaterial] = useState('');
    const [moveQty, setMoveQty] = useState('');
    const [transporter, setTransporter] = useState('');
    const [vehicleNo, setVehicleNo] = useState('');
    const [moveAmount, setMoveAmount] = useState('');
    const [fromFilter, setFromFilter] = useState('All');
    const [toFilter, setToFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [applied, setApplied] = useState({ from: 'All', to: 'All', status: 'All', fromDate: '', toDate: '' });

    const openCreate = () => {
        setTripDate(new Date().toISOString().slice(0, 10));
        setFromName('');
        setToName('');
        setMaterial('');
        setMoveQty('');
        setTransporter('');
        setVehicleNo('');
        setMoveAmount('');
        setShowAddModal(true);
    };

    const handleCreate = (e) => {
        e.preventDefault();
        const qty = Number(moveQty) || 0;
        const amount = Number(moveAmount) || 0;
        if (!fromName.trim()) { alert('From is required.'); return; }
        if (!toName.trim()) { alert('To is required.'); return; }
        if (fromName.trim().toLowerCase() === toName.trim().toLowerCase()) { alert('From and To cannot be the same.'); return; }
        if (!material.trim()) { alert('Material is required.'); return; }
        if (!(qty > 0)) { alert('Qty (M/Kg) must be greater than 0.'); return; }
        addTransfer({
            sourceLocation: fromName.trim(),
            destLocation: toName.trim(),
            date: tripDate || new Date().toISOString().slice(0, 10),
            itemsCount: 1,
            status: 'In Transit',
            shippedBy: transporter.trim() || '—',
            vehicleNo: vehicleNo.trim(),
            items: [{ description: material.trim(), qty, rate: qty > 0 ? amount / qty : 0, amount }],
        });
        setShowAddModal(false);
    };

    const markReceived = (id) => {
        updateTransferStatus(id, 'Received');
    };

    const displayStatus = (t) => (t.status === 'Received' ? 'Completed' : (t.status || 'Pending'));
    const statusPill = (s) => s === 'Completed'
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
        : s === 'In Transit'
            ? 'bg-rose-50 text-rose-600 border-rose-200'
            : 'bg-amber-50 text-amber-600 border-amber-200';
    const transferQty = (t) => (t.items || []).reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const transferAmount = (t) => (t.items || []).reduce((s, l) => s + (Number(l.amount) || (Number(l.qty) || 0) * (Number(l.rate) || 0)), 0);
    const transferMaterial = (t) => {
        const first = (t.items || [])[0];
        const name = first?.description || first?.name || first?.itemSku || '—';
        const extra = (t.items || []).length > 1 ? ` +${(t.items || []).length - 1}` : '';
        return `${name}${extra}`;
    };

    const fromOptions = useMemo(() => ['All', ...new Set(transfers.map((t) => t.sourceLocation).filter(Boolean))], [transfers]);
    const toOptions = useMemo(() => ['All', ...new Set(transfers.map((t) => t.destLocation).filter(Boolean))], [transfers]);
    const rows = useMemo(() => transfers.filter((t) => {
        if (applied.from !== 'All' && t.sourceLocation !== applied.from) return false;
        if (applied.to !== 'All' && t.destLocation !== applied.to) return false;
        if (applied.status !== 'All' && displayStatus(t) !== applied.status) return false;
        if (applied.fromDate || applied.toDate) {
            const d = parseTripDate(t.date);
            if (!Number.isNaN(d.getTime())) {
                if (applied.fromDate && d < new Date(`${applied.fromDate}T00:00:00`)) return false;
                if (applied.toDate && d > new Date(`${applied.toDate}T23:59:59`)) return false;
            }
        }
        return true;
    }), [transfers, applied]);

    return (<div className="space-y-6">
      <PageHeader title="Transport / Material Movement" subtitle="Trip-wise material movement with transporter, vehicle, quantity and amount." guide={transportGuide} actions={<Button icon={Plus} onClick={openCreate}>
            Create Transport Trip
          </Button>}/>

      <div className="rounded-xl border border-[#e2eaf5] bg-white shadow-[0_1px_2px_rgba(16,42,82,0.05)]">
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-4 py-3 md:grid-cols-3 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400">From</span>
            <select value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none">
              {fromOptions.map((o) => <option key={o} value={o}>{o === 'All' ? 'All Locations' : o}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400">To</span>
            <select value={toFilter} onChange={(e) => setToFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none">
              {toOptions.map((o) => <option key={o} value={o}>{o === 'All' ? 'All Locations' : o}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] font-medium text-slate-700 outline-none">
              {['All', 'Completed', 'In Transit', 'Pending'].map((o) => <option key={o} value={o}>{o === 'All' ? 'All Status' : o}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400">From Date</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-slate-400">To Date</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none" />
          </label>
          <div className="flex items-end">
            <button onClick={() => setApplied({ from: fromFilter, to: toFilter, status: statusFilter, fromDate, toDate })} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-6 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]">
              <Search size={13} /> Search
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-500">
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5">Trip No.</th>
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">From</th>
                <th className="px-3 py-2.5">To</th>
                <th className="px-3 py-2.5">Material</th>
                <th className="px-3 py-2.5 text-right">Qty (M/Kg)</th>
                <th className="px-3 py-2.5">Transporter</th>
                <th className="px-3 py-2.5">Vehicle No.</th>
                <th className="px-3 py-2.5 text-right">Amount (₹)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, idx) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2.5"><button onClick={() => setViewing(t)} className="font-mono font-bold text-blue-600 hover:underline">{t.transferNumber}</button></td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{toDDMMYYYY(t.date)}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{t.sourceLocation}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-700 whitespace-nowrap">{t.destLocation}</td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{transferMaterial(t)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">{transferQty(t).toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{t.shippedBy || '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">{t.vehicleNo || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-slate-800">₹{transferAmount(t).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${statusPill(displayStatus(t))}`}>{displayStatus(t)}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewing(t)} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="View"><Eye size={14} /></button>
                      {t.status !== 'Received' && (<button onClick={() => markReceived(t.id)} className="px-2.5 py-1 rounded-lg bg-[#2563eb] text-white text-[11px] font-bold hover:bg-[#1d4ed8]" title="Confirm intake">Confirm</button>)}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-10 text-center">
                  <p className="text-[13px] font-extrabold text-[#17294e]">No records found</p>
                  <p className="mt-1 text-[11.5px] text-slate-400">There are no records matching your current filter criteria.</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl text-xs" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[15px] font-extrabold text-[#17294e]">Trip {viewing.transferNumber}</h3>
              <button onClick={() => setViewing(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {[['Date', toDDMMYYYY(viewing.date)], ['From', viewing.sourceLocation], ['To', viewing.destLocation], ['Material', transferMaterial(viewing)], ['Qty (M/Kg)', transferQty(viewing).toLocaleString('en-IN')], ['Transporter', viewing.shippedBy || '—'], ['Vehicle No.', viewing.vehicleNo || '—'], ['Amount (₹)', `₹${transferAmount(viewing).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`], ['Status', displayStatus(viewing)]].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10.5px] font-bold uppercase text-slate-400">{k}</dt>
                  <dd className="mt-0.5 text-[12px] font-bold text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex justify-end gap-2">
              {viewing.status !== 'Received' && (<button onClick={() => { markReceived(viewing.id); setViewing(null); }} className="rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]">Confirm Intake</button>)}
              <button onClick={() => setViewing(null)} className="rounded-lg bg-slate-100 px-4 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-4 sm:p-6 text-xs max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">
                Create Transport Trip
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trip No.</label>
                  <input type="text" readOnly value="Auto-Generate" className="w-full border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-500 font-medium cursor-not-allowed" />
                  <p className="text-[10px] text-slate-400 mt-1">Trip number is generated automatically on save.</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date *</label>
                  <input type="date" required value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                  <input type="text" value={transporter} onChange={(e) => setTransporter(e.target.value)} placeholder="e.g. Shree Transport" maxLength={100} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From *</label>
                  <input type="text" required value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="e.g. Vendor A" maxLength={120} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To *</label>
                  <input type="text" required value={toName} onChange={(e) => setToName(e.target.value)} placeholder="e.g. Oscar" maxLength={120} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material *</label>
                  <input type="text" required value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Cotton Grey" maxLength={120} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Qty (M/Kg) *</label>
                  <input type="text" inputMode="decimal" required value={moveQty} onChange={(e) => setMoveQty(e.target.value)} placeholder="e.g. 24640" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-right" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle Number</label>
                  <input type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. MH-12-AB-1234" maxLength={30} className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                  <input type="text" inputMode="decimal" value={moveAmount} onChange={(e) => setMoveAmount(e.target.value)} placeholder="e.g. 2000" className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-right" />
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-3 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded-lg font-bold shadow-sm">
                  Save Trip
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
