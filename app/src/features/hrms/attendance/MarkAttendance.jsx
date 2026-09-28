import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useAttendanceStore } from "../../../stores/attendanceStore";
import { ConfirmModal } from "../../../components/hrms/Shared";
import { PageInfoButton } from "../../../components/common/PageInfoButton";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

const INITIAL_EMPLOYEES = [];

const DEPARTMENTS = ["All", "Engineering", "Design", "Marketing", "Finance", "HR", "Operations"];
const LOCATIONS = ["All", "Bangalore", "Mumbai", "Delhi", "Hyderabad"];
const SHIFTS = ["All", "General", "Flexible", "Night"];
const STATUSES = ["Present", "Late", "Absent", "WFH", "Half Day", "On Leave"];

export default function MarkAttendance() {
  const setToast = useAppStore((s) => s.setToast || s.showToast);
  const storeRecords = useAttendanceStore((s) => s.records);
  const saveDailyAttendance = useAttendanceStore((s) => s.saveDailyAttendance);
  const bulkUpdateStore = useAttendanceStore((s) => s.bulkUpdate);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dept, setDept] = useState("All");
  const [location, setLocation] = useState("All");
  const [shift, setShift] = useState("All");

  const [rows, setRows] = useState(() => {
    if (storeRecords && storeRecords.length > 0) {
      return storeRecords.map((r) => ({
        ...r,
        avatar: r.avatar || r.img || `https://i.pravatar.cc/100?u=${r.id || r.name}`,
        remarks: r.remarks || "",
        checked: false,
      }));
    }
    return INITIAL_EMPLOYEES;
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  const storeEmployees = useAppStore((s) => s.employees);

  // Sync rows if store records or employees change
  useEffect(() => {
    if (storeRecords && storeRecords.length > 0) {
      setRows((prev) => {
        return storeRecords.map((r) => {
          const existing = prev.find((p) => p.id === r.id);
          return {
            ...r,
            avatar: r.avatar || r.img || `https://i.pravatar.cc/100?u=${r.id || r.name}`,
            remarks: existing ? existing.remarks : r.remarks || "",
            checked: existing ? existing.checked : false,
          };
        });
      });
    } else if (storeEmployees && storeEmployees.length > 0) {
      setRows((prev) => {
        return storeEmployees.map((emp, i) => {
          const empId = emp.empId || emp.id || `EMP${1024 + i}`;
          const existing = prev.find((p) => p.id === empId);
          return {
            id: empId,
            name: emp.name,
            dept: emp.department || 'Engineering',
            checkIn: '09:00',
            checkOut: '18:00',
            status: 'Present',
            remarks: existing ? existing.remarks : '',
            checked: existing ? existing.checked : false,
            avatar: emp.avatar || `https://i.pravatar.cc/100?u=${empId}`,
          };
        });
      });
    }
  }, [storeRecords, storeEmployees]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (dept !== "All" && r.dept !== dept) return false;
      return true;
    });
  }, [rows, dept]);

  const selectedCount = rows.filter((r) => r.checked).length;

  function toggleAll(v) {
    setRows(rows.map((r) => (filtered.some((f) => f.id === r.id) ? { ...r, checked: v } : r)));
  }

  function updateRow(id, patch) {
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function formatAttendanceRows(targetRows) {
    return targetRows.map((r) => {
      const emp = (storeEmployees || []).find(
        (e) => e.empId === r.id || e.id === r.id || e.name === r.name
      );
      return {
        ...r,
        employeeId: emp?.id || r.id,
        date: date,
        checkIn: r.checkIn ? (r.checkIn.includes('T') ? r.checkIn : `${date}T${r.checkIn.length === 5 ? r.checkIn + ':00' : r.checkIn}`) : null,
        checkOut: r.checkOut ? (r.checkOut.includes('T') ? r.checkOut : `${date}T${r.checkOut.length === 5 ? r.checkOut + ':00' : r.checkOut}`) : null,
      };
    });
  }

  function handleSave() {
    const formatted = formatAttendanceRows(rows);
    saveDailyAttendance(date, formatted);
    setToast(`Attendance saved for ${rows.length} employees on ${date}`);
  }

  return (
    <div className="mark-att-page">
      {/* Breadcrumb */}
      <nav className="mark-crumb">
        <span style={{ cursor: "pointer" }}>Home</span>
        <ChevronRight size={13} style={{ color: "#9aa7bd" }} />
        <span style={{ color: "#111f36", fontWeight: 600 }}>Attendance / Mark Attendance</span>
      </nav>

      {/* Header Row */}
      <div className="mark-title-row">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="mark-title">Mark Attendance</h1>
            <PageInfoButton guide={hrmsGuides.attendanceMark} />
          </div>
          <p className="mark-sub">Record daily employee attendance.</p>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="mark-card mark-filter-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Date Picker Input */}
          <div className="mark-date-wrap">
            <span>{date.split("-").reverse().join("-")}</span>
            <CalendarIcon size={14} style={{ color: "#475569" }} />
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="mark-date-native"
              aria-label="Select date"
            />
          </div>

          <select value={dept} onChange={(e) => setDept(e.target.value)} className="mark-select">
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select value={location} onChange={(e) => setLocation(e.target.value)} className="mark-select">
            {LOCATIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <select value={shift} onChange={(e) => setShift(e.target.value)} className="mark-select">
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: "13px", color: "#6b7280" }}>{selectedCount} selected</span>
      </div>

      {/* Main Table Card */}
      <div className="mark-card mark-main-card">
        <div style={{ overflowX: "auto" }}>
          <table className="mark-table">
            <thead>
              <tr>
                <th style={{ width: 40, paddingLeft: 20 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((r) => r.checked)}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="mark-checkbox"
                  />
                </th>
                <th>EMPLOYEE</th>
                <th>EMPLOYEE ID</th>
                <th>DEPARTMENT</th>
                <th>CHECK IN</th>
                <th>CHECK OUT</th>
                <th>STATUS</th>
                <th>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <input
                      type="checkbox"
                      checked={r.checked}
                      onChange={(e) => updateRow(r.id, { checked: e.target.checked })}
                      className="mark-checkbox"
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <img src={r.avatar} alt={r.name} className="mark-avatar" loading="lazy" />
                      <span style={{ fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{r.name}</span>
                    </div>
                  </td>
                  <td className="mark-id">{r.id}</td>
                  <td style={{ color: "#374151" }}>{r.dept}</td>
                  <td>
                    <input
                      type="text"
                      value={r.checkIn}
                      onChange={(e) => updateRow(r.id, { checkIn: e.target.value })}
                      className="mark-input mark-input-time"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.checkOut}
                      onChange={(e) => updateRow(r.id, { checkOut: e.target.value })}
                      className="mark-input mark-input-time"
                    />
                  </td>
                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => updateRow(r.id, { status: e.target.value })}
                      className="mark-select-status"
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.remarks}
                      onChange={(e) => updateRow(r.id, { remarks: e.target.value })}
                      placeholder="—"
                      className="mark-input mark-input-remarks"
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "#6b7280", padding: "32px" }}>
                    No employees match the selected department filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="mark-footer">
          <button
            type="button"
            onClick={() => setRows([])}
            className="mark-btn-cancel"
          >
            Clear
          </button>
          <button type="button" onClick={handleSave} className="mark-btn-save">
            Save Attendance
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm bulk update?"
        desc={`You are about to update attendance for ${selectedCount} employees on ${date}. This will overwrite previous records.`}
        confirmLabel="Confirm Update"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          const selectedIds = rows.filter((r) => r.checked).map((r) => r.id);
          const formatted = formatAttendanceRows(rows);
          saveDailyAttendance(date, formatted);
          setConfirmOpen(false);
          setToast(`Attendance saved for ${selectedIds.length || rows.length} employees`);
        }}
      />

      <style>{`
        .mark-att-page { background: #f8fafc; margin: -24px -28px -40px; padding: 18px 26px 28px; min-height: calc(100vh - 62px); }
        .mark-crumb { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #6b7a90; margin-bottom: 10px; }
        .mark-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }
        .mark-title { margin: 0; font-size: 24px; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
        .mark-sub { margin: 4px 0 0; font-size: 13px; color: #6b7280; }

        .mark-card { background: #fff; border: 1px solid #e8edf3; border-radius: 16px; box-shadow: 0 1px 3px rgba(16,24,40,0.03); }
        .mark-filter-card { border: none; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-bottom: 16px; }

        .mark-date-wrap { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 14px; font-size: 13px; color: #374151; min-width: 110px; cursor: pointer; }
        .mark-date-native { position: absolute; right: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }

        .mark-select { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 7px 32px 7px 14px; font-size: 13px; color: #374151; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; min-width: 100px; }
        .mark-select:focus { border-color: #94a3b8; background-color: #fff; }

        .mark-main-card { overflow: hidden; }
        .mark-table { width: 100%; border-collapse: collapse; min-width: 800px; font-size: 13.5px; }
        .mark-table thead tr { background: #ffffff; border-bottom: 1px solid #e2e8f0; }
        .mark-table th { text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7b8aa0; padding: 14px 16px; white-space: nowrap; }
        .mark-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.12s ease; }
        .mark-table tbody tr:hover { background: #f8fafc; }
        .mark-table td { padding: 12px 16px; vertical-align: middle; }

        .mark-checkbox { width: 16px; height: 16px; border-radius: 4px; accent-color: #16233a; cursor: pointer; }
        .mark-avatar { width: 32px; height: 32px; border-radius: 999px; object-fit: cover; }
        .mark-id { font-family: inherit; font-size: 12.5px; color: #6b7280; white-space: nowrap; }

        .mark-input { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 12px; font-size: 13px; color: #1e293b; outline: none; transition: border-color 0.15s ease; }
        .mark-input:focus { border-color: #94a3b8; }
        .mark-input-time { width: 84px; text-align: center; }
        .mark-input-remarks { width: 110px; }

        .mark-select-status { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px 28px 6px 12px; font-size: 13px; color: #1e293b; font-weight: 500; outline: none; cursor: pointer; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%230f172a' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; background-size: 12px; width: 110px; }
        .mark-select-status:focus { border-color: #94a3b8; }

        .mark-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 14px 20px; background: #ffffff; border-top: 1px solid #f1f5f9; }
        .mark-btn-cancel { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 18px; font-size: 13.5px; font-weight: 500; color: #475569; cursor: pointer; transition: background 0.15s ease; }
        .mark-btn-cancel:hover { background: #f8fafc; color: #111827; }
        .mark-btn-save { background: #16233a; color: #fff; border: none; border-radius: 10px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background 0.15s ease; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .mark-btn-save:hover { background: #0f172a; }
        @media (max-width: 1023px) {
          .mark-att-page { margin: -16px -20px -24px; }
        }
        @media (max-width: 767px) {
          .mark-att-page { margin: -12px -14px -20px; }
        }
        @media (max-width: 640px) {
          .mark-att-page { padding: 14px 14px 22px; }
          .mark-filter-card { padding: 12px 14px; }
          .mark-footer { flex-wrap: wrap; padding: 12px 14px; }
        }
      `}</style>
    </div>
  );
}
