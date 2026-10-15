import React, { useState } from 'react';
import { Printer, Download } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { exportToCSV } from '../../services/exportUtils';
import {
  Card,
  EmptyRow,
  ErrorState,
  Kpi,
  LoadingState,
  TabBar,
  formatDate,
  formatINR,
  inputClass,
  labelClass,
  thClass,
  todayISO,
  unwrapList,
  useApiGet,
} from './accountingShared';

const TABS = [
  { id: 'pl', label: 'Profit & Loss' },
  { id: 'bs', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'budget', label: 'Budget vs Actual' },
];

const accountName = (a) => `${a.code ? `${a.code} - ` : ''}${a.name}`;

function Amount({ value, strong = false }) {
  const n = Number(value);
  const tone = !Number.isFinite(n) || n === 0 ? 'text-slate-600' : n > 0 ? 'text-slate-900' : 'text-rose-600';
  return <span className={`font-mono ${strong ? 'font-bold' : ''} ${tone}`}>{formatINR(value)}</span>;
}

function SectionRow({ label, tone }) {
  return (
    <tr>
      <td colSpan={2} className={`py-2 px-3 font-bold text-[11px] uppercase tracking-wider ${tone}`}>{label}</td>
    </tr>
  );
}

function LineRow({ label, value, total = false, indent = false }) {
  return (
    <tr className={total ? 'bg-slate-50 font-bold border-t border-[#dce5f4]' : 'hover:bg-slate-50'}>
      <td className={`py-1.5 px-3 ${indent ? 'pl-8 text-slate-500' : 'text-slate-800'}`}>{label}</td>
      <td className="py-1.5 px-3 text-right"><Amount value={value} strong={total} /></td>
    </tr>
  );
}

