import { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, Search, Calendar as CalendarIcon, X } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import Modal from "../../../components/ui/Modal";
import { ConfirmModal } from "../../../components/hrms/Shared";
import { PageInfoButton } from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

const SAMPLE_REQUESTS = [];

const DEPARTMENTS = ["All", "Engineering", "Design", "Marketing", "HR", "Finance", "Operations"];
const TYPES = ["All", "Regularization", "Early Clock-Out"];
const STATUSES = ["All", "Pending", "Approved", "Rejected", "Cancelled"];

const typeStyles = {
  Regularization: { background: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Early Clock-Out": { background: "#f3e8ff", color: "#7e22ce", border: "#d8b4fe" },
};

const statusStyles = {
  Pending: { background: "#fef3c7", color: "#b45309", border: "#fde68a" },
  Approved: { background: "#e6f4ea", color: "#15803d", border: "#a7f3d0" },
  Rejected: { background: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  Cancelled: { background: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

export default function Requests() {
  const setToast = useAppStore((s) => s.setToast || s.showToast);
  const storeEmployees = useAppStore((s) => s.employees || []);
  const currentUser = useAppStore((s) => s.currentUser);
  const reviewerName = currentUser?.name || "HR Manager";
  const storeRequests = useAttendanceStore((s) => s.requests || []);
  const setStoreRequestStatus = useAttendanceStore((s) => s.setRequestStatus);
  const addStoreRequest = useAttendanceStore((s) => s.addRequest);

  // Normalize requests
  const requestsList = useMemo(() => {
    if (storeRequests && storeRequests.length > 0) {
      return storeRequests.map((r) => ({
        ...r,
        avatar: r.avatar || `https://i.pravatar.cc/100?u=${r.id || r.employee}`,
        dept: r.dept || "General",
        submitted: r.submitted || "Recent",
      }));
    }
    return SAMPLE_REQUESTS;
  }, [storeRequests]);

  const [tab, setTab] = useState("All");

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");

  const [selectedReq, setSelectedReq] = useState(null);
  const [approveId, setApproveId] = useState(null);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [showRegModal, setShowRegModal] = useState(false);
  const [showEarlyModal, setShowEarlyModal] = useState(false);

  const [regForm, setRegForm] = useState({
    employee: "",
    date: new Date().toISOString().slice(0, 10),
    curIn: "",
    curOut: "",
    reqIn: "09:30",
    reqOut: "18:30",
    reason: "",
  });

  const [earlyForm, setEarlyForm] = useState({
    employee: "",
    date: new Date().toISOString().slice(0, 10),
    curIn: "",
    curOut: "",
    reqOut: "16:30",
    reason: "",
  });

  const filtered = useMemo(() => {
    return requestsList.filter((r) => {
      if (tab !== "All" && r.type !== tab) return false;
      if (
        search &&
        !(
          String(r.employee ?? '').toLowerCase().includes(search.toLowerCase()) ||
          String(r.id ?? '').toLowerCase().includes(search.toLowerCase())
        )
      )
        return false;
      if (deptFilter !== "All" && r.dept !== deptFilter) return false;
      if (typeFilter !== "All" && r.type !== typeFilter) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      return true;
    });
  }, [requestsList, tab, search, deptFilter, typeFilter, statusFilter]);

  const countForTab = (t) => {
    if (t === "All") return requestsList.length;
    return requestsList.filter((r) => r.type === t).length;
  };

  const handleClearFilters = () => {
    setSearch("");
    setDeptFilter("All");
    setTypeFilter("All");
    setStatusFilter("All");
    setDateFilter("");
  };

  const handleApprove = (id) => {
    setStoreRequestStatus(id, "Approved", { reviewer: reviewerName });
    setToast("Attendance request approved.");
    setApproveId(null);
    if (selectedReq?.id === id) {
      setSelectedReq((prev) => ({ ...prev, status: "Approved", reviewer: reviewerName }));
    }
  };

  const handleReject = () => {
    if (!rejectId) return;
    setStoreRequestStatus(rejectId, "Rejected", { reviewer: reviewerName, rejectReason });
    setToast("Attendance request rejected.");
    setRejectId(null);
    setRejectReason("");
    if (selectedReq?.id === rejectId) {
      setSelectedReq((prev) => ({ ...prev, status: "Rejected", rejectReason }));
    }
  };

  const handleRegSubmit = () => {
    if (!regForm.employee) return setToast("Please select an employee.", "error");
    if (!regForm.reason) return setToast("Please enter reason for regularization.", "error");
    addStoreRequest({
      employee: regForm.employee,
      dept: "General",
      type: "Regularization",
      date: regForm.date || new Date().toISOString().slice(0, 10),
      currentIn: regForm.curIn,
      currentOut: regForm.curOut,
      requestedIn: regForm.reqIn,
      requestedOut: regForm.reqOut,
      reason: regForm.reason,
      requestedBy: regForm.employee,
      status: "Pending",
    });
    setToast("Regularization request submitted successfully.");
    setShowRegModal(false);
    setRegForm({
      employee: "",
      date: new Date().toISOString().slice(0, 10),
      curIn: "",
      curOut: "",
      reqIn: "09:30",
      reqOut: "18:30",
      reason: "",
    });
  };

  const handleEarlySubmit = () => {
    if (!earlyForm.employee) return setToast("Please select an employee.", "error");
    if (!earlyForm.reason) return setToast("Please enter reason for early clock-out.", "error");
    addStoreRequest({
      employee: earlyForm.employee,
      dept: "General",
      type: "Early Clock-Out",
      date: earlyForm.date || new Date().toISOString().slice(0, 10),
      currentIn: earlyForm.curIn,
      currentOut: earlyForm.curOut,
      requestedIn: earlyForm.curIn,
      requestedOut: earlyForm.reqOut,
      reason: earlyForm.reason,
      requestedBy: earlyForm.employee,
      status: "Pending",
    });
    setToast("Early clock-out request submitted successfully.");
    setShowEarlyModal(false);
    setEarlyForm({
      employee: "",
      date: new Date().toISOString().slice(0, 10),
      curIn: "",
      curOut: "",
      reqOut: "16:30",
      reason: "",
    });
  };

  return (
    <div className="req-page">
      {/* Breadcrumbs */}
      <nav className="req-crumb">
        <span style={{ cursor: "pointer" }}>Home</span>
        <ChevronRight size={13} style={{ color: "#9aa7bd" }} />
        <span style={{ color: "#111f36", fontWeight: 600 }}>Attendance / Attendance Requests</span>
      </nav>

      {/* Header Row */}
      <div className="req-title-row">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="req-title">Attendance Requests</h1>
            <PageInfoButton guide={hrmsGuides.attendanceRequests} />
          </div>
          <p className="req-sub">Single request management for regularization &amp; early clock-out.</p>
        </div>
        <div className="flex-wrap lg:flex-nowrap" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={() => setShowRegModal(true)} className="req-btn-outline">
            Regularize
          </button>
          <button type="button" onClick={() => setShowEarlyModal(true)} className="req-btn-primary">
            Early Clock-Out Request
          </button>
        </div>
      </div>

      {/* Filter Tabs Pills */}
      <div className="req-tabs">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? "req-tab active" : "req-tab"}
          >
            {t} ({countForTab(t)})
          </button>
        ))}
      </div>

      {/* Filter Bar Card */}
      <div className="req-card req-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Search Box */}
          <div className="req-search-wrap">
            <Search size={15} style={{ color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="req-search-input"
            />
          </div>

          {/* Dropdown Filters */}
          <div className={`req-filter-dropdown ${deptFilter !== "All" ? "active" : ""}`}>
            <span className="req-filter-text">
              {deptFilter === "All" ? "Department" : deptFilter}
            </span>
            <ChevronDown size={13} className="req-filter-arrow" />
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="req-filter-native-select"
              aria-label="Department Filter"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className={`req-filter-dropdown ${typeFilter !== "All" ? "active" : ""}`}>
            <span className="req-filter-text">
              {typeFilter === "All" ? "Request Type" : typeFilter}
            </span>
            <ChevronDown size={13} className="req-filter-arrow" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="req-filter-native-select"
              aria-label="Request Type Filter"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className={`req-filter-dropdown ${statusFilter !== "All" ? "active" : ""}`}>
            <span className="req-filter-text">
              {statusFilter === "All" ? "Status" : statusFilter}
            </span>
            <ChevronDown size={13} className="req-filter-arrow" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="req-filter-native-select"
              aria-label="Status Filter"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker Input */}
          <div className="req-date-wrap">
            <span>{dateFilter ? dateFilter.split("-").reverse().join("-") : "dd-mm-yyyy"}</span>
            <CalendarIcon size={14} style={{ color: "#475569" }} />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="req-date-native"
              aria-label="Filter date"
            />
          </div>

          <button type="button" onClick={handleClearFilters} className="req-btn-clear">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Main Requests Table */}
      <div className="req-card req-main-card">
        <div style={{ overflowX: "auto" }}>
          <table className="req-table">
            <thead>
              <tr>
                <th>REQUEST ID</th>
                <th>EMPLOYEE</th>
                <th>REQUEST TYPE</th>
                <th>DATE</th>
                <th>CURRENT ATTENDANCE</th>
                <th>REQUESTED ATTENDANCE</th>
                <th>REASON</th>
                <th>REQUESTED BY</th>
                <th>SUBMITTED</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => setSelectedReq(r)}
                      className="req-id-link"
                    >
                      {r.id}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={r.avatar} alt={r.employee} className="req-avatar" loading="lazy" />
                      <div>
                        <span style={{ fontWeight: 600, color: "#111827", display: "inline-block", marginRight: 6 }}>
                          {r.employee}
                        </span>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>{r.dept}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="req-type-pill" style={{ ...typeStyles[r.type] }}>
                      {r.type}
                    </span>
                  </td>
                  <td className="req-date">{r.date}</td>
                  <td className="req-time">{r.currentIn === "—" ? "—" : `${r.currentIn}-${r.currentOut}`}</td>
                  <td className="req-time">{`${r.requestedIn}-${r.requestedOut}`}</td>
                  <td className="req-reason" title={r.reason}>
                    {r.reason}
                  </td>
                  <td style={{ color: "#374151" }}>{r.requestedBy}</td>
                  <td style={{ color: "#6b7280" }}>{r.submitted}</td>
                  <td>
                    <span className="req-status" style={{ ...statusStyles[r.status] }}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.status === "Pending" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setApproveId(r.id)}
                          className="req-btn-approve"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectId(r.id)}
                          className="req-btn-reject"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedReq(r)}
                        className="req-btn-view"
                      >
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                    No attendance requests found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer Modal */}
      <Modal
        isOpen={Boolean(selectedReq)}
        onClose={() => setSelectedReq(null)}
        title={`Request Details — ${selectedReq?.id || ""}`}
        footer={
          selectedReq?.status === "Pending" ? (
            <>
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setRejectId(selectedReq.id);
                  setSelectedReq(null);
                }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  handleApprove(selectedReq.id);
                }}
              >
                Approve Request
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setSelectedReq(null)}>
              Close
            </button>
          )
        }
      >
        {selectedReq && (
          <div style={{ display: "grid", gap: 16, fontSize: "13.5px", color: "#334155" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={selectedReq.avatar} alt={selectedReq.employee} style={{ width: 44, height: 44, borderRadius: 999 }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{selectedReq.employee}</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  {selectedReq.dept} • Requested: {selectedReq.submitted}
                </p>
              </div>
            </div>

            <div className="form-row">
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Current Attendance</span>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: "#111827" }}>
                  {selectedReq.currentIn === "—" ? "—" : `${selectedReq.currentIn} – ${selectedReq.currentOut}`}
                </div>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Requested Attendance</span>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: "#111827" }}>
                  {selectedReq.requestedIn} – {selectedReq.requestedOut}
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Reason</span>
              <div style={{ marginTop: 4, padding: 12, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#111827" }}>
                {selectedReq.reason}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
              <div><strong>Type:</strong> {selectedReq.type}</div>
              <div><strong>Status:</strong> <span className="req-status" style={{ ...statusStyles[selectedReq.status] }}>{selectedReq.status}</span></div>
              <div><strong>Requested By:</strong> {selectedReq.requestedBy}</div>
              {selectedReq.reviewer && <div><strong>Reviewer:</strong> {selectedReq.reviewer}</div>}
            </div>

            {selectedReq.rejectReason && (
              <div style={{ padding: 12, background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, color: "#991b1b" }}>
                <strong>Rejection Reason:</strong> {selectedReq.rejectReason}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Regularize Attendance Modal */}
      <Modal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        title="Regularize Attendance Request"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowRegModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleRegSubmit}>
              Submit Request
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Employee</label>
            <select
              className="form-select"
              value={regForm.employee}
              onChange={(e) => setRegForm({ ...regForm, employee: e.target.value })}
            >
              <option value="">Select employee…</option>
              {storeEmployees.map((e) => e.name).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Current Check In</label>
              <input
                className="form-input"
                value={regForm.curIn}
                onChange={(e) => setRegForm({ ...regForm, curIn: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Check Out</label>
              <input
                className="form-input"
                value={regForm.curOut}
                onChange={(e) => setRegForm({ ...regForm, curOut: e.target.value })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Requested Check In</label>
              <input
                className="form-input"
                value={regForm.reqIn}
                onChange={(e) => setRegForm({ ...regForm, reqIn: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Requested Check Out</label>
              <input
                className="form-input"
                value={regForm.reqOut}
                onChange={(e) => setRegForm({ ...regForm, reqOut: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reason for Correction <span className="required">*</span></label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain miss check-in or correction details..."
              value={regForm.reason}
              onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Early Clock-Out Modal */}
      <Modal
        isOpen={showEarlyModal}
        onClose={() => setShowEarlyModal(false)}
        title="Early Clock-Out Request"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowEarlyModal(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleEarlySubmit}>
              Submit Request
            </button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Employee</label>
            <select
              className="form-select"
              value={earlyForm.employee}
              onChange={(e) => setEarlyForm({ ...earlyForm, employee: e.target.value })}
            >
              <option value="">Select employee…</option>
              {storeEmployees.map((e) => e.name).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Current Check In</label>
              <input
                className="form-input"
                value={earlyForm.curIn}
                onChange={(e) => setEarlyForm({ ...earlyForm, curIn: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Current Check Out</label>
              <input
                className="form-input"
                value={earlyForm.curOut}
                onChange={(e) => setEarlyForm({ ...earlyForm, curOut: e.target.value })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Requested Early Check Out Time</label>
            <input
              className="form-input"
              value={earlyForm.reqOut}
              onChange={(e) => setEarlyForm({ ...earlyForm, reqOut: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Reason for Early Clock-Out <span className="required">*</span></label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Explain personal appointment or medical reason..."
              value={earlyForm.reason}
              onChange={(e) => setEarlyForm({ ...earlyForm, reason: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmModal
        open={Boolean(approveId)}
        title="Approve Attendance Request?"
        desc="This will update the employee's attendance record and mark the request as approved."
        confirmLabel="Approve"
        onClose={() => setApproveId(null)}
        onConfirm={() => handleApprove(approveId)}
      />

      <ConfirmModal
        open={Boolean(rejectId)}
        title="Reject Request"
        desc="Please enter a rejection reason."
        confirmLabel="Reject Request"
        danger
        onClose={() => {
          setRejectId(null);
          setRejectReason("");
        }}
        onConfirm={handleReject}
        requireReason
        reason={rejectReason}
        setReason={setRejectReason}
      />

      <style>{`
        .req-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .req-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .req-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .req-title { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
        .req-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }

        .req-btn-outline { background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 8px 18px; font-size: 13.5px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .req-btn-outline:hover { background: #f9fafb; }
        .req-btn-primary { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .req-btn-primary:hover { background: #0f172a; }

        .req-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; margin-bottom: 16px; }
        .req-tab { border: 1.5px solid transparent; border-radius: 999px; padding: 5px 16px; font-size: 13px; font-weight: 500; color: #8e9baa; background: transparent; cursor: pointer; transition: all 0.15s ease; }
        .req-tab.active { font-weight: 600; color: #000000; background: #ffffff; border-color: #000000; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

        .req-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .req-filter-card { border: none; padding: 14px 18px; margin-bottom: 16px; }

        .req-search-wrap { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 12px; min-width: 170px; }
        .req-search-input { border: none; background: transparent; font-size: 13px; color: #1e293b; outline: none; width: 100%; }

        .req-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 120px; cursor: pointer; }
        .req-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .req-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 90px; }
        .req-select:focus { border-color: #94a3b8; background-color: #fff; }
        .req-select-active { border-color: #3b82f6 !important; background-color: #eff6ff !important; color: #1d4ed8 !important; font-weight: 600 !important; }

        .req-filter-dropdown { position: relative; display: inline-flex; align-items: center; justify-content: space-between; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0 12px; height: 35px; cursor: pointer; transition: all 0.15s ease; box-sizing: border-box; }
        .req-filter-dropdown:hover { border-color: #cbd5e1; background: #f1f5f9; }
        .req-filter-dropdown.active { border-color: #3b82f6; background: #eff6ff; }
        .req-filter-text { font-size: 13px; color: #374151; font-weight: 500; white-space: nowrap; user-select: none; }
        .req-filter-dropdown.active .req-filter-text { color: #1d4ed8; font-weight: 600; }
        .req-filter-arrow { color: #64748b; flex-shrink: 0; pointer-events: none; }
        .req-filter-dropdown.active .req-filter-arrow { color: #2563eb; }
        .req-filter-native-select { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .req-btn-clear { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 14px; font-size: 13px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .req-btn-clear:hover { background: #f8fafc; color: #111827; }

        .req-main-card { overflow: hidden; }
        .req-table { width: 100%; border-collapse: collapse; min-width: 1000px; font-size: 13.5px; }
        .req-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .req-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 18px; white-space: nowrap; }
        .req-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .req-table tbody tr:hover { background: #f8fafc; }
        .req-table td { padding: 14px 18px; vertical-align: middle; }

        .req-id-link { background: transparent; border: none; font-family: inherit; font-size: 13px; font-weight: 600; color: #111827; text-decoration: underline; cursor: pointer; padding: 0; }
        .req-avatar { width: 32px; height: 32px; border-radius: 999px; object-fit: cover; }
        .req-type-pill { display: inline-block; font-size: 12px; font-weight: 500; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }
        .req-date { font-family: inherit; font-size: 12.5px; color: #111827; white-space: nowrap; }
        .req-time { font-family: inherit; font-size: 12.5px; color: #374151; white-space: nowrap; }
        .req-reason { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #374151; }
        .req-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }

        .req-btn-approve { background: #059669; color: #fff; border: none; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.15s ease; }
        .req-btn-approve:hover { background: #047857; }
        .req-btn-reject { background: #fff; border: 1px solid #d1d5db; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #475569; cursor: pointer; transition: background 0.15s ease; }
        .req-btn-reject:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
        .req-btn-view { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .req-btn-view:hover { background: #f8fafc; color: #111827; }
        @media (max-width: 1023px) {
          .req-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .req-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .req-page { padding: 14px 14px 22px; }
          .req-filter-card { padding: 12px 14px; }
          .req-search-wrap { flex: 1 1 100%; min-width: 0; }
          .req-tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
          .req-tab { flex-shrink: 0; white-space: nowrap; }
        }
      `}</style>
    </div>
  );
}
