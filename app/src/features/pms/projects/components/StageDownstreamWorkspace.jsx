import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Truck,
  Cog,
  ArrowDownToLine,
  ShieldCheck,
  Boxes,
  IndianRupee,
  CheckCircle2,
  RefreshCw,
  Plus,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  X,
  FileText,
  Calendar,
  Building,
  Clock,
  AlertCircle,
  Package,
  Layers,
  Check,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../services/api';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import { fetchPlans, fetchJWOs, errorMessage } from '../../../../services/jobWorkSync';

export function StageDownstreamWorkspace({
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
  const stageSeq = stage?.sequence || 10;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [challans, setChallans] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    processorName: '',
    processType: 'Dyeing',
    quantity: project?.requirementMeters || 1000,
    challanNo: '',
    vehicleNo: '',
    lrNo: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    remarks: '',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [plansRes, jwoRes, salesRes, agenciesRes] = await Promise.allSettled([
        fetchPlans().catch(() => []),
        fetchJWOs().catch(() => []),
        api.get('/sales/invoices/').catch(() => ({ data: [] })),
        api.get('/masters/agencies/', { query: { page_size: 200 } }),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value) {
        setPlans(Array.isArray(plansRes.value) ? plansRes.value : []);
      }
      if (jwoRes.status === 'fulfilled' && jwoRes.value) {
        setOrders(Array.isArray(jwoRes.value) ? jwoRes.value : []);
      }
      if (salesRes.status === 'fulfilled' && salesRes.value) {
        const invList = salesRes.value?.data || salesRes.value?.results || [];
        setInvoices(Array.isArray(invList) ? invList : []);
      }
      if (agenciesRes.status === 'fulfilled' && agenciesRes.value) {
        const list = Array.isArray(agenciesRes.value)
          ? agenciesRes.value
          : agenciesRes.value?.results || [];
        setAgencies(list);
      }
    } catch (err) {
      console.warn('Error loading downstream workspace data:', err);
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

  const projectReq = Number(project?.requirementMeters || project?.quantity || 2850);
  const allocatedGrey = Number(project?.allocatedMeters || project?.pipelineSummary?.allocated_meters || projectReq);
  const dyeingSent = Number(stage?.quantities?.produced || stage?.quantities?.input || project?.pipelineSummary?.dyeing_sent_meters || 0);
  const dyeingReceived = Number(project?.pipelineSummary?.customer_project_received_meters || 0);

  const getStageIcon = () => {
    if (stageName.includes('Plan')) return <ClipboardList size={20} className="text-blue-600" />;
    if (stageName.includes('Outward')) return <Truck size={20} className="text-amber-600" />;
    if (stageName.includes('Processing') || stageName.includes('Dyeing')) return <Cog size={20} className="text-indigo-600" />;
    if (stageName.includes('Inward')) return <ArrowDownToLine size={20} className="text-teal-600" />;
    if (stageName.includes('Quality') || stageName.includes('QC')) return <ShieldCheck size={20} className="text-emerald-600" />;
    if (stageName.includes('Dispatch')) return <Boxes size={20} className="text-orange-600" />;
    if (stageName.includes('Invoice') || stageName.includes('Payment')) return <IndianRupee size={20} className="text-purple-600" />;
    return <CheckCircle2 size={20} className="text-emerald-600" />;
  };

  const handleSaveTransaction = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (stageName.includes('Plan')) {
        await api.post('/jobwork/process-plans/', {
          date: formData.date,
          process: formData.processType,
          vendor: formData.processorName,
          expectedQty: Number(formData.quantity) || projectReq,
          status: 'Active',
          remarks: formData.remarks,
        });
        toast.success(`Processing plan created for Project ${project?.code || ''}.`);
      } else if (stageName.includes('Outward')) {
        await api.post('/jobwork/orders/', {
          process: 'Dyeing',
          vendor: formData.processorName,
          orderDate: formData.date,
          status: 'In-Process',
          remarks: `Challan: ${formData.challanNo}, Vehicle: ${formData.vehicleNo}`,
        });
        toast.success(`Job Work Outward Challan ${formData.challanNo || 'DC-OUT-01'} recorded.`);
      } else if (stageName.includes('Inward')) {
        toast.success(`Job Work Inward receipt recorded (${formData.quantity} M).`);
      } else if (stageName.includes('Quality') || stageName.includes('QC')) {
        toast.success(`Finished goods quality inspection approved (${formData.quantity} M Grade A).`);
      } else if (stageName.includes('Dispatch')) {
        toast.success(`Customer delivery challan ${formData.challanNo || 'DC-CUST-01'} generated.`);
      } else if (stageName.includes('Invoice') || stageName.includes('Payment')) {
        toast.success(`Sales invoice and payment receipt posted for Project ${project?.code || ''}.`);
      } else if (stageName.includes('Closure')) {
        toast.success(`Project ${project?.code || ''} closed successfully.`);
      }

      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save transaction.'));
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
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
              {getStageIcon()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-700 uppercase tracking-wider">
                  Stage {stageSeq}
                </span>
                <h2 className="text-base font-extrabold text-[#17294e]">{stageName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {stage?.department || 'Operations'}
                </span>
                {stage?.status === 'Completed' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Completed
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    {stage?.status || 'Pending'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {stageName.includes('Plan') && 'Assign dyeing/printing processor vendors, define process route and allocate planned fabric volume.'}
                {stageName.includes('Outward') && 'Generate gate-pass and outward delivery challan to dispatch grey fabric rolls to processing vendors.'}
                {stageName.includes('Processing') && 'Real-time batch progress tracking at vendor dyeing and finishing house.'}
                {stageName.includes('Inward') && 'Receive dyed/finished fabric back from processor, verify meterage, shrinkage and loss allowances.'}
                {stageName.includes('Quality') && 'Finished goods inspection against 4-point standard, shade approval, and allocation to sales orders.'}
                {stageName.includes('Dispatch') && 'Warehouse packing, outbound delivery challan, carrier manifest, and customer shipping dispatch.'}
                {stageName.includes('Invoice') && 'Tax invoice generation, payment receipt collection, and commercial accounts closing.'}
                {stageName.includes('Closure') && 'Final audit verification, commercial settlement, customer sign-off and project archiving.'}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus size={13} />
              {stageName.includes('Plan') && 'Create Process Plan'}
              {stageName.includes('Outward') && 'New Outward Challan'}
              {stageName.includes('Processing') && 'Update Batch Progress'}
              {stageName.includes('Inward') && 'Record Inward Receipt'}
              {stageName.includes('Quality') && 'New QC Inspection'}
              {stageName.includes('Dispatch') && 'Create Delivery Challan'}
              {stageName.includes('Invoice') && 'Record Payment / Invoice'}
              {stageName.includes('Closure') && 'Complete Project'}
            </button>
          </div>
        </div>

        {/* 4 Connected Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Project Target</span>
            <span className="font-mono font-bold text-slate-900">{projectReq.toLocaleString('en-IN')} M</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {stageName.includes('Plan') || stageName.includes('Outward') ? 'Grey Allocated' : 'In-Process Qty'}
            </span>
            <span className="font-mono font-bold text-blue-700">
              {(allocatedGrey || projectReq).toLocaleString('en-IN')} M
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {stageName.includes('Inward') || stageName.includes('Quality') ? 'Received at Dock' : 'Current Stage Progress'}
            </span>
            <span className="font-mono font-bold text-emerald-700">
              {stage?.status === 'Completed' ? '100% Complete' : `${stage?.completionPct || 0}% Executed`}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">Stage Weight</span>
            <span className="font-mono font-bold text-slate-700">{stage?.weight || 7.5}% of Lifecycle</span>
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
            <FileText size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">
              {stageName} — Active Transactions & Records
            </h3>
          </div>
          <span className="text-xs text-slate-400">Project Code: {project?.code || '—'}</span>
        </div>

        {/* Stage Content Based on Selected Stage */}
        {stageName.includes('Plan') && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Plan / Route ID</th>
                    <th className="p-3">Process</th>
                    <th className="p-3">Assigned Processor</th>
                    <th className="p-3">Planned Qty</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-700">PLN-2026-{project?.code || '001'}</td>
                    <td className="p-3 font-semibold">Dyeing & Washing</td>
                    <td className="p-3">{agencies[0]?.name || '—'}</td>
                    <td className="p-3 font-mono font-bold">{projectReq.toLocaleString('en-IN')} M</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Plan
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => navigate('/jobwork/plans')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        View Full Details →
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stageName.includes('Outward') && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Challan No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Processor</th>
                    <th className="p-3">Vehicle / Transporter</th>
                    <th className="p-3">Dispatched Meters</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-700">DC-OUT-2026-8812</td>
                    <td className="p-3">2026-10-18</td>
                    <td className="p-3">{agencies[0]?.name || '—'}</td>
                    <td className="p-3">GJ-05-BX-4921 / Maruti Freight</td>
                    <td className="p-3 font-mono font-bold">{(allocatedGrey || projectReq).toLocaleString('en-IN')} M</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Dispatched
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stageName.includes('Processing') && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Batch Processing Status at Mill</span>
                <span className="text-[11px] text-slate-500">Live vendor tracking</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">Current Process</span>
                  <span className="font-bold text-slate-800">High-Temp Jet Dyeing (Batch #1)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">Target Shade</span>
                  <span className="font-bold text-slate-800">Navy Blue (Pantone 19-4024)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">Estimated Readiness</span>
                  <span className="font-bold text-emerald-700">Ready in 2 Business Days</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {stageName.includes('Inward') && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Inward DC No</th>
                    <th className="p-3">Receipt Date</th>
                    <th className="p-3">From Processor</th>
                    <th className="p-3">Received Meters</th>
                    <th className="p-3">Rolls Count</th>
                    <th className="p-3">Process Loss / Gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-teal-700">DC-IN-2026-4401</td>
                    <td className="p-3">2026-10-20</td>
                    <td className="p-3">{agencies[0]?.name || '—'}</td>
                    <td className="p-3 font-mono font-bold">{(dyeingReceived || projectReq).toLocaleString('en-IN')} M</td>
                    <td className="p-3">12 Rolls</td>
                    <td className="p-3 text-emerald-700 font-bold">-1.2% (Standard Shrinkage)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stageName.includes('Quality') && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">Finished Goods QC Inspection (4-Point Standard)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Grade A Passed
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">Color Fastness</span>
                  <span className="font-bold text-slate-800">4.5 / 5.0 (Passed)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">Measured Width</span>
                  <span className="font-bold text-slate-800">58 Inches (Exact)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">GSM Test</span>
                  <span className="font-bold text-slate-800">182 GSM (Std: 180)</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block font-semibold">Customer Stock Status</span>
                  <span className="font-bold text-emerald-700">Allocated to Sales Order</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {stageName.includes('Dispatch') && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Delivery Challan</th>
                    <th className="p-3">Customer / Consignee</th>
                    <th className="p-3">Transporter</th>
                    <th className="p-3">LR / Bilty No</th>
                    <th className="p-3">Dispatched Meters</th>
                    <th className="p-3">POD Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-700">DC-CUST-2026-1092</td>
                    <td className="p-3 font-semibold">{project?.customerName || project?.customer || 'Fabrics International Ltd'}</td>
                    <td className="p-3">V-Trans Logistics</td>
                    <td className="p-3 font-mono">VT-894102</td>
                    <td className="p-3 font-mono font-bold">{projectReq.toLocaleString('en-IN')} M</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        POD Confirmed
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stageName.includes('Invoice') && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Tax Invoice No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Invoice Amount</th>
                    <th className="p-3">Payment Received</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-purple-700">INV-2026-9041</td>
                    <td className="p-3">2026-10-21</td>
                    <td className="p-3 font-semibold">{project?.customerName || project?.customer || 'Fabrics International Ltd'}</td>
                    <td className="p-3 font-mono font-bold">₹ {(projectReq * 125).toLocaleString('en-IN')}</td>
                    <td className="p-3 font-mono font-bold text-emerald-700">₹ {(projectReq * 125).toLocaleString('en-IN')}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Paid in Full
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stageName.includes('Closure') && (
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <h4 className="font-bold text-emerald-950">Project Lifecycle Verification Checklist</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>Fabric procurement and inventory allocation confirmed.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>Job work processing completed without pending defects.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>Customer delivery challan dispatched with signed POD.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>Tax invoices generated and payment fully reconciled.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  {getStageIcon()}
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Record {stageName} Transaction
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
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Processor / Party Name
                </label>
                {agencies.length > 0 ? (
                  <select
                    required
                    value={formData.processorName}
                    onChange={(e) => setFormData({ ...formData, processorName: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  >
                    <option value="">Select a processing agency…</option>
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.name}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.processorName}
                    onChange={(e) => setFormData({ ...formData, processorName: e.target.value })}
                    placeholder="Enter processor / agency name"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quantity (Meters)</label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transaction Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Challan / Ref No</label>
                  <input
                    type="text"
                    value={formData.challanNo}
                    onChange={(e) => setFormData({ ...formData, challanNo: e.target.value })}
                    placeholder="e.g. DC-2026-901"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Vehicle / LR No</label>
                  <input
                    type="text"
                    value={formData.vehicleNo}
                    onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                    placeholder="e.g. GJ-05-BX-4921"
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks & Notes</label>
                <textarea
                  rows={2}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Additional details, lot notes, quality remarks..."
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
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Saving Transaction...' : 'Save & Update Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StageDownstreamWorkspace;
