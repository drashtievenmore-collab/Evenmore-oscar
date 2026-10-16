import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Layers,
  Calendar,
  Filter,
  Download,
  Search,
  IndianRupee,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { misService } from '../../services/domainServices';

const inr = (val) =>
  val != null
    ? `₹${parseFloat(val).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`
    : '₹0';

const num = (val) =>
  val != null
    ? parseFloat(val).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : '0';

export default function OwnerMISDashboardPage() {
  const [activeTab, setActiveTab] = useState('leakage'); // 'leakage' | 'party' | 'design' | 'ageing'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [leakageData, setLeakageData] = useState(null);
  const [partyData, setPartyData] = useState([]);
  const [designData, setDesignData] = useState([]);
  const [ageingData, setAgeingData] = useState(null);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [partySearch, setPartySearch] = useState('');
  const [designSearch, setDesignSearch] = useState('');

  const loadAllMIS = async () => {
    setLoading(true);
    setError('');
    try {
      const query = {};
      if (startDate) query.dateFrom = startDate;
      if (endDate) query.dateTo = endDate;

      const [leakRes, partyRes, desRes, ageRes] = await Promise.all([
        misService.getAnnualCommercialLeakage(query),
        misService.getPartyProfitability(query),
        misService.getDesignColourAnalysis(query),
        misService.getStockAgeingMis(query),
      ]);

      setLeakageData(leakRes);
      setPartyData(partyRes.results || partyRes || []);
      setDesignData(desRes.results || desRes || []);
      setAgeingData(ageRes);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load MIS reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMIS();
  }, [startDate, endDate]);

  const filteredParties = useMemo(() => {
    if (!partySearch) return partyData;
    const q = partySearch.toLowerCase();
    return partyData.filter(
      (p) =>
        (p.party_name || p.partyName || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q)
    );
  }, [partyData, partySearch]);

  const filteredDesigns = useMemo(() => {
    if (!designSearch) return designData;
    const q = designSearch.toLowerCase();
    return designData.filter(
      (d) =>
        (d.fabric_item || d.fabricItem || '').toLowerCase().includes(q) ||
        (d.quality || '').toLowerCase().includes(q) ||
        (d.shade || '').toLowerCase().includes(q)
    );
  }, [designData, designSearch]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Owner Executive MIS & Commercial Analysis"
        subtitle="Annual commercial leakage, customer profitability, fabric design analysis, and stock ageing."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none bg-white font-medium"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none bg-white font-medium"
          />
        </div>
      </PageHeader>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex flex-wrap gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('leakage')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'leakage'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Commercial Leakage (₹ & %)
        </button>
        <button
          onClick={() => setActiveTab('party')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'party'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <IndianRupee className="w-4 h-4" />
          Customer Profitability
        </button>
        <button
          onClick={() => setActiveTab('design')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'design'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Fabric Design & Shade Margins
        </button>
        <button
          onClick={() => setActiveTab('ageing')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'ageing'
              ? 'border-indigo-600 text-indigo-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Stock Ageing MIS
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* TAB 1: COMMERCIAL LEAKAGE */}
      {activeTab === 'leakage' && (
        <div className="space-y-6">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Gross Invoiced Sales
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {inr(leakageData?.leakageKpis?.grossSales)}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Baseline before trade deductions and returns
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
              <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-1">
                Total Commercial Leakage
              </div>
              <div className="text-3xl font-extrabold text-rose-600">
                {inr(leakageData?.leakageKpis?.totalLeakage)}
              </div>
              <div className="mt-2 text-xs font-semibold text-rose-700">
                {leakageData?.leakageKpis?.leakagePct || 0}% of Gross Sales
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1">
                Net Contribution
              </div>
              <div className="text-3xl font-extrabold text-emerald-700">
                {inr(leakageData?.leakageKpis?.netContribution)}
              </div>
              <div className="mt-2 text-xs font-semibold text-emerald-700">
                {leakageData?.leakageKpis?.netContributionPct || 0}% Net Realization
              </div>
            </div>
          </div>

          {/* Breakdown Bars */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              Annual Leakage Components (₹ and % of Sales)
            </h3>
            <p className="text-xs text-slate-500">
              Breakdown of non-production deductions eroding sales margin across the financial year.
            </p>

            <div className="space-y-4 pt-2">
              {(leakageData?.leakageComponents || []).map((comp, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-700">{comp.name}</span>
                    <span className="font-bold text-slate-900">
                      {inr(comp.amount)}{' '}
                      <span className="text-slate-400 font-normal">({comp.pctOfSales}% of sales)</span>
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, comp.pctOfSales * 4))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARTY PROFITABILITY */}
      {activeTab === 'party' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search party name or code..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-full focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold">{filteredParties.length}</span> party record(s)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3">Party Name</th>
                    <th className="py-3 px-3 text-right">Invoiced (₹)</th>
                    <th className="py-3 px-3 text-right">COGS (₹)</th>
                    <th className="py-3 px-3 text-right">Discounts</th>
                    <th className="py-3 px-3 text-right">Brokerage</th>
                    <th className="py-3 px-3 text-right">Incentive</th>
                    <th className="py-3 px-3 text-right">Freight</th>
                    <th className="py-3 px-3 text-right">Returns</th>
                    <th className="py-3 px-3 text-right font-bold text-slate-900">Contribution (₹)</th>
                    <th className="py-3 px-3 text-right font-bold text-slate-900">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredParties.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No party profitability data available for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredParties.map((p, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{p.party_name || p.partyName}</div>
                          <div className="text-[11px] text-slate-400">{p.code || ''}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold">{inr(p.sales_value)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{inr(p.cogs)}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600">{inr(p.discount)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{inr(p.brokerage)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{inr(p.incentive)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{inr(p.freight)}</td>
                        <td className="py-2.5 px-3 text-right text-rose-600">{inr(p.returns)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                          {inr(p.net_contribution)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] ${
                              parseFloat(p.margin_pct) >= 15
                                ? 'bg-emerald-50 text-emerald-700'
                                : parseFloat(p.margin_pct) >= 5
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {p.margin_pct}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DESIGN & SHADE ANALYSIS */}
      {activeTab === 'design' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search quality or shade..."
                value={designSearch}
                onChange={(e) => setDesignSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-full focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold">{filteredDesigns.length}</span> fabric item(s)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-3">Fabric Quality</th>
                    <th className="py-3 px-3">Shade / Colour</th>
                    <th className="py-3 px-3 text-right">Produced (Mtr)</th>
                    <th className="py-3 px-3 text-right">Sold (Mtr)</th>
                    <th className="py-3 px-3 text-right">Stock Balance (Mtr)</th>
                    <th className="py-3 px-3 text-right">Total Revenue (₹)</th>
                    <th className="py-3 px-3 text-right">Avg Rate (₹/Mtr)</th>
                    <th className="py-3 px-3 text-right">Ageing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDesigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No fabric design records found for the period.
                      </td>
                    </tr>
                  ) : (
                    filteredDesigns.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{d.quality || d.fabric_item}</td>
                        <td className="py-2.5 px-3 text-slate-600">{d.shade || '-'}</td>
                        <td className="py-2.5 px-3 text-right">{num(d.produced_meters)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                          {num(d.sold_meters)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                          {num(d.balance_meters)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold">{inr(d.sales_amount)}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">{inr(d.avg_rate)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            {d.ageing_days || 0}d
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STOCK AGEING MIS */}
      {activeTab === 'ageing' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Inventory Valuation
              </div>
              <div className="text-3xl font-extrabold text-slate-900">
                {inr(ageingData?.summary?.totalStockValue)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Finished Fabric
              </div>
              <div className="text-2xl font-bold text-indigo-600">
                {num(ageingData?.summary?.totalMeters)} <span className="text-xs font-normal">Meters</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(ageingData?.buckets || []).map((b, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2"
              >
                <div className="text-xs font-bold text-indigo-600">{b.label}</div>
                <div className="text-xl font-extrabold text-slate-900">{inr(b.value)}</div>
                <div className="text-xs text-slate-500 font-medium">{num(b.meters)} Meters</div>
                <div className="text-xs font-semibold text-slate-400">
                  {b.pctOfTotal || 0}% of inventory
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
