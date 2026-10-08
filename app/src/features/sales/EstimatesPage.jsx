import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Plus, FileText, CheckCircle2, ArrowRight, X, Eye, Printer, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LineItemEditor } from '../../components/common/LineItemEditor';
import { PageHeader } from '../../components/common/PageHeader';
import { useEstimates, updateEstimate } from '../../services/estimateStore';
import { PrintEstimateModal } from '../../components/common/PrintEstimateModal';
import EstimateComposer from './EstimateComposer';
import './EstimatesPage.css';

function logLeadActivity(leadId, title, color) {
    if (!leadId || !title) return;
    // The lead timeline is written server-side from the change itself
    // (`GET /crm/leads/{id}/timeline/`), so there is nothing to record here.
}

const estimateGuide = {
    title: 'Sales Estimates',
    subtitle: 'Pre-quotation cost estimates and 1-click conversion to Quotations.',
    purpose: 'An Estimate is a preliminary, non-binding cost indication shared with a prospect before a formal Quotation. Once the prospect accepts the estimate, it converts directly into a Quotation without re-entering line items.',
    keyTerms: [
        { term: 'Estimate', definition: 'A rough cost indication valid for a short window (e.g. 15 days).' },
        { term: 'Estimate Value', definition: 'The total monetary value of all open estimates awaiting prospect response.' },
        { term: '1-Click Quotation Conversion', definition: 'Automatically converts an accepted estimate into a formal Quotation.' },
    ],
    tips: [
        'Click "Convert to Quotation" to instantly create a formal Quotation from an accepted estimate.',
        'Use the Clone button to duplicate any existing estimate for a quick client variation.',
        'Click the Estimate number to view line item details and print the estimate voucher.',
    ],
    workflow: ['Estimate Created', 'Prospect Review', 'Convert to Quotation', 'Customer Approval', 'Sales Order'],
};

