import { useState, useMemo } from "react";
import { ChevronRight, X } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import Modal from "../../../components/ui/Modal";
import { PageInfoButton } from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

const DEFAULT_EMPLOYEES = [];

const MONTHS = ["October", "September", "August", "July", "June", "May"];
const YEARS = ["2024", "2023"];

const SAMPLE_RECORDS = [];

const statusStyles = {
  Present: { background: "#e6f4ea", color: "#15803d", border: "#a7f3d0" },
  Late: { background: "#fef3c7", color: "#b45309", border: "#fde68a" },
  Absent: { background: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  WFH: { background: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  "On Leave": { background: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  "Half Day": { background: "#f3e8ff", color: "#7e22ce", border: "#d8b4fe" },
};

export default function IndividualAttendance() {
  const setToast = useAppStore((s) => s.setToast || s.showToast);
  const storeEmployees = useAppStore((s) => s.employees || []);
  const storeRecords = useAttendanceStore((s) => s.records || []);
  const updateStoreRecord = useAttendanceStore((s) => s.updateRecord);

  const employeesList = useMemo(() => {
    if (storeEmployees && storeEmployees.length > 0) {
      return storeEmployees.map((e) => ({
        id: e.id || `EMP${e.employeeId || "1024"}`,
        name: e.name,
        designation: e.designation || e.role || "Employee",
        dept: e.department || e.dept || "General",
        manager: e.manager || "HR Manager",
        status: e.status || "Active",
        avatar: e.avatar || `https://i.pravatar.cc/100?u=${e.id || e.name}`,
      }));
    }
    return DEFAULT_EMPLOYEES;
  }, [storeEmployees]);

  const [selectedEmpId, setSelectedEmpId] = useState(() => employeesList[0]?.id || "");
  const [selectedMonth, setSelectedMonth] = useState("October");
  const [selectedYear, setSelectedYear] = useState("2024");
  const [viewMode, setViewMode] = useState("Table");

  const [records, setRecords] = useState(SAMPLE_RECORDS);
  const [editItem, setEditItem] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const currentEmp = useMemo(
    () => employeesList.find((e) => e.id === selectedEmpId) || employeesList[0] || null,
    [employeesList, selectedEmpId]
  );

  const stats = useMemo(() => {
    return {
      present: records.filter((r) => r.status === "Present").length,
      absent: records.filter((r) => r.status === "Absent").length,
      late: records.filter((r) => r.status === "Late").length,
      leave: records.filter((r) => r.status === "On Leave").length,
      wfh: records.filter((r) => r.status === "WFH").length,
      overtime: "0h",
    };
  }, [records]);

  const handleEditSave = () => {
    if (!editItem) return;
    setRecords((prev) =>
      prev.map((r) => (r.date === editItem.date ? { ...r, ...editItem } : r))
    );
    // If this date corresponds to the active record in store, sync it
    if (updateStoreRecord) {
      updateStoreRecord(selectedEmpId, {
        checkIn: editItem.checkIn,
        checkOut: editItem.checkOut,
        status: editItem.status,
      });
    }
    setToast(`Attendance record for ${editItem.date} updated.`);
    setEditItem(null);
  };

  return (
    <div className="ind-att-page">
      {/* Breadcrumb */}
      <nav className="ind-crumb">
        <span style={{ cursor: "pointer" }}>Home</span>
        <ChevronRight size={13} style={{ color: "#9aa7bd" }} />
        <span style={{ color: "#111f36", fontWeight: 600 }}>Attendance / Individual Attendance</span>
      </nav>

      {/* Header Row */}
      <div className="ind-title-row">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="ind-title">Individual Attendance</h1>
            <PageInfoButton guide={hrmsGuides.attendanceIndividual} />
          </div>
          <p className="ind-sub">View and manage per-employee attendance history.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="ind-card ind-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
            className="ind-select ind-select-emp"
          >
            <option value="">Select employee…</option>
            {employeesList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.id}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="ind-select"
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="ind-select"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div className="ind-tabs">
          <button
            type="button"
            onClick={() => setViewMode("Table")}
            className={viewMode === "Table" ? "ind-tab active" : "ind-tab"}
          >
            Table View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("Calendar")}
            className={viewMode === "Calendar" ? "ind-tab active" : "ind-tab"}
          >
            Calendar View
          </button>
        </div>
      </div>

      {/* Hero Employee Card */}
      {currentEmp ? (
      <div className="ind-card ind-hero-card">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={currentEmp.avatar} alt={currentEmp.name} className="ind-hero-avatar" />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                {currentEmp.name}
              </h3>
              <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{currentEmp.id}</span>
            </div>
            <div style={{ margin: "4px 0 0", fontSize: "13px", color: "#6b7280" }}>
              {currentEmp.designation} • {currentEmp.dept} • Manager: {currentEmp.manager} •{" "}
              <span className="ind-status-pill">{currentEmp.status}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowProfileModal(true)}
          className="ind-btn-view-emp"
        >
          View Employee
        </button>
      </div>
      ) : (
      <div className="ind-card" style={{ padding: "28px", textAlign: "center", color: "#6b7280", marginBottom: 16 }}>
        No employees found. Add employees to view individual attendance.
      </div>
      )}

      {/* Stats Cards Row (6 Cards) */}
      <div className="ind-stats-grid">
        <div className="ind-stat-card">
          <span className="ind-stat-label">PRESENT DAYS</span>
          <span className="ind-stat-val">{stats.present}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">ABSENT DAYS</span>
          <span className="ind-stat-val">{stats.absent}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">LATE DAYS</span>
          <span className="ind-stat-val">{stats.late}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">LEAVE DAYS</span>
          <span className="ind-stat-val">{stats.leave}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">WFH DAYS</span>
          <span className="ind-stat-val">{stats.wfh}</span>
        </div>
        <div className="ind-stat-card">
          <span className="ind-stat-label">OVERTIME HOURS</span>
          <span className="ind-stat-val">{stats.overtime}</span>
        </div>
      </div>

      {/* Table or Calendar View */}
      {viewMode === "Table" ? (
        <div className="ind-card ind-main-card">
          <div style={{ overflowX: "auto" }}>
            <table className="ind-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>DAY</th>
                  <th>CHECK IN</th>
                  <th>CHECK OUT</th>
                  <th>WORK HOURS</th>
                  <th>SHIFT</th>
                  <th>STATUS</th>
                  <th>REMARKS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td className="ind-date">{r.date}</td>
                    <td style={{ color: "#374151" }}>{r.day}</td>
                    <td className="ind-time">{r.checkIn}</td>
                    <td className="ind-time">{r.checkOut}</td>
                    <td className="ind-time">{r.workHours}</td>
                    <td style={{ color: "#374151" }}>{r.shift}</td>
                    <td>
                      <span className="ind-status" style={{ ...statusStyles[r.status] }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ color: "#6b7280" }}>{r.remarks || "—"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setEditItem({ ...r })}
                        className="ind-btn-edit"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                      No attendance records found for this employee.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="ind-card" style={{ padding: "20px" }}>
          <div className="ind-cal-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="ind-cal-header">
                {d}
              </div>
            ))}
            {records.map((r, i) => (
              <div key={i} className="ind-cal-cell" onClick={() => setEditItem({ ...r })}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>
                  {i + 1}
                </span>
                <span className="ind-status" style={{ ...statusStyles[r.status], marginTop: 4 }}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      <Modal
        isOpen={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title={`Edit Attendance — ${editItem?.date || ""}`}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setEditItem(null)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={handleEditSave}>
              Save Record
            </button>
          </>
        }
      >
        {editItem && (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Check In Time</label>
                <input
                  className="form-input"
                  value={editItem.checkIn}
                  onChange={(e) => setEditItem({ ...editItem, checkIn: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Check Out Time</label>
                <input
                  className="form-input"
                  value={editItem.checkOut}
                  onChange={(e) => setEditItem({ ...editItem, checkOut: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={editItem.status}
                  onChange={(e) => setEditItem({ ...editItem, status: e.target.value })}
                >
                  <option>Present</option>
                  <option>Late</option>
                  <option>Absent</option>
                  <option>WFH</option>
                  <option>On Leave</option>
                  <option>Half Day</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Remarks</label>
                <input
                  className="form-input"
                  value={editItem.remarks}
                  onChange={(e) => setEditItem({ ...editItem, remarks: e.target.value })}
                  placeholder="e.g. Grace 10 min"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* View Employee Profile Modal */}
      <Modal
        isOpen={showProfileModal && Boolean(currentEmp)}
        onClose={() => setShowProfileModal(false)}
        title={`Employee Profile — ${currentEmp?.name || ""}`}
        footer={
          <button type="button" className="btn-primary" onClick={() => setShowProfileModal(false)}>
            Close
          </button>
        }
      >
        {currentEmp && (
        <>
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
          <img src={currentEmp.avatar} alt={currentEmp.name} style={{ width: 60, height: 60, borderRadius: 999 }} />
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{currentEmp.name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>{currentEmp.id} • {currentEmp.designation}</p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10, fontSize: 13.5, color: "#334155" }}>
          <div><strong>Department:</strong> {currentEmp.dept}</div>
          <div><strong>Reporting Manager:</strong> {currentEmp.manager}</div>
          <div><strong>Employment Status:</strong> {currentEmp.status}</div>
          <div><strong>Work Location:</strong> —</div>
        </div>
        </>
        )}
      </Modal>

      <style>{`
        .ind-att-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .ind-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .ind-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .ind-title { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
        .ind-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }

        .ind-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .ind-filter-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }

        .ind-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; }
        .ind-select:focus { border-color: #94a3b8; background-color: #fff; }
        .ind-select-emp { min-width: 210px; }

        .ind-tabs { display: inline-flex; align-items: center; gap: 3px; background: #f4f4f6; border: 1px solid #e5e7eb; border-radius: 999px; padding: 3px 4px; }
        .ind-tab { border: 1.5px solid transparent; border-radius: 999px; padding: 4px 16px; font-size: 13px; font-weight: 500; color: #8e9baa; background: transparent; cursor: pointer; transition: all 0.15s ease; }
        .ind-tab.active { font-weight: 600; color: #000000; background: #ffffff; border-color: #000000; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

        .ind-hero-card { padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .ind-hero-avatar { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; }
        .ind-status-pill { display: inline-block; font-size: 11px; font-weight: 600; color: #15803d; background: #e6f4ea; border: 1px solid #a7f3d0; border-radius: 999px; padding: 2px 9px; }
        .ind-btn-view-emp { background: #fff; border: 1px solid #d1d5db; border-radius: 10px; padding: 7px 16px; font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; transition: background 0.15s ease; }
        .ind-btn-view-emp:hover { background: #f9fafb; }

        .ind-stats-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
        .ind-stat-card { background: #fff; border: 1px solid #e8edf3; border-radius: 14px; padding: 16px 14px; text-align: center; box-shadow: 0 1px 2px rgba(16,24,40,0.03); }
        .ind-stat-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #6b7280; text-transform: uppercase; }
        .ind-stat-val { display: block; font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.02em; margin-top: 6px; }

        .ind-main-card { overflow: hidden; }
        .ind-table { width: 100%; border-collapse: collapse; min-width: 800px; font-size: 13.5px; }
        .ind-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .ind-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 20px; white-space: nowrap; }
        .ind-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .ind-table tbody tr:hover { background: #f8fafc; }
        .ind-table td { padding: 14px 20px; vertical-align: middle; }

        .ind-date { font-weight: 600; color: #111827; white-space: nowrap; }
        .ind-time { font-family: inherit; font-size: 13px; color: #374151; white-space: nowrap; }
        .ind-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 3px 12px; border: 1px solid; white-space: nowrap; }

        .ind-btn-edit { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .ind-btn-edit:hover { background: #f8fafc; color: #111827; border-color: #cbd5e1; }

        .ind-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
        .ind-cal-header { text-align: center; font-size: 12px; font-weight: 700; color: #6b7280; padding: 8px 0; }
        .ind-cal-cell { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; min-height: 70px; cursor: pointer; transition: background 0.15s ease; display: flex; flex-direction: column; justify-content: space-between; }
        .ind-cal-cell:hover { background: #f8fafc; }

        @media (max-width: 1200px) {
          .ind-stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .ind-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ind-att-page { padding: 14px 14px 22px; }
        }
        @media (max-width: 1023px) {
          .ind-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .ind-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .ind-filter-card, .ind-hero-card { padding: 12px 14px; }
          .ind-hero-avatar { flex-shrink: 0; }
          .ind-tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; }
          .ind-tab { flex-shrink: 0; white-space: nowrap; }
          .ind-cal-grid { gap: 4px; }
          .ind-cal-cell { min-height: 52px; padding: 4px; }
        }
      `}</style>
    </div>
  );
}
