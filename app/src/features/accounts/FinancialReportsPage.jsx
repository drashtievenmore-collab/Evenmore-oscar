import React, { useState, useEffect, useMemo } from 'react';
import { useERP } from '../../context/ERPContext';
import PageHeader from '../../components/ui/PageHeader';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import { Printer, Download } from 'lucide-react';
import { api } from '../../services/api';

export function FinancialReportsPage() {
  const { formatCurrency, formatDateDDMMYYYY, budgets = [] } = useERP();
  const [reportType, setReportType] = useState('pl'); // 'pl' | 'bs' | 'cashflow' | 'budget'

  const [pnlData, setPnlData] = useState(null);
  const [bsData, setBsData] = useState(null);
  const [cfData, setCfData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadReports = () => {
    setLoading(true);
    Promise.all([
      api.get('/reports/profit-and-loss/').catch(() => null),
      api.get('/reports/balance-sheet/').catch(() => null),
      api.get('/reports/cash-flow/').catch(() => null),
    ])
      .then(([pnl, bs, cf]) => {
        setPnlData(pnl);
        setBsData(bs);
        setCfData(cf);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load financial reports');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadReports();
  }, []);

  const totalRevenue = Number(pnlData?.revenue) || 0;
  const totalCOGS = Number(pnlData?.cogs) || 0;
  const totalExpenses = Number(pnlData?.operatingExpenses) || 0;
  const netIncome = Number(pnlData?.netOperatingProfit) || 0;
  const grossProfit = Number(pnlData?.grossProfit) || 0;
  const marginPct = Number(pnlData?.grossMarginPct) || 0;

  const totalAssets = Number(bsData?.totalAssets) || 0;
  const totalLiabilities = Number(bsData?.totalLiabilities) || 0;
  const totalEquity = Number(bsData?.totalEquity) || 0;
  const retainedEarnings = Number(bsData?.retainedEarnings) || 0;
  const bsDifference = Number(bsData?.difference) || 0;

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: 'dollar', tone: 'blue' },
    { label: 'Cost of Goods', value: formatCurrency(totalCOGS), icon: 'cart', tone: 'amber' },
    { label: 'Operating Expenses', value: formatCurrency(totalExpenses), icon: 'file', tone: 'pink' },
    { label: 'Net Profit', value: formatCurrency(netIncome), icon: 'chart', tone: netIncome >= 0 ? 'green' : 'pink', trend: `${marginPct.toFixed(1)}% margin` },
  ];

  const plRows = useMemo(() => {
    if (!pnlData) return [];
    const rows = [
      { category: 'Operating Revenue', item: 'Gross Sales & Services', amount: totalRevenue, type: 'revenue' },
    ];
    (pnlData.incomeAccounts || []).forEach((acct) => {
      rows.push({
        category: 'Operating Revenue',
        item: `${acct.code ? `${acct.code} - ` : ''}${acct.name}`,
        amount: Number(acct.amount) || 0,
        type: 'sub',
      });
    });
    rows.push(
      { category: 'Cost of Goods Sold', item: 'Procurement & Direct Production Costs', amount: -totalCOGS, type: 'cogs' },
      { category: 'Gross Profit', item: 'Revenue minus COGS', amount: grossProfit, type: 'summary' },
      { category: 'Operating Expenses', item: 'General, Administrative & Utilities', amount: -totalExpenses, type: 'expense' },
    );
    (pnlData.expenseAccounts || []).forEach((acct) => {
      rows.push({
        category: 'Operating Expenses',
        item: `${acct.code ? `${acct.code} - ` : ''}${acct.name}`,
        amount: -(Number(acct.amount) || 0),
        type: 'sub',
      });
    });
    rows.push(
      { category: 'Net Income', item: 'Operating Profit Before Taxes', amount: netIncome, type: 'net' },
    );
    return rows;
  }, [pnlData, totalRevenue, totalCOGS, grossProfit, totalExpenses, netIncome]);

  const plColumns = [
    {
      key: 'category',
      label: 'Category',
      render: (val, row) => (
        <strong style={{ color: row.type === 'net' ? '#1f6bff' : row.type === 'summary' ? '#0f172a' : '#334155' }}>
          {val}
        </strong>
      ),
    },
    {
      key: 'item',
      label: 'Description / Account',
      render: (val, row) => (
        <span style={{ color: row.type === 'sub' ? '#64748b' : '#334155', paddingLeft: row.type === 'sub' ? 16 : 0 }}>
          {row.type === 'sub' ? `↳ ${val}` : val}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (val, row) => (
        <span style={{
          fontWeight: row.type === 'net' || row.type === 'summary' ? 800 : row.type === 'sub' ? 500 : 600,
          color: val > 0 ? '#1bb878' : val < 0 ? '#ef4444' : '#64748b',
          fontSize: row.type === 'net' ? 15 : 13,
        }}>
          {val < 0 ? `-${formatCurrency(Math.abs(val))}` : formatCurrency(val)}
        </span>
      ),
    },
  ];

  const bsAssets = useMemo(() => {
    const list = (bsData?.assets || []).map((a) => ({
      section: 'Assets',
      account: `${a.code ? `${a.code} - ` : ''}${a.name}`,
      amount: Number(a.amount) || 0,
      isTotal: false,
    }));
    list.push({ section: '', account: 'Total Assets', amount: totalAssets, isTotal: true });
    return list;
  }, [bsData, totalAssets]);

  const bsLiabilities = useMemo(() => {
    const list = (bsData?.liabilities || []).map((l) => ({
      section: 'Liabilities',
      account: `${l.code ? `${l.code} - ` : ''}${l.name}`,
      amount: Number(l.amount) || 0,
      isTotal: false,
    }));
    list.push({ section: '', account: 'Total Liabilities', amount: totalLiabilities, isTotal: true });
    return list;
  }, [bsData, totalLiabilities]);

  const bsEquity = useMemo(() => {
    const list = (bsData?.equity || []).map((e) => ({
      section: "Owners' Equity",
      account: `${e.code ? `${e.code} - ` : ''}${e.name}`,
      amount: Number(e.amount) || 0,
      isTotal: false,
    }));
    list.push({
      section: "Owners' Equity",
      account: 'Retained Earnings / Current Period Net P&L',
      amount: retainedEarnings,
      isTotal: false,
    });
    list.push({ section: '', account: 'Total Equity & Retained Earnings', amount: totalEquity, isTotal: true });
    return list;
  }, [bsData, retainedEarnings, totalEquity]);

  // Budget vs Variance
  const budgetRows = useMemo(() => {
    return budgets.filter((b) => b.active !== false).map((b) => {
      const budgetAmt = Number(b.annualAmount) || 0;
      const actual = Number(b.actualAmount) || 0;
      const variance = budgetAmt - actual;
      const utilization = budgetAmt > 0 ? ((actual / budgetAmt) * 100).toFixed(1) : '—';
      return {
        id: b.id,
        name: b.name,
        budget: budgetAmt,
        actual,
        variance,
        utilization,
        isOver: variance < 0,
      };
    });
  }, [budgets]);

  const exportToCSV = (filename, headers, rows) => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    let headers, rows, title;
    if (reportType === 'pl') {
      headers = ['Category', 'Description', 'Amount'];
      rows = plRows.map((r) => [r.category, r.item, r.amount]);
      title = 'Profit_and_Loss';
    } else if (reportType === 'bs') {
      headers = ['Section', 'Account', 'Balance'];
      rows = [...bsAssets, ...bsLiabilities, ...bsEquity].map((r) => [r.section, r.account, r.amount]);
      title = 'Balance_Sheet';
    } else if (reportType === 'budget') {
      headers = ['Category', 'Budget (Annual)', 'Actual (YTD)', 'Variance', 'Utilization %'];
      rows = budgetRows.map((r) => [r.name, r.budget, r.actual, r.variance, r.utilization]);
      title = 'Budget_vs_Variance';
    } else {
      headers = ['Period', 'Inflow', 'Outflow', 'Net Cash Flow'];
      rows = (cfData?.periods || []).map((p) => [p.period, p.inflow, p.outflow, p.net]);
      title = 'Cash_Flow';
    }
    exportToCSV(`Financial_${title}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="feature-page printable-document py-4 sm:py-6 px-0 sm:px-8">
      <PageHeader
        title="Financial Reports"
        subtitle="Consolidated Profit & Loss, Balance Sheet, and Cash Flow metrics directly from ledger."
        breadcrumb={[{ label: 'Accounts', to: '/accounts/cash-bank' }, { label: 'Reports' }]}
        actions={
          <div className="flex-wrap lg:flex-nowrap" style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn-outline" onClick={() => window.print()}>
              <Printer size={15} /> Print Statement
            </button>
            <button type="button" className="btn-primary" onClick={() => handleExport()}>
              <Download size={15} /> Export {reportType === 'pl' ? 'P&L' : reportType === 'bs' ? 'Balance Sheet' : reportType === 'budget' ? 'Budget' : 'Cash Flow'} CSV
            </button>
          </div>
        }
      />

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, margin: '20px 0 24px' }}>
        {stats.map((s) => <StatCard key={s.label} stat={s} />)}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Assets</span>
          <span className="text-lg font-mono font-bold text-[#1F2E4A]">{formatCurrency(totalAssets)}</span>
          <span className="text-[11px] text-slate-400 mt-0.5">As of {bsData?.asOf ? formatDateDDMMYYYY(bsData.asOf) : 'today'}</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Net Worth (A − L)</span>
          <span className="text-lg font-mono font-bold text-emerald-700">{formatCurrency(totalAssets - totalLiabilities)}</span>
          <span className="text-[11px] text-slate-400 mt-0.5">Liabilities: {formatCurrency(totalLiabilities)} · Equity: {formatCurrency(totalEquity)}</span>
        </div>
      </div>

      <div className="card" style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
        <div className="flex-wrap lg:flex-nowrap gap-3 lg:gap-0" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
          <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'pl', label: 'Profit & Loss' },
              { id: 'bs', label: 'Balance Sheet' },
              { id: 'cashflow', label: 'Cash Flow' },
              { id: 'budget', label: 'Budget vs Variance' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-btn ${reportType === tab.id ? 'active' : ''}`}
                onClick={() => setReportType(tab.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: reportType === tab.id ? '#1f6bff' : '#e2e8f0',
                  background: reportType === tab.id ? '#f0f6ff' : '#ffffff',
                  color: reportType === tab.id ? '#1f6bff' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {loading ? 'Refreshing ledger figures...' : 'Live Ledger Computation'}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600">
            {error}
          </div>
        )}

        {reportType === 'pl' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Income Statement Summary</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Live calculation directly from recognized revenues and expenses in the double-entry ledger.</p>
            </div>
            <DataTable columns={plColumns} data={plRows} rowKey="item" emptyMessage="No financial entries available in the ledger." />
          </div>
        )}

        {reportType === 'bs' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Balance Sheet (as of {bsData?.asOf ? formatDateDDMMYYYY(bsData.asOf) : 'today'})</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Derived directly from live journal entries, asset accounts, liabilities, and retained earnings.</p>
            </div>
            {bsDifference !== 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                <strong>Notice:</strong> Unbalanced journal entries detected (Difference: {formatCurrency(bsDifference)}).
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600" style={{ minWidth: 540 }}>
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Section</th>
                    <th className="py-2 px-3">Account</th>
                    <th className="py-2 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={3} className="py-2 px-3 bg-blue-50 font-bold text-blue-800 text-[11px] uppercase tracking-wider">Assets</td></tr>
                  {bsAssets.map((r, i) => (
                    <tr key={`a-${i}`} className={r.isTotal ? 'bg-blue-50/60 font-bold border-t-2 border-blue-200' : 'hover:bg-slate-50'}>
                      <td className="py-1.5 px-3">{r.section}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">{r.account}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900" style={{ fontWeight: r.isTotal ? 800 : 500 }}>{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} className="py-2 px-3 bg-rose-50 font-bold text-rose-800 text-[11px] uppercase tracking-wider">Liabilities</td></tr>
                  {bsLiabilities.map((r, i) => (
                    <tr key={`l-${i}`} className={r.isTotal ? 'bg-rose-50/60 font-bold border-t-2 border-rose-200' : 'hover:bg-slate-50'}>
                      <td className="py-1.5 px-3">{r.section}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">{r.account}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900" style={{ fontWeight: r.isTotal ? 800 : 500 }}>{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} className="py-2 px-3 bg-emerald-50 font-bold text-emerald-800 text-[11px] uppercase tracking-wider">Owners' Equity</td></tr>
                  {bsEquity.map((r, i) => (
                    <tr key={`e-${i}`} className={r.isTotal ? 'bg-emerald-50/60 font-bold border-t-2 border-emerald-200' : 'hover:bg-slate-50'}>
                      <td className="py-1.5 px-3">{r.section}</td>
                      <td className="py-1.5 px-3 font-semibold text-slate-800">{r.account}</td>
                      <td className="py-1.5 px-3 text-right font-mono text-slate-900" style={{ fontWeight: r.isTotal ? 800 : 500 }}>{formatCurrency(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'cashflow' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Cash Flow Statement</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Period movement across cash and bank accounts from recognized ledger entries.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600" style={{ minWidth: 540 }}>
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3 text-right">Inflow</th>
                    <th className="py-2 px-3 text-right">Outflow</th>
                    <th className="py-2 px-3 text-right">Net Cash Movement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(cfData?.periods || []).map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-semibold text-slate-800">{p.period ? String(p.period).slice(0, 7) : 'Period'}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-600">{formatCurrency(p.inflow)}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-600">-{formatCurrency(p.outflow)}</td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${Number(p.net) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(p.net)}
                      </td>
                    </tr>
                  ))}
                  {(!cfData?.periods || cfData.periods.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No cash flow movement recorded in the ledger.
                      </td>
                    </tr>
                  )}
                  {cfData?.periods && cfData.periods.length > 0 && (
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                      <td className="py-2 px-3 text-slate-900">Total Movement</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatCurrency(cfData.totalInflow)}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-700">-{formatCurrency(cfData.totalOutflow)}</td>
                      <td className={`py-2 px-3 text-right font-mono font-extrabold ${Number(cfData.netCashFlow) >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {formatCurrency(cfData.netCashFlow)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'budget' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Budget vs Actual</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Comparison of active annual budgets against recorded actuals.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600" style={{ minWidth: 600 }}>
                <thead className="bg-slate-50 uppercase font-semibold text-slate-500 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Budget (Annual)</th>
                    <th className="py-2 px-3 text-right">Actual YTD</th>
                    <th className="py-2 px-3 text-right">Variance</th>
                    <th className="py-2 px-3 text-right">Utilization</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {budgetRows.map((r) => (
                    <tr key={r.id} className={`hover:bg-slate-50 ${r.isOver ? 'bg-rose-50/50' : ''}`}>
                      <td className="py-2 px-3 font-semibold text-slate-800">{r.name}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrency(r.budget)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(r.actual)}</td>
                      <td className={`py-2 px-3 text-right font-mono font-bold ${r.isOver ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {r.variance < 0 ? '−' : '+'}{formatCurrency(Math.abs(r.variance))}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-600">{r.utilization}%</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${r.isOver ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}`}>
                          {r.isOver ? 'Over Budget' : 'Within Budget'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {budgetRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No active budgets configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FinancialReportsPage;
