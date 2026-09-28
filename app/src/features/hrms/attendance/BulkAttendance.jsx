import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { ConfirmModal } from "../../../components/hrms/Shared";
import { PageInfoButton } from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";
import { bulkAttendance, isBackendEnabled } from "../../../services/hrmsSync";

const INITIAL_EMPLOYEES = [];

const DEPARTMENTS = ["All", "Engineering", "Design", "Marketing", "Finance", "HR", "Operations"];
const LOCATIONS = ["All", "Bangalore", "Mumbai", "Delhi", "Hyderabad"];
const SHIFTS = ["All", "General", "Flexible", "Night"];
const STATUS_OPTIONS = ["Present", "Absent", "Late", "Half Day", "WFH", "On Leave"];

const statusStyles = {
  Present: { background: "#e6f4ea", color: "#15803d", border: "#a7f3d0" },
  Late: { background: "#fef3c7", color: "#b45309", border: "#fde68a" },
  Absent: { background: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  WFH: { background: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  "Half Day": { background: "#f3e8ff", color: "#7e22ce", border: "#d8b4fe" },
  "On Leave": { background: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};

export default function BulkAttendance() {
  const setToast = useAppStore((s) => s.setToast || s.showToast);
  const storeRecords = useAttendanceStore((s) => s.records);
  const bulkUpdateStore = useAttendanceStore((s) => s.bulkUpdate);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dept, setDept] = useState("All");
  const [location, setLocation] = useState("All");
  const [shift, setShift] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [employees, setEmployees] = useState(() => {
    if (storeRecords && storeRecords.length > 0) {
      return storeRecords.map((r) => ({
        id: r.id,
        name: r.name,
        dept: r.dept,
        status: r.status || "Present",
        avatar: r.avatar || r.img || `https://i.pravatar.cc/100?u=${r.id || r.name}`,
      }));
    }
    return INITIAL_EMPLOYEES;
  });

  const storeEmployees = useAppStore((s) => s.employees);

  useEffect(() => {
    if (storeRecords && storeRecords.length > 0) {
      setEmployees(
        storeRecords.map((r) => ({
          id: r.id,
          name: r.name,
          dept: r.dept,
          status: r.status || "Present",
          avatar: r.avatar || r.img || `https://i.pravatar.cc/100?u=${r.id || r.name}`,
        }))
      );
    } else if (storeEmployees && storeEmployees.length > 0) {
      setEmployees(
        storeEmployees.map((emp, i) => ({
          id: emp.empId || emp.id || `EMP${1024 + i}`,
          name: emp.name,
          dept: emp.department || "Engineering",
          status: "Present",
          avatar: emp.avatar || `https://i.pravatar.cc/100?u=${emp.id || emp.name}`,
        }))
      );
    }
  }, [storeRecords, storeEmployees]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("Present");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (dept !== "All" && e.dept !== dept) return false;
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      return true;
    });
  }, [employees, dept, statusFilter]);

  const allSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));

  function toggleAll(v) {
    const next = new Set(selectedIds);
    filtered.forEach((e) => (v ? next.add(e.id) : next.delete(e.id)));
    setSelectedIds(next);
  }

  function toggleOne(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handlePillClick(st) {
    setBulkStatus(st);
    if (selectedIds.size > 0) {
      const idsArray = Array.from(selectedIds);
      setEmployees((prev) =>
        prev.map((e) => (selectedIds.has(e.id) ? { ...e, status: st } : e))
      );
      bulkUpdateStore(idsArray, st);
      setToast(`Updated ${idsArray.length} employee(s) status to "${st}" in store.`);
    } else {
      setToast(`Status "${st}" selected. Select employees and click "Save Attendance" to apply.`);
    }
  }

  function handleSaveClick() {
    if (selectedIds.size === 0) {
      return setToast("Please select at least one employee or check 'Select All'.", "error");
    }
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    const idsArray = Array.from(selectedIds);
    setEmployees((prev) =>
      prev.map((e) => (selectedIds.has(e.id) ? { ...e, status: bulkStatus } : e))
    );
    bulkUpdateStore(idsArray, bulkStatus);

    if (isBackendEnabled()) {
      const recordsToPush = idsArray.map((id) => {
        const emp = (storeEmployees || []).find(
          (e) => e.empId === id || e.id === id || e.name === id
        );
        return {
          employeeId: emp?.id || id,
          date,
          status: bulkStatus,
          checkIn: `${date}T09:00:00`,
          checkOut: `${date}T18:00:00`,
        };
      });
      try {
        await bulkAttendance(recordsToPush);
      } catch (err) {
        console.warn('[BulkAttendance] Failed to push bulk records to server:', err);
      }
    }

    setToast(`Bulk attendance saved as "${bulkStatus}" for ${idsArray.length} employees on ${date}`);
    setConfirmOpen(false);
    setSelectedIds(new Set());
  }

  return (
    <div className="bulk-att-page">
      {/* Breadcrumb */}
      <nav className="bulk-crumb">
        <span style={{ cursor: "pointer" }}>Home</span>
        <ChevronRight size={13} style={{ color: "#9aa7bd" }} />
        <span style={{ color: "#111f36", fontWeight: 600 }}>Attendance / Bulk Attendance</span>
      </nav>

      {/* Header Row */}
      <div className="bulk-title-row">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="bulk-title">Bulk Attendance</h1>
            <PageInfoButton guide={hrmsGuides.attendanceBulk} />
          </div>
          <p className="bulk-sub">Update attendance for multiple employees at once.</p>
        </div>
      </div>

      {/* Top Filter Card */}
      <div className="bulk-card bulk-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Date Picker Input */}
          <div className="bulk-date-wrap">
            <span>{date.split("-").reverse().join("-")}</span>
            <CalendarIcon size={14} style={{ color: "#475569" }} />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bulk-date-native"
              aria-label="Select date"
            />
          </div>

          <select value={dept} onChange={(e) => setDept(e.target.value)} className="bulk-select">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select value={location} onChange={(e) => setLocation(e.target.value)} className="bulk-select">
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select value={shift} onChange={(e) => setShift(e.target.value)} className="bulk-select">
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action & Selection Bar Card */}
      <div className="bulk-card bulk-action-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Status Options Pills */}
          <div className="bulk-pills-group">
            {STATUS_OPTIONS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handlePillClick(st)}
                className={bulkStatus === st ? "bulk-pill active" : "bulk-pill"}
              >
                {st}
              </button>
            ))}
          </div>

          <button type="button" onClick={handleSaveClick} className="bulk-btn-save">
            Save Attendance
          </button>
        </div>
      </div>

      {/* Employee List Table */}
      <div className="bulk-card bulk-main-card">
        <div style={{ overflowX: "auto" }}>
          <table className="bulk-table">
            <thead>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="bulk-checkbox"
                  />
                </th>
                <th>EMPLOYEE</th>
                <th>EMPLOYEE ID</th>
                <th>DEPARTMENT</th>
                <th>CURRENT STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => toggleOne(e.id)}
                      className="bulk-checkbox"
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={e.avatar} alt={e.name} className="bulk-avatar" loading="lazy" />
                      <span style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                        {e.name}
                      </span>
                    </div>
                  </td>
                  <td className="bulk-id">{e.id}</td>
                  <td style={{ color: "#374151" }}>{e.dept}</td>
                  <td>
                    <span className="bulk-status" style={{ ...statusStyles[e.status] }}>
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                    No employees match the selected department filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm bulk update?"
        desc={`Update attendance status to "${bulkStatus}" for ${selectedIds.size} selected employees on ${date}?`}
        confirmLabel="Confirm Update"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSave}
      />

      <style>{`
        .bulk-att-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .bulk-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .bulk-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .bulk-title { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
        .bulk-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }

        .bulk-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .bulk-filter-card { border: none; padding: 14px 18px; margin-bottom: 16px; }

        .bulk-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 110px; cursor: pointer; }
        .bulk-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .bulk-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; }
        .bulk-select:focus { border-color: #94a3b8; background-color: #fff; }

        .bulk-action-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: flex-end; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .bulk-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; cursor: pointer; user-select: none; }
        .bulk-checkbox { width: 16px; height: 16px; border-radius: 4px; accent-color: #16233a; cursor: pointer; }

        .bulk-pills-group { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .bulk-pill { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 14px; font-size: 12.5px; font-weight: 500; color: #475569; cursor: pointer; transition: all 0.15s ease; }
        .bulk-pill:hover { background: #f8fafc; color: #111827; }
        .bulk-pill.active { background: #16233a; color: #fff; border-color: #16233a; font-weight: 600; }

        .bulk-btn-save { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .bulk-btn-save:hover { background: #0f172a; }

        .bulk-main-card { overflow: hidden; }
        .bulk-table { width: 100%; border-collapse: collapse; min-width: 700px; font-size: 13.5px; }
        .bulk-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .bulk-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 20px; white-space: nowrap; }
        .bulk-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .bulk-table tbody tr:hover { background: #f8fafc; }
        .bulk-table td { padding: 14px 20px; vertical-align: middle; }

        .bulk-avatar { width: 32px; height: 32px; border-radius: 999px; object-fit: cover; }
        .bulk-id { font-family: inherit; font-size: 12.5px; color: #6b7280; white-space: nowrap; }
        .bulk-status { display: inline-block; font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 13px; border: 1px solid; white-space: nowrap; }
        @media (max-width: 1023px) {
          .bulk-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .bulk-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .bulk-att-page { padding: 14px 14px 22px; }
          .bulk-filter-card, .bulk-action-card { padding: 12px 14px; }
          .bulk-action-card { justify-content: flex-start; }
        }
      `}</style>
    </div>
  );
}
