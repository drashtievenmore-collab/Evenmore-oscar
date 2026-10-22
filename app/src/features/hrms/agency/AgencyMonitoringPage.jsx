import React, { useState, useEffect, useMemo } from "react";
import {
  Factory,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Filter,
  Image as ImageIcon,
  Building,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { MetricCard } from "../../../components/hrms/MetricCard";
import { useAgencyMonitoringStore } from "../../../stores/agencyMonitoringStore";

export default function AgencyMonitoringPage() {
  const {
    dailyEntries,
    agencySummaries,
    assignedAgencies,
    loading,
    hydrate,
    submitEntry,
    fetchAgencySummary,
  } = useAgencyMonitoringStore();

  const [activeTab, setActiveTab] = useState("ENTRIES"); // "ENTRIES" | "SUMMARY"
  const [search, setSearch] = useState("");
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Daily entry form state
  const [form, setForm] = useState({
    agencyId: "",
    workInstructionNo: "",
    entryDate: new Date().toISOString().split("T")[0],
    openingPendingQuantity: 10000,
    producedQuantity: 1200,
    goodQuantity: 1150,
    rejectQuantity: 30,
    reprocessQuantity: 20,
    uom: "Meter",
    photoUrl: "",
    remarks: "",
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const remainingBalance = useMemo(() => {
    const opening = Number(form.openingPendingQuantity || 0);
    const produced = Number(form.producedQuantity || 0);
    return Math.max(0, opening - produced);
  }, [form.openingPendingQuantity, form.producedQuantity]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agencyId && agencySummaries.length > 0) {
      form.agencyId = agencySummaries[0].agency_id;
    }
    setSubmitting(true);
    try {
      await submitEntry({
        agency: form.agencyId,
        agencyId: form.agencyId,
        work_instruction_no: form.workInstructionNo,
        workInstructionNo: form.workInstructionNo,
        entry_date: form.entryDate,
        entryDate: form.entryDate,
        opening_pending_quantity: form.openingPendingQuantity,
        produced_quantity: form.producedQuantity,
        good_quantity: form.goodQuantity,
        reject_quantity: form.rejectQuantity,
        reprocess_quantity: form.reprocessQuantity,
        uom: form.uom,
        photo_url: form.photoUrl,
        remarks: form.remarks,
      });
      setIsEntryModalOpen(false);
      setForm({
        agencyId: agencySummaries[0]?.agency_id || "",
        workInstructionNo: "",
        entryDate: new Date().toISOString().split("T")[0],
        openingPendingQuantity: 10000,
        producedQuantity: 1000,
        goodQuantity: 980,
        rejectQuantity: 20,
        reprocessQuantity: 0,
        uom: "Meter",
        photoUrl: "",
        remarks: "",
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return (dailyEntries || []).filter((e) => {
      const q = search.toLowerCase();
      return (
        !q ||
        (e.agencyName || "").toLowerCase().includes(q) ||
        (e.work_instruction_no || e.workInstructionNo || "").toLowerCase().includes(q) ||
        (e.employeeName || "").toLowerCase().includes(q)
      );
    });
  }, [dailyEntries, search]);

  const stats = useMemo(() => {
    let produced = 0;
    let good = 0;
    let reject = 0;
    let balance = 0;

    (dailyEntries || []).forEach((e) => {
      produced += Number(e.produced_quantity || e.producedQuantity || 0);
      good += Number(e.good_quantity || e.goodQuantity || 0);
      reject += Number(e.reject_quantity || e.rejectQuantity || 0);
      balance += Number(e.remaining_balance || e.remainingBalance || 0);
    });

    return {
      produced,
      good,
      reject,
      agencies: agencySummaries.length,
      balance,
    };
  }, [dailyEntries, agencySummaries]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Salaried Production Staff Field Monitoring"
        description="Daily on-site meter tracking, grey takas inspection, balance remaining, and agency delay monitoring (Scope §02, §05, §15)."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => hydrate()}
              className="p-2 border border-border rounded-lg bg-card hover:bg-soft transition"
              title="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4 text-muted" />
            </button>
            <button
              onClick={() => setIsEntryModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Daily Log Entry
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Total Produced"
          value={`${stats.produced.toLocaleString("en-IN")} M`}
          sub="Cumulative tracked meters"
          icon={TrendingUp}
        />
        <MetricCard
          label="Good Quality"
          value={`${stats.good.toLocaleString("en-IN")} M`}
          sub="Passed inspection"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Defect / Reject"
          value={`${stats.reject.toLocaleString("en-IN")} M`}
          sub="Rejected/Reprocess meters"
          icon={AlertTriangle}
        />
        <MetricCard
          label="Active Agencies"
          value={stats.agencies}
          sub="Monitored weaving units"
          icon={Factory}
        />
        <MetricCard
          label="Pending Balance"
          value={`${stats.balance.toLocaleString("en-IN")} M`}
          sub="Pending work orders"
          icon={Clock}
        />
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2 border-b sm:border-b-0 border-border pb-2 sm:pb-0 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("ENTRIES")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeTab === "ENTRIES"
                ? "bg-primary text-white"
                : "bg-soft text-muted hover:text-text"
            }`}
          >
            Daily Production Logs
          </button>
          <button
            onClick={() => setActiveTab("SUMMARY")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
              activeTab === "SUMMARY"
                ? "bg-primary text-white"
                : "bg-soft text-muted hover:text-text"
            }`}
          >
            Agency Position Summary
          </button>
        </div>

        {activeTab === "ENTRIES" && (
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="Search agency or order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-soft border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Daily Entries Table */}
      {activeTab === "ENTRIES" && (
        <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-soft border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Date & Supervisor</th>
                  <th className="py-3.5 px-4">Agency / Unit</th>
                  <th className="py-3.5 px-4">Work Instruction</th>
                  <th className="py-3.5 px-4 text-right">Produced Qty</th>
                  <th className="py-3.5 px-4 text-right">Good Quality</th>
                  <th className="py-3.5 px-4 text-right">Rejection</th>
                  <th className="py-3.5 px-4 text-right">Remaining Balance</th>
                  <th className="py-3.5 px-4 text-center">Proof / Photo</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-muted">
                      No daily field monitoring logs found. Salaried staff can click "New Daily Log Entry" to record today's production meters.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((row) => (
                    <tr key={row.id} className="hover:bg-soft/50 transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-text">{row.entry_date || row.entryDate}</div>
                        <div className="text-xs text-muted">{row.employeeName || "Salaried Supervisor"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-text">{row.agencyName || "Agency"}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-text">
                        {row.work_instruction_no || row.workInstructionNo || row.jobWorkOrderNo || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-text">
                        {Number(row.produced_quantity || row.producedQuantity || 0).toLocaleString("en-IN")} {row.uom || "M"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {Number(row.good_quantity || row.goodQuantity || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-red-600">
                        {Number(row.reject_quantity || row.rejectQuantity || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                        {Number(row.remaining_balance || row.remainingBalance || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.photo_url || row.photoUrl ? (
                          <a
                            href={row.photo_url || row.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> View Photo
                          </a>
                        ) : (
                          <span className="text-xs text-muted">No photo</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-muted max-w-xs truncate" title={row.remarks}>
                        {row.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Agency Position Summary Cards */}
      {activeTab === "SUMMARY" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agencySummaries.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted bg-card border border-border rounded-xl">
              No agency summaries available yet.
            </div>
          ) : (
            agencySummaries.map((ag) => (
              <div
                key={ag.agency_id}
                className="bg-card border border-border rounded-xl p-5 shadow-2xs hover:shadow-xs transition space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-text text-base flex items-center gap-2">
                      <Factory className="w-4 h-4 text-primary" />
                      {ag.agency_name}
                    </h4>
                    <span className="text-xs text-muted font-mono">{ag.agency_code}</span>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-soft text-text border border-border">
                    {ag.entry_count} Logs
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <span className="text-xs text-muted block">Total Produced</span>
                    <span className="text-sm font-bold text-text">
                      {ag.total_produced.toLocaleString("en-IN")} M
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Remaining Balance</span>
                    <span className="text-sm font-bold text-amber-600">
                      {ag.remaining_balance.toLocaleString("en-IN")} M
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Good Meter</span>
                    <span className="text-sm font-semibold text-emerald-600">
                      {ag.total_good.toLocaleString("en-IN")} M
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted block">Defects / Rejects</span>
                    <span className="text-sm font-semibold text-red-600">
                      {ag.total_reject.toLocaleString("en-IN")} M
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted flex items-center justify-between pt-2 border-t border-border">
                  <span>Latest Field Entry:</span>
                  <span className="font-medium text-text">{ag.latest_entry_date || "Never"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Daily Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Daily Agency Production Entry
            </h3>
            <p className="text-xs text-muted">
              Submit daily production meters, inspect quality, and calculate balance remaining for assigned external job work agencies.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Agency / Unit *</label>
                  <select
                    required
                    value={form.agencyId}
                    onChange={(e) => setForm({ ...form, agencyId: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  >
                    <option value="">Select Agency...</option>
                    {agencySummaries.map((ag) => (
                      <option key={ag.agency_id} value={ag.agency_id}>
                        {ag.agency_name} ({ag.agency_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.entryDate}
                    onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase">Work Instruction / JWO No.</label>
                <input
                  type="text"
                  placeholder="e.g. WI-2026-089 or JWO-44"
                  value={form.workInstructionNo}
                  onChange={(e) => setForm({ ...form, workInstructionNo: e.target.value })}
                  className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Opening Pending Qty (M)</label>
                  <input
                    type="number"
                    value={form.openingPendingQuantity}
                    onChange={(e) => setForm({ ...form, openingPendingQuantity: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Today Produced (M) *</label>
                  <input
                    type="number"
                    required
                    value={form.producedQuantity}
                    onChange={(e) => {
                      const prod = Number(e.target.value);
                      setForm({
                        ...form,
                        producedQuantity: prod,
                        goodQuantity: Math.max(0, prod - form.rejectQuantity - form.reprocessQuantity),
                      });
                    }}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text font-bold"
                  />
                </div>
              </div>

              {/* Quality Split */}
              <div className="p-3 bg-soft rounded-lg border border-border space-y-2">
                <span className="text-xs font-semibold text-muted uppercase block">Quality Breakdown</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-muted">Good (M)</label>
                    <input
                      type="number"
                      value={form.goodQuantity}
                      onChange={(e) => setForm({ ...form, goodQuantity: Number(e.target.value) })}
                      className="w-full p-1.5 bg-card border border-border rounded text-xs text-emerald-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted">Reject (M)</label>
                    <input
                      type="number"
                      value={form.rejectQuantity}
                      onChange={(e) => setForm({ ...form, rejectQuantity: Number(e.target.value) })}
                      className="w-full p-1.5 bg-card border border-border rounded text-xs text-red-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted">Reprocess (M)</label>
                    <input
                      type="number"
                      value={form.reprocessQuantity}
                      onChange={(e) => setForm({ ...form, reprocessQuantity: Number(e.target.value) })}
                      className="w-full p-1.5 bg-card border border-border rounded text-xs text-amber-600 font-bold"
                    />
                  </div>
                </div>
                <div className="text-xs font-semibold text-text flex justify-between pt-1">
                  <span>Remaining Pending Balance:</span>
                  <span className="text-primary font-bold">{remainingBalance.toLocaleString("en-IN")} M</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase">Inspection Photo URL / File Link</label>
                <input
                  type="text"
                  placeholder="https://... inspection proof or drive link"
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase">Remarks / Delays / Observations</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Yarn breakage delay reported by weaver, expected delivery tomorrow"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Submit Daily Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