export const EstimatesPage = () => {
    const { customers, addQuotation, deleteEstimate, formatCurrency } = useERP();
    const navigate = useNavigate();
    const location = useLocation();
    const leadRequest = location.state && location.state.fromLead ? location.state : null;
    const autoOpened = React.useRef(false);
    const estimates = useEstimates();
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerKey, setComposerKey] = useState(0);
    const [composerInitial, setComposerInitial] = useState({ customerId: '', items: [] });
    const [selectedEstimate, setSelectedEstimate] = useState(null);
    const [printEstimateTarget, setPrintEstimateTarget] = useState(null);
    const [editingEstimate, setEditingEstimate] = useState(null);

    const handleOpenCreateModal = () => {
        const match = customers.find((c) => leadRequest && c.name === leadRequest.company) || customers[0];
        setEditingEstimate(null);
        setComposerInitial({ customerId: match?.id || '', items: [] });
        setComposerKey((k) => k + 1);
        setIsComposerOpen(true);
    };

    const handleCloseCreateModal = () => {
        setEditingEstimate(null);
        setIsComposerOpen(false);
    };

    const handleEdit = (estimate) => {
        if (!estimate || estimate.status === 'Converted') return;
        setEditingEstimate(estimate);
        setComposerInitial({ customerId: '', items: [] });
        setComposerKey((k) => k + 1);
        setIsComposerOpen(true);
    };

    const handleDelete = (estimate) => {
        if (!estimate || estimate.status === 'Converted') return;
        const label = estimate.estimateNumber || 'this estimate';
        if (!window.confirm(`Delete estimate ${label}? This cannot be undone.`)) return;
        if (selectedEstimate && selectedEstimate.id === estimate.id) setSelectedEstimate(null);
        deleteEstimate?.(estimate.id);
    };

    const isRowLocked = (estimate) => estimate.status === 'Converted';

    // Pastel filled pills like the register mockup (real statuses kept).
    const estimateStatusTone = (status) => ({
        Draft: 'bg-blue-50 text-blue-700 border-blue-200',
        Sent: 'bg-blue-50 text-blue-700 border-blue-200',
        Viewed: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        Accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        Converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
        Expired: 'bg-rose-50 text-rose-700 border-rose-200',
    }[status] || 'bg-slate-100 text-slate-600 border-slate-200');

    const renderEstimateStatus = (status) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${estimateStatusTone(status)}`}>
            {status}
        </span>
    );

    const actionIconBtn = 'h-7 w-7 grid place-items-center rounded-md cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

    React.useEffect(() => {
        if (!leadRequest || autoOpened.current) return;
        autoOpened.current = true;
        const match = customers.find((c) => c.name === leadRequest.company) || customers[0];
        setComposerInitial({
            customerId: match?.id || '',
            items: Array.isArray(leadRequest.items) ? leadRequest.items : [],
        });
        setComposerKey((k) => k + 1);
        setIsComposerOpen(true);
    }, [leadRequest, customers]);

    const totalValue = estimates
        .filter((e) => e.status !== 'Converted')
        .reduce((sum, e) => sum + (e.amount || 0), 0);

    const handleConvert = (estimateId) => {
        const estimate = estimates.find((e) => e.id === estimateId);
        if (!estimate) return;
        convertEstimateObject(estimate);
    };

    const convertEstimateObject = (estimate) => {
        if (!estimate) return;
        const cust = customers.find((c) => c.id === estimate.customerId) ||
            customers.find((c) => c.name === estimate.customer) ||
            customers[0];
        const nextQuote = {
            id: `quo-${Date.now()}`,
            quoteNumber: `QUO-2026-${String(Date.now()).slice(-3)}`,
            estimateRef: estimate.estimateNumber,
            customerId: cust?.id || '',
            customer: cust?.name || estimate.customer || 'Client Account',
            leadId: estimate.leadId || '',
            leadName: estimate.leadName || '',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            validUntil: '30 Days',
            amount: estimate.amount,
            status: 'Draft',
            items: estimate.items || [],
        };
        addQuotation(nextQuote);
        if (estimate.id) updateEstimate(estimate.id, { status: 'Converted' });
        if (estimate.leadId) {
            logLeadActivity(estimate.leadId, `Estimate ${estimate.estimateNumber} converted to Quotation ${nextQuote.quoteNumber}`, '#10b981');
        }
        setIsComposerOpen(false);
        navigate('/sales/quotations');
    };

    const itemNames = (estimate) => {
        const names = (estimate.items || [])
            .map((it) => it.itemName || it.name || it.description)
            .filter(Boolean);
        if (names.length === 0) return '1 Item';
        if (names.length <= 2) return names.join(', ');
        return `Multiple Items (${names.length})`;
    };

    const itemNamesTitle = (estimate) => (estimate.items || [])
        .map((it) => it.itemName || it.name || it.description)
        .filter(Boolean)
        .join(', ');

    const columns = [
        {
            header: 'Estimate #',
            accessor: 'estimateNumber',
            width: '14%',
            render: (e) => (
                <button
                    onClick={() => setSelectedEstimate(e)}
                    title="View Details"
                    className="font-bold text-[13px] text-[#1F2E4A] hover:underline block text-left cursor-pointer"
                >
                    {e.estimateNumber}
                    {e._synced === false && (
                        <span
                            className="ml-1.5 inline-flex items-center gap-1 align-middle text-[10px] font-bold text-amber-600 no-underline"
                            title={e._syncError || 'This estimate did not reach the server.'}
                        >
                            <AlertTriangle size={11} /> Not synced
                        </span>
                    )}
                </button>
            ),
        },
        {
            header: 'Customer',
            accessor: 'customer',
            width: '24%',
            render: (e) => (
                <span className="font-semibold text-[13px] text-slate-800 block truncate" title={e.customer}>
                    {e.customer}
                </span>
            ),
        },
        {
            header: 'Items',
            width: '20%',
            render: (e) => (
                <span className="text-[13px] text-slate-600 block truncate" title={itemNamesTitle(e)}>
                    {itemNames(e)}
                </span>
            ),
        },
        {
            header: 'Estimated Total',
            accessor: 'amount',
            width: '14%',
            render: (e) => (
                <span className="font-bold text-[13px] text-slate-900">
                    {formatCurrency(e.amount || 0)}
                </span>
            ),
        },
        {
            header: 'Status',
            accessor: 'status',
            width: '12%',
            align: 'center',
            render: (e) => renderEstimateStatus(e.status),
        },
        {
            header: 'Actions',
            align: 'right',
            width: '16%',
            render: (e) => (
                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedEstimate(e)}
                      className={`${actionIconBtn} bg-slate-100 text-slate-500 hover:bg-slate-200`}
                      title="View Details"
                    >
                        <Eye size={13} />
                    </button>
                    <button
                      onClick={() => handleEdit(e)}
                      disabled={isRowLocked(e)}
                      className={`${actionIconBtn} bg-blue-50 text-blue-600 hover:bg-blue-100`}
                      title={isRowLocked(e) ? 'Converted estimates cannot be edited' : 'Edit Estimate'}
                    >
                        <Pencil size={13} />
                    </button>
                    {e.status === 'Converted' ? (
                        <button
                          onClick={() => navigate('/sales/quotations')}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          title="Open the converted quotation"
                        >
                            <CheckCircle2 size={12} /> Converted
                        </button>
                    ) : (
                        <button
                          onClick={() => handleConvert(e.id)}
                          className={`${actionIconBtn} bg-emerald-500 text-white hover:bg-emerald-600`}
                          title="Convert to Quotation"
                        >
                            <ArrowRight size={13} />
                        </button>
                    )}
                    <button
                      onClick={() => handleDelete(e)}
                      disabled={isRowLocked(e)}
                      className={`${actionIconBtn} bg-red-500 text-white hover:bg-red-600`}
                      title={isRowLocked(e) ? 'Converted estimates cannot be deleted' : 'Delete Estimate'}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            ),
        },
    ];

    if (isComposerOpen) {
        return (
            <EstimateComposer
                key={composerKey}
                initialCustomerId={composerInitial.customerId}
                initialLines={composerInitial.items}
                editingEstimate={editingEstimate}
                leadId={leadRequest?.leadId || ''}
                leadName={leadRequest?.leadName || ''}
                company={leadRequest?.company || ''}
                onBack={handleCloseCreateModal}
                onSaved={() => { setEditingEstimate(null); setIsComposerOpen(false); }}
                onConvert={(saved) => convertEstimateObject(saved)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sales Estimates"
                subtitle="Share preliminary cost estimates and convert accepted ones directly into formal Quotations."
                guide={estimateGuide}
                actions={
                    <Button icon={Plus} onClick={handleOpenCreateModal}>
                        New Estimate
                    </Button>
                }
            />

            {leadRequest && (
                <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs">
                    <FileText size={15} className="text-blue-600 shrink-0" />
                    <span className="text-slate-700">
                        Creating estimate for lead <strong className="text-slate-900">{leadRequest.leadName}</strong>
                        {leadRequest.company && <span> • {leadRequest.company}</span>}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Total Estimates" value={estimates.length} icon={FileText} />
                <StatCard label="Open Estimate Value" value={formatCurrency(totalValue)} />
                <StatCard
                    label="Converted to Quotation"
                    value={`${estimates.filter((e) => e.status === 'Converted').length} Estimates`}
                    trend={{ positive: true, text: 'Direct quotation conversion' }}
                />
            </div>

            <div className="estimate-register">
            <DataTable
                title="Estimate Register"
                data={estimates}
                columns={columns}
                keyExtractor={(e) => e.id}
                searchPlaceholder="Search estimates..."
                searchFilter={(e, term) =>
                    String(e.estimateNumber ?? '').toLowerCase().includes(term) ||
                    String(e.customer ?? '').toLowerCase().includes(term) ||
                    String(e.status ?? '').toLowerCase().includes(term)
                }
            />
            </div>

            {selectedEstimate && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full p-4 sm:p-6 shadow-2xl text-xs max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pb-3 border-b border-slate-200">
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 sm:gap-3 min-w-0 lg:min-w-auto">
                                <h3 className="font-bold text-lg text-[#1F2E4A]">{selectedEstimate.estimateNumber}</h3>
                                <span className="font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded">
                                    {selectedEstimate.customer}
                                </span>
                                {renderEstimateStatus(selectedEstimate.status)}
                            </div>
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPrintEstimateTarget(selectedEstimate)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                    <Printer size={13} />
                                    Print Official Estimate
                                </button>
                                <button onClick={() => setSelectedEstimate(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 mt-4 overflow-y-auto pr-1 flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Client Account</span>
                                    <p className="text-sm font-bold text-slate-900 mt-0.5">{selectedEstimate.customer}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Validity Window</span>
                                    <p className="text-sm font-semibold text-slate-800 mt-0.5">{selectedEstimate.validUntil || '15 Days'}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-xs">
                                    Estimated Line Items ({selectedEstimate.items?.length || 0})
                                </h4>
                                <LineItemEditor items={selectedEstimate.items || []} onChange={() => {}} readOnly={true} />
                            </div>
                        </div>

                        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 lg:gap-0 pt-4 border-t border-slate-200 bg-slate-50 -mx-4 -mb-4 px-4 sm:-mx-6 sm:-mb-6 sm:px-6 py-3">
                            <div className="font-mono text-xs">
                                Total Estimate:{' '}
                                <strong className="text-slate-900">
                                    ${(selectedEstimate.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </strong>
                            </div>
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                                {selectedEstimate.status !== 'Converted' && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setSelectedEstimate(null);
                                                handleEdit(selectedEstimate);
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                handleConvert(selectedEstimate.id);
                                                setSelectedEstimate(null);
                                            }}
                                        >
                                            Convert to Quotation
                                        </Button>
                                    </>
                                )}
                                <Button variant="outline" onClick={() => setSelectedEstimate(null)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Official Commercial Sales Estimate Voucher */}
            <PrintEstimateModal
                isOpen={Boolean(printEstimateTarget)}
                onClose={() => setPrintEstimateTarget(null)}
                estimate={printEstimateTarget}
            />
        </div>
    );
};

export default EstimatesPage;
