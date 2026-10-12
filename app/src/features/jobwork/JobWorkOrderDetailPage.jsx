import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Printer,
  MoreVertical,
  MoreHorizontal,
  Calendar,
  ChevronUp,
  X,
  Trash2,
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  Truck,
  Eye,
  MapPin,
  AlertCircle,
  ShoppingCart,
  IndianRupee,
  Layers,
  Download,
  ExternalLink,
} from 'lucide-react';
import {
  loadJWOs,
  saveJWOs,
  syncJWOToBackend,
  jwoKpis,
  numIN,
  toDDMMYYYY,
} from './jobWorkOrdersStore';
import PageHeader from '../../components/ui/PageHeader';

const TABS = [
  'Material Details',
  'Outward Challans',
  'Inward Receipts',
  'Production / WIP',
  'Charges',
  'Documents',
  'Remarks',
];

const statusPill = (s) => {
  if (s === 'Sent' || s === 'Received' || s === 'Completed') return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  if (s === 'In-Process') return 'bg-rose-50 text-rose-500 border-rose-200';
  if (s === 'Draft') return 'bg-amber-50 text-amber-600 border-amber-200';
  return 'bg-blue-50 text-blue-600 border-blue-200';
};

const nextOutwardNo = (outwards = []) => {
  const max = (outwards || []).reduce((m, o) => {
    const num = Number(String(o.no || '').replace(/\D/g, '')) || 0;
    return Math.max(m, num);
  }, 0);
  return `JWO-OUT-${String(max + 1).padStart(3, '0')}`;
};

const nextInwardNo = (inwards = []) => {
  const max = (inwards || []).reduce((m, r) => {
    const num = Number(String(r.no || '').replace(/\D/g, '')) || 0;
    return Math.max(m, num);
  }, 0);
  return `JWO-IN-${String(max + 1).padStart(3, '0')}`;
};

