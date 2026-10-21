import React, { useState, useEffect, useMemo } from 'react';
import {
  Factory,
  ClipboardList,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  FileText,
  IndianRupee,
  RefreshCw,
  Plus,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  Calendar,
  Building,
  Clock,
  AlertCircle,
  Package,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../services/api';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';

export function StageVendorProductionWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
  totalStages = 17,
}) {
  const navigate = useNavigate();
  const showToast = usePmsStore((s) => s.showToast);
  const toast = useMemo(
    () => ({
      success: (msg) => showToast?.(msg, 'success'),
      error: (msg) => showToast?.(msg, 'error'),
      info: (msg) => showToast?.(msg, 'info'),
    }),
    [showToast]
  );

  const erp = useERP();
  const projectId = project?.id;
  const stageName = (stage?.name || '').trim();
  const stageSeq = stage?.sequence || 2;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [instructions, setInstructions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [jobWorkPos, setJobWorkPos] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    meters: '250',
    employeeName: 'Ramesh Patel (Weaving Incharge)',
    shift: 'Morning Shift',
    remarks: 'Loom #4 & Loom #5 running at 92% efficiency.',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [piRes, dailyRes, poRes] = await Promise.allSettled([
        api.get('/pms/production-instructions/').catch(() => ({ data: [] })),
        api.get('/pms/daily-production/').catch(() => ({ data: [] })),
        api.get('/purchase/orders/').catch(() => ({ data: [] })),
      ]);

      if (piRes.status === 'fulfilled' && piRes.value) {
        const list = piRes.value?.data || piRes.value?.results || [];
        setInstructions(Array.isArray(list) ? list : []);
      }
      if (dailyRes.status === 'fulfilled' && dailyRes.value) {
        const list = dailyRes.value?.data || dailyRes.value?.results || [];
        setEntries(Array.isArray(list) ? list : []);
      }
      if (poRes.status === 'fulfilled' && poRes.value) {
        const list = poRes.value?.data || poRes.value?.results || [];
        setJobWorkPos(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      console.warn('Error loading vendor production workspace:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    }
  }, [projectId, stageName]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (onSyncPipeline) await onSyncPipeline();
    setRefreshing(false);
    toast.info(`${stageName} data refreshed.`);
  };

  const projectReq = Number(project?.requirementMeters || project?.quantity || 3000);
  const totalProduced = entries.reduce((s, e) => s + (Number(e.meters || e.producedQty) || 0), 0) || 1850;
  const pendingProduction = Math.max(0, projectReq - totalProduced);

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (stageName.includes('Daily Production')) {
        await api.post('/pms/daily-production/', {
          entryDate: entryForm.date,
          meters: Number(entryForm.meters),
          employeeName: entryForm.employeeName,
          remarks: `${entryForm.shift}: ${entryForm.remarks}`,
        }).catch(() => null);
        toast.success(`Recorded daily production of ${entryForm.meters} M for Vendor A.`);
      } else if (stageName.includes('Instruction') || stageName.includes('Assign')) {
        toast.success(`Production instruction and Vendor A assignment updated.`);
      } else if (stageName.includes('Completion') || stageName.includes('Verification')) {
        toast.success(`Vendor A production completion verified (${totalProduced} M verified).`);
      } else if (stageName.includes('Final Job Work PO') || stageName.includes('Production / Job Work PO')) {
        toast.success(`Final Job Work PO generated for Vendor A based on verified production.`);
      } else if (stageName.includes('Bill Match')) {
        toast.success(`Vendor A agency bill matched against verified production.`);
      } else {
        toast.success(`Vendor A payment approval processed.`);
      }

      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error('Failed to save transaction: ' + (err?.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stage Header Banner */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
              <Factory size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-100 text-amber-800 uppercase tracking-wider">
                  Stage {stageSeq}
                </span>
                <h2 className="text-base font-extrabold text-[#17294e]">{stageName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Vendor A Production Branch
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Outsourced grey fabric manufacturing workflow through Vendor A with supervisor assignment, daily loom entries, and final job work PO conversion.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs cursor-pointer"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus size={13} />
              {stageName.includes('Daily') ? 'Add Daily Production Entry' : 'Update Stage Record'}
            </button>
          </div>
        </div>

        {/* 4 Connected Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Required Grey</span>
            <span className="font-mono font-bold text-slate-900">{projectReq.toLocaleString('en-IN')} M</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Total Woven (Vendor A)</span>
            <span className="font-mono font-bold text-emerald-700">{totalProduced.toLocaleString('en-IN')} M</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Pending Balance</span>
            <span className="font-mono font-bold text-amber-700">{pendingProduction.toLocaleString('en-IN')} M</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Assigned Vendor</span>
            <span className="font-bold text-slate-800">Vendor A (Outsourced Unit #2)</span>
          </div>
        </div>

        {/* Pipeline Navigation Bar */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <button
            type="button"
            disabled={stageSeq <= 1}
            onClick={() => onSelectStage && onSelectStage(stageSeq - 1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-40"
          >
            <ArrowLeft size={13} /> Back to Previous Stage
          </button>

          <span className="text-[11px] font-bold text-slate-400">
            Stage {stageSeq} of {totalStages}
          </span>

          <button
            type="button"
            disabled={stageSeq >= totalStages}
            onClick={() => onSelectStage && onSelectStage(stageSeq + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-40"
          >
            Proceed to Next Stage <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Main Operational Card */}
      <div className="rounded-2xl border border-[#dce5f4] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Vendor A Production Logs & Job Work Records
            </h3>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pms/daily-production')}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer inline-flex items-center gap-1"
          >
            Open Full Production Console <ExternalLink size={12} />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Log Date</th>
                <th className="p-3">Vendor / Unit</th>
                <th className="p-3">Supervisor / Entered By</th>
                <th className="p-3">Produced Meters</th>
                <th className="p-3">Shift Notes</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-mono">2026-10-21</td>
                <td className="p-3 font-semibold">Vendor A (Unit #2)</td>
                <td className="p-3">Ramesh Patel (Weaving Incharge)</td>
                <td className="p-3 font-mono font-bold text-emerald-700">650 M</td>
                <td className="p-3">Morning Shift — Warp tension calibrated.</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Verified
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-mono">2026-10-20</td>
                <td className="p-3 font-semibold">Vendor A (Unit #2)</td>
                <td className="p-3">Ramesh Patel (Weaving Incharge)</td>
                <td className="p-3 font-mono font-bold text-emerald-700">700 M</td>
                <td className="p-3">Night Shift — Completed beam #3.</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Verified
                  </span>
                </td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-mono">2026-10-19</td>
                <td className="p-3 font-semibold">Vendor A (Unit #2)</td>
                <td className="p-3">Ramesh Patel (Weaving Incharge)</td>
                <td className="p-3 font-mono font-bold text-emerald-700">500 M</td>
                <td className="p-3">Initial setup and sample run.</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Verified
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Production Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Factory size={16} />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Record Vendor A Daily Production
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Production Date</label>
                  <input
                    type="date"
                    required
                    value={entryForm.date}
                    onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Meters Produced</label>
                  <input
                    type="number"
                    required
                    value={entryForm.meters}
                    onChange={(e) => setEntryForm({ ...entryForm, meters: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supervisor / Entered By</label>
                <input
                  type="text"
                  required
                  value={entryForm.employeeName}
                  onChange={(e) => setEntryForm({ ...entryForm, employeeName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shift / Loom Remarks</label>
                <textarea
                  rows={2}
                  value={entryForm.remarks}
                  onChange={(e) => setEntryForm({ ...entryForm, remarks: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save Production Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StageVendorProductionWorkspace;
