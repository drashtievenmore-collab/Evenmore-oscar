import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Boxes, Layers, ShoppingCart, Truck, Receipt, CheckCircle2,
  Clock, AlertCircle, ArrowUpRight, ShieldCheck, Factory, Warehouse,
  Building2, IndianRupee, FileText, RefreshCw, Eye, Tag, AlertTriangle,
  Check, DollarSign, Calendar
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyUtils';
import { fetchCustomerProjectDetails, fetchOwnProjectDetails } from '../../../../services/jobWorkSync';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function Card({ title, icon: Icon, badge, children }) {
  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Icon size={14} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-800',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
    rose: 'text-rose-600',
  };
  return (
    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
      <div className="text-[11px] font-medium text-slate-400">{label}</div>
      <div className={`text-base font-black mt-0.5 ${tones[tone] || tones.slate}`}>{value ?? '—'}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

/**
 * CustomerProjectTab — Order & requirement fulfillment for the customer (Part 2)
 */
export function CustomerProjectTab({ project }) {
  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchCustomerProjectDetails(projectId);
      setData(res?.data || res);
    } catch (err) {
      console.warn('Failed to fetch customer project details:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fallback calculations if loading or network error
  const summary = data?.summary || {
    customerRequirement: Number(project.productDetails?.quantity ?? project.quantity ?? project.requirementMeters ?? 0),
    customerAllocatedFabric: Number(project.pipelineSummary?.allocated_stock_qty || 0),
    processingPlanned: Number(project.requirementMeters || project.quantity || 0),
    sentForProcessing: Number(project.dyeingSentMeters || 0),
    processingInward: Number(project.customerProjectReceivedMeters || 0),
    qcPassedQuantity: Number(project.customerProjectReceivedMeters || 0),
    dispatchedQuantity: Number(project.dispatchedMeters || 0),
    remainingRequirement: Math.max(0, Number(project.requirementMeters || project.quantity || 0) - Number(project.dispatchedMeters || 0)),
  };

  const orderDetails = data?.customerOrderDetails || {
    customerName: project.customerName || 'Direct Customer',
    salesOrderNumber: project.salesOrder?.order_number || project.crmOrderId || project.code,
    fabricQuality: project.productDetails?.fabricQuality || project.fabricQuality || project.productName || 'Custom Quality',
    design: project.productDetails?.designNo || project.designNo || 'Standard',
    shade: project.productDetails?.shade || project.shade || 'Standard',
    width: project.productDetails?.width || '44 inches',
    requiredQuantity: summary.customerRequirement,
    deliveryDate: project.expectedCompletionDate || project.dueDate,
    orderStatus: project.status || 'Active',
  };

  const allocations = data?.fabricAllocations || [];
  const processingTracking = data?.processingTracking || [];
  const qcAndFulfilment = data?.qcAndFulfilment || {};
  const dispatches = qcAndFulfilment.dispatches || [];

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="text-blue-600" size={18} />
            <span>Customer Project — Order Fulfillment & Traceability</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Traceable reservation, processing, QC, and dispatch records for Customer: <span className="font-semibold text-slate-700">{orderDetails.customerName}</span>
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. 8 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Stat
          label="1. Customer Requirement"
          value={`${n(summary.customerRequirement)} m`}
          sub="Customer target order"
          tone="blue"
        />
        <Stat
          label="2. Customer-Allocated"
          value={`${n(summary.customerAllocatedFabric)} m`}
          sub="Reserved from Grey Stock"
          tone="emerald"
        />
        <Stat
          label="3. Processing Planned"
          value={`${n(summary.processingPlanned)} m`}
          sub="Assigned in Stage 11"
          tone="slate"
        />
        <Stat
          label="4. Sent for Processing"
          value={`${n(summary.sentForProcessing)} m`}
          sub="Stage 12 Outward to Mill"
          tone="purple"
        />
        <Stat
          label="5. Processing Inward"
          value={`${n(summary.processingInward)} m`}
          sub="Received from Processor"
          tone="amber"
        />
        <Stat
          label="6. QC-Passed Quantity"
          value={`${n(summary.qcPassedQuantity)} m`}
          sub="Passed inspection"
          tone="emerald"
        />
        <Stat
          label="7. Dispatched Quantity"
          value={`${n(summary.dispatchedQuantity)} m`}
          sub="Delivered with Challan & LR"
          tone="blue"
        />
        <Stat
          label="8. Remaining Requirement"
          value={`${n(summary.remainingRequirement)} m`}
          sub={summary.remainingRequirement === 0 ? '100% Fulfilled' : 'Pending Fulfillment'}
          tone={summary.remainingRequirement === 0 ? 'emerald' : 'rose'}
        />
      </div>

      {/* 2. Customer & Order Details */}
      <Card title="Customer & Order Specifications" icon={Building2}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Customer Name</span>
            <span className="font-bold text-slate-800 text-sm mt-0.5 block">{orderDetails.customerName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Sales Order / Ref</span>
            <span className="font-mono font-bold text-blue-600 text-sm mt-0.5 block">
              {orderDetails.salesOrderNumber || '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Fabric Quality & Specs</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{orderDetails.fabricQuality}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Design & Shade / Color</span>
            <span className="font-semibold text-slate-800 block mt-0.5">{orderDetails.design} / {orderDetails.shade}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Width & Construction</span>
            <span className="font-semibold text-slate-700 block mt-0.5">{orderDetails.width}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Agreed Delivery Date</span>
            <span className="font-semibold text-slate-700 block mt-0.5">
              {orderDetails.deliveryDate ? new Date(orderDetails.deliveryDate).toLocaleDateString('en-GB') : '—'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Order Value</span>
            <span className="font-bold text-emerald-700 block mt-0.5 font-mono">
              {formatCurrency(project.productDetails?.orderValue ?? project.budget ?? 0)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Current Order Status</span>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
              {orderDetails.orderStatus}
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Fabric Allocation Table */}
      <Card title="Grey Fabric Allocation Register (Customer Reserved Stock)" icon={Boxes}>
        {allocations.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Source PO / GRN</th>
                  <th className="p-3">Fabric Item / Quality</th>
                  <th className="p-3">Lot Number</th>
                  <th className="p-3">Taka / Roll</th>
                  <th className="p-3 text-right">Allocated Qty</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3">Warehouse Location</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allocations.map((a, idx) => (
                  <tr key={a.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-semibold text-blue-600">{a.sourcePo || 'Direct Stock'}</td>
                    <td className="p-3 font-semibold text-slate-900">{a.fabricItem} ({a.fabricQuality})</td>
                    <td className="p-3 font-mono">{a.lotNumber}</td>
                    <td className="p-3 font-mono">{a.takaNumber}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{n(a.allocatedQty)} m</td>
                    <td className="p-3 text-right font-mono text-slate-600">{n(a.availableQty)} m</td>
                    <td className="p-3 text-slate-600">{a.location}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No specific piece-by-piece takas earmarked directly in database yet. Allocate grey stock in Stage 1.
          </div>
        )}
      </Card>

      {/* 4. Processing Tracking Table */}
      <Card title="Processing & Vendor Tracking (Stage 11–14)" icon={Factory}>
        {processingTracking.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">JWO Number</th>
                  <th className="p-3">Process Type</th>
                  <th className="p-3">Processor / Vendor B</th>
                  <th className="p-3 text-right">Planned Qty</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Pending Qty</th>
                  <th className="p-3 text-right">Rate (₹/m)</th>
                  <th className="p-3 text-center">Loss %</th>
                  <th className="p-3">Return Due</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processingTracking.map((p, idx) => (
                  <tr key={p.jwoNo || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-600">{p.jwoNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{p.process}</td>
                    <td className="p-3 text-slate-700">{p.vendorName}</td>
                    <td className="p-3 text-right font-mono">{n(p.plannedQty)} m</td>
                    <td className="p-3 text-right font-mono font-semibold text-purple-700">{n(p.outwardQty)} m</td>
                    <td className="p-3 text-right font-mono font-semibold text-emerald-700">{n(p.inwardQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-700">{n(p.pendingQty)} m</td>
                    <td className="p-3 text-right font-mono">₹{n(p.rate)}</td>
                    <td className="p-3 text-center font-mono">{n(p.expectedLoss)}%</td>
                    <td className="p-3 text-slate-600">{p.expectedReturnDate || '—'}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No processing orders recorded for this customer requirement yet.
          </div>
        )}
      </Card>

      {/* 5. QC & Customer Fulfilment */}
      <Card title="Quality Inspection & Customer Dispatch Records" icon={Truck}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 mb-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">QC Passed Qty</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">{n(qcAndFulfilment.qcPassedQuantity)} m</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">QC Rejected Qty</span>
            <span className="font-bold text-rose-700 text-sm mt-0.5 block">{n(qcAndFulfilment.rejectedQuantity)} m</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Payment Status</span>
            <span className="font-bold text-blue-700 text-sm mt-0.5 block">{qcAndFulfilment.paymentStatus || 'Pending'}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Fulfilment Balance</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{n(qcAndFulfilment.customerFulfilmentBalance)} m</span>
          </div>
        </div>

        {dispatches.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Delivery Challan</th>
                  <th className="p-3">Dispatch Date</th>
                  <th className="p-3 text-right">Dispatched Qty</th>
                  <th className="p-3">Transporter</th>
                  <th className="p-3">LR / Consignment No</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.map((d, idx) => (
                  <tr key={d.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-blue-600">{d.challanNo}</td>
                    <td className="p-3 text-slate-600">{d.date || '—'}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">{n(d.quantity)} m</td>
                    <td className="p-3 text-slate-700">{d.transporter || 'Direct Delivery'}</td>
                    <td className="p-3 font-mono text-slate-600">{d.lrNumber || '—'}</td>
                    <td className="p-3 text-slate-600">{d.destination}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No customer dispatch delivery challans generated yet. Dispatches occur in Stage 16.
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * OwnProjectTab — Buffer inventory & extra company stock allocation (Part 3)
 */
export function OwnProjectTab({ project }) {
  const projectId = project?.id;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchOwnProjectDetails(projectId);
      setData(res?.data || res);
    } catch (err) {
      console.warn('Failed to fetch own project details:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = data?.summary || {
    extraFabricAllocated: Number(project.pipelineSummary?.own_stock_allocated || 0),
    processingPlanned: 0,
    sentForProcessing: 0,
    processingInward: 0,
    qcPassedQuantity: 0,
    processingLoss: 0,
    availableOwnStock: Number(project.pipelineSummary?.own_stock_allocated || 0),
  };

  const ownStockDetails = data?.ownStockDetails || [];
  const ownProcessingPlans = data?.ownProcessingPlans || [];
  const ownInventoryTracking = data?.ownInventoryTracking || {
    inwardQuantity: summary.processingInward,
    qcPassedQuantity: summary.qcPassedQuantity,
    rejectedQuantity: 0,
    reprocessingQuantity: 0,
    actualProcessingLoss: summary.processingLoss,
    availableForFutureSales: summary.availableOwnStock,
    inventoryValuation: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="text-purple-600" size={18} />
            <span>Own Project — Buffer Stock & Company Inventory Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bulk purchased surplus fabric retained for future sales and warehouse inventory buffering.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Strict Accounting Policy Banner */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-3 text-xs text-blue-900">
        <ShieldCheck size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block">Strict ERP Inventory Separation Rules</span>
          <span className="text-blue-800 leading-relaxed block mt-0.5">
            1. Surplus fabric retained under Own Project is NOT counted as an unfulfilled customer requirement.
            2. Vendor-held fabric is tracked as external WIP and only enters available warehouse stock after inward receipt and QC approval.
            3. The same physical meter cannot be double-counted in both Customer Project and Own Project.
          </span>
        </div>
      </div>

      {/* 1. 7 Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat
          label="1. Extra Fabric"
          value={`${n(summary.extraFabricAllocated)} m`}
          sub="Company Allocation"
          tone="purple"
        />
        <Stat
          label="2. Planned"
          value={`${n(summary.processingPlanned)} m`}
          sub="In Process Plans"
          tone="slate"
        />
        <Stat
          label="3. Sent Outward"
          value={`${n(summary.sentForProcessing)} m`}
          sub="At Processor Mill"
          tone="blue"
        />
        <Stat
          label="4. Inward Rcvd"
          value={`${n(summary.processingInward)} m`}
          sub="Received from Mill"
          tone="amber"
        />
        <Stat
          label="5. QC Passed"
          value={`${n(summary.qcPassedQuantity)} m`}
          sub="Accepted Quality"
          tone="emerald"
        />
        <Stat
          label="6. Process Loss"
          value={`${n(summary.processingLoss)} m`}
          sub="Shrinkage / Loss"
          tone="rose"
        />
        <Stat
          label="7. Available Stock"
          value={`${n(summary.availableOwnStock)} m`}
          sub="Free for Future Sales"
          tone="emerald"
        />
      </div>

      {/* 2. Own Stock Details Table */}
      <Card title="Own Stock Inventory Details (Warehouse Physical Takas)" icon={Warehouse}>
        {ownStockDetails.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">Source PO / GRN</th>
                  <th className="p-3">Fabric Item / Quality</th>
                  <th className="p-3">Lot Number</th>
                  <th className="p-3">Taka / Roll</th>
                  <th className="p-3 text-right">Allocated Qty</th>
                  <th className="p-3 text-right">Available Qty</th>
                  <th className="p-3 text-right">Standard Valuation</th>
                  <th className="p-3">Godown Location</th>
                  <th className="p-3 text-center">Stock Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownStockDetails.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-semibold text-blue-600">{s.sourcePo || 'Direct PO'}</td>
                    <td className="p-3 font-semibold text-slate-900">{s.fabricItem} ({s.fabricQuality})</td>
                    <td className="p-3 font-mono">{s.lotNumber}</td>
                    <td className="p-3 font-mono">{s.takaNumber}</td>
                    <td className="p-3 text-right font-mono font-bold text-purple-700">{n(s.allocatedQty)} m</td>
                    <td className="p-3 text-right font-mono text-slate-600">{n(s.availableQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 font-mono">
                      {formatCurrency(s.valuation || 0)}
                    </td>
                    <td className="p-3 text-slate-600">{s.location}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No surplus grey stock allocated to Own Project for this project. All purchased stock is earmarked for customer requirement.
          </div>
        )}
      </Card>

      {/* 3. Own Processing Plans Table */}
      <Card title="Own Project Processing Plans (Stage 11–13)" icon={Factory}>
        {ownProcessingPlans.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-600 uppercase border-b border-slate-200">
                <tr>
                  <th className="p-3">JWO Number</th>
                  <th className="p-3">Process</th>
                  <th className="p-3">Vendor / Processor</th>
                  <th className="p-3 text-right">Planned Qty</th>
                  <th className="p-3 text-right">Outward Qty</th>
                  <th className="p-3 text-right">Inward Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-center">Loss %</th>
                  <th className="p-3">Expected Return</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownProcessingPlans.map((p, idx) => (
                  <tr key={p.jwoNo || idx} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-purple-600">{p.jwoNo}</td>
                    <td className="p-3 font-semibold text-slate-800">{p.process}</td>
                    <td className="p-3 text-slate-700">{p.vendorName}</td>
                    <td className="p-3 text-right font-mono">{n(p.plannedQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700">{n(p.outwardQty)} m</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">{n(p.inwardQty)} m</td>
                    <td className="p-3 text-right font-mono">₹{n(p.rate)}</td>
                    <td className="p-3 text-center font-mono">{n(p.expectedLoss)}%</td>
                    <td className="p-3 text-slate-600">{p.expectedReturnDate || '—'}</td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            No dedicated Own Project processing plans created yet.
          </div>
        )}
      </Card>

      {/* 4. Own Inventory Tracking & Valuation */}
      <Card title="Own Inventory Tracking & Commercial Valuation" icon={DollarSign}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Actual Inward Quantity</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">{n(ownInventoryTracking.inwardQuantity)} m</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">QC-Passed Stock</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">{n(ownInventoryTracking.qcPassedQuantity)} m</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Free Stock for Future Sales</span>
            <span className="font-bold text-blue-700 text-sm mt-0.5 block">{n(ownInventoryTracking.availableForFutureSales)} m</span>
          </div>
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-400 block text-[11px]">Inventory Asset Valuation</span>
            <span className="font-bold text-emerald-800 text-sm mt-0.5 block font-mono">
              {formatCurrency(ownInventoryTracking.inventoryValuation || 0)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * PaymentDispatchTab — Billing, Payments and Customer Delivery Tracking
 */
export function PaymentDispatchTab({ project }) {
  const stages = project.stages ?? [];
  const dispatchStage = stages.find((s) => s.slug === 'customer_dispatch' || s.name?.includes('Dispatch'));
  const invoiceStage = stages.find((s) => s.slug === 'invoice_and_payment' || s.name?.includes('Invoice'));
  const orderValue = Number(project.productDetails?.orderValue ?? project.budget ?? 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Stat
          label="Total Order Value"
          value={formatCurrency(orderValue)}
          sub="Customer Agreed Value"
          tone="blue"
        />
        <Stat
          label="Dispatch Status"
          value={dispatchStage?.status || 'Pending'}
          sub={dispatchStage?.remarks || 'Awaiting dispatch confirmation'}
          tone={dispatchStage?.status === 'Completed' ? 'emerald' : 'slate'}
        />
        <Stat
          label="Invoice & Accounts Status"
          value={invoiceStage?.status || 'Pending'}
          sub={invoiceStage?.remarks || 'Awaiting invoice generation'}
          tone={invoiceStage?.status === 'Completed' ? 'emerald' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Customer Dispatch Records" icon={Truck}>
          <div className="space-y-0.5">
            <Row label="Dispatch Stage" value={dispatchStage?.name || 'Customer Dispatch'} />
            <Row label="Dispatch Status" value={dispatchStage?.status || 'Pending'} />
            <Row
              label="Dispatched Quantity"
              value={`${Number(dispatchStage?.quantities?.dispatched || 0).toLocaleString('en-IN')} m`}
            />
            <Row
              label="Delivery Challans"
              value={
                <Link to="/sales/delivery-challans" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                  Open Delivery Challans <ArrowUpRight size={10} />
                </Link>
              }
            />
          </div>
        </Card>

        <Card title="Invoicing & Receivables" icon={Receipt}>
          <div className="space-y-0.5">
            <Row label="Billing Stage" value={invoiceStage?.name || 'Invoice & Payment Collection'} />
            <Row label="Invoice Status" value={invoiceStage?.status || 'Pending'} />
            <Row label="Remarks" value={invoiceStage?.remarks || 'Payment on delivery terms'} />
            <Row
              label="Sales Invoices Register"
              value={
                <Link to="/sales/invoices" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                  Open Sales Invoices <ArrowUpRight size={10} />
                </Link>
              }
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
