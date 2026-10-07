import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppStore } from "../../../stores/appStore";
import { useAssetStore } from "../../../stores/assetStore";
import { Badge } from "../../../components/hrms/Badge";
import Modal from "../../../components/ui/Modal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import {
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  Cpu,
  Headphones,
  Armchair,
  Box,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  DollarSign,
  ShieldCheck,
  History,
  ArrowRight,
  Info,
  Tag,
  Hash,
  Send,
  Inbox,
  Check,
  X,
  ClipboardList,
  Sparkles,
} from "lucide-react";

export function AssetsPage() {
  const showToast = useAppStore((s) => s.showToast);
  const employees = useAppStore((s) => s.employees || []);

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const {
    assets = [],
    requests = [],
    addAsset,
    updateAsset,
    deleteAsset,
    assignAsset,
    returnAsset,
    setAssetStatus,
    addRequest,
    updateRequestStatus,
    fulfillRequestWithAsset,
    deleteRequest,
    resetDefaults,
  } = useAssetStore();

  // Tab State: 'inventory' | 'requests' (with URL query synchronization)
  const [activeTab, setActiveTab] = useState(tabParam === "requests" ? "requests" : "inventory");

  useEffect(() => {
    if (tabParam === "requests" && activeTab !== "requests") {
      setActiveTab("requests");
    } else if (tabParam === "inventory" && activeTab !== "inventory") {
      setActiveTab("inventory");
    }
  }, [tabParam, activeTab]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === "requests") {
      setSearchParams({ tab: "requests" });
    } else {
      setSearchParams({});
    }
  };

  // Search & Filters for Inventory
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");

  // Search & Filters for Requests
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("All");
  const [reqPriorityFilter, setReqPriorityFilter] = useState("All");

  // Modals state (Inventory)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Modals state (Requests)
  const [isAddReqOpen, setIsAddReqOpen] = useState(false);
  const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fulfillAssetId, setFulfillAssetId] = useState("");

  const [requestForm, setRequestForm] = useState({
    employeeName: "",
    employeeId: "",
    dept: "Engineering",
    category: "Laptop",
    assetName: "",
    reason: "",
    priority: "Medium",
    notes: "",
  });

  // Selected item tracking
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Form states
  const [assetForm, setAssetForm] = useState({
    name: "",
    category: "Laptop",
    serialNumber: "",
    assignedTo: "",
    dept: "Engineering",
    status: "Available",
    condition: "Excellent",
    purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: "",
    warrantyExpiry: "",
    notes: "",
  });

  const [assignForm, setAssignForm] = useState({
    employeeName: "",
    employeeId: "",
    dept: "Engineering",
    notes: "",
  });

  const [returnForm, setReturnForm] = useState({
    condition: "Good",
    notes: "",
  });

  // Filtered Assets
  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const q = search.toLowerCase();
      const matchesSearch =
        (a.name || "").toLowerCase().includes(q) ||
        (a.id || "").toLowerCase().includes(q) ||
        (a.serialNumber || "").toLowerCase().includes(q) ||
        (a.assignedTo || "").toLowerCase().includes(q);

      const matchesCat = categoryFilter === "All" || a.category === categoryFilter;
      const matchesStatus = statusFilter === "All" || a.status === statusFilter;
      const matchesDept = deptFilter === "All" || a.dept === deptFilter;

      return matchesSearch && matchesCat && matchesStatus && matchesDept;
    });
  }, [assets, search, categoryFilter, statusFilter, deptFilter]);

  // Statistics
  const total = assets.length;
  const assignedCount = assets.filter((a) => a.status === "Assigned").length;
  const availableCount = assets.filter((a) => a.status === "Available").length;
  const maintenanceCount = assets.filter((a) => a.status === "Under Maintenance").length;
  const lostDamagedCount = assets.filter((a) => a.status === "Lost/Damaged").length;

  // Handlers
  function handleOpenAdd() {
    setAssetForm({
      name: "",
      category: "Laptop",
      serialNumber: "",
      assignedTo: "",
      dept: "Engineering",
      status: "Available",
      condition: "Excellent",
      purchaseDate: new Date().toISOString().slice(0, 10),
      purchaseCost: "",
      warrantyExpiry: "",
      notes: "",
    });
    setIsAddOpen(true);
  }

  function handleSaveAdd(e) {
    e.preventDefault();
    if (!assetForm.name.trim()) return;

    const matchedEmp = employees.find((emp) => emp.name === assetForm.assignedTo);
    const created = addAsset({
      ...assetForm,
      employeeId: matchedEmp?.id || "",
      dept: matchedEmp?.department || assetForm.dept,
    });

    setIsAddOpen(false);
    showToast(`Asset ${created.id} registered successfully`);
  }

  function handleOpenEdit(asset) {
    setSelectedAsset(asset);
    setAssetForm({
      name: asset.name || "",
      category: asset.category || "Laptop",
      serialNumber: asset.serialNumber || "",
      assignedTo: asset.assignedTo || "",
      dept: asset.dept || "Engineering",
      status: asset.status || "Available",
      condition: asset.condition || "Good",
      purchaseDate: asset.purchaseDate || "",
      purchaseCost: asset.purchaseCost || "",
      warrantyExpiry: asset.warrantyExpiry || "",
      notes: asset.notes || "",
    });
    setIsEditOpen(true);
  }

  function handleSaveEdit(e) {
    e.preventDefault();
    if (!selectedAsset) return;

    const matchedEmp = employees.find((emp) => emp.name === assetForm.assignedTo);
    updateAsset(selectedAsset.id, {
      ...assetForm,
      employeeId: matchedEmp?.id || selectedAsset.employeeId || "",
      dept: matchedEmp?.department || assetForm.dept,
    });

    setIsEditOpen(false);
    showToast(`Asset ${selectedAsset.id} updated`);
  }

  function handleOpenAssign(asset) {
    setSelectedAsset(asset);
    const firstEmp = employees[0]?.name || "";
    const firstEmpObj = employees[0];
    setAssignForm({
      employeeName: firstEmp,
      employeeId: firstEmpObj?.id || "",
      dept: firstEmpObj?.department || asset.dept || "Engineering",
      notes: "",
    });
    setIsAssignOpen(true);
  }

  function handleSaveAssign(e) {
    e.preventDefault();
    if (!selectedAsset || !assignForm.employeeName) return;

    assignAsset(selectedAsset.id, {
      employeeName: assignForm.employeeName,
      employeeId: assignForm.employeeId,
      dept: assignForm.dept,
      notes: assignForm.notes,
    });

    setIsAssignOpen(false);
    showToast(`Asset ${selectedAsset.id} assigned to ${assignForm.employeeName}`);
  }

  function handleOpenReturn(asset) {
    setSelectedAsset(asset);
    setReturnForm({
      condition: asset.condition || "Good",
      notes: "",
    });
    setIsReturnOpen(true);
  }

  function handleSaveReturn(e) {
    e.preventDefault();
    if (!selectedAsset) return;

    returnAsset(selectedAsset.id, {
      condition: returnForm.condition,
      notes: returnForm.notes,
    });

    setIsReturnOpen(false);
    showToast(`Asset ${selectedAsset.id} returned to inventory`);
  }

  function handleOpenDetails(asset) {
    setSelectedAsset(asset);
    setIsDetailsOpen(true);
  }

  function handleOpenDelete(asset) {
    setSelectedAsset(asset);
    setIsDeleteOpen(true);
  }

  function handleConfirmDelete() {
    if (!selectedAsset) return;
    deleteAsset(selectedAsset.id);
    setIsDeleteOpen(false);
    showToast(`Asset ${selectedAsset.id} deleted`);
  }

  function getCategoryIcon(cat) {
    switch (cat) {
      case "Laptop":
        return <Laptop size={15} className="text-blue-500" />;
      case "Monitor":
        return <Monitor size={15} className="text-purple-500" />;
      case "Mobile":
        return <Smartphone size={15} className="text-emerald-500" />;
      case "Tablet":
        return <Tablet size={15} className="text-indigo-500" />;
      case "Workstation":
        return <Cpu size={15} className="text-orange-500" />;
      case "Audio / Peripherals":
        return <Headphones size={15} className="text-pink-500" />;
      case "Office Furniture":
        return <Armchair size={15} className="text-amber-500" />;
      default:
        return <Box size={15} className="text-slate-500" />;
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case "Assigned":
        return <Badge variant="green">Assigned</Badge>;
      case "Available":
        return <Badge variant="blue">Available</Badge>;
      case "Under Maintenance":
        return <Badge variant="yellow">Under Maintenance</Badge>;
      case "Lost/Damaged":
        return <Badge variant="red">Lost / Damaged</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  }

  // Request Helpers & Statistics
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const q = reqSearch.toLowerCase();
      const matchesSearch =
        (r.employeeName || "").toLowerCase().includes(q) ||
        (r.id || "").toLowerCase().includes(q) ||
        (r.assetName || "").toLowerCase().includes(q) ||
        (r.category || "").toLowerCase().includes(q) ||
        (r.dept || "").toLowerCase().includes(q);

      const matchesStatus = reqStatusFilter === "All" || r.status === reqStatusFilter;
      const matchesPriority = reqPriorityFilter === "All" || r.priority === reqPriorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [requests, reqSearch, reqStatusFilter, reqPriorityFilter]);

  const reqTotal = requests.length;
  const reqPending = requests.filter((r) => r.status === "Pending").length;
  const reqApproved = requests.filter((r) => r.status === "Approved").length;
  const reqFulfilled = requests.filter((r) => r.status === "Fulfilled").length;
  const reqRejected = requests.filter((r) => r.status === "Rejected").length;

  const availableAssets = useMemo(() => {
    return assets.filter((a) => a.status === "Available");
  }, [assets]);

  function getReqPriorityBadge(priority) {
    switch (priority) {
      case "High":
        return <Badge variant="red">High</Badge>;
      case "Medium":
        return <Badge variant="yellow">Medium</Badge>;
      case "Low":
        return <Badge variant="blue">Low</Badge>;
      default:
        return <Badge variant="gray">{priority}</Badge>;
    }
  }

  function getReqStatusBadge(status) {
    switch (status) {
      case "Pending":
        return <Badge variant="yellow">Pending</Badge>;
      case "Approved":
        return <Badge variant="blue">Approved</Badge>;
      case "Fulfilled":
        return <Badge variant="green">Fulfilled</Badge>;
      case "Rejected":
        return <Badge variant="red">Rejected</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  }

  function handleOpenAddReq() {
    const firstEmp = employees[0]?.name || "";
    const firstEmpObj = employees[0];
    setRequestForm({
      employeeName: firstEmp,
      employeeId: firstEmpObj?.id || "",
      dept: firstEmpObj?.department || "Engineering",
      category: "Laptop",
      assetName: "",
      reason: "",
      priority: "Medium",
      notes: "",
    });
    setIsAddReqOpen(true);
  }

  function handleSaveAddReq(e) {
    e.preventDefault();
    if (!requestForm.assetName.trim() || !requestForm.employeeName.trim()) return;

    const matchedEmp = employees.find((emp) => emp.name === requestForm.employeeName);
    const created = addRequest({
      ...requestForm,
      employeeId: matchedEmp?.id || requestForm.employeeId,
      dept: matchedEmp?.department || requestForm.dept,
    });

    setIsAddReqOpen(false);
    showToast(`Asset request ${created.id} submitted successfully`);
  }

  function handleApproveRequest(req) {
    updateRequestStatus(req.id, "Approved");
    showToast(`Request ${req.id} approved`);
  }

  function handleRejectRequest(req) {
    updateRequestStatus(req.id, "Rejected");
    showToast(`Request ${req.id} rejected`);
  }

  function handleOpenFulfill(req) {
    setSelectedRequest(req);
    // Auto-select first available asset if exists
    const matchingAvailable = availableAssets.find((a) => a.category === req.category) || availableAssets[0];
    setFulfillAssetId(matchingAvailable?.id || "");
    setIsFulfillModalOpen(true);
  }

  function handleConfirmFulfill(e) {
    e.preventDefault();
    if (!selectedRequest || !fulfillAssetId) return;

    fulfillRequestWithAsset(selectedRequest.id, fulfillAssetId);
    setIsFulfillModalOpen(false);
    showToast(`Request ${selectedRequest.id} fulfilled with asset ${fulfillAssetId}`);
  }

  function handleDeleteRequest(req) {
    deleteRequest(req.id);
    showToast(`Request ${req.id} deleted`);
  }

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        title="Asset Setup & Inventory"
        subtitle="Lifecycle management, hardware provisioning, allocations, repairs & return audits."
        guide={hrmsGuides.assets}
        actions={
          activeTab === "inventory" ? (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              Register Asset
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenAddReq}
              className="px-5 py-2.5 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              New Asset Request
            </button>
          )
        }
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-bdr overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        <button
          type="button"
          onClick={() => handleTabChange("inventory")}
          className={`pb-3 px-3 text-[14px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "inventory" ? "text-navy" : "text-muted hover:text-slate-700"
          }`}
        >
          <Box size={16} />
          <span>Asset Inventory</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {total}
          </span>
          {activeTab === "inventory" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("requests")}
          className={`pb-3 px-3 text-[14px] font-semibold transition-colors relative flex items-center gap-2 shrink-0 lg:shrink cursor-pointer ${
            activeTab === "requests" ? "text-navy" : "text-muted hover:text-slate-700"
          }`}
        >
          <ClipboardList size={16} />
          <span>Employee Requests</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              reqPending > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {reqPending > 0 ? `${reqPending} Pending` : reqTotal}
          </span>
          {activeTab === "requests" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-t" />
          )}
        </button>
      </div>

      {/* INVENTORY TAB VIEW */}
      {activeTab === "inventory" && (
        <>
          {/* KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => setStatusFilter("All")}
              className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                statusFilter === "All" ? "border-navy ring-1 ring-navy/10" : "border-bdr hover:border-slate-300"
              }`}
            >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Total Assets</span>
            <Box size={16} className="text-slate-400" />
          </div>
          <div className="text-[22px] font-bold mt-1 text-slate-900">{total}</div>
          <div className="text-[11px] text-muted mt-0.5">All registered units</div>
        </div>

        <div
          onClick={() => setStatusFilter("Assigned")}
          className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
            statusFilter === "Assigned" ? "border-emerald-500 ring-1 ring-emerald-500/10" : "border-bdr hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Assigned</span>
            <UserCheck size={16} className="text-emerald-500" />
          </div>
          <div className="text-[22px] font-bold mt-1 text-emerald-600">{assignedCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Active with staff</div>
        </div>

        <div
          onClick={() => setStatusFilter("Available")}
          className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
            statusFilter === "Available" ? "border-blue-500 ring-1 ring-blue-500/10" : "border-bdr hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Available Stock</span>
            <CheckCircle2 size={16} className="text-blue-500" />
          </div>
          <div className="text-[22px] font-bold mt-1 text-blue-600">{availableCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Ready for deployment</div>
        </div>

        <div
          onClick={() => setStatusFilter("Under Maintenance")}
          className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
            statusFilter === "Under Maintenance" ? "border-amber-500 ring-1 ring-amber-500/10" : "border-bdr hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Maintenance</span>
            <Wrench size={16} className="text-amber-500" />
          </div>
          <div className="text-[22px] font-bold mt-1 text-amber-600">{maintenanceCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Under diagnostics</div>
        </div>

        <div
          onClick={() => setStatusFilter("Lost/Damaged")}
          className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
            statusFilter === "Lost/Damaged" ? "border-red-500 ring-1 ring-red-500/10" : "border-bdr hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-muted">Lost / Damaged</span>
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="text-[22px] font-bold mt-1 text-red-600">{lostDamagedCount}</div>
          <div className="text-[11px] text-muted mt-0.5">Incident reported</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by model, ID, serial or assignee..."
              className="pl-10 pr-4 h-9 w-full bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy"
            />
          </div>

          <div className="flex items-center gap-1.5 text-[12.5px]">
            <span className="text-muted font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy"
            >
              <option value="All">All Categories</option>
              <option value="Laptop">Laptop</option>
              <option value="Monitor">Monitor</option>
              <option value="Mobile">Mobile</option>
              <option value="Tablet">Tablet</option>
              <option value="Workstation">Workstation</option>
              <option value="Audio / Peripherals">Audio / Peripherals</option>
              <option value="Office Furniture">Office Furniture</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-[12.5px]">
            <span className="text-muted font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy"
            >
              <option value="All">All Statuses</option>
              <option value="Assigned">Assigned</option>
              <option value="Available">Available</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Lost/Damaged">Lost/Damaged</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-[12.5px]">
            <span className="text-muted font-medium">Department:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy"
            >
              <option value="All">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="Design">Design</option>
              <option value="Product">Product</option>
              <option value="Marketing">Marketing</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="IT Support">IT Support</option>
            </select>
          </div>
        </div>

        {(search || categoryFilter !== "All" || statusFilter !== "All" || deptFilter !== "All") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("All");
              setStatusFilter("All");
              setDeptFilter("All");
            }}
            className="text-[12px] text-muted hover:text-navy underline cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Assets Inventory Table */}
      <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px] border-collapse">
            <thead className="bg-off border-b border-bdr text-[11px] font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th className="py-3 px-5">Asset Details</th>
                <th className="py-3 px-5">Asset ID</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5">Serial Number</th>
                <th className="py-3 px-5">Assigned To</th>
                <th className="py-3 px-5">Department</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bdr/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted">
                    <Box size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700 text-[14px]">No assets match your search or filters.</p>
                    <p className="text-[12px] text-muted mt-0.5">Try resetting filters or registering a new asset unit.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-off/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-off border border-bdr grid place-items-center shrink-0">
                          {getCategoryIcon(r.category)}
                        </div>
                        <div>
                          <div
                            onClick={() => handleOpenDetails(r)}
                            className="font-semibold text-slate-900 hover:text-navy cursor-pointer"
                          >
                            {r.name}
                          </div>
                          <div className="text-[11.5px] text-muted flex items-center gap-1.5 mt-0.5">
                            <span className="capitalize">{r.condition || "Good"} condition</span>
                            {r.purchaseCost && r.purchaseCost !== "—" && (
                              <>
                                <span>•</span>
                                <span>{r.purchaseCost}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-[12px] font-semibold text-slate-700">
                      {r.id}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-off border border-bdr rounded-lg text-[11.5px] font-medium text-slate-700">
                        {r.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 font-mono text-[12px] text-slate-600">
                      {r.serialNumber || "—"}
                    </td>

                    <td className="py-3.5 px-5">
                      {r.status === "Assigned" && r.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-navy/10 text-navy font-bold text-[10px] grid place-items-center shrink-0">
                            {r.assignedTo.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-[12.5px]">{r.assignedTo}</div>
                            {r.employeeId && (
                              <div className="text-[10.5px] text-muted font-mono">{r.employeeId}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted text-[12px] italic">Unassigned (Stock)</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-slate-700 text-[12.5px]">
                      {r.dept || "—"}
                    </td>

                    <td className="py-3.5 px-5">
                      {getStatusBadge(r.status)}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Action: Assign or Return */}
                        {r.status === "Assigned" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReturn(r)}
                            className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1"
                            title="Return asset to inventory"
                          >
                            <RotateCcw size={13} />
                            Return
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenAssign(r)}
                            className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                            title="Assign asset to employee"
                          >
                            <UserCheck size={13} />
                            Assign
                          </button>
                        )}

                        {/* Action: Details */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(r)}
                          className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-slate-900 transition-colors cursor-pointer"
                          title="View Specifications & History"
                        >
                          <Eye size={14} />
                        </button>

                        {/* Action: Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(r)}
                          className="w-7 h-7 rounded-lg border border-bdr hover:bg-off grid place-items-center text-muted hover:text-slate-900 transition-colors cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Action: Delete */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(r)}
                          className="w-7 h-7 rounded-lg border border-bdr hover:bg-red-50 text-muted hover:text-red-600 grid place-items-center transition-colors cursor-pointer"
                          title="Decommission / Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* REQUESTS TAB VIEW */}
      {activeTab === "requests" && (
        <>
          {/* Requests KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div
              onClick={() => setReqStatusFilter("All")}
              className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                reqStatusFilter === "All" ? "border-navy ring-1 ring-navy/10" : "border-bdr hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">All Requests</span>
                <ClipboardList size={16} className="text-slate-400" />
              </div>
              <div className="text-[22px] font-bold mt-1 text-slate-900">{reqTotal}</div>
              <div className="text-[11px] text-muted mt-0.5">Submitted requisition logs</div>
            </div>

            <div
              onClick={() => setReqStatusFilter("Pending")}
              className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                reqStatusFilter === "Pending" ? "border-amber-500 ring-1 ring-amber-500/10" : "border-bdr hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Pending Review</span>
                <Clock size={16} className="text-amber-500" />
              </div>
              <div className="text-[22px] font-bold mt-1 text-amber-600">{reqPending}</div>
              <div className="text-[11px] text-muted mt-0.5">Awaiting manager/IT action</div>
            </div>

            <div
              onClick={() => setReqStatusFilter("Approved")}
              className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                reqStatusFilter === "Approved" ? "border-blue-500 ring-1 ring-blue-500/10" : "border-bdr hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Approved</span>
                <CheckCircle2 size={16} className="text-blue-500" />
              </div>
              <div className="text-[22px] font-bold mt-1 text-blue-600">{reqApproved}</div>
              <div className="text-[11px] text-muted mt-0.5">Ready for asset fulfillment</div>
            </div>

            <div
              onClick={() => setReqStatusFilter("Fulfilled")}
              className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                reqStatusFilter === "Fulfilled" ? "border-emerald-500 ring-1 ring-emerald-500/10" : "border-bdr hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Fulfilled</span>
                <UserCheck size={16} className="text-emerald-500" />
              </div>
              <div className="text-[22px] font-bold mt-1 text-emerald-600">{reqFulfilled}</div>
              <div className="text-[11px] text-muted mt-0.5">Hardware handed over</div>
            </div>

            <div
              onClick={() => setReqStatusFilter("Rejected")}
              className={`bg-white border rounded-xl p-4 shadow-xs transition-all cursor-pointer ${
                reqStatusFilter === "Rejected" ? "border-red-500 ring-1 ring-red-500/10" : "border-bdr hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted">Rejected</span>
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <div className="text-[22px] font-bold mt-1 text-red-600">{reqRejected}</div>
              <div className="text-[11px] text-muted mt-0.5">Disapproved requisitions</div>
            </div>
          </div>

          {/* Requests Search & Filters Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px] flex-1 max-w-sm">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={reqSearch}
                  onChange={(e) => setReqSearch(e.target.value)}
                  placeholder="Search requests by employee, item, department..."
                  className="pl-10 pr-4 h-9 w-full bg-off border border-bdr rounded-xl text-[13px] text-slate-800 placeholder:text-muted focus:outline-none focus:border-navy"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Status:</span>
                <select
                  value={reqStatusFilter}
                  onChange={(e) => setReqStatusFilter(e.target.value)}
                  className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Fulfilled">Fulfilled</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="text-muted font-medium">Priority:</span>
                <select
                  value={reqPriorityFilter}
                  onChange={(e) => setReqPriorityFilter(e.target.value)}
                  className="h-9 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {(reqSearch || reqStatusFilter !== "All" || reqPriorityFilter !== "All") && (
              <button
                type="button"
                onClick={() => {
                  setReqSearch("");
                  setReqStatusFilter("All");
                  setReqPriorityFilter("All");
                }}
                className="text-[12px] text-muted hover:text-navy underline cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Requests Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px] border-collapse">
                <thead className="bg-off border-b border-bdr text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="py-3 px-5">Request ID</th>
                    <th className="py-3 px-5">Employee / Requester</th>
                    <th className="py-3 px-5">Requested Hardware</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">Priority</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/50">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted">
                        <Inbox size={32} className="mx-auto text-slate-300 mb-2" />
                        <p className="font-medium text-slate-700 text-[14px]">No employee requests match your filters.</p>
                        <p className="text-[12px] text-muted mt-0.5">Click &quot;New Asset Request&quot; above to submit an employee equipment need.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-off/60 transition-colors">
                        <td className="py-3.5 px-5 font-mono text-[12px] font-semibold text-slate-700">
                          {req.id}
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-navy/10 text-navy font-bold text-[11px] grid place-items-center shrink-0">
                              {(req.employeeName || "E")
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-[12.5px]">{req.employeeName}</div>
                              <div className="text-[11px] text-muted flex items-center gap-1.5 flex-wrap">
                                <span>{req.dept}</span>
                                {req.employeeId && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{req.employeeId}</span>
                                  </>
                                )}
                                {req.source === "HRMS Dashboard" && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                                    <Send size={9} /> Dashboard
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          <div>
                            <div className="font-medium text-slate-900 text-[13px]">{req.assetName}</div>
                            {req.reason && (
                              <div className="text-[11.5px] text-muted line-clamp-1 max-w-xs mt-0.5" title={req.reason}>
                                {req.reason}
                              </div>
                            )}
                            {req.allocatedAssetId && (
                              <div className="text-[10.5px] text-emerald-700 font-mono mt-0.5 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Fulfilled via Asset: {req.allocatedAssetId}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-off border border-bdr rounded-lg text-[11.5px] font-medium text-slate-700">
                            {getCategoryIcon(req.category)}
                            <span>{req.category}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-5">
                          {getReqPriorityBadge(req.priority)}
                        </td>

                        <td className="py-3.5 px-5 text-slate-600 text-[12px]">
                          {req.requestedDate || "—"}
                        </td>

                        <td className="py-3.5 px-5">
                          {getReqStatusBadge(req.status)}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Actions for Pending */}
                            {req.status === "Pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproveRequest(req)}
                                  className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Approve Requisition"
                                >
                                  <Check size={13} />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectRequest(req)}
                                  className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 transition-colors cursor-pointer flex items-center gap-1"
                                  title="Reject Requisition"
                                >
                                  <X size={13} />
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Actions for Approved: Fulfill from inventory */}
                            {req.status === "Approved" && (
                              <button
                                type="button"
                                onClick={() => handleOpenFulfill(req)}
                                className="px-2.5 py-1 rounded-lg text-[11.5px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                                title="Allocate and fulfill request from stock inventory"
                              >
                                <UserCheck size={13} />
                                Fulfill
                              </button>
                            )}

                            {/* Delete request button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(req)}
                              className="w-7 h-7 rounded-lg border border-bdr hover:bg-red-50 text-muted hover:text-red-600 grid place-items-center transition-colors cursor-pointer"
                              title="Delete Requisition Log"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MODAL 1: ADD ASSET */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Register Company Asset" size="lg">
        <form onSubmit={handleSaveAdd} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Asset Name / Model Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MacBook Pro 16 M3 Max or Dell UltraSharp 32"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13.5px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Category</label>
              <select
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Laptop">Laptop</option>
                <option value="Monitor">Monitor</option>
                <option value="Mobile">Mobile Device</option>
                <option value="Tablet">Tablet</option>
                <option value="Workstation">Desktop / Workstation</option>
                <option value="Audio / Peripherals">Audio / Peripherals</option>
                <option value="Office Furniture">Office Furniture</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Serial / Tag Number</label>
              <input
                type="text"
                placeholder="e.g. C02G41ABMD6M"
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Initial Status</label>
              <select
                value={assetForm.status}
                onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Available">Available (In Stock)</option>
                <option value="Assigned">Assigned to Staff</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Lost/Damaged">Lost/Damaged</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Condition</label>
              <select
                value={assetForm.condition}
                onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Needs Repair">Needs Repair</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Department</label>
              <select
                value={assetForm.dept}
                onChange={(e) => setAssetForm({ ...assetForm, dept: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Product">Product</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="IT Support">IT Support</option>
              </select>
            </div>
          </div>

          {assetForm.status === "Assigned" && (
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Assignee</label>
              <select
                value={assetForm.assignedTo}
                onChange={(e) => setAssetForm({ ...assetForm, assignedTo: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id || emp.name} value={emp.name}>
                    {emp.name} — {emp.designation || emp.department} ({emp.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Purchase Date</label>
              <input
                type="date"
                value={assetForm.purchaseDate}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Purchase Cost</label>
              <input
                type="text"
                placeholder="e.g. ₹1,45,000"
                value={assetForm.purchaseCost}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Warranty Expiry</label>
              <input
                type="date"
                value={assetForm.warrantyExpiry}
                onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Hardware Notes / Specs</label>
            <textarea
              rows={2}
              placeholder="e.g. 32GB RAM, 1TB NVMe, AppleCare+ extended warranty included."
              value={assetForm.notes}
              onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs"
            >
              Register Asset
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: EDIT ASSET */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`Edit Asset: ${selectedAsset?.id || ""}`} size="lg">
        <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Asset Description</label>
            <input
              type="text"
              required
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13.5px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Category</label>
              <select
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Laptop">Laptop</option>
                <option value="Monitor">Monitor</option>
                <option value="Mobile">Mobile Device</option>
                <option value="Tablet">Tablet</option>
                <option value="Workstation">Desktop / Workstation</option>
                <option value="Audio / Peripherals">Audio / Peripherals</option>
                <option value="Office Furniture">Office Furniture</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Serial Number</label>
              <input
                type="text"
                value={assetForm.serialNumber}
                onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Status</label>
              <select
                value={assetForm.status}
                onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Available">Available</option>
                <option value="Assigned">Assigned</option>
                <option value="Under Maintenance">Under Maintenance</option>
                <option value="Lost/Damaged">Lost/Damaged</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Condition</label>
              <select
                value={assetForm.condition}
                onChange={(e) => setAssetForm({ ...assetForm, condition: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Needs Repair">Needs Repair</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Department</label>
              <select
                value={assetForm.dept}
                onChange={(e) => setAssetForm({ ...assetForm, dept: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Product">Product</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="IT Support">IT Support</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Purchase Date</label>
              <input
                type="date"
                value={assetForm.purchaseDate}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Purchase Cost</label>
              <input
                type="text"
                value={assetForm.purchaseCost}
                onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Warranty Expiry</label>
              <input
                type="date"
                value={assetForm.warrantyExpiry}
                onChange={(e) => setAssetForm({ ...assetForm, warrantyExpiry: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Notes</label>
            <textarea
              rows={2}
              value={assetForm.notes}
              onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: ASSIGN ASSET */}
      <Modal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} title={`Assign Asset: ${selectedAsset?.name || ""}`}>
        <form onSubmit={handleSaveAssign} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-[12.5px] text-blue-900">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              Allocating <span className="font-semibold">{selectedAsset?.id}</span> ({selectedAsset?.name}). An assignment audit entry will be automatically generated.
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Select Employee <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={assignForm.employeeName}
              onChange={(e) => {
                const matched = employees.find((emp) => emp.name === e.target.value);
                setAssignForm({
                  ...assignForm,
                  employeeName: e.target.value,
                  employeeId: matched?.id || "",
                  dept: matched?.department || assignForm.dept,
                });
              }}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id || emp.name} value={emp.name}>
                  {emp.name} — {emp.designation || emp.department} ({emp.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Department</label>
            <input
              type="text"
              readOnly
              value={assignForm.dept}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-slate-100 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Handover Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Handed over with charger, power cable and neoprene sleeve."
              value={assignForm.notes}
              onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsAssignOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-[13px] font-medium hover:bg-emerald-700 cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <UserCheck size={15} />
              Confirm Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: RETURN ASSET */}
      <Modal isOpen={isReturnOpen} onClose={() => setIsReturnOpen(false)} title={`Return Asset: ${selectedAsset?.name || ""}`}>
        <form onSubmit={handleSaveReturn} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-start gap-2.5 text-[12.5px] text-amber-900">
            <RotateCcw size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              Returning from <span className="font-semibold">{selectedAsset?.assignedTo}</span> to warehouse inventory stock.
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Inspection Condition</label>
            <select
              value={returnForm.condition}
              onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            >
              <option value="Excellent">Excellent (No defects, factory condition)</option>
              <option value="Good">Good (Normal cosmetic wear)</option>
              <option value="Fair">Fair (Noticeable scratches / signs of usage)</option>
              <option value="Needs Repair">Needs Repair (Sent to maintenance)</option>
            </select>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Check-in Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Checked all ports and display; wiped clean and returned to stock."
              value={returnForm.notes}
              onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsReturnOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <RotateCcw size={15} />
              Confirm Return
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: ASSET DETAILS & HISTORY */}
      <Modal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} title="Asset Specifications & History" size="lg">
        {selectedAsset && (
          <div className="flex flex-col gap-5">
            {/* Asset Headline */}
            <div className="flex flex-wrap lg:flex-nowrap items-start justify-between gap-3 lg:gap-0 p-4 bg-off border border-bdr rounded-2xl">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white border border-bdr grid place-items-center shrink-0">
                  {getCategoryIcon(selectedAsset.category)}
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-slate-900">{selectedAsset.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[12px] bg-white border border-bdr px-2 py-0.5 rounded-md font-semibold text-slate-700">
                      {selectedAsset.id}
                    </span>
                    <span className="text-[12px] text-muted">•</span>
                    <span className="text-[12px] text-muted">{selectedAsset.category}</span>
                  </div>
                </div>
              </div>
              <div>{getStatusBadge(selectedAsset.status)}</div>
            </div>

            {/* Spec Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Serial Number</div>
                <div className="font-mono font-medium text-[12.5px] text-slate-900 mt-1 truncate">
                  {selectedAsset.serialNumber || "—"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Assigned Holder</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1 truncate">
                  {selectedAsset.status === "Assigned" ? selectedAsset.assignedTo : "In Stock"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Department</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1 truncate">
                  {selectedAsset.dept || "—"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Condition</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1 truncate capitalize">
                  {selectedAsset.condition || "Good"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Purchase Date</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1">
                  {selectedAsset.purchaseDate || "—"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Purchase Cost</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1">
                  {selectedAsset.purchaseCost || "—"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Warranty Expiry</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1">
                  {selectedAsset.warrantyExpiry || "—"}
                </div>
              </div>

              <div className="p-3 bg-white border border-bdr rounded-xl">
                <div className="text-[11px] text-muted uppercase font-semibold">Logged Actions</div>
                <div className="font-medium text-[12.5px] text-slate-900 mt-1">
                  {selectedAsset.history?.length || 1} entries
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedAsset.notes && (
              <div className="p-3.5 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700">
                <span className="font-semibold text-slate-900">Notes &amp; Specs: </span>
                {selectedAsset.notes}
              </div>
            )}

            {/* History Timeline */}
            <div>
              <h4 className="font-bold text-[13.5px] text-slate-900 flex items-center gap-1.5 mb-3">
                <History size={15} className="text-navy" />
                Custody &amp; Event Log
              </h4>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {(selectedAsset.history || []).map((h, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-bdr bg-white flex items-start justify-between gap-3 text-[12px]">
                    <div>
                      <div className="font-semibold text-slate-800">{h.action}</div>
                      <div className="text-muted mt-0.5">{h.notes}</div>
                    </div>
                    <div className="text-right shrink-0 text-muted">
                      <div>{h.date}</div>
                      <div className="text-[11px]">{h.by}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-bdr">
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 6: DELETE CONFIRMATION */}
      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Decommission Asset">
        <div className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-[12.5px] text-red-900">
            <AlertTriangle size={17} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              Are you sure you want to decommission / delete{" "}
              <span className="font-bold text-red-950">{selectedAsset?.id}</span> ({selectedAsset?.name})? This action will permanently remove the asset and its history logs.
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-medium cursor-pointer shadow-xs"
            >
              Delete Asset
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 7: NEW ASSET REQUEST */}
      <Modal
        isOpen={isAddReqOpen}
        onClose={() => setIsAddReqOpen(false)}
        title="Submit Employee Asset Requisition"
        size="lg"
      >
        <form onSubmit={handleSaveAddReq} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-[12.5px] text-blue-900 flex items-start gap-2.5">
            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              Submit equipment and workstation needs for staff. Approved requests can be immediately fulfilled from available inventory.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Requester / Employee <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={requestForm.employeeName}
                onChange={(e) => {
                  const emp = employees.find((x) => x.name === e.target.value);
                  setRequestForm({
                    ...requestForm,
                    employeeName: e.target.value,
                    employeeId: emp?.id || "",
                    dept: emp?.department || requestForm.dept,
                  });
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="">Select Employee</option>
                {employees.map((emp) => (
                  <option key={emp.id || emp.name} value={emp.name}>
                    {emp.name} — {emp.designation || emp.department} ({emp.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Department</label>
              <select
                value={requestForm.dept}
                onChange={(e) => setRequestForm({ ...requestForm, dept: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Product">Product</option>
                <option value="Marketing">Marketing</option>
                <option value="HR">HR</option>
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="IT Support">IT Support</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={requestForm.category}
                onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="Laptop">Laptop</option>
                <option value="Monitor">Monitor</option>
                <option value="Mobile">Mobile Device</option>
                <option value="Tablet">Tablet</option>
                <option value="Workstation">Desktop / Workstation</option>
                <option value="Audio / Peripherals">Audio / Peripherals</option>
                <option value="Office Furniture">Office Furniture</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Priority</label>
              <select
                value={requestForm.priority}
                onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="High">High (Critical / Blocker)</option>
                <option value="Medium">Medium (Standard Need)</option>
                <option value="Low">Low (Upgrade / Nice to Have)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Requested Hardware / Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. MacBook Pro 14 M3 or 27-inch 4K monitor"
              value={requestForm.assetName}
              onChange={(e) => setRequestForm({ ...requestForm, assetName: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13.5px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
              Business Justification / Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="Why is this equipment necessary? e.g. Current laptop running out of memory for Docker simulations."
              value={requestForm.reason}
              onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy resize-none"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">Additional Notes / Specs</label>
            <input
              type="text"
              placeholder="e.g. Preferred minimum 32GB RAM or ergonomic arm"
              value={requestForm.notes}
              onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
            />
          </div>

          <div className="flex justify-end gap-2.5 mt-2 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsAddReqOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-navy text-white rounded-xl text-[13px] font-medium hover:bg-navy/90 cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Send size={14} />
              Submit Request
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 8: FULFILL REQUEST FROM INVENTORY */}
      <Modal
        isOpen={isFulfillModalOpen}
        onClose={() => setIsFulfillModalOpen(false)}
        title="Fulfill Asset Requisition"
        size="md"
      >
        <form onSubmit={handleConfirmFulfill} className="flex flex-col gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-bdr text-[12.5px] text-slate-700 space-y-1">
            <div>
              <span className="font-semibold text-slate-900">Requester: </span>
              {selectedRequest?.employeeName} ({selectedRequest?.dept})
            </div>
            <div>
              <span className="font-semibold text-slate-900">Requested Hardware: </span>
              {selectedRequest?.assetName} ({selectedRequest?.category})
            </div>
            {selectedRequest?.reason && (
              <div className="text-muted text-[11.5px] pt-1 italic">
                &ldquo;{selectedRequest?.reason}&rdquo;
              </div>
            )}
          </div>

          {availableAssets.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                There are currently no assets with <strong>&quot;Available&quot;</strong> status in stock.
                Please register a new asset or return an existing asset to fulfill this request.
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[12.5px] font-semibold text-slate-700 mb-1.5">
                Select Available Stock Asset <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={fulfillAssetId}
                onChange={(e) => setFulfillAssetId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-bdr text-[13px] bg-off focus:bg-white focus:outline-none focus:border-navy"
              >
                <option value="">Choose asset to allocate...</option>
                {availableAssets.map((ast) => (
                  <option key={ast.id} value={ast.id}>
                    {ast.id} — {ast.name} ({ast.category}) [SN: {ast.serialNumber || "N/A"}]
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] text-muted mt-1.5">
                Selected asset will be updated to <strong>&quot;Assigned&quot;</strong> under {selectedRequest?.employeeName}, and the request will be marked <strong>&quot;Fulfilled&quot;</strong>.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-bdr">
            <button
              type="button"
              onClick={() => setIsFulfillModalOpen(false)}
              className="px-4 py-2 border border-bdr rounded-xl text-[13px] hover:bg-off font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={availableAssets.length === 0 || !fulfillAssetId}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[13px] font-medium cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              Confirm Allocation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const Assets = AssetsPage;
export default AssetsPage;