export default function JobWorkOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState(loadJWOs);
  const [tab, setTab] = useState('Inward Receipts');

  // Backend-first: refresh from GET /jobwork/orders/ when logged in.
  useEffect(() => {
    let live = true;
    import('./jobWorkOrdersStore').then(({ loadJWOsAsync }) =>
      loadJWOsAsync().then((rows) => {
        if (live && Array.isArray(rows)) setOrders(rows);
      }),
    );
    return () => { live = false; };
  }, []);

  // Modals state
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const [showOutwardModal, setShowOutwardModal] = useState(false);
  const [editingOutward, setEditingOutward] = useState(null);
  const [viewingOutward, setViewingOutward] = useState(null);

  const [showInwardModal, setShowInwardModal] = useState(false);
  const [editingInward, setEditingInward] = useState(null);
  const [viewingInward, setViewingInward] = useState(null);

  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editingCharge, setEditingCharge] = useState(null);
  const [viewingCharge, setViewingCharge] = useState(null);

  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    type: 'QC Report',
    no: '',
    date: new Date().toISOString().slice(0, 10),
    fileName: 'QC_Report.pdf',
    uploadedBy: 'Admin',
    file: null,
    fileDataUrl: '',
  });

  const [showEditHeader, setShowEditHeader] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // Form states for modals
  const [materialForm, setMaterialForm] = useState({
    fabricItem: '',
    fabricQuality: '',
    shade: '',
    lotNo: '',
    qty: '',
    rate: '',
  });

  const [outwardForm, setOutwardForm] = useState({
    no: '',
    date: new Date().toISOString().slice(0, 10),
    qty: '',
    lrNo: '',
    transporter: '',
    status: 'Sent',
  });

  const [inwardForm, setInwardForm] = useState({
    no: '',
    date: new Date().toISOString().slice(0, 10),
    qty: '',
    accepted: '',
    rejected: '0',
    challanNo: '',
    status: 'Received',
  });

  const [chargeForm, setChargeForm] = useState({
    type: '',
    description: '',
    rate: '',
    qty: '',
    status: 'Active',
  });

  const [headerForm, setHeaderForm] = useState({
    process: '',
    vendor: '',
    orderDate: '',
    expectedCompletion: '',
    status: '',
  });

  const [remarksText, setRemarksText] = useState('');

  const jwo = useMemo(
    () => orders.find((o) => String(o.id) === String(id) || String(o.jwoNo) === String(id)),
    [orders, id],
  );

  React.useEffect(() => {
    if (jwo) {
      setRemarksText(jwo.remarks || '');
    }
  }, [jwo]);

  // Charges Memo — above the early return so hook order never changes.
  const charges = useMemo(() => {
    if (!jwo) return [];
    if (jwo.charges && jwo.charges.length > 0) {
      return jwo.charges;
    }
    return [
      {
        id: `c-primary-${jwo.id}`,
        type: `${jwo.process} Charge`,
        description: `${jwo.process} Processing`,
        rate: Number(jwo.rate) || 0,
        qty: Number(jwo.plannedQty) || 0,
        amount: Number(jwo.totalAmount) || (Number(jwo.rate) * Number(jwo.plannedQty)),
        status: 'Active',
      },
    ];
  }, [jwo]);

  if (!jwo) {
    return (
      <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4">
        <div className="mt-3 rounded-xl border border-[#e2eaf5] bg-white p-10 text-center">
          <p className="text-[14px] font-extrabold text-[#17294e]">Job Work Order not found</p>
          <p className="mt-1 text-[12px] text-slate-400">This job work order no longer exists.</p>
          <button
            onClick={() => navigate('/job-work/orders')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] px-4 py-2 text-[12px] font-bold text-[#2563eb] hover:bg-slate-50"
          >
            <ArrowLeft size={14} /> Back to Job Work Orders
          </button>
        </div>
      </div>
    );
  }

  const k = jwoKpis(jwo);
  const totalOutward = (jwo.outwards || []).reduce((s, o) => s + (Number(o.qty) || 0), 0);
  const totalInwardQty = (jwo.inwards || []).reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const totalAccepted = (jwo.inwards || []).reduce((s, r) => s + (Number(r.accepted) || 0), 0);
  const totalRejected = (jwo.inwards || []).reduce((s, r) => s + (Number(r.rejected) || 0), 0);

  const persist = (next) => {
    setOrders(next);
    saveJWOs(next);
    // Fire-and-forget backend PATCH for the changed order (backend owns numbers).
    try {
      const changed = (Array.isArray(next) ? next : []).find((o) => o && jwo && String(o.id) === String(jwo.id));
      if (changed) {
        import('../../services/jobWorkSync').then(async ({ pushUpdateJWO, uploadPendingJWODocs, isJobWorkBackendEnabled }) => {
          if (!isJobWorkBackendEnabled()) return;
          try {
            // Documents attached while offline finally upload here.
            const ready = await uploadPendingJWODocs(changed);
            if (ready !== changed) {
              const reconciled = (Array.isArray(next) ? next : []).map((o) => (o && jwo && String(o.id) === String(jwo.id) ? ready : o));
              setOrders(reconciled);
              try { saveJWOs(reconciled); } catch { /* ignore */ }
            }
            await pushUpdateJWO(ready.id, ready);
          } catch { /* offline — local cache already saved */ }
        });
      }
    } catch {
      /* offline — local cache already saved */
    }
  };

  // Header editing
  const handleOpenEditHeader = () => {
    setHeaderForm({
      process: jwo.process || '',
      vendor: jwo.vendor || '',
      orderDate: jwo.orderDate || '',
      expectedCompletion: jwo.expectedCompletion || '',
      status: jwo.status || 'In-Process',
    });
    setShowEditHeader(true);
  };

  const handleSaveHeader = (e) => {
    e.preventDefault();
    const updated = {
      ...jwo,
      process: headerForm.process,
      vendor: headerForm.vendor,
      orderDate: headerForm.orderDate,
      expectedCompletion: headerForm.expectedCompletion,
      status: headerForm.status,
    };
    persist(orders.map((o) => (o.id === jwo.id ? updated : o)));
    setShowEditHeader(false);
  };

  // Material Handlers
  const handleOpenAddMaterial = () => {
    setEditingMaterial(null);
    setMaterialForm({
      fabricItem: '',
      fabricQuality: '',
      shade: '',
      lotNo: '',
      qty: '',
      rate: String(jwo.rate || ''),
    });
    setShowAddMaterial(true);
  };

  const handleEditMaterial = (m) => {
    setEditingMaterial(m);
    setMaterialForm({
      fabricItem: m.fabricItem || '',
      fabricQuality: m.fabricQuality || '',
      shade: m.shade || '',
      lotNo: m.lotNo || '',
      qty: String(m.qty || ''),
      rate: String(m.rate || ''),
    });
    setOpenActionMenuId(null);
    setShowAddMaterial(true);
  };

  const handleDeleteMaterial = (mId) => {
    if (!window.confirm('Delete this material item?')) return;
    const remainingMaterials = (jwo.materials || []).filter((m) => m.id !== mId);
    const newPlannedQty = remainingMaterials.reduce((s, m) => s + (Number(m.qty) || 0), 0);
    const newTotalAmount = remainingMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const updated = {
      ...jwo,
      materials: remainingMaterials,
      plannedQty: newPlannedQty,
      totalAmount: newTotalAmount,
    };
    persist(orders.map((o) => (o.id === jwo.id ? updated : o)));
    setOpenActionMenuId(null);
  };

  const handleSaveMaterial = (e) => {
    e.preventDefault();
    const qty = Number(materialForm.qty) || 0;
    const rate = Number(materialForm.rate) || 0;
    const amount = qty * rate;

    let nextMaterials = [...(jwo.materials || [])];
    if (editingMaterial) {
      nextMaterials = nextMaterials.map((m) =>
        m.id === editingMaterial.id
          ? {
              ...m,
              fabricItem: materialForm.fabricItem,
              fabricQuality: materialForm.fabricQuality,
              shade: materialForm.shade,
              lotNo: materialForm.lotNo,
              qty,
              rate,
              amount,
            }
          : m,
      );
    } else {
      const newMat = {
        id: `m-${Date.now()}`,
        fabricItem: materialForm.fabricItem,
        fabricQuality: materialForm.fabricQuality,
        shade: materialForm.shade,
        lotNo: materialForm.lotNo,
        qty,
        rate,
        amount,
      };
      nextMaterials.push(newMat);
    }

    const newPlannedQty = nextMaterials.reduce((s, m) => s + (Number(m.qty) || 0), 0);
    const newTotalAmount = nextMaterials.reduce((s, m) => s + (Number(m.amount) || 0), 0);

    const updated = {
      ...jwo,
      materials: nextMaterials,
      plannedQty: newPlannedQty,
      totalAmount: newTotalAmount,
    };
    persist(orders.map((o) => (o.id === jwo.id ? updated : o)));
    setShowAddMaterial(false);
  };

  // Outward Handlers
  const handleOpenAddOutward = () => {
    setEditingOutward(null);
    const remainingQty = Math.max(0, Number(jwo.plannedQty || 0) - totalOutward);
    setOutwardForm({
      no: nextOutwardNo(jwo.outwards),
      date: new Date().toISOString().slice(0, 10),
      qty: remainingQty > 0 ? String(remainingQty) : '',
      lrNo: '',
      transporter: '',
      status: 'Sent',
    });
    setShowOutwardModal(true);
  };

  const handleEditOutward = (o) => {
    setEditingOutward(o);
    setOutwardForm({
      no: o.no || '',
      date: o.date || new Date().toISOString().slice(0, 10),
      qty: String(o.qty || ''),
      lrNo: o.lrNo || '',
      transporter: o.transporter || '',
      status: o.status || 'Sent',
    });
    setOpenActionMenuId(null);
    setShowOutwardModal(true);
  };

  const handleViewOutward = (o) => {
    setViewingOutward(o);
  };

  const handleDeleteOutward = (outwardId) => {
    if (!window.confirm('Delete this outward challan?')) return;
    const remaining = (jwo.outwards || []).filter((o) => o.id !== outwardId);
    persist(orders.map((o) => (o.id === jwo.id ? { ...o, outwards: remaining } : o)));
    setOpenActionMenuId(null);
  };

  const handleSaveOutward = (e) => {
    e.preventDefault();
    const qty = Number(outwardForm.qty);
    if (!(qty > 0)) {
      window.alert('Quantity must be greater than 0.');
      return;
    }

    let nextOutwards = [...(jwo.outwards || [])];
    if (editingOutward) {
      nextOutwards = nextOutwards.map((o) =>
        o.id === editingOutward.id
          ? {
              ...o,
              no: outwardForm.no,
              date: outwardForm.date,
              qty,
              lrNo: outwardForm.lrNo,
              transporter: outwardForm.transporter,
              status: outwardForm.status,
            }
          : o,
      );
    } else {
      const entry = {
        id: `o-${Date.now()}`,
        no: outwardForm.no,
        date: outwardForm.date,
        qty,
        lrNo: outwardForm.lrNo,
        transporter: outwardForm.transporter,
        status: outwardForm.status,
      };
      nextOutwards.push(entry);
    }

    persist(orders.map((o) => (o.id === jwo.id ? { ...o, outwards: nextOutwards } : o)));
    setShowOutwardModal(false);
  };

  // Inward Handlers
  const handleOpenAddInward = () => {
    setEditingInward(null);
    const latestOutward = (jwo.outwards || [])[0]?.no || '';
    setInwardForm({
      no: nextInwardNo(jwo.inwards),
      date: new Date().toISOString().slice(0, 10),
      qty: '',
      accepted: '',
      rejected: '0',
      challanNo: latestOutward,
      status: 'Received',
    });
    setShowInwardModal(true);
  };

  const handleEditInward = (r) => {
    setEditingInward(r);
    setInwardForm({
      no: r.no || '',
      date: r.date || new Date().toISOString().slice(0, 10),
      qty: String(r.qty || ''),
      accepted: String(r.accepted || ''),
      rejected: String(r.rejected || '0'),
      challanNo: r.challanNo || '',
      status: r.status || 'Received',
    });
    setOpenActionMenuId(null);
    setShowInwardModal(true);
  };

  const handleViewInward = (r) => {
    setViewingInward(r);
  };

  const handleDeleteInward = (inwardId) => {
    if (!window.confirm('Delete this inward receipt?')) return;
    const remaining = (jwo.inwards || []).filter((r) => r.id !== inwardId);
    persist(orders.map((o) => (o.id === jwo.id ? { ...o, inwards: remaining } : o)));
    setOpenActionMenuId(null);
  };

  const handleSaveInward = (e) => {
    e.preventDefault();
    const qty = Number(inwardForm.qty);
    if (!(qty > 0)) {
      window.alert('Quantity must be greater than 0.');
      return;
    }
    const rejected = Math.max(0, Number(inwardForm.rejected) || 0);
    const accepted = Math.max(0, Number(inwardForm.accepted) || Math.max(0, qty - rejected));

    let nextInwards = [...(jwo.inwards || [])];
    if (editingInward) {
      nextInwards = nextInwards.map((r) =>
        r.id === editingInward.id
          ? {
              ...r,
              no: inwardForm.no,
              date: inwardForm.date,
              qty,
              accepted,
              rejected,
              challanNo: inwardForm.challanNo,
              status: inwardForm.status,
            }
          : r,
      );
    } else {
      const entry = {
        id: `i-${Date.now()}`,
        no: inwardForm.no,
        date: inwardForm.date,
        qty,
        accepted,
        rejected,
        challanNo: inwardForm.challanNo,
        status: inwardForm.status,
      };
      nextInwards.push(entry);
    }

    persist(orders.map((o) => (o.id === jwo.id ? { ...o, inwards: nextInwards } : o)));
    setShowInwardModal(false);
  };

  const handleSaveRemarks = () => {
    persist(orders.map((o) => (o.id === jwo.id ? { ...o, remarks: remarksText } : o)));
    window.alert('Remarks saved successfully.');
  };

  // Charges Memo & Handlers (memo moved above the early return)

  const handleOpenAddCharge = () => {
    setEditingCharge(null);
    setChargeForm({
      type: `${jwo.process} Charge`,
      description: `${jwo.process} Processing`,
      rate: String(jwo.rate || ''),
      qty: String(jwo.plannedQty || ''),
      status: 'Active',
    });
    setShowChargeModal(true);
  };

  const handleEditCharge = (c) => {
    setEditingCharge(c);
    setChargeForm({
      type: c.type || '',
      description: c.description || '',
      rate: String(c.rate || ''),
      qty: String(c.qty || ''),
      status: c.status || 'Active',
    });
    setOpenActionMenuId(null);
    setShowChargeModal(true);
  };

  const handleViewCharge = (c) => {
    setViewingCharge(c);
  };

  const handleDeleteCharge = (chargeId) => {
    if (!window.confirm('Delete this charge?')) return;
    const remaining = charges.filter((c) => c.id !== chargeId);
    persist(orders.map((o) => (o.id === jwo.id ? { ...o, charges: remaining } : o)));
    setOpenActionMenuId(null);
  };

  const handleSaveCharge = (e) => {
    e.preventDefault();
    const rate = Number(chargeForm.rate) || 0;
    const qty = Number(chargeForm.qty) || 0;
    const amount = rate * qty;

    let nextCharges = [...charges];
    if (editingCharge) {
      nextCharges = nextCharges.map((c) =>
        c.id === editingCharge.id
          ? {
              ...c,
              type: chargeForm.type,
              description: chargeForm.description,
              rate,
              qty,
              amount,
              status: chargeForm.status,
            }
          : c,
      );
    } else {
      const entry = {
        id: `c-${Date.now()}`,
        type: chargeForm.type,
        description: chargeForm.description,
        rate,
        qty,
        amount,
        status: chargeForm.status,
      };
      nextCharges.push(entry);
    }

    persist(orders.map((o) => (o.id === jwo.id ? { ...o, charges: nextCharges } : o)));
    setShowChargeModal(false);
  };

  // Document List (plain computation — no hook, safe after early return)
  const documentsList = (() => {
    if (!jwo) return [];
    const list = [];
    // 1. Primary Job Work Order document
    list.push({
      id: `doc-jwo-${jwo.id}`,
      type: 'Job Work Order',
      no: jwo.jwoNo,
      date: jwo.orderDate,
      fileName: `${jwo.jwoNo}.pdf`,
      uploadedBy: 'Admin',
      isSystem: true,
      sourceType: 'jwo',
      sourceData: jwo,
    });
    // 2. Outward Challans
    (jwo.outwards || []).forEach((o) => {
      const cleanNo = String(o.no || '').replace(/\s+/g, '_');
      list.push({
        id: `doc-out-${o.id || o.no}`,
        type: 'Outward Challan',
        no: o.no,
        date: o.date,
        fileName: `Outward_Challan_${cleanNo.replace(/\D/g, '') || '001'}.pdf`,
        uploadedBy: 'Admin',
        isSystem: true,
        sourceType: 'outward',
        sourceData: o,
      });
    });
    // 3. Inward Receipts
    (jwo.inwards || []).forEach((r) => {
      const cleanNo = String(r.no || '').replace(/\s+/g, '_');
      list.push({
        id: `doc-in-${r.id || r.no}`,
        type: 'Inward Receipt',
        no: r.no,
        date: r.date,
        fileName: `Inward_Receipt_${cleanNo.replace(/\D/g, '') || '001'}.pdf`,
        uploadedBy: 'Admin',
        isSystem: true,
        sourceType: 'inward',
        sourceData: r,
      });
    });
    // 4. Custom Uploaded Documents
    (jwo.documents || []).forEach((d, idx) => {
      list.push({
        id: d.id || `doc-custom-${idx}`,
        type: d.type || 'Other',
        no: d.no || `DOC-${String(idx + 1).padStart(3, '0')}`,
        date: d.date || jwo.orderDate,
        fileName: d.fileName || d.file_name || 'document.pdf',
        uploadedBy: d.uploadedBy || 'Admin',
        url: d.url || '',
        fileId: d.fileId || '',
        isCustom: true,
      });
    });
    return list;
  })();

  const handleOpenUploadDoc = () => {
    const nextDocNum = `QC-${String((jwo?.documents || []).length + 1).padStart(3, '0')}`;
    setDocForm({
      type: 'QC Report',
      no: nextDocNum,
      date: new Date().toISOString().slice(0, 10),
      fileName: 'QC_Report.pdf',
      uploadedBy: 'Admin',
      file: null,
      fileDataUrl: '',
    });
    setShowUploadDocModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setDocForm((prev) => ({
          ...prev,
          file,
          fileName: file.name,
          fileDataUrl: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveUploadDoc = async (e) => {
    e.preventDefault();
    setIsUploadingDoc(true);
    try {
      let fileUrl = docForm.fileDataUrl;
      let fileId = null;

      // Connect with backend file upload service if available
      if (docForm.file) {
        try {
          const { uploadFileToBackend } = await import('../../services/fileUploadService');
          fileId = await uploadFileToBackend(docForm.file, docForm.fileName, 'jobwork_document');
        } catch (uploadErr) {
          console.warn('[uploadDoc] Backend upload attempt failed, falling back to local storage:', uploadErr);
        }
      }

      const newDoc = {
        id: `doc-${Date.now()}`,
        type: docForm.type || 'Other',
        no: docForm.no || `DOC-${Date.now().toString().slice(-4)}`,
        date: docForm.date || new Date().toISOString().slice(0, 10),
        fileName: docForm.fileName || (docForm.file?.name) || `${docForm.type.replace(/\s+/g, '_')}.pdf`,
        uploadedBy: docForm.uploadedBy || 'Admin',
        url: fileUrl || '',
        fileId: fileId || '',
      };

      const nextDocs = [...(jwo.documents || []), newDoc];
      persist(orders.map((o) => (o.id === jwo.id ? { ...o, documents: nextDocs } : o)));
      setShowUploadDocModal(false);
    } catch (err) {
      window.alert(`Error saving document: ${err?.message || err}`);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = (docId) => {
    if (!window.confirm('Delete this uploaded document?')) return;
    const remaining = (jwo.documents || []).filter((d) => d.id !== docId);
    persist(orders.map((o) => (o.id === jwo.id ? { ...o, documents: remaining } : o)));
    setOpenActionMenuId(null);
  };

  const handleViewDoc = (doc) => {
    setViewingDoc(doc);
  };

  const handleDownloadDoc = (doc) => {
    if (doc.url) {
      const link = document.createElement('a');
      link.href = doc.url;
      link.download = doc.fileName || `${doc.no}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      setViewingDoc(doc);
      setTimeout(() => {
        window.print();
      }, 350);
    }
  };

  // Render Outward Section exactly matching screenshot
  const renderOutwardSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-[#17294e]">Outward Challans</h3>
        <button
          onClick={handleOpenAddOutward}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#1d4ed8]"
        >
          <Plus size={14} className="stroke-[2.5]" /> Create Outward Challan
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
        <table className="w-full min-w-[780px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
              <th className="px-3.5 py-2.5 w-10 text-center">#</th>
              <th className="px-3.5 py-2.5">Outward No.</th>
              <th className="px-3.5 py-2.5">Date</th>
              <th className="px-3.5 py-2.5 text-center">Quantity (M)</th>
              <th className="px-3.5 py-2.5">LR No.</th>
              <th className="px-3.5 py-2.5">Transporter</th>
              <th className="px-3.5 py-2.5 text-center">Status</th>
              <th className="px-3.5 py-2.5 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(jwo.outwards || []).length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3.5 py-10 text-center text-[12px] text-slate-400">
                  No outward challans recorded yet. Click "+ Create Outward Challan" to add one.
                </td>
              </tr>
            ) : (
              (jwo.outwards || []).map((o, i) => (
                <tr key={o.id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{i + 1}</td>
                  <td className="px-3.5 py-3">
                    <button
                      onClick={() => handleViewOutward(o)}
                      className="font-mono font-semibold text-blue-600 underline hover:text-blue-800 text-left"
                    >
                      {o.no}
                    </button>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">{toDDMMYYYY(o.date)}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">{numIN(o.qty)}</td>
                  <td className="px-3.5 py-3 font-mono text-slate-700">{o.lrNo || '—'}</td>
                  <td className="px-3.5 py-3 text-slate-700">{o.transporter || '—'}</td>
                  <td className="px-3.5 py-3 text-center">
                    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[10.5px] font-bold ${statusPill(o.status)}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        title="View Details"
                        onClick={() => handleViewOutward(o)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        title="Edit Challan"
                        onClick={() => handleEditOutward(o)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Pencil size={13} />
                      </button>
                      <div className="relative">
                        <button
                          title="More options"
                          onClick={() => setOpenActionMenuId(openActionMenuId === o.id ? null : o.id)}
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {openActionMenuId === o.id && (
                          <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
                            <button
                              onClick={() => {
                                window.print();
                                setOpenActionMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                            >
                              <Printer size={12} /> Print Challan
                            </button>
                            <button
                              onClick={() => handleDeleteOutward(o.id)}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {(jwo.outwards || []).length > 0 && (
              <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold">
                <td className="px-3.5 py-3 text-center" colSpan={3}>
                  Total
                </td>
                <td className="px-3.5 py-3 text-center font-mono text-slate-900 font-extrabold">
                  {numIN(totalOutward)}
                </td>
                <td colSpan={4} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render Inward Section exactly matching user screenshot
  const renderInwardSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-[#17294e]">Inward Receipts</h3>
        <button
          onClick={handleOpenAddInward}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#1d4ed8]"
        >
          <Plus size={14} className="stroke-[2.5]" /> Create Inward Receipt
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
        <table className="w-full min-w-[820px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
              <th className="px-3.5 py-2.5 w-10 text-center">#</th>
              <th className="px-3.5 py-2.5">Inward No.</th>
              <th className="px-3.5 py-2.5">Date</th>
              <th className="px-3.5 py-2.5 text-center">Quantity (M)</th>
              <th className="px-3.5 py-2.5 text-center">Accepted (M)</th>
              <th className="px-3.5 py-2.5 text-center">Rejected (M)</th>
              <th className="px-3.5 py-2.5">Challan No.</th>
              <th className="px-3.5 py-2.5 text-center">Status</th>
              <th className="px-3.5 py-2.5 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(jwo.inwards || []).length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3.5 py-10 text-center text-[12px] text-slate-400">
                  No inward receipts recorded yet. Click "+ Create Inward Receipt" to add one.
                </td>
              </tr>
            ) : (
              (jwo.inwards || []).map((r, i) => (
                <tr key={r.id || i} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{i + 1}</td>
                  <td className="px-3.5 py-3">
                    <button
                      onClick={() => handleViewInward(r)}
                      className="font-mono font-semibold text-blue-600 underline hover:text-blue-800 text-left"
                    >
                      {r.no}
                    </button>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">{toDDMMYYYY(r.date)}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">{numIN(r.qty)}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">{numIN(r.accepted)}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">{numIN(r.rejected)}</td>
                  <td className="px-3.5 py-3 font-mono text-slate-700">{r.challanNo || '—'}</td>
                  <td className="px-3.5 py-3 text-center">
                    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[10.5px] font-bold ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        title="View Details"
                        onClick={() => handleViewInward(r)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        title="Edit Receipt"
                        onClick={() => handleEditInward(r)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Pencil size={13} />
                      </button>
                      <div className="relative">
                        <button
                          title="More options"
                          onClick={() => setOpenActionMenuId(openActionMenuId === r.id ? null : r.id)}
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {openActionMenuId === r.id && (
                          <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
                            <button
                              onClick={() => {
                                window.print();
                                setOpenActionMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                            >
                              <Printer size={12} /> Print Receipt
                            </button>
                            <button
                              onClick={() => handleDeleteInward(r.id)}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {(jwo.inwards || []).length > 0 && (
              <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold">
                <td className="px-3.5 py-3 text-center" colSpan={3}>
                  Total
                </td>
                <td className="px-3.5 py-3 text-center font-mono text-slate-900 font-extrabold">
                  {numIN(totalInwardQty)}
                </td>
                <td className="px-3.5 py-3 text-center font-mono text-slate-900 font-extrabold">
                  {numIN(totalAccepted)}
                </td>
                <td className="px-3.5 py-3 text-center font-mono text-slate-900 font-extrabold">
                  {numIN(totalRejected)}
                </td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Summary Cards (matching reference screenshot) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
        {/* Total Inward */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#ecfdf5] border border-emerald-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d1fae5] text-[#059669]">
            <MapPin size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Inward</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#111827] leading-tight">
              {numIN(totalInwardQty)} M
            </p>
          </div>
        </div>

        {/* Accepted */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#eff6ff] border border-blue-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]">
            <FileText size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Accepted</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#111827] leading-tight">
              {numIN(totalAccepted)} M
            </p>
          </div>
        </div>

        {/* Rejected */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#fff1f2] border border-rose-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffe4e6] text-[#e11d48]">
            <AlertCircle size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#e11d48] leading-tight">Rejected</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#111827] leading-tight">
              {numIN(totalRejected)} M
            </p>
          </div>
        </div>

        {/* Pending to Receive */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#fffbeb] border border-amber-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fef3c7] text-[#d97706]">
            <ShoppingCart size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Pending to Receive</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#17294e] leading-tight">
              {numIN(k.pending)} M
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMaterialSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-[#17294e]">Material Details (Grey Fabric)</h3>
        <button
          onClick={handleOpenAddMaterial}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#c7d9fc] bg-white px-3 py-1.5 text-[12px] font-bold text-[#2563eb] shadow-xs hover:bg-blue-50"
        >
          <Plus size={14} className="stroke-[2.5]" /> Add Material
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
        <table className="w-full min-w-[860px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
              <th className="px-3.5 py-2.5 w-10 text-center">#</th>
              <th className="px-3.5 py-2.5">Fabric Item</th>
              <th className="px-3.5 py-2.5">Fabric Quality</th>
              <th className="px-3.5 py-2.5">Shade / Colour</th>
              <th className="px-3.5 py-2.5">Lot No.</th>
              <th className="px-3.5 py-2.5 text-right">Quantity (M)</th>
              <th className="px-3.5 py-2.5 text-right">Rate (₹/M)</th>
              <th className="px-3.5 py-2.5 text-right">Amount (₹)</th>
              <th className="px-3.5 py-2.5 w-12 text-center">
                <ChevronUp size={14} className="inline text-slate-400" />
              </th>
            </tr>
          </thead>
          <tbody>
            {(jwo.materials || []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-3.5 py-8 text-center text-[12px] text-slate-400">
                  No material details recorded yet. Click "+ Add Material" above.
                </td>
              </tr>
            )}
            {(jwo.materials || []).map((m, idx) => (
              <tr key={m.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                <td className="px-3.5 py-3 font-semibold text-slate-800">{m.fabricItem}</td>
                <td className="px-3.5 py-3 text-slate-700">{m.fabricQuality}</td>
                <td className="px-3.5 py-3 text-slate-700">{m.shade}</td>
                <td className="px-3.5 py-3 font-mono text-slate-700">{m.lotNo}</td>
                <td className="px-3.5 py-3 text-right font-mono text-slate-800">{numIN(m.qty)}</td>
                <td className="px-3.5 py-3 text-right font-mono text-slate-800">{Number(m.rate).toFixed(2)}</td>
                <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-900">{numIN(m.amount)}</td>
                <td className="px-3.5 py-3 text-center relative">
                  <button
                    onClick={() => setOpenActionMenuId(openActionMenuId === m.id ? null : m.id)}
                    className="inline-grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {openActionMenuId === m.id && (
                    <div className="absolute right-3 top-10 z-20 w-28 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
                      <button
                        onClick={() => handleEditMaterial(m)}
                        className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteMaterial(m.id)}
                        className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderWipSection = () => {
    // Dynamically calculate WIP ledger movements from actual user outwards & inwards
    const movements = [];
    let totalOut = 0;
    let totalIn = 0;

    (jwo.outwards || []).forEach((o) => {
      const q = Number(o.qty) || 0;
      totalOut += q;
      movements.push({
        id: o.id || `out-${o.no}`,
        stage: 'Outward',
        date: o.date,
        qty: q,
        inwardQty: 0,
        wipQty: q,
        status: 'Sent to Vendor',
        remarks: '',
      });
    });

    (jwo.inwards || []).forEach((r) => {
      const q = Number(r.qty) || 0;
      const acc = Number(r.accepted) || (q - (Number(r.rejected) || 0));
      const rej = Number(r.rejected) || 0;
      totalIn += q;
      const balance = Math.max(0, (Number(jwo.plannedQty) || totalOut) - totalIn);
      movements.push({
        id: r.id || `in-${r.no}`,
        stage: 'Inward',
        date: r.date,
        qty: q,
        inwardQty: acc,
        wipQty: balance,
        status: 'In Process',
        remarks: `${numIN(acc)} accepted, ${numIN(rej)} rejected`,
      });
    });

    return (
      <div className="space-y-3">
        <h3 className="text-[15px] font-bold text-[#17294e]">Production / WIP Tracking</h3>

        <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
          <table className="w-full min-w-[780px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
                <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                <th className="px-3.5 py-2.5">Stage</th>
                <th className="px-3.5 py-2.5">Date</th>
                <th className="px-3.5 py-2.5">Quantity (M)</th>
                <th className="px-3.5 py-2.5">Inward Qty (M)</th>
                <th className="px-3.5 py-2.5">WIP Qty (M)</th>
                <th className="px-3.5 py-2.5">Status</th>
                <th className="px-3.5 py-2.5">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3.5 py-10 text-center text-[12px] text-slate-400">
                    No production / WIP movements recorded yet. Movements appear automatically as outward challans and inward receipts are created.
                  </td>
                </tr>
              ) : (
                movements.map((m, idx) => (
                  <tr key={m.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                    <td className="px-3.5 py-3 font-semibold text-slate-800">{m.stage}</td>
                    <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">{toDDMMYYYY(m.date)}</td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">{numIN(m.qty)}</td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">{numIN(m.inwardQty)}</td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">{numIN(m.wipQty)}</td>
                    <td className="px-3.5 py-3">
                      {m.status === 'In Process' ? (
                        <span className="inline-block rounded-md border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10.5px] font-bold text-rose-500">
                          {m.status}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium text-[12px]">{m.status}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 text-[11.5px]">{m.remarks || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderChargesSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-[#17294e]">Processing Charges</h3>
        <button
          onClick={handleOpenAddCharge}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#1d4ed8]"
        >
          <Plus size={14} className="stroke-[2.5]" /> Add Charge
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
        <table className="w-full min-w-[780px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
              <th className="px-3.5 py-2.5 w-10 text-center">#</th>
              <th className="px-3.5 py-2.5">Charge Type</th>
              <th className="px-3.5 py-2.5">Description</th>
              <th className="px-3.5 py-2.5 text-center">Rate (₹/M)</th>
              <th className="px-3.5 py-2.5 text-center">Quantity (M)</th>
              <th className="px-3.5 py-2.5 text-center">Amount (₹)</th>
              <th className="px-3.5 py-2.5 text-center">Status</th>
              <th className="px-3.5 py-2.5 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3.5 py-10 text-center text-[12px] text-slate-400">
                  No processing charges recorded yet. Click "+ Add Charge" to add one.
                </td>
              </tr>
            ) : (
              charges.map((c, idx) => (
                <tr key={c.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-800">{c.type}</td>
                  <td className="px-3.5 py-3 text-slate-700">{c.description}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">{Number(c.rate).toFixed(2)}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-semibold text-slate-800">{numIN(c.qty)}</td>
                  <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-900">{numIN(c.amount)}</td>
                  <td className="px-3.5 py-3 text-center">
                    <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-600">
                      {c.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        title="View Details"
                        onClick={() => handleViewCharge(c)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        title="Edit Charge"
                        onClick={() => handleEditCharge(c)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Pencil size={13} />
                      </button>
                      <div className="relative">
                        <button
                          title="More options"
                          onClick={() => setOpenActionMenuId(openActionMenuId === c.id ? null : c.id)}
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {openActionMenuId === c.id && (
                          <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
                            <button
                              onClick={() => handleDeleteCharge(c.id)}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
            {charges.length > 0 && (
              <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold">
                <td className="px-3.5 py-3 text-center" colSpan={4}>
                  Total
                </td>
                <td className="px-3.5 py-3 text-center font-mono text-slate-900 font-extrabold">
                  {numIN(charges.reduce((s, c) => s + (Number(c.qty) || 0), 0))}
                </td>
                <td className="px-3.5 py-3 text-center font-mono text-slate-900 font-extrabold">
                  {numIN(charges.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bottom Summary Cards for Charges ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-1">
        {/* Total Charges */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#ecfdf5] border border-emerald-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d1fae5] text-[#059669]">
            <IndianRupee size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Charges</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#111827] leading-tight">
              ₹ {numIN(charges.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
            </p>
          </div>
        </div>

        {/* Total Quantity */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#eff6ff] border border-blue-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]">
            <Layers size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Quantity</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#111827] leading-tight">
              {numIN(charges.reduce((s, c) => s + (Number(c.qty) || 0), 0))} M
            </p>
          </div>
        </div>

        {/* Process Rate */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#fff1f2] border border-rose-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffe4e6] text-[#e11d48]">
            <Clock size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-[#e11d48] leading-tight">Process Rate</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#111827] leading-tight">
              ₹ {Number(jwo.rate || 0).toFixed(2)} / M
            </p>
          </div>
        </div>

        {/* Active Charges */}
        <div className="flex items-center gap-3 rounded-2xl bg-[#fffbeb] border border-amber-100/70 p-3.5 shadow-2xs">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fef3c7] text-[#d97706]">
            <CheckCircle2 size={18} className="stroke-[2.2]" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Active Charges</p>
            <p className="mt-0.5 text-[16px] font-extrabold text-[#17294e] leading-tight">
              {charges.filter((c) => c.status === 'Active').length} Active
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocumentsSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-[#17294e]">Document List</h3>
        <button
          onClick={handleOpenUploadDoc}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-[#1d4ed8]"
        >
          <Plus size={14} className="stroke-[2.5]" /> Upload Document
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white">
        <table className="w-full min-w-[780px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-200/80 bg-[#f8fafc] text-[11px] font-bold text-slate-700">
              <th className="px-3.5 py-2.5 w-10 text-center">#</th>
              <th className="px-3.5 py-2.5">Document Type</th>
              <th className="px-3.5 py-2.5">Document No.</th>
              <th className="px-3.5 py-2.5">Date</th>
              <th className="px-3.5 py-2.5">File Name</th>
              <th className="px-3.5 py-2.5">Uploaded By</th>
              <th className="px-3.5 py-2.5 text-center w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {documentsList.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3.5 py-10 text-center text-[12px] text-slate-400">
                  No documents found. Click "+ Upload Document" to attach one.
                </td>
              </tr>
            ) : (
              documentsList.map((doc, idx) => (
                <tr key={doc.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3.5 py-3 text-center text-slate-500 font-medium">{idx + 1}</td>
                  <td className="px-3.5 py-3 font-semibold text-slate-800">{doc.type}</td>
                  <td className="px-3.5 py-3">
                    <button
                      onClick={() => handleViewDoc(doc)}
                      className="font-mono font-semibold text-[#2563eb] underline hover:text-[#1d4ed8] text-left"
                    >
                      {doc.no}
                    </button>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">{toDDMMYYYY(doc.date)}</td>
                  <td className="px-3.5 py-3 font-mono text-[11.5px] text-slate-700">{doc.fileName}</td>
                  <td className="px-3.5 py-3 text-slate-700 font-medium">{doc.uploadedBy}</td>
                  <td className="px-3.5 py-3 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        title="View Document"
                        onClick={() => handleViewDoc(doc)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        title="Download Document"
                        onClick={() => handleDownloadDoc(doc)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                      >
                        <Download size={13} />
                      </button>
                      <div className="relative">
                        <button
                          title="More options"
                          onClick={() => setOpenActionMenuId(openActionMenuId === doc.id ? null : doc.id)}
                          className="grid h-7 w-7 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 shadow-xs"
                        >
                          <MoreHorizontal size={13} />
                        </button>
                        {openActionMenuId === doc.id && (
                          <div className="absolute right-0 top-8 z-20 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg text-left">
                            <button
                              onClick={() => {
                                handleDownloadDoc(doc);
                                setOpenActionMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                            >
                              <Download size={12} /> Download
                            </button>
                            <button
                              onClick={() => {
                                handleViewDoc(doc);
                                setOpenActionMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
                            >
                              <Printer size={12} /> Print
                            </button>
                            {doc.isCustom && (
                              <button
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="w-full px-3 py-1.5 text-[11.5px] font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1.5"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRemarksSection = () => (
    <div className="space-y-3">
      <h3 className="text-[14px] font-bold text-[#17294e]">Order Remarks & Special Instructions</h3>
      <textarea
        rows={4}
        value={remarksText}
        onChange={(e) => setRemarksText(e.target.value)}
        placeholder="Enter instructions, packaging details, shade matching tolerance, etc…"
        className="w-full rounded-lg border border-slate-200 p-3 text-[12.5px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white"
      />
      <div className="flex justify-end">
        <button
          onClick={handleSaveRemarks}
          className="rounded-lg bg-[#2563eb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
        >
          Save Remarks
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-62px)] bg-[#eef3fb] p-3 md:p-4 space-y-3">
      {/* ── Top Header Strip ── */}
      <PageHeader
        title={`${jwo.process} Job Work Order - ${jwo.jwoNo}`}
        breadcrumb={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Job Work / Processing' },
          { label: 'Job Work Orders', path: '/job-work/orders' },
          { label: jwo.jwoNo },
        ]}
        titleExtra={
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPill(jwo.status)}`}>
            {jwo.status}
          </span>
        }
        actions={
          <>
            <button
              onClick={handleOpenAddOutward}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1d4ed8]"
            >
              <Plus size={14} /> Outward Challan
            </button>
            <button
              onClick={handleOpenAddInward}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              Create Inward
            </button>
            <button
              onClick={handleOpenEditHeader}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2eaf5] bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              <Printer size={13} /> Print
            </button>
            <button className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-[#e2eaf5] bg-white text-slate-500 hover:bg-slate-50">
              <MoreVertical size={15} />
            </button>
          </>
        }
      />

      {/* ── Main Container Card (matching Screenshot) ── */}
      <div className="rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        {/* Top Summary Row */}
        <div className="grid grid-cols-2 gap-4 items-center sm:grid-cols-4 lg:grid-cols-7">
          <div>
            <p className="text-[11.5px] font-medium text-slate-500">Process</p>
            <p className="mt-1 text-[14px] font-bold text-[#17294e]">{jwo.process}</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-slate-500">Vendor</p>
            <p className="mt-1 text-[14px] font-bold text-[#17294e]">{jwo.vendor}</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-slate-500">Order Date</p>
            <p className="mt-1 text-[14px] font-bold text-[#17294e]">{toDDMMYYYY(jwo.orderDate)}</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-slate-500">Quantity (M)</p>
            <p className="mt-1 text-[14px] font-bold text-[#17294e]">{numIN(jwo.plannedQty)}</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-slate-500">Rate (₹/M)</p>
            <p className="mt-1 text-[14px] font-bold text-[#17294e]">{Number(jwo.rate).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-slate-500">Amount (₹)</p>
            <p className="mt-1 text-[14px] font-bold text-[#17294e]">{numIN(jwo.totalAmount)}</p>
          </div>
          {/* Expected Completion Badge */}
          <div className="flex items-center gap-2.5 rounded-xl bg-[#fff1f2] border border-rose-100/70 px-3.5 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-500 border border-rose-200">
              <Calendar size={17} className="stroke-[2.2]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-rose-500 leading-tight">Expected Completion</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-rose-600 leading-tight">
                {toDDMMYYYY(jwo.expectedCompletion)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Order Activity & Details ── */}
      <div className="mt-4 rounded-xl border border-[#e2eaf5] bg-white p-4 shadow-[0_1px_2px_rgba(16,42,82,0.06)]">
        {/* ── Tabs (matching Screenshot) ── */}
        <div className="flex gap-6 overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setOpenActionMenuId(null);
              }}
              className={`whitespace-nowrap pb-2.5 text-[12.5px] font-bold transition-colors ${
                tab === t
                  ? 'border-b-2 border-[#2563eb] text-[#2563eb]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="mt-4">
          {tab === 'Material Details' && renderMaterialSection()}
          {tab === 'Outward Challans' && renderOutwardSection()}
          {tab === 'Inward Receipts' && renderInwardSection()}
          {tab === 'Production / WIP' && renderWipSection()}
          {tab === 'Charges' && renderChargesSection()}
          {tab === 'Documents' && renderDocumentsSection()}
          {tab === 'Remarks' && renderRemarksSection()}
        </div>
      </div>

      {/* ── MODAL: Create / Edit Outward Challan ── */}
      {showOutwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">
                {editingOutward ? 'Edit Outward Challan' : 'Create Outward Challan'}
              </h3>
              <button
                onClick={() => setShowOutwardModal(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveOutward} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Outward No.</label>
                <input
                  required
                  value={outwardForm.no}
                  onChange={(e) => setOutwardForm({ ...outwardForm, no: e.target.value })}
                  placeholder="e.g. JWO-OUT-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={outwardForm.date}
                    onChange={(e) => setOutwardForm({ ...outwardForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Quantity (M)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={outwardForm.qty}
                    onChange={(e) => setOutwardForm({ ...outwardForm, qty: e.target.value })}
                    placeholder="e.g. 15000"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">LR No.</label>
                  <input
                    value={outwardForm.lrNo}
                    onChange={(e) => setOutwardForm({ ...outwardForm, lrNo: e.target.value })}
                    placeholder="e.g. LR-4587"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Transporter</label>
                  <input
                    value={outwardForm.transporter}
                    onChange={(e) => setOutwardForm({ ...outwardForm, transporter: e.target.value })}
                    placeholder="e.g. ABC Transport"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={outwardForm.status}
                  onChange={(e) => setOutwardForm({ ...outwardForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="Sent">Sent</option>
                  <option value="In-Transit">In-Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOutwardModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  {editingOutward ? 'Update Challan' : 'Create Challan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Create / Edit Inward Receipt ── */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">
                {editingInward ? 'Edit Inward Receipt' : 'Create Inward Receipt'}
              </h3>
              <button
                onClick={() => setShowInwardModal(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveInward} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Inward No.</label>
                <input
                  required
                  value={inwardForm.no}
                  onChange={(e) => setInwardForm({ ...inwardForm, no: e.target.value })}
                  placeholder="e.g. JWO-IN-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={inwardForm.date}
                    onChange={(e) => setInwardForm({ ...inwardForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Challan No.</label>
                  <input
                    value={inwardForm.challanNo}
                    onChange={(e) => setInwardForm({ ...inwardForm, challanNo: e.target.value })}
                    placeholder="e.g. JWO-OUT-001"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Quantity (M)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={inwardForm.qty}
                  onChange={(e) => {
                    const q = e.target.value;
                    const rej = Number(inwardForm.rejected) || 0;
                    setInwardForm({
                      ...inwardForm,
                      qty: q,
                      accepted: String(Math.max(0, (Number(q) || 0) - rej)),
                    });
                  }}
                  placeholder="e.g. 12000"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Accepted (M)</label>
                  <input
                    type="number"
                    min="0"
                    value={inwardForm.accepted}
                    onChange={(e) => setInwardForm({ ...inwardForm, accepted: e.target.value })}
                    placeholder="e.g. 11800"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Rejected (M)</label>
                  <input
                    type="number"
                    min="0"
                    value={inwardForm.rejected}
                    onChange={(e) => {
                      const rej = e.target.value;
                      const q = Number(inwardForm.qty) || 0;
                      setInwardForm({
                        ...inwardForm,
                        rejected: rej,
                        accepted: String(Math.max(0, q - (Number(rej) || 0))),
                      });
                    }}
                    placeholder="e.g. 200"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={inwardForm.status}
                  onChange={(e) => setInwardForm({ ...inwardForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="Received">Received</option>
                  <option value="Partially Received">Partially Received</option>
                  <option value="Inspected">Inspected</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  {editingInward ? 'Update Receipt' : 'Create Inward Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Inward Receipt Details ── */}
      {viewingInward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-[#17294e]">Inward Receipt Details</h3>
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${statusPill(viewingInward.status)}`}>
                  {viewingInward.status}
                </span>
              </div>
              <button
                onClick={() => setViewingInward(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Inward Receipt No.</p>
                  <p className="mt-0.5 font-mono font-bold text-blue-600">{viewingInward.no}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Receipt Date</p>
                  <p className="mt-0.5 font-bold text-slate-800">{toDDMMYYYY(viewingInward.date)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Total Qty</p>
                  <p className="mt-0.5 font-mono text-[14px] font-bold text-slate-900">{numIN(viewingInward.qty)} M</p>
                </div>
                <div>
                  <p className="text-[11px] text-emerald-600 font-medium">Accepted</p>
                  <p className="mt-0.5 font-mono text-[14px] font-bold text-emerald-700">{numIN(viewingInward.accepted)} M</p>
                </div>
                <div>
                  <p className="text-[11px] text-rose-500 font-medium">Rejected</p>
                  <p className="mt-0.5 font-mono text-[14px] font-bold text-rose-600">{numIN(viewingInward.rejected)} M</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-[11px] text-slate-500 font-medium">Linked Outward Challan</p>
                <p className="mt-0.5 font-mono font-semibold text-slate-800">{viewingInward.challanNo || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-[11px] text-slate-500 font-medium">Job Work Order</p>
                <p className="mt-0.5 font-semibold text-slate-800">{jwo.process} Order ({jwo.jwoNo}) from {jwo.vendor}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <Printer size={13} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingInward;
                    setViewingInward(null);
                    handleEditInward(toEdit);
                  }}
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: View Outward Challan Details ── */}
      {viewingOutward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-[#17294e]">Outward Challan Details</h3>
                <span className={`inline-block rounded-md border px-2 py-0.5 text-[10.5px] font-bold ${statusPill(viewingOutward.status)}`}>
                  {viewingOutward.status}
                </span>
              </div>
              <button
                onClick={() => setViewingOutward(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Outward Challan No.</p>
                  <p className="mt-0.5 font-mono font-bold text-blue-600">{viewingOutward.no}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Challan Date</p>
                  <p className="mt-0.5 font-bold text-slate-800">{toDDMMYYYY(viewingOutward.date)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Dispatched Quantity</p>
                  <p className="mt-0.5 font-mono text-[14px] font-extrabold text-slate-900">{numIN(viewingOutward.qty)} M</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">LR / Consignment No.</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-800">{viewingOutward.lrNo || '—'}</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-[11px] text-slate-500 font-medium">Transporter / Logistics</p>
                <p className="mt-0.5 font-semibold text-slate-800">{viewingOutward.transporter || '—'}</p>
              </div>
              <div className="rounded-lg border border-slate-100 p-3">
                <p className="text-[11px] text-slate-500 font-medium">Job Work Order</p>
                <p className="mt-0.5 font-semibold text-slate-800">{jwo.process} Order ({jwo.jwoNo}) to {jwo.vendor}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1.5"
                >
                  <Printer size={13} /> Print
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingOutward;
                    setViewingOutward(null);
                    handleEditOutward(toEdit);
                  }}
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Add / Edit Material ── */}
      {showAddMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">
                {editingMaterial ? 'Edit Material' : 'Add Material (Grey Fabric)'}
              </h3>
              <button
                onClick={() => setShowAddMaterial(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveMaterial} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Fabric Item</label>
                <input
                  required
                  value={materialForm.fabricItem}
                  onChange={(e) => setMaterialForm({ ...materialForm, fabricItem: e.target.value })}
                  placeholder="e.g. Cotton Fabric"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Fabric Quality</label>
                  <input
                    value={materialForm.fabricQuality}
                    onChange={(e) => setMaterialForm({ ...materialForm, fabricQuality: e.target.value })}
                    placeholder="e.g. GSM 120"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Shade / Colour</label>
                  <input
                    value={materialForm.shade}
                    onChange={(e) => setMaterialForm({ ...materialForm, shade: e.target.value })}
                    placeholder="e.g. Navy Blue"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Lot No.</label>
                <input
                  value={materialForm.lotNo}
                  onChange={(e) => setMaterialForm({ ...materialForm, lotNo: e.target.value })}
                  placeholder="e.g. LOT-001"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Quantity (M)</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={materialForm.qty}
                    onChange={(e) => setMaterialForm({ ...materialForm, qty: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Rate (₹/M)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={materialForm.rate}
                    onChange={(e) => setMaterialForm({ ...materialForm, rate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="rounded-lg bg-blue-50/50 p-2.5 text-[12px] flex justify-between items-center text-blue-900 font-semibold">
                <span>Calculated Amount:</span>
                <span className="font-mono text-[13px] font-bold">
                  ₹ {numIN((Number(materialForm.qty) || 0) * (Number(materialForm.rate) || 0))}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMaterial(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  {editingMaterial ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Edit Order Header Details ── */}
      {showEditHeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Edit Order Details</h3>
              <button
                onClick={() => setShowEditHeader(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveHeader} className="mt-4 space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Process</label>
                  <input
                    required
                    value={headerForm.process}
                    onChange={(e) => setHeaderForm({ ...headerForm, process: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Vendor</label>
                  <input
                    required
                    value={headerForm.vendor}
                    onChange={(e) => setHeaderForm({ ...headerForm, vendor: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Order Date</label>
                  <input
                    type="date"
                    required
                    value={headerForm.orderDate}
                    onChange={(e) => setHeaderForm({ ...headerForm, orderDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Expected Completion</label>
                  <input
                    type="date"
                    required
                    value={headerForm.expectedCompletion}
                    onChange={(e) => setHeaderForm({ ...headerForm, expectedCompletion: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={headerForm.status}
                  onChange={(e) => setHeaderForm({ ...headerForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="In-Process">In-Process</option>
                  <option value="Completed">Completed</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditHeader(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Create / Edit Processing Charge ── */}
      {showChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">
                {editingCharge ? 'Edit Processing Charge' : 'Add Processing Charge'}
              </h3>
              <button
                onClick={() => setShowChargeModal(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveCharge} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Charge Type</label>
                <input
                  required
                  value={chargeForm.type}
                  onChange={(e) => setChargeForm({ ...chargeForm, type: e.target.value })}
                  placeholder="e.g. Dyeing Charge"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description</label>
                <input
                  value={chargeForm.description}
                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                  placeholder="e.g. Dyeing Processing"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Rate (₹/M)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={chargeForm.rate}
                    onChange={(e) => setChargeForm({ ...chargeForm, rate: e.target.value })}
                    placeholder="e.g. 8.00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Quantity (M)</label>
                  <input
                    type="number"
                    required
                    value={chargeForm.qty}
                    onChange={(e) => setChargeForm({ ...chargeForm, qty: e.target.value })}
                    placeholder="e.g. 24640"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={chargeForm.status}
                  onChange={(e) => setChargeForm({ ...chargeForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="rounded-lg bg-blue-50/50 p-2.5 text-[12px] flex justify-between items-center text-blue-900 font-semibold">
                <span>Calculated Amount:</span>
                <span className="font-mono text-[13px] font-bold">
                  ₹ {numIN((Number(chargeForm.rate) || 0) * (Number(chargeForm.qty) || 0))}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChargeModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  {editingCharge ? 'Update Charge' : 'Add Charge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Processing Charge Details ── */}
      {viewingCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-[#17294e]">Charge Details</h3>
                <span className="inline-block rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-600">
                  {viewingCharge.status || 'Active'}
                </span>
              </div>
              <button
                onClick={() => setViewingCharge(null)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-[12px]">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Charge Type</p>
                  <p className="mt-0.5 font-bold text-slate-800">{viewingCharge.type}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Description</p>
                  <p className="mt-0.5 font-semibold text-slate-700">{viewingCharge.description || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Rate (₹/M)</p>
                  <p className="mt-0.5 font-mono text-[13px] font-semibold text-slate-800">
                    {Number(viewingCharge.rate).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Quantity (M)</p>
                  <p className="mt-0.5 font-mono text-[13px] font-semibold text-slate-800">
                    {numIN(viewingCharge.qty)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Amount (₹)</p>
                  <p className="mt-0.5 font-mono text-[14px] font-bold text-blue-700">
                    ₹ {numIN(viewingCharge.amount)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewingCharge(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingCharge;
                    setViewingCharge(null);
                    handleEditCharge(toEdit);
                  }}
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8]"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Upload Document ── */}
      {showUploadDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-[14px] font-bold text-[#17294e]">Upload Document</h3>
              <button
                onClick={() => setShowUploadDocModal(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveUploadDoc} className="mt-4 space-y-3 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Document Type</label>
                <select
                  required
                  value={docForm.type}
                  onChange={(e) => {
                    const t = e.target.value;
                    setDocForm((prev) => ({
                      ...prev,
                      type: t,
                      fileName: `${t.replace(/\s+/g, '_')}.pdf`,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400 bg-white"
                >
                  <option value="QC Report">QC Report</option>
                  <option value="Delivery Challan">Delivery Challan</option>
                  <option value="Bill / Invoice">Bill / Invoice</option>
                  <option value="Quality Certificate">Quality Certificate</option>
                  <option value="Inspection Sheet">Inspection Sheet</option>
                  <option value="Fabric Test Report">Fabric Test Report</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Document No.</label>
                  <input
                    required
                    value={docForm.no}
                    onChange={(e) => setDocForm({ ...docForm, no: e.target.value })}
                    placeholder="e.g. QC-001"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={docForm.date}
                    onChange={(e) => setDocForm({ ...docForm, date: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">File Attachment (PDF, Image)</label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={handleFileChange}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11.5px] outline-none focus:border-blue-400 file:mr-2 file:rounded-md file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-[11.5px] file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">File Name</label>
                <input
                  required
                  value={docForm.fileName}
                  onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })}
                  placeholder="e.g. QC_Report.pdf"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Uploaded By</label>
                <input
                  required
                  value={docForm.uploadedBy}
                  onChange={(e) => setDocForm({ ...docForm, uploadedBy: e.target.value })}
                  placeholder="e.g. Admin"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadDocModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="rounded-lg bg-[#2563eb] px-4 py-1.5 font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                >
                  {isUploadingDoc ? 'Uploading…' : 'Upload Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: View Document / Voucher Preview ── */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-[#2563eb]" />
                <h3 className="text-[15px] font-bold text-[#17294e]">
                  {viewingDoc.type} — <span className="font-mono text-[#2563eb]">{viewingDoc.no}</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer size={13} /> Print
                </button>
                <button
                  onClick={() => handleDownloadDoc(viewingDoc)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#2563eb] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-[#1d4ed8]"
                >
                  <Download size={13} /> Download
                </button>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-[12px]">
              {/* Document Meta Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-slate-50 p-3">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Document Type</p>
                  <p className="mt-0.5 font-bold text-slate-800">{viewingDoc.type}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Document No.</p>
                  <p className="mt-0.5 font-mono font-bold text-slate-800">{viewingDoc.no}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Date</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{toDDMMYYYY(viewingDoc.date)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Uploaded / Created By</p>
                  <p className="mt-0.5 font-semibold text-slate-800">{viewingDoc.uploadedBy}</p>
                </div>
              </div>

              {/* Document Content / Embedded Preview */}
              {viewingDoc.url ? (
                viewingDoc.url.startsWith('data:image/') ? (
                  <div className="border border-slate-200 rounded-lg p-2 text-center bg-slate-50">
                    <img src={viewingDoc.url} alt={viewingDoc.fileName} className="max-h-[500px] mx-auto rounded" />
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden h-[500px]">
                    <iframe src={viewingDoc.url} title={viewingDoc.fileName} className="w-full h-full border-0" />
                  </div>
                )
              ) : (
                /* Formatted Official Voucher Card for generated order/challan/receipt */
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                  <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-[15px] font-black tracking-wide text-slate-900">OSCAR TEXTILES & PROCESSING</h4>
                      <p className="text-[11px] text-slate-500">Official Job Work & Production Voucher</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                        {viewingDoc.type}
                      </span>
                      <p className="mt-1 font-mono text-[13px] font-bold text-slate-800">{viewingDoc.no}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11.5px]">
                    <div>
                      <span className="text-slate-500">Order No:</span>{' '}
                      <span className="font-bold text-slate-800">{jwo.jwoNo}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Vendor:</span>{' '}
                      <span className="font-bold text-slate-800">{jwo.vendor}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Process:</span>{' '}
                      <span className="font-bold text-slate-800">{jwo.process}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Planned Quantity:</span>{' '}
                      <span className="font-mono font-bold text-slate-800">{numIN(jwo.plannedQty)} M</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Rate:</span>{' '}
                      <span className="font-mono font-bold text-slate-800">₹ {Number(jwo.rate).toFixed(2)} / M</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Order Total:</span>{' '}
                      <span className="font-mono font-bold text-slate-900">₹ {numIN(jwo.totalAmount)}</span>
                    </div>
                  </div>

                  {/* Materials line summary */}
                  {(jwo.materials || []).length > 0 && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200/80">
                      <table className="w-full text-left text-[11.5px]">
                        <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-600">
                          <tr>
                            <th className="px-3.5 py-1.5">Fabric Item</th>
                            <th className="px-3.5 py-1.5">Quality</th>
                            <th className="px-3.5 py-1.5">Shade</th>
                            <th className="px-3.5 py-1.5">Lot No.</th>
                            <th className="px-3.5 py-1.5 text-right">Quantity (M)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jwo.materials.map((m, i) => (
                            <tr key={i} className="border-t border-slate-100">
                              <td className="px-3.5 py-2 font-semibold text-slate-800">{m.fabricItem}</td>
                              <td className="px-3.5 py-2 text-slate-600">{m.fabricQuality}</td>
                              <td className="px-3.5 py-2 text-slate-600">{m.shade}</td>
                              <td className="px-3.5 py-2 font-mono text-slate-600">{m.lotNo}</td>
                              <td className="px-3.5 py-2 text-right font-mono font-semibold text-slate-800">{numIN(m.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Signature footer */}
                  <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100 text-[11px] text-slate-500">
                    <div>
                      <p className="border-b border-slate-300 pb-8 text-center" />
                      <p className="mt-1 text-center font-medium">Authorized Signatory</p>
                    </div>
                    <div>
                      <p className="border-b border-slate-300 pb-8 text-center" />
                      <p className="mt-1 text-center font-medium">Vendor / Receiver's Signature</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="rounded-lg border border-slate-200 px-4 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
