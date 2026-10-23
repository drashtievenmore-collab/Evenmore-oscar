import React, { useState, useEffect, useMemo } from "react";
import {
  TrendingUp,
  Award,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Plus,
  ShieldAlert,
  Search,
  Check,
  Ban,
  Settings,
} from "lucide-react";
import PageHeader from "../../../components/ui/PageHeader";
import { MetricCard } from "../../../components/hrms/MetricCard";
import { useIncentiveStore } from "../../../stores/incentiveStore";

export default function IncentivesPage() {
  const {
    accruals,
    schemes,
    loading,
    error,
    hydrate,
    calculateQuarterlyIncentive,
    approveIncentive,
    holdPayout,
    releasePayout,
    markPaid,
    saveScheme,
  } = useIncentiveStore();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [calculating, setCalculating] = useState(false);
  const [calcQuarter, setCalcQuarter] = useState(1);
  const [calcYear, setCalcYear] = useState(new Date().getFullYear());
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [selectedAccrual, setSelectedAccrual] = useState(null);
  const [holdReason, setHoldReason] = useState("");

  // New Scheme Form State
  const [schemeForm, setSchemeForm] = useState({
    name: "Quarterly Standard Slab",
    basis: "INVOICE_VALUE",
    frequency: "QUARTERLY",
    slab_type: "TIERED",
    flat_rate_percent: 1.5,
    slabs: [
      { min_amount: 0, max_amount: 1000000, rate_percent: 1.0 },
      { min_amount: 1000001, max_amount: 2500000, rate_percent: 1.5 },
      { min_amount: 2500001, max_amount: 999999999, rate_percent: 2.0 },
    ],
    deduct_returns: true,
    deduct_bad_debts: true,
    description: "Standard tiered slabs with deduction for credit notes and bad debts",
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      await calculateQuarterlyIncentive(calcQuarter, calcYear);
      setIsCalcModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCalculating(false);
    }
  };

  const handleHoldConfirm = async () => {
    if (!selectedAccrual) return;
    try {
      await holdPayout(selectedAccrual.id, holdReason || "Managerial Hold");
      setIsHoldModalOpen(false);
      setSelectedAccrual(null);
      setHoldReason("");
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAccruals = useMemo(() => {
    return (accruals || []).filter((item) => {
      const matchSearch =
        !search ||
        (item.employeeName || "").toLowerCase().includes(search.toLowerCase()) ||
        (item.period_name || item.periodName || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "ALL" || (item.status || "").toUpperCase() === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [accruals, search, statusFilter]);

  const stats = useMemo(() => {
    let gross = 0;
    let returns = 0;
    let net = 0;
    let incentive = 0;
    let paid = 0;

    (accruals || []).forEach((a) => {
      gross += Number(a.gross_sales || a.grossSales || 0);
      returns += Number(a.returns_deduction || a.returnsDeduction || 0);
      net += Number(a.net_eligible_sales || a.netEligibleSales || 0);
      incentive += Number(a.calculated_incentive || a.calculatedIncentive || 0);
      if (a.status === "PAID") {
        paid += Number(a.calculated_incentive || a.calculatedIncentive || 0);
      }
    });

    return { gross, returns, net, incentive, paid };
  }, [accruals]);

  const getStatusBadge = (status) => {
    const s = (status || "DRAFT").toUpperCase();
    switch (s) {
      case "APPROVED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">Approved</span>;
      case "PAID":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">Paid</span>;
      case "HELD":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400">Held</span>;
      case "ACCRUED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">Accrued</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">Draft</span>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Salesperson Incentive Management"
        description="Configure tiered incentive slabs, calculate quarterly payouts net of returns, and control release/hold workflows (Scope §12)."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSchemeModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-border rounded-lg bg-card hover:bg-soft transition"
            >
              <Settings className="w-4 h-4 text-muted" />
              Slab Scheme Setup
            </button>
            <button
              onClick={() => setIsCalcModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Calculate Quarterly
            </button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Gross Eligible Sales"
          value={`₹${stats.gross.toLocaleString("en-IN")}`}
          sub="Quarterly aggregated"
          icon={TrendingUp}
        />
        <MetricCard
          label="Deducted Returns"
          value={`₹${stats.returns.toLocaleString("en-IN")}`}
          sub="Sales returns & credit notes"
          icon={ShieldAlert}
        />
        <MetricCard
          label="Net Incentive Base"
          value={`₹${stats.net.toLocaleString("en-IN")}`}
          sub="Sales after return cuts"
          icon={DollarSign}
        />
        <MetricCard
          label="Calculated Accrual"
          value={`₹${stats.incentive.toLocaleString("en-IN")}`}
          sub="Total commission earned"
          icon={Award}
        />
        <MetricCard
          label="Disbursed / Paid"
          value={`₹${stats.paid.toLocaleString("en-IN")}`}
          sub="Settled to bank/salary"
          icon={CheckCircle2}
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search salesperson or period..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-soft border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted" />
          <span className="text-xs font-medium text-muted">Status:</span>
          {["ALL", "ACCRUED", "APPROVED", "PAID", "HELD"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                statusFilter === st
                  ? "bg-primary text-white"
                  : "bg-soft text-muted hover:text-text border border-border"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Accruals Table */}
      <div className="bg-card border border-border rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-soft border-b border-border text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Salesperson</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-right">Gross Sales</th>
                <th className="py-3.5 px-4 text-right">Returns Cut</th>
                <th className="py-3.5 px-4 text-right">Net Sales Base</th>
                <th className="py-3.5 px-4 text-center">Rate (%)</th>
                <th className="py-3.5 px-4 text-right">Incentive</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAccruals.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-muted">
                    No incentive accruals found. Click "Calculate Quarterly" to evaluate active salesperson commissions.
                  </td>
                </tr>
              ) : (
                filteredAccruals.map((row) => (
                  <tr key={row.id} className="hover:bg-soft/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-medium text-text">{row.employeeName || row.employee?.name || "Salesperson"}</div>
                      <div className="text-xs text-muted">{row.employeeCode || row.employee?.employee_code || "—"}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-text">
                      {row.period_name || row.periodName}
                    </td>
                    <td className="py-3 px-4 text-right text-text">
                      ₹{Number(row.gross_sales || row.grossSales || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">
                      -₹{Number(row.returns_deduction || row.returnsDeduction || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-text">
                      ₹{Number(row.net_eligible_sales || row.netEligibleSales || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-text">
                      {row.applicable_rate || row.applicableRate}%
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{Number(row.calculated_incentive || row.calculatedIncentive || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(row.status)}
                      {row.hold_reason && (
                        <div className="text-[11px] text-red-500 truncate max-w-[120px] mt-0.5" title={row.hold_reason}>
                          {row.hold_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {row.status === "ACCRUED" && (
                          <>
                            <button
                              onClick={() => approveIncentive(row.id)}
                              title="Approve for Payroll Payout"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded dark:hover:bg-emerald-950/50 transition"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAccrual(row);
                                setIsHoldModalOpen(true);
                              }}
                              title="Hold Payout (Bad Debt / Delay)"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-950/50 transition"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {row.status === "HELD" && (
                          <button
                            onClick={() => releasePayout(row.id)}
                            title="Release Hold"
                            className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded dark:bg-amber-950/40 dark:text-amber-400 transition"
                          >
                            Release
                          </button>
                        )}
                        {row.status === "APPROVED" && (
                          <button
                            onClick={() => markPaid(row.id)}
                            title="Mark as Paid"
                            className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded dark:bg-blue-950/40 dark:text-blue-400 transition"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculate Quarterly Modal */}
      {isCalcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text">Trigger Quarterly Incentive Calculation</h3>
            <p className="text-sm text-muted">
              Scans sales invoices and deducted credit notes/returns for all active salespersons for the period and applies slab schemes.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Quarter</label>
                <select
                  value={calcQuarter}
                  onChange={(e) => setCalcQuarter(Number(e.target.value))}
                  className="w-full mt-1.5 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                >
                  <option value={1}>Q1 (Apr - Jun)</option>
                  <option value={2}>Q2 (Jul - Sep)</option>
                  <option value={3}>Q3 (Oct - Dec)</option>
                  <option value={4}>Q4 (Jan - Mar)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Financial Year</label>
                <input
                  type="number"
                  value={calcYear}
                  onChange={(e) => setCalcYear(Number(e.target.value))}
                  className="w-full mt-1.5 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setIsCalcModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
              >
                Cancel
              </button>
              <button
                disabled={calculating}
                onClick={handleCalculate}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                {calculating && <RefreshCw className="w-4 h-4 animate-spin" />}
                Calculate Accruals
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold Modal */}
      {isHoldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-text text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Hold Incentive Payout
            </h3>
            <p className="text-sm text-muted">
              Place a managerial hold on <b>{selectedAccrual?.employeeName}</b>'s incentive payout due to overdue customer accounts, returns, or pending verification.
            </p>
            <div>
              <label className="text-xs font-semibold text-muted uppercase">Reason for Hold</label>
              <textarea
                rows="3"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder="e.g. Pending party payment for Invoice #INV-204"
                className="w-full mt-1.5 p-2.5 bg-soft border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setIsHoldModalOpen(false);
                  setSelectedAccrual(null);
                }}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleHoldConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheme Modal */}
      {isSchemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text">Incentive Slab Scheme Configuration</h3>
            <p className="text-sm text-muted">
              Configure tiered sales brackets and deduction rules per Oscar Letter Pad §12.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Scheme Name</label>
                <input
                  type="text"
                  value={schemeForm.name}
                  onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
                  className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Calculation Basis</label>
                  <select
                    value={schemeForm.basis}
                    onChange={(e) => setSchemeForm({ ...schemeForm, basis: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  >
                    <option value="INVOICE_VALUE">Invoice Value</option>
                    <option value="COLLECTIONS">Payment Collections</option>
                    <option value="GROSS_PROFIT">Gross Profit Margin</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Slab Structure</label>
                  <select
                    value={schemeForm.slab_type}
                    onChange={(e) => setSchemeForm({ ...schemeForm, slab_type: e.target.value })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  >
                    <option value="TIERED">Tiered Sales Thresholds</option>
                    <option value="FLAT">Flat % Rate</option>
                  </select>
                </div>
              </div>

              {schemeForm.slab_type === "TIERED" ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted uppercase">Tier Brackets</label>
                  {schemeForm.slabs.map((slab, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-muted w-12">Tier {idx + 1}:</span>
                      <input
                        type="number"
                        placeholder="Min"
                        value={slab.min_amount}
                        onChange={(e) => {
                          const updated = [...schemeForm.slabs];
                          updated[idx].min_amount = Number(e.target.value);
                          setSchemeForm({ ...schemeForm, slabs: updated });
                        }}
                        className="w-32 p-1.5 bg-soft border border-border rounded text-xs text-text"
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="number"
                        placeholder="Max"
                        value={slab.max_amount}
                        onChange={(e) => {
                          const updated = [...schemeForm.slabs];
                          updated[idx].max_amount = Number(e.target.value);
                          setSchemeForm({ ...schemeForm, slabs: updated });
                        }}
                        className="w-32 p-1.5 bg-soft border border-border rounded text-xs text-text"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder="%"
                        value={slab.rate_percent}
                        onChange={(e) => {
                          const updated = [...schemeForm.slabs];
                          updated[idx].rate_percent = Number(e.target.value);
                          setSchemeForm({ ...schemeForm, slabs: updated });
                        }}
                        className="w-20 p-1.5 bg-soft border border-border rounded text-xs text-text font-bold"
                      />
                      <span className="text-xs text-muted">%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-muted uppercase">Flat Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={schemeForm.flat_rate_percent}
                    onChange={(e) => setSchemeForm({ ...schemeForm, flat_rate_percent: Number(e.target.value) })}
                    className="w-full mt-1 p-2 bg-soft border border-border rounded-lg text-sm text-text"
                  />
                </div>
              )}

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={schemeForm.deduct_returns}
                    onChange={(e) => setSchemeForm({ ...schemeForm, deduct_returns: e.target.checked })}
                    className="rounded border-border"
                  />
                  Deduct Sales Returns / Credit Notes
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setIsSchemeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-soft"
              >
                Close
              </button>
              <button
                onClick={() => {
                  saveScheme(schemeForm);
                  setIsSchemeModalOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
              >
                Save Scheme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