export function FinancialReportsPage() {
  const [reportType, setReportType] = useState('pl');
  // Period for P&L / cash flow; as-of date for the balance sheet. Empty = server default.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [asOf, setAsOf] = useState('');

  const period = { date_from: dateFrom, date_to: dateTo };
  const pnl = useApiGet('/accounts/reports/profit-and-loss/', period);
  const bs = useApiGet('/accounts/reports/balance-sheet/', { asOf });
  const cf = useApiGet('/accounts/reports/cash-flow/', period);
  const budgets = useApiGet('/accounts/budgets/', { page_size: 200, date_from: dateFrom, date_to: dateTo }, { enabled: reportType === 'budget' });

  const p = pnl.data;
  const b = bs.data;
  const c = cf.data;
  const budgetRows = unwrapList(budgets.data);

  const handleExport = () => {
    const stamp = todayISO();
    if (reportType === 'pl' && p) {
      exportToCSV(`Profit_and_Loss_${stamp}`, ['Section', 'Account', 'Amount'], [
        ...(p.incomeAccounts || []).map((a) => ['Income', accountName(a), a.amount]),
        ['Total', 'Revenue', p.revenue],
        ['Total', 'Cost of goods sold', p.cogs],
        ['Total', 'Gross profit', p.grossProfit],
        ...(p.expenseAccounts || []).map((a) => ['Expense', accountName(a), a.amount]),
        ['Total', 'Operating expenses', p.operatingExpenses],
        ['Total', 'Net operating profit', p.netOperatingProfit],
      ]);
    } else if (reportType === 'bs' && b) {
      exportToCSV(`Balance_Sheet_${stamp}`, ['Section', 'Account', 'Amount'], [
        ...(b.assets || []).map((a) => ['Assets', accountName(a), a.amount]),
        ['Assets', 'Total assets', b.totalAssets],
        ...(b.liabilities || []).map((a) => ['Liabilities', accountName(a), a.amount]),
        ['Liabilities', 'Total liabilities', b.totalLiabilities],
        ...(b.equity || []).map((a) => ['Equity', accountName(a), a.amount]),
        ['Equity', 'Retained earnings', b.retainedEarnings],
        ['Equity', 'Total equity', b.totalEquity],
      ]);
    } else if (reportType === 'cashflow' && c) {
      exportToCSV(`Cash_Flow_${stamp}`, ['Period', 'Inflow', 'Outflow', 'Net'], (c.periods || []).map((r) => [r.period, r.inflow, r.outflow, r.net]));
    } else if (reportType === 'budget') {
      exportToCSV(`Budget_vs_Actual_${stamp}`, ['Account', 'Period start', 'Period end', 'Budget', 'Actual', 'Variance'], budgetRows.map((r) => [r.accountName, r.periodStart, r.periodEnd, r.amount, r.actual, r.variance]));
    }
  };

  const activeReady =
    (reportType === 'pl' && p) || (reportType === 'bs' && b) || (reportType === 'cashflow' && c) || (reportType === 'budget' && budgets.data);

  return (
    <div className="space-y-6 printable-document">
      <PageHeader
        title="Financial Reports"
        subtitle="Profit & Loss, Balance Sheet, Cash Flow and Budgets — computed on the server from the journal."
        breadcrumb={[{ label: 'Accounts', to: '/accounts/cash-bank' }, { label: 'Reports' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
            <Button icon={Download} onClick={handleExport} disabled={!activeReady}>Export CSV</Button>
          </div>
        }
      />

      <div className="bg-white border border-[#dce5f4] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <div>
          <label className={labelClass}>Period from (P&amp;L, Cash Flow, Budgets)</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Period to</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Balance sheet as of</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Revenue" value={p ? formatINR(p.revenue) : '—'} />
        <Kpi label="Cost of Goods" value={p ? formatINR(p.cogs) : '—'} />
        <Kpi label="Operating Expenses" value={p ? formatINR(p.operatingExpenses) : '—'} />
        <Kpi
          label="Net Operating Profit"
          value={p ? formatINR(p.netOperatingProfit) : '—'}
          tone={p && Number(p.netOperatingProfit) < 0 ? 'text-rose-700' : 'text-emerald-700'}
          note={p ? `Gross margin ${Number(p.grossMarginPct).toLocaleString('en-IN')}%` : undefined}
        />
        <Kpi label="Total Assets" value={b ? formatINR(b.totalAssets) : '—'} note={b ? `As of ${formatDate(b.asOf)}` : undefined} />
        <Kpi label="Total Equity" value={b ? formatINR(b.totalEquity) : '—'} note={b ? `Liabilities ${formatINR(b.totalLiabilities)}` : undefined} />
      </div>

      <Card actions={<TabBar tabs={TABS} active={reportType} onChange={setReportType} />}>
        {reportType === 'pl' && (
          <div className="space-y-3">
            <ErrorState message={pnl.error ? `Profit & Loss could not be loaded — ${pnl.error}` : ''} onRetry={pnl.reload} />
            {pnl.loading ? <LoadingState label="Loading Profit & Loss…" /> : p && (
              <div className="overflow-x-auto">
                <p className="text-[11px] text-slate-500 mb-2">
                  Period: {p.periodFrom ? formatDate(p.periodFrom) : 'beginning'} to {p.periodTo ? formatDate(p.periodTo) : 'today'}
                </p>
                <table className="w-full min-w-[480px] text-left text-xs">
                  <tbody>
                    <SectionRow label="Income" tone="bg-blue-50 text-blue-800" />
                    {(p.incomeAccounts || []).length === 0 && <EmptyRow colSpan={2} message="No income postings in this period." />}
                    {(p.incomeAccounts || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                    <LineRow label="Revenue" value={p.revenue} total />
                    <LineRow label="Cost of goods sold" value={p.cogs} />
                    <LineRow label="Gross profit" value={p.grossProfit} total />
                    <SectionRow label="Expenses" tone="bg-rose-50 text-rose-800" />
                    {(p.expenseAccounts || []).length === 0 && <EmptyRow colSpan={2} message="No expense postings in this period." />}
                    {(p.expenseAccounts || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                    <LineRow label="Operating expenses" value={p.operatingExpenses} total />
                    <LineRow label="Net operating profit" value={p.netOperatingProfit} total />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {reportType === 'bs' && (
          <div className="space-y-3">
            <ErrorState message={bs.error ? `Balance sheet could not be loaded — ${bs.error}` : ''} onRetry={bs.reload} />
            {bs.loading ? <LoadingState label="Loading balance sheet…" /> : b && (
              <>
                <p className="text-[11px] text-slate-500">As of {formatDate(b.asOf)}</p>
                {Number(b.difference) !== 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Assets do not equal liabilities + equity — difference reported by the server: {formatINR(b.difference)}.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <tbody>
                      <SectionRow label="Assets" tone="bg-blue-50 text-blue-800" />
                      {(b.assets || []).length === 0 && <EmptyRow colSpan={2} message="No asset balances." />}
                      {(b.assets || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                      <LineRow label="Total assets" value={b.totalAssets} total />
                      <SectionRow label="Liabilities" tone="bg-rose-50 text-rose-800" />
                      {(b.liabilities || []).length === 0 && <EmptyRow colSpan={2} message="No liability balances." />}
                      {(b.liabilities || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                      <LineRow label="Total liabilities" value={b.totalLiabilities} total />
                      <SectionRow label="Equity" tone="bg-emerald-50 text-emerald-800" />
                      {(b.equity || []).map((a) => <LineRow key={a.accountId} label={accountName(a)} value={a.amount} indent />)}
                      <LineRow label="Retained earnings (net operating profit to date)" value={b.retainedEarnings} indent />
                      <LineRow label="Total equity" value={b.totalEquity} total />
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {reportType === 'cashflow' && (
          <div className="space-y-3">
            <ErrorState message={cf.error ? `Cash flow could not be loaded — ${cf.error}` : ''} onRetry={cf.reload} />
            {cf.loading ? <LoadingState label="Loading cash flow…" /> : c && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-[#dce5f4]">
                    <tr>
                      <th className={thClass}>Month</th>
                      <th className={`${thClass} text-right`}>Inflow</th>
                      <th className={`${thClass} text-right`}>Outflow</th>
                      <th className={`${thClass} text-right`}>Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(c.periods || []).length === 0 && <EmptyRow colSpan={4} message="No bank or cash movement in this period." />}
                    {(c.periods || []).map((r) => (
                      <tr key={r.period} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{String(r.period).slice(0, 7)}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatINR(r.inflow)}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-700">{formatINR(r.outflow)}</td>
                        <td className="py-2 px-3 text-right"><Amount value={r.net} strong /></td>
                      </tr>
                    ))}
                  </tbody>
                  {(c.periods || []).length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-[#dce5f4]">
                        <td className="py-2 px-3 text-slate-900">Total</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-800">{formatINR(c.totalInflow)}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-800">{formatINR(c.totalOutflow)}</td>
                        <td className="py-2 px-3 text-right"><Amount value={c.netCashFlow} strong /></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {reportType === 'budget' && (
          <div className="space-y-3">
            <ErrorState message={budgets.error ? `Budgets could not be loaded — ${budgets.error}` : ''} onRetry={budgets.reload} />
            {budgets.loading ? <LoadingState label="Loading budgets…" /> : budgets.data && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-[#dce5f4]">
                    <tr>
                      <th className={thClass}>Account</th>
                      <th className={thClass}>Period</th>
                      <th className={`${thClass} text-right`}>Budget</th>
                      <th className={`${thClass} text-right`}>Actual</th>
                      <th className={`${thClass} text-right`}>Variance</th>
                      <th className={`${thClass} text-center`}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {budgetRows.length === 0 && <EmptyRow colSpan={6} message="No budgets in this period." />}
                    {budgetRows.map((r) => {
                      const over = r.variance !== null && r.variance !== undefined && Number(r.variance) < 0;
                      return (
                        <tr key={r.id} className={`hover:bg-slate-50 ${over ? 'bg-rose-50/50' : ''}`}>
                          <td className="py-2 px-3 font-semibold text-slate-800">{r.accountName}</td>
                          <td className="py-2 px-3 font-mono whitespace-nowrap">{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatINR(r.amount)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatINR(r.actual)}</td>
                          <td className="py-2 px-3 text-right"><Amount value={r.variance} strong /></td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${over ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                              {over ? 'Over budget' : 'Within budget'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

export default FinancialReportsPage;
