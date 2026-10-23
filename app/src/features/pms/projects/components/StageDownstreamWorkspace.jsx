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
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../../services/api';
import { usePmsStore } from '../../../../stores/pmsStore';
import { useERP } from '../../../../context/ERPContext';
import {
  fetchPlans,
  fetchJWOs,
  createJWORow,
  fetchPendingRegister,
  fetchVendorReconciliation,
  errorMessage,
} from '../../../../services/jobWorkSync';
import { ProcessPlanStageWorkspace } from './ProcessPlanStageWorkspace';

export function StageDownstreamWorkspace({
  project,
  stage,
  onSyncPipeline,
  onSelectStage,
  totalStages = 18,
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

  const isPlanStage = stageName.startsWith('Processing Plan');
  const isOutwardStage = stageName.includes('Outward');
  const isProcessingStage = stageName === 'Processing' || stageName === 'Processing (Dyeing)';
  const isInwardStage = stageName.includes('Inward');
  const isQCStage = stageName.includes('Quality') || stageName.includes('QC');
  const isDispatchStage = stageName.includes('Dispatch');
  const isInvoiceStage = stageName.includes('Invoice') || stageName.includes('Payment');
  const isClosureStage = stageName.includes('Closure');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pendingRegister, setPendingRegister] = useState([]);
  const [vendorReconciliation, setVendorReconciliation] = useState([]);
  const [qcInspections, setQcInspections] = useState([]);
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [agencies, setAgencies] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active JWO selector for multi-JWO projects
  const [selectedJwoId, setSelectedJwoId] = useState('');

  // Form states
  const [outwardForm, setOutwardForm] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    challanNo: '',
    vehicleNo: '',
    lrNo: '',
    transporter: '',
    driver: '',
    remarks: '',
    selectedTakas: [],
  });

  const [inwardForm, setInwardForm] = useState({
    date: new Date().toISOString().split('T')[0],
    quantity: '',
    accepted: '',
    rejected: '0',
    challanNo: '',
    rollCount: '',
    remarks: '',
  });

  const [qcForm, setQcForm] = useState({
    date: new Date().toISOString().split('T')[0],
    inspectionNumber: `QC-${Date.now().toString().slice(-6)}`,
    totalInspectedQty: '',
    passedQty: '',
    secondQualityQty: '0',
    reprocessQty: '0',
    rejectedQty: '0',
    qualityGrade: 'Grade A',
    defectsFound: '',
    notes: '',
  });

  const [dispatchForm, setDispatchForm] = useState({
    date: new Date().toISOString().split('T')[0],
    challanNumber: `DC-CUST-${Date.now().toString().slice(-6)}`,
    transporter: '',
    vehicleNo: '',
    lrNo: '',
    dispatchedQty: '',
    notes: '',
  });

  const loadData = async () => {
    if (!projectId) return;
    try {
      const [
        plansRes,
        jwoRes,
        prRes,
        vrRes,
        qcRes,
        salesRes,
        dcRes,
        agenciesRes,
      ] = await Promise.allSettled([
        fetchPlans().catch(() => []),
        fetchJWOs().catch(() => []),
        fetchPendingRegister(projectId).catch(() => []),
        fetchVendorReconciliation(projectId).catch(() => []),
        api.get('/inventory/qc-inspections/', { query: { page_size: 100 } }).catch(() => ({ results: [] })),
        api.get('/sales/invoices/', {
          query: project?.salesOrderId ? { sales_order: project.salesOrderId } : { page_size: 50 },
        }).catch(() => ({ data: [] })),
        api.get('/sales/delivery-challans/', {
          query: project?.salesOrderId ? { sales_order: project.salesOrderId } : { page_size: 50 },
        }).catch(() => ({ results: [] })),
        api.get('/masters/agencies/', { query: { page_size: 200 } }),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value) {
        setPlans(Array.isArray(plansRes.value) ? plansRes.value : []);
      }
      if (jwoRes.status === 'fulfilled' && jwoRes.value) {
        setOrders(Array.isArray(jwoRes.value) ? jwoRes.value : []);
      }
      if (prRes.status === 'fulfilled' && prRes.value) {
        setPendingRegister(Array.isArray(prRes.value) ? prRes.value : []);
      }
      if (vrRes.status === 'fulfilled' && vrRes.value) {
        setVendorReconciliation(Array.isArray(vrRes.value) ? vrRes.value : []);
      }
      if (qcRes.status === 'fulfilled' && qcRes.value) {
        const qList = qcRes.value?.results || qcRes.value?.data || [];
        setQcInspections(Array.isArray(qList) ? qList : []);
      }
      if (salesRes.status === 'fulfilled' && salesRes.value) {
        const invList = salesRes.value?.data || salesRes.value?.results || [];
        setSalesInvoices(Array.isArray(invList) ? invList : []);
      }
      if (dcRes.status === 'fulfilled' && dcRes.value) {
        const dList = dcRes.value?.results || dcRes.value?.data || [];
        setDeliveryChallans(Array.isArray(dList) ? dList : []);
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

  const projectOrders = useMemo(() => {
    return orders.filter(
      (o) => o.projectId === projectId || (o.remarks || '').includes(project?.code || '')
    );
  }, [orders, projectId, project?.code]);

  const activeJwo = useMemo(() => {
    if (selectedJwoId) {
      return projectOrders.find((o) => o.id === selectedJwoId) || projectOrders[0];
    }
    return projectOrders[0] || null;
  }, [projectOrders, selectedJwoId]);

  const projectPlans = useMemo(() => {
    return plans.filter(
      (p) => p.projectId === projectId || (p.remarks || '').includes(project?.code || '')
    );
  }, [plans, projectId, project?.code]);

  const realOutwards = useMemo(() => {
    const list = [];
    projectOrders.forEach((o) => {
      (o.outwards || []).forEach((out) => {
        list.push({
          ...out,
          jwoId: o.id,
          jwoNo: o.jwoNo,
          vendor: o.vendor || o.vendorName,
          process: o.process,
          plannedQty: o.plannedQty,
        });
      });
    });
    return list;
  }, [projectOrders]);

  const realInwards = useMemo(() => {
    const list = [];
    projectOrders.forEach((o) => {
      (o.inwards || []).forEach((inw) => {
        list.push({
          ...inw,
          jwoId: o.id,
          jwoNo: o.jwoNo,
          vendor: o.vendor || o.vendorName,
          process: o.process,
          plannedQty: o.plannedQty,
        });
      });
    });
    return list;
  }, [projectOrders]);

  const realLosses = useMemo(() => {
    const list = [];
    projectOrders.forEach((o) => {
      (o.lossEntries || []).forEach((loss) => {
        list.push({
          ...loss,
          jwoId: o.id,
          jwoNo: o.jwoNo,
          vendor: o.vendor || o.vendorName,
        });
      });
    });
    return list;
  }, [projectOrders]);

  const projectQCInspections = useMemo(() => {
    const inwardIds = new Set(realInwards.map((i) => String(i.id)));
    const inwardNos = new Set(realInwards.map((i) => i.no).filter(Boolean));
    return qcInspections.filter((q) => {
      if (q.source_document_type === 'JWO_INWARD') {
        if (q.source_document_id && inwardIds.has(String(q.source_document_id))) return true;
        if (q.source_document_number && inwardNos.has(q.source_document_number)) return true;
      }
      if ((q.notes || '').includes(project?.code || '')) return true;
      return false;
    });
  }, [qcInspections, realInwards, project?.code]);

  const projectReq = Number(project?.requirementMeters || project?.quantity || 2850);
  const allocatedGrey = Number(project?.allocatedMeters || project?.pipelineSummary?.allocated_meters || projectReq);
  const realOutwardSum = realOutwards.reduce((acc, out) => acc + (Number(out.qty) || 0), 0);
  const realInwardSum = realInwards.reduce((acc, inw) => acc + (Number(inw.qty) || 0), 0);
  const realAcceptedSum = realInwards.reduce((acc, inw) => acc + (Number(inw.accepted ?? inw.qty) || 0), 0);
  const realApprovedLossSum = realLosses
    .filter((l) => l.status === 'Approved')
    .reduce((acc, l) => acc + (Number(l.qty) || 0), 0);
  const pendingAtMill = Math.max(0, realOutwardSum - realInwardSum - realApprovedLossSum);

  const getStageIcon = () => {
    if (isPlanStage) return <ClipboardList size={20} className="text-blue-600" />;
    if (isOutwardStage) return <Truck size={20} className="text-amber-600" />;
    if (isProcessingStage) return <Cog size={20} className="text-indigo-600" />;
    if (isInwardStage) return <ArrowDownToLine size={20} className="text-teal-600" />;
    if (isQCStage) return <ShieldCheck size={20} className="text-emerald-600" />;
    if (isDispatchStage) return <Boxes size={20} className="text-orange-600" />;
    if (isInvoiceStage) return <IndianRupee size={20} className="text-purple-600" />;
    return <CheckCircle2 size={20} className="text-emerald-600" />;
  };

  // Pre-fill modals when opening
  const handleOpenModal = () => {
    if (isOutwardStage) {
      const target = activeJwo || projectOrders[0];
      const remainingPlanned = target
        ? Math.max(0, (Number(target.plannedQty) || projectReq) - realOutwardSum)
        : projectReq;
      const linkedPlan = projectPlans.find((p) => String(p.id) === String(target?.processPlanId)) || projectPlans[0];
      const availableTakas = linkedPlan?.selectedTakas || [];
      setOutwardForm({
        date: new Date().toISOString().split('T')[0],
        quantity: remainingPlanned || projectReq,
        challanNo: `DC-OUT-${Date.now().toString().slice(-5)}`,
        vehicleNo: 'GJ-05-BX-4921',
        lrNo: `LR-${Date.now().toString().slice(-5)}`,
        transporter: target?.vendor || agencies[0]?.name || 'Standard Transport',
        driver: '',
        remarks: `Dispatched outward for project ${project?.code || ''}`,
        selectedTakas: availableTakas,
      });
    } else if (isInwardStage) {
      setInwardForm({
        date: new Date().toISOString().split('T')[0],
        quantity: pendingAtMill || 500,
        accepted: pendingAtMill || 500,
        rejected: '0',
        challanNo: `DC-IN-${Date.now().toString().slice(-5)}`,
        rollCount: '10',
        remarks: `Received finished dyed fabric for project ${project?.code || ''}`,
      });
    } else if (isQCStage) {
      setQcForm({
        date: new Date().toISOString().split('T')[0],
        inspectionNumber: `QC-INSP-${Date.now().toString().slice(-5)}`,
        totalInspectedQty: realInwardSum || projectReq,
        passedQty: realInwardSum || projectReq,
        secondQualityQty: '0',
        reprocessQty: '0',
        rejectedQty: '0',
        qualityGrade: 'Grade A',
        defectsFound: 'None. Shade and finish within 4-point standard tolerance.',
        notes: `QC inspection for project ${project?.code || ''}`,
      });
    } else if (isDispatchStage) {
      setDispatchForm({
        date: new Date().toISOString().split('T')[0],
        challanNumber: `DC-CUST-${Date.now().toString().slice(-5)}`,
        transporter: 'V-Trans Logistics',
        vehicleNo: 'GJ-05-AX-9912',
        lrNo: `LR-${Date.now().toString().slice(-5)}`,
        dispatchedQty: realAcceptedSum || projectReq,
        notes: `Customer dispatch for sales order ${project?.salesOrderNumber || project?.code || ''}`,
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveOutward = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetOrder = activeJwo || projectOrders[0];
      if (!targetOrder) {
        throw new Error('Please create a Job Work Order in Stage 11 before dispatching outward.');
      }
      const qty = Number(outwardForm.quantity) || 0;
      if (qty <= 0) {
        throw new Error('Dispatch quantity must be greater than zero.');
      }

      const takasPayload = (outwardForm.selectedTakas || []).map((t) => ({
        lot_taka: t.lot_taka_id || t.id,
        meters: Number(t.quantity || t.meters || t.available_quantity || 0),
        weight_kg: t.roll_weight || t.weight_kg || null,
      }));

      await createJWORow(targetOrder.id, 'outwards', {
        date: outwardForm.date,
        qty: qty,
        challan_no: outwardForm.challanNo,
        lrNo: outwardForm.lrNo,
        transporter: outwardForm.transporter,
        vehicleNo: outwardForm.vehicleNo,
        driver: outwardForm.driver,
        status: 'Sent',
        remarks: outwardForm.remarks,
        ...(takasPayload.length > 0 ? { takas: takasPayload } : {}),
      });

      toast.success(
        `Job Work Outward Challan recorded for JWO ${targetOrder.jwoNo}. Moved to External WIP.`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save outward challan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveInward = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const targetOrder = activeJwo || projectOrders[0];
      if (!targetOrder) {
        throw new Error('No active Job Work Order found for this inward receipt.');
      }
      const qty = Number(inwardForm.quantity) || 0;
      const accepted = Number(inwardForm.accepted ?? inwardForm.quantity) || 0;
      const rejected = Number(inwardForm.rejected || 0);

      if (qty <= 0) {
        throw new Error('Received quantity must be greater than zero.');
      }
      if (accepted + rejected > qty) {
        throw new Error('Accepted + Rejected quantity cannot exceed total received quantity.');
      }

      await createJWORow(targetOrder.id, 'inwards', {
        date: inwardForm.date,
        qty: qty,
        accepted: accepted,
        rejected: rejected,
        challanNo: inwardForm.challanNo,
        status: 'Received',
        remarks: inwardForm.remarks,
      });

      toast.success(
        `Job Work Inward receipt recorded (${qty.toLocaleString('en-IN')} M). Material received into QC Hold stock.`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to record inward receipt.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveQC = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const inspected = Number(qcForm.totalInspectedQty) || 0;
      const passed = Number(qcForm.passedQty) || 0;
      const secondQuality = Number(qcForm.secondQualityQty) || 0;
      const reprocess = Number(qcForm.reprocessQty) || 0;
      const rejected = Number(qcForm.rejectedQty) || 0;

      const latestInward = realInwards[0];

      await api.post('/inventory/qc-inspections/', {
        inspection_number: qcForm.inspectionNumber,
        source_document_type: 'JWO_INWARD',
        source_document_id: latestInward ? latestInward.id : null,
        source_document_number: latestInward ? latestInward.no : null,
        inspection_date: qcForm.date,
        total_received_qty: inspected,
        total_inspected_qty: inspected,
        passed_qty: passed,
        second_quality_qty: secondQuality,
        reprocess_qty: reprocess,
        rejected_qty: rejected,
        quality_grade: qcForm.qualityGrade,
        defects_found: qcForm.defectsFound,
        status: passed > 0 ? 'Approved' : 'Rejected',
        notes: `${qcForm.notes} | Project: ${project?.code || ''}`,
      });

      toast.success(
        `QC Inspection ${qcForm.inspectionNumber} approved (${passed.toLocaleString('en-IN')} M Grade A passed).`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save QC inspection.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const qty = Number(dispatchForm.dispatchedQty) || 0;
      await api.post('/sales/delivery-challans/', {
        challan_number: dispatchForm.challanNumber,
        sales_order_id: project?.salesOrderId || null,
        challan_date: dispatchForm.date,
        transporter: dispatchForm.transporter,
        vehicle_no: dispatchForm.vehicleNo,
        lr_number: dispatchForm.lrNo,
        status: 'Dispatched',
        notes: dispatchForm.notes,
        total_quantity: qty,
      });

      toast.success(
        `Customer Delivery Challan ${dispatchForm.challanNumber} generated (${qty.toLocaleString('en-IN')} M dispatched).`
      );
      setIsModalOpen(false);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save delivery challan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseProject = async () => {
    if (!window.confirm(`Are you sure you want to mark project ${project?.code} as Completed & Closed?`)) {
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/pms/projects/${projectId}/close/`, {
        remarks: 'All 18 PMS stages completed, reconciliation balanced, and payment settled.',
      });
      toast.success(`Project ${project?.code} successfully completed and archived.`);
      await loadData();
      if (onSyncPipeline) await onSyncPipeline();
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to close project.'));
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
                    {stage?.status || 'In Progress'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {isPlanStage && 'Select lot/taka from grey stock and configure process, vendor, rate, tolerance, and return date.'}
                {isOutwardStage && 'Generate gate-pass and outward delivery challan to dispatch grey rolls to external processor WIP.'}
                {isProcessingStage && 'Real-time batch progress tracking, pending register, and mill ageing.'}
                {isInwardStage && 'Receive dyed/finished fabric back from processor, capture partial returns, and balance reconciliation.'}
                {isQCStage && 'Finished goods 4-point inspection, grade disposition (Grade A / Seconds / Reject), and stock allocation.'}
                {isDispatchStage && 'Warehouse packing, customer outbound delivery challan, transporter LR manifest, and shipping.'}
                {isInvoiceStage && 'Commercial dual-settlement: Customer sales invoice collections vs Processor job work charge payables.'}
                {isClosureStage && 'Final commercial audit verification, reconciliation balance confirmation, and project sign-off.'}
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

            {!isPlanStage && !isProcessingStage && !isClosureStage && !isInvoiceStage && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus size={13} />
                {isOutwardStage && 'New Outward Challan'}
                {isInwardStage && 'Record Inward Receipt'}
                {isQCStage && 'New QC Inspection'}
                {isDispatchStage && 'Create Delivery Challan'}
              </button>
            )}

            {isClosureStage && stage?.status !== 'Completed' && (
              <button
                type="button"
                onClick={handleCloseProject}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Complete & Close Project</span>
              </button>
            )}
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
              {isPlanStage || isOutwardStage ? 'Grey Allocated' : 'Dispatched to Processor'}
            </span>
            <span className="font-mono font-bold text-blue-700">
              {(isPlanStage || isOutwardStage ? allocatedGrey : realOutwardSum).toLocaleString('en-IN')} M
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {isInwardStage || isQCStage ? 'Received at Dock' : 'Current Stage Progress'}
            </span>
            <span className="font-mono font-bold text-emerald-700">
              {isInwardStage || isQCStage
                ? `${realInwardSum.toLocaleString('en-IN')} M`
                : stage?.status === 'Completed'
                ? '100% Complete'
                : `${stage?.completionPct || 0}% Executed`}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
            <span className="text-[11px] font-semibold text-slate-400 block">
              {isProcessingStage || isInwardStage ? 'Outstanding at Vendor' : 'Stage Weight'}
            </span>
            <span className="font-mono font-bold text-slate-700">
              {isProcessingStage || isInwardStage
                ? `${pendingAtMill.toLocaleString('en-IN')} M`
                : `${stage?.weight || 10}% of Lifecycle`}
            </span>
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

        {/* Stage 11: Processing Plan & Vendor Assignment */}
        {isPlanStage && (
          <ProcessPlanStageWorkspace
            project={project}
            stage={stage}
            onUpdated={() => onSyncPipeline && onSyncPipeline()}
            onSelectStage={onSelectStage}
          />
        )}

        {/* Stage 12: Job Work Outward */}
        {isOutwardStage && (
          <div className="space-y-4">
            {realOutwards.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">
                    Confirmed Outward Challans (External Job Work WIP)
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Total Dispatched:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {realOutwardSum.toLocaleString('en-IN')} M
                    </span>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-3">Challan No</th>
                        <th className="p-3">JWO No</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Processor</th>
                        <th className="p-3">Process</th>
                        <th className="p-3">Vehicle / Transporter</th>
                        <th className="p-3">LR / Bilty</th>
                        <th className="p-3 text-right">Dispatched Qty</th>
                        <th className="p-3 text-center">Stock Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {realOutwards.map((out, idx) => (
                        <tr key={out.id || idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-blue-700">{out.no || out.challanNo || `DC-OUT-${idx + 1}`}</td>
                          <td className="p-3 font-semibold text-slate-800">{out.jwoNo}</td>
                          <td className="p-3 font-sans text-slate-600">{out.date || '—'}</td>
                          <td className="p-3 font-sans font-medium text-slate-800">{out.vendor || '—'}</td>
                          <td className="p-3 font-sans text-slate-700">{out.process || 'Dyeing'}</td>
                          <td className="p-3 font-sans text-slate-600">
                            {[out.vehicleNo, out.transporter].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="p-3 text-slate-600">{out.lrNo || '—'}</td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {Number(out.qty || 0).toLocaleString('en-IN')} M
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              External WIP
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : projectOrders.length > 0 ? (
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      Job Work Orders Ready for Outward Dispatch ({projectOrders.length})
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Confirm physical vehicle, transporter, and dispatch challan to move stock from Godown to External WIP.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenModal}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1.5"
                  >
                    <Truck size={14} />
                    <span>Dispatch Outward Challan</span>
                  </button>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">JWO No</th>
                        <th className="p-2.5">Processor</th>
                        <th className="p-2.5">Process</th>
                        <th className="p-2.5 text-right">Planned Metres</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {projectOrders.map((ord) => (
                        <tr key={ord.id}>
                          <td className="p-2.5 font-bold text-blue-700">{ord.jwoNo}</td>
                          <td className="p-2.5 font-sans font-medium">{ord.vendor || '—'}</td>
                          <td className="p-2.5 font-sans">{ord.process || '—'}</td>
                          <td className="p-2.5 text-right font-bold">{Number(ord.plannedQty || 0).toLocaleString('en-IN')} M</td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedJwoId(ord.id);
                                handleOpenModal();
                              }}
                              className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-sans font-bold text-[11px] border border-blue-200 cursor-pointer"
                            >
                              Dispatch Now
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-6 text-center space-y-3">
                <p className="text-slate-600 text-xs">
                  No Job Work Order has been generated for this project yet. Please complete <strong>Stage 11: Processing Plan & Vendor Assignment</strong> first.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectStage && onSelectStage(11)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs cursor-pointer"
                >
                  <span>Go to Stage 11 (Processing Plan)</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stage 13: Processing (Live Vendor WIP Progress) */}
        {isProcessingStage && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Total Sent to Mill</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {realOutwardSum.toLocaleString('en-IN')} M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Received Back at Dock</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {realInwardSum.toLocaleString('en-IN')} M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Currently In-Process</span>
                <span className="font-mono font-bold text-blue-700 text-sm">
                  {pendingAtMill.toLocaleString('en-IN')} M
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">
                  Active Vendor Processing Register (Live WIP Tracking)
                </span>
                <span className="text-[11px] text-slate-500">
                  Data derived from actual JWO Outward & Inward records
                </span>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">JWO No</th>
                      <th className="p-3">Vendor / Processor</th>
                      <th className="p-3">Process</th>
                      <th className="p-3 text-right">Sent (M)</th>
                      <th className="p-3 text-right">Received (M)</th>
                      <th className="p-3 text-right">Pending at Mill (M)</th>
                      <th className="p-3">Expected Return</th>
                      <th className="p-3 text-center">Days Pending</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {projectOrders.length > 0 ? (
                      projectOrders.map((ord) => {
                        const sent = (ord.outwards || []).reduce((a, b) => a + (Number(b.qty) || 0), 0);
                        const rec = (ord.inwards || []).reduce((a, b) => a + (Number(b.qty) || 0), 0);
                        const pend = Math.max(0, sent - rec);
                        const isOverdue =
                          ord.expectedCompletion && new Date().toISOString().slice(0, 10) > ord.expectedCompletion;
                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-blue-700">{ord.jwoNo}</td>
                            <td className="p-3 font-sans font-medium text-slate-800">{ord.vendor || '—'}</td>
                            <td className="p-3 font-sans text-slate-700">{ord.process || 'Dyeing'}</td>
                            <td className="p-3 text-right font-bold">{sent.toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right text-emerald-700 font-bold">{rec.toLocaleString('en-IN')}</td>
                            <td className="p-3 text-right text-blue-700 font-bold">{pend.toLocaleString('en-IN')}</td>
                            <td className="p-3 font-sans text-slate-600">{ord.expectedCompletion || '—'}</td>
                            <td className="p-3 text-center">
                              {pend > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                  In Process
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                  0 Days
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {pend === 0 && sent > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Completed
                                </span>
                              ) : isOverdue ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  Overdue
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  In-Process
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-4 text-center font-sans text-slate-400">
                          No active Job Work Orders found for this project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {realOutwardSum > 0 && pendingAtMill > 0 && (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs">
                <div className="flex items-center gap-2 text-teal-800">
                  <ArrowDownToLine size={16} className="text-teal-600" />
                  <span>
                    Material is ready to be received back from the processor? Continue to <strong>Stage 14</strong> to record dock inward.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectStage && onSelectStage(14)}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <span>Go to Stage 14 (Job Work Inward)</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stage 14: Job Work Inward (Receive from Vendor) */}
        {isInwardStage && (
          <div className="space-y-4">
            {/* Reconciliation Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800">
                  Material Reconciliation (PDF §07: Sent − Received − Approved Loss = Closing Pending)
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    pendingAtMill === 0 && realOutwardSum > 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {pendingAtMill === 0 && realOutwardSum > 0 ? 'Fully Reconciled' : 'Inward Pending'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-slate-400 block font-semibold">Total Sent Outward</span>
                  <span className="font-bold text-slate-900">{realOutwardSum.toLocaleString('en-IN')} M</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-slate-400 block font-semibold">Received at Dock</span>
                  <span className="font-bold text-emerald-700">{realInwardSum.toLocaleString('en-IN')} M</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-slate-400 block font-semibold">Approved Losses</span>
                  <span className="font-bold text-slate-700">{realApprovedLossSum.toLocaleString('en-IN')} M</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] font-sans text-slate-400 block font-semibold">Closing Pending</span>
                  <span className={`font-bold ${pendingAtMill > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {pendingAtMill.toLocaleString('en-IN')} M
                  </span>
                </div>
              </div>
            </div>

            {/* Inward Receipts Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">
                  Inward Receipts (Received into SYS-QC-HOLD)
                </span>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>Record Inward</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Inward No</th>
                      <th className="p-3">JWO No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Vendor Challan</th>
                      <th className="p-3 text-right">Received M</th>
                      <th className="p-3 text-right">Accepted M</th>
                      <th className="p-3 text-right">Rejected M</th>
                      <th className="p-3 text-center">Holding Location</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {realInwards.length > 0 ? (
                      realInwards.map((inw, idx) => (
                        <tr key={inw.id || idx} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-teal-700">{inw.no || `JWIN-${idx + 1}`}</td>
                          <td className="p-3 font-semibold text-slate-800">{inw.jwoNo}</td>
                          <td className="p-3 font-sans text-slate-600">{inw.date || '—'}</td>
                          <td className="p-3 text-slate-700">{inw.challanNo || '—'}</td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {Number(inw.qty || 0).toLocaleString('en-IN')} M
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            {Number(inw.accepted ?? inw.qty).toLocaleString('en-IN')} M
                          </td>
                          <td className="p-3 text-right text-red-600">
                            {Number(inw.rejected || 0).toLocaleString('en-IN')} M
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              SYS-QC-HOLD
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              {inw.status || 'Received'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-4 text-center font-sans text-slate-400">
                          No inward receipts recorded yet. Click &quot;Record Inward&quot; above to capture returned fabric rolls.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Stage 15: Quality Check & Stock Allocation */}
        {isQCStage && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Total Inspected</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {projectQCInspections
                    .reduce((a, b) => a + (Number(b.total_inspected_qty) || 0), 0)
                    .toLocaleString('en-IN')} M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Passed Grade A</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {projectQCInspections
                    .reduce((a, b) => a + (Number(b.passed_qty) || 0), 0)
                    .toLocaleString('en-IN')} M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Second Quality / Reprocess</span>
                <span className="font-mono font-bold text-amber-700 text-sm">
                  {projectQCInspections
                    .reduce((a, b) => a + (Number(b.second_quality_qty || 0) + Number(b.reprocess_qty || 0)), 0)
                    .toLocaleString('en-IN')} M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] text-slate-400 block font-semibold">Rejected Qty</span>
                <span className="font-mono font-bold text-red-600 text-sm">
                  {projectQCInspections
                    .reduce((a, b) => a + (Number(b.rejected_qty) || 0), 0)
                    .toLocaleString('en-IN')} M
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs">
                  Finished Goods QC Inspections (4-Point Standard)
                </span>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>New Inspection</span>
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-3">Inspection No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Source Receipt</th>
                      <th className="p-3 text-right">Inspected M</th>
                      <th className="p-3 text-right">Passed M</th>
                      <th className="p-3">Quality Grade</th>
                      <th className="p-3">Defects / Observations</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {projectQCInspections.length > 0 ? (
                      projectQCInspections.map((qc) => (
                        <tr key={qc.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-emerald-700">{qc.inspection_number}</td>
                          <td className="p-3 font-sans text-slate-600">{qc.inspection_date || '—'}</td>
                          <td className="p-3 text-slate-700">{qc.source_document_number || 'JWO-INWARD'}</td>
                          <td className="p-3 text-right font-bold text-slate-900">
                            {Number(qc.total_inspected_qty || 0).toLocaleString('en-IN')} M
                          </td>
                          <td className="p-3 text-right font-bold text-emerald-700">
                            {Number(qc.passed_qty || 0).toLocaleString('en-IN')} M
                          </td>
                          <td className="p-3 font-sans font-semibold text-slate-800">{qc.quality_grade || 'Grade A'}</td>
                          <td className="p-3 font-sans text-slate-500 max-w-xs truncate">
                            {qc.defects_found || 'Standard 4-point pass'}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {qc.status || 'Approved'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-4 text-center font-sans text-slate-400">
                          No QC inspections logged yet. Click &quot;New Inspection&quot; to inspect fabric rolls held in SYS-QC-HOLD.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Stage 16: Customer Dispatch */}
        {isDispatchStage && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 text-xs">
                Outbound Customer Delivery Challans & Freight Manifest
              </span>
              <button
                type="button"
                onClick={handleOpenModal}
                className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Create Delivery Challan</span>
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Delivery Challan</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer / Consignee</th>
                    <th className="p-3">Transporter</th>
                    <th className="p-3">Vehicle No</th>
                    <th className="p-3">LR / Bilty</th>
                    <th className="p-3 text-right">Dispatched Meters</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {deliveryChallans.length > 0 ? (
                    deliveryChallans.map((dc) => (
                      <tr key={dc.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-orange-700">{dc.challan_number || dc.challanNumber}</td>
                        <td className="p-3 font-sans text-slate-600">{dc.challan_date || dc.date || '—'}</td>
                        <td className="p-3 font-sans font-semibold text-slate-800">
                          {project?.customerName || project?.customer || 'Fabrics International Ltd'}
                        </td>
                        <td className="p-3 font-sans text-slate-700">{dc.transporter || '—'}</td>
                        <td className="p-3 text-slate-700">{dc.vehicle_no || dc.vehicleNo || '—'}</td>
                        <td className="p-3 text-slate-600">{dc.lr_number || dc.lrNo || '—'}</td>
                        <td className="p-3 text-right font-bold text-slate-900">
                          {Number(dc.total_quantity || dc.totalQty || projectReq).toLocaleString('en-IN')} M
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {dc.status || 'Dispatched'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="p-4 text-center font-sans text-slate-400">
                        No delivery challans generated yet. Click &quot;Create Delivery Challan&quot; to ship finished goods to the customer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stage 17: Invoice & Payment Collection */}
        {isInvoiceStage && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Customer Sales Invoicing */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IndianRupee size={16} className="text-purple-600" />
                    <span className="font-bold text-slate-800 text-xs">Customer Sales Invoices & Collections</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-purple-700">
                    Target: ₹ {(projectReq * 125).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Invoice No</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-center">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {salesInvoices.length > 0 ? (
                        salesInvoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="p-2.5 font-bold text-purple-700">{inv.invoice_number || inv.invoiceNumber}</td>
                            <td className="p-2.5 font-sans text-slate-600">{inv.invoice_date || '—'}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              ₹ {Number(inv.total || inv.grandTotal || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {inv.status || 'Paid'}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-3 text-center font-sans text-slate-400">
                            No sales invoices generated yet for this project.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Processor Job Work Payables (Strictly Separated from Grey Fabric Bills) */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-blue-600" />
                    <span className="font-bold text-slate-800 text-xs">Processor Job Work Charges Payable</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-700">
                    Separate from Grey PO
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
                  <table className="w-full text-left font-mono">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">JWO No</th>
                        <th className="p-2.5">Processor</th>
                        <th className="p-2.5 text-right">Rate / M</th>
                        <th className="p-2.5 text-right">Job Work Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectOrders.length > 0 ? (
                        projectOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="p-2.5 font-bold text-blue-700">{ord.jwoNo}</td>
                            <td className="p-2.5 font-sans">{ord.vendor || '—'}</td>
                            <td className="p-2.5 text-right">₹ {Number(ord.rate || 14).toFixed(2)}</td>
                            <td className="p-2.5 text-right font-bold text-slate-900">
                              ₹ {Number(ord.totalAmount || (ord.plannedQty || projectReq) * 14).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-3 text-center font-sans text-slate-400">
                            No external processing charges recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stage 18: Project Closure */}
        {isClosureStage && (
          <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <h4 className="font-extrabold text-emerald-950 text-sm">
                Project Lifecycle Completion Audit & Sign-off
              </h4>
            </div>

            <p className="text-slate-600 font-medium">
              Verify that all physical and financial flows across the 18-stage lifecycle are balanced prior to archiving:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700 font-semibold">
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-emerald-100">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <span>Grey fabric allocated & verified against requirements.</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-emerald-100">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <span>Processor stock reconciled: Sent − Received = 0.</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-emerald-100">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <span>Finished goods QC passed & allocated to customer order.</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-emerald-100">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <span>Customer delivery challans dispatched with confirmed LR.</span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                Project Code: {project?.code} | Status: {project?.status || 'Active'}
              </span>
              {stage?.status !== 'Completed' && (
                <button
                  type="button"
                  onClick={handleCloseProject}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
                >
                  Confirm Full Sign-off & Close Project
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transaction Entry Modals */}
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

            {/* Outward Modal Form */}
            {isOutwardStage && (
              <form onSubmit={handleSaveOutward} className="p-5 space-y-4 text-xs">
                {projectOrders.length > 1 && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Job Work Order</label>
                    <select
                      value={selectedJwoId || activeJwo?.id || ''}
                      onChange={(e) => setSelectedJwoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    >
                      {projectOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.jwoNo} ({ord.vendor} — {ord.process} — {ord.plannedQty} M)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatch Quantity (M)</label>
                    <input
                      type="number"
                      required
                      value={outwardForm.quantity}
                      onChange={(e) => setOutwardForm({ ...outwardForm, quantity: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
                    <input
                      type="date"
                      required
                      value={outwardForm.date}
                      onChange={(e) => setOutwardForm({ ...outwardForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Outward Challan No</label>
                    <input
                      type="text"
                      required
                      value={outwardForm.challanNo}
                      onChange={(e) => setOutwardForm({ ...outwardForm, challanNo: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vehicle No</label>
                    <input
                      type="text"
                      value={outwardForm.vehicleNo}
                      onChange={(e) => setOutwardForm({ ...outwardForm, vehicleNo: e.target.value })}
                      placeholder="e.g. GJ-05-BX-4921"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                    <input
                      type="text"
                      value={outwardForm.transporter}
                      onChange={(e) => setOutwardForm({ ...outwardForm, transporter: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">LR / Bilty No</label>
                    <input
                      type="text"
                      value={outwardForm.lrNo}
                      onChange={(e) => setOutwardForm({ ...outwardForm, lrNo: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Remarks & Gate Pass Notes</label>
                  <textarea
                    rows={2}
                    value={outwardForm.remarks}
                    onChange={(e) => setOutwardForm({ ...outwardForm, remarks: e.target.value })}
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
                    {submitting ? 'Dispatching...' : 'Confirm Outward Dispatch'}
                  </button>
                </div>
              </form>
            )}

            {/* Inward Modal Form */}
            {isInwardStage && (
              <form onSubmit={handleSaveInward} className="p-5 space-y-4 text-xs">
                {projectOrders.length > 1 && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Select Job Work Order</label>
                    <select
                      value={selectedJwoId || activeJwo?.id || ''}
                      onChange={(e) => setSelectedJwoId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    >
                      {projectOrders.map((ord) => (
                        <option key={ord.id} value={ord.id}>
                          {ord.jwoNo} ({ord.vendor} — {ord.process})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Received Quantity (M)</label>
                    <input
                      type="number"
                      required
                      value={inwardForm.quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInwardForm({
                          ...inwardForm,
                          quantity: val,
                          accepted: val,
                        });
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Receipt Date</label>
                    <input
                      type="date"
                      required
                      value={inwardForm.date}
                      onChange={(e) => setInwardForm({ ...inwardForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Accepted Metres</label>
                    <input
                      type="number"
                      required
                      value={inwardForm.accepted}
                      onChange={(e) => setInwardForm({ ...inwardForm, accepted: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-emerald-700 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Rejected Metres</label>
                    <input
                      type="number"
                      value={inwardForm.rejected}
                      onChange={(e) => setInwardForm({ ...inwardForm, rejected: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-red-600 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vendor Challan No</label>
                    <input
                      type="text"
                      required
                      value={inwardForm.challanNo}
                      onChange={(e) => setInwardForm({ ...inwardForm, challanNo: e.target.value })}
                      placeholder="e.g. DC-IN-4902"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Rolls Count</label>
                    <input
                      type="number"
                      value={inwardForm.rollCount}
                      onChange={(e) => setInwardForm({ ...inwardForm, rollCount: e.target.value })}
                      placeholder="10"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inward Notes & Observations</label>
                  <textarea
                    rows={2}
                    value={inwardForm.remarks}
                    onChange={(e) => setInwardForm({ ...inwardForm, remarks: e.target.value })}
                    placeholder="Shrinkage, shade tone, dock inspection notes..."
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
                    className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Recording Inward...' : 'Confirm Inward Receipt'}
                  </button>
                </div>
              </form>
            )}

            {/* QC Modal Form */}
            {isQCStage && (
              <form onSubmit={handleSaveQC} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inspection Number</label>
                    <input
                      type="text"
                      required
                      value={qcForm.inspectionNumber}
                      onChange={(e) => setQcForm({ ...qcForm, inspectionNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Inspection Date</label>
                    <input
                      type="date"
                      required
                      value={qcForm.date}
                      onChange={(e) => setQcForm({ ...qcForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Total Inspected Qty (M)</label>
                    <input
                      type="number"
                      required
                      value={qcForm.totalInspectedQty}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQcForm({ ...qcForm, totalInspectedQty: val, passedQty: val });
                      }}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Passed Grade A (M)</label>
                    <input
                      type="number"
                      required
                      value={qcForm.passedQty}
                      onChange={(e) => setQcForm({ ...qcForm, passedQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-emerald-700 font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">2nd Quality (M)</label>
                    <input
                      type="number"
                      value={qcForm.secondQualityQty}
                      onChange={(e) => setQcForm({ ...qcForm, secondQualityQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Reprocess (M)</label>
                    <input
                      type="number"
                      value={qcForm.reprocessQty}
                      onChange={(e) => setQcForm({ ...qcForm, reprocessQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Rejected (M)</label>
                    <input
                      type="number"
                      value={qcForm.rejectedQty}
                      onChange={(e) => setQcForm({ ...qcForm, rejectedQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono text-red-600 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quality Grade</label>
                  <select
                    value={qcForm.qualityGrade}
                    onChange={(e) => setQcForm({ ...qcForm, qualityGrade: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                  >
                    <option value="Grade A">Grade A (Passed Export Quality)</option>
                    <option value="Grade B">Grade B (Standard Commercial)</option>
                    <option value="Second Quality">Second Quality (Discounted)</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Defects & 4-Point Report</label>
                  <textarea
                    rows={2}
                    value={qcForm.defectsFound}
                    onChange={(e) => setQcForm({ ...qcForm, defectsFound: e.target.value })}
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
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Approving QC...' : 'Approve QC & Allocate Stock'}
                  </button>
                </div>
              </form>
            )}

            {/* Dispatch Modal Form */}
            {isDispatchStage && (
              <form onSubmit={handleSaveDispatch} className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Delivery Challan No</label>
                    <input
                      type="text"
                      required
                      value={dispatchForm.challanNumber}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, challanNumber: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatch Date</label>
                    <input
                      type="date"
                      required
                      value={dispatchForm.date}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, date: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dispatched Quantity (M)</label>
                    <input
                      type="number"
                      required
                      value={dispatchForm.dispatchedQty}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchedQty: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Transporter</label>
                    <input
                      type="text"
                      value={dispatchForm.transporter}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, transporter: e.target.value })}
                      placeholder="e.g. V-Trans Logistics"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vehicle No</label>
                    <input
                      type="text"
                      value={dispatchForm.vehicleNo}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
                      placeholder="e.g. GJ-05-BX-4921"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">LR / Bilty No</label>
                    <input
                      type="text"
                      value={dispatchForm.lrNo}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, lrNo: e.target.value })}
                      placeholder="e.g. LR-9402"
                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Dispatch Remarks</label>
                  <textarea
                    rows={2}
                    value={dispatchForm.notes}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
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
                    className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? 'Generating Challan...' : 'Confirm Customer Dispatch'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default StageDownstreamWorkspace;
