import React from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Boxes, Layers, ShoppingCart, Truck, Receipt, CheckCircle2,
  Clock, AlertCircle, ArrowUpRight, ShieldCheck, Factory, Warehouse,
  Building2, IndianRupee, FileText
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/currencyUtils';

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
 * CustomerProjectTab — Order & requirement fulfillment for the customer
 */
export function CustomerProjectTab({ project }) {
  const summary = project.pipelineSummary || {};
  const total = Number(project.productDetails?.quantity ?? project.quantity ?? 0);
  const stages = project.stages ?? [];
  const dispatchStage = stages.find((s) => s.slug === 'customer_dispatch' || s.name?.includes('Dispatch'));
  const dispatched = Number(dispatchStage?.quantities?.dispatched ?? 0);
  const pct = total > 0 ? Math.min(100, Math.round((dispatched / total) * 100)) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <Stat
          label="Customer Requirement"
          value={`${total.toLocaleString('en-IN')} m`}
          sub={project.productDetails?.fabricQuality || project.fabricQuality || 'Custom Fabric'}
          tone="blue"
        />
        <Stat
          label="Order Value"
          value={formatCurrency(project.productDetails?.orderValue ?? project.budget ?? 0)}
          sub={project.customerName || 'Direct Customer'}
          tone="emerald"
        />
        <Stat
          label="Dispatched to Customer"
          value={`${dispatched.toLocaleString('en-IN')} m`}
          sub={`${pct}% fulfilled`}
          tone={pct >= 100 ? 'emerald' : 'amber'}
        />
        <Stat
          label="Customer Order Status"
          value={project.status || 'Active'}
          sub={`Due: ${project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB') : '—'}`}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Customer & Order Details" icon={Building2}>
          <div className="space-y-0.5">
            <Row label="Customer Name" value={project.customerName} />
            <Row
              label="Sales Order / CRM Order"
              value={
                project.crmOrderId ? (
                  <Link to="/sales/orders" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-mono">
                    <ShoppingCart size={11} /> {project.crmOrderId} <ArrowUpRight size={10} />
                  </Link>
                ) : '—'
              }
            />
            <Row label="Fabric Quality" value={project.productDetails?.fabricQuality || project.fabricQuality || '—'} />
            <Row label="Color / Shade" value={project.productDetails?.shade || project.shade || '—'} />
            <Row label="Customer Reference / Notes" value={project.productDetails?.specifications || 'As per approved sample'} />
          </div>
        </Card>

        <Card title="Fulfillment & Traceability" icon={Factory}>
          <div className="space-y-0.5">
            <Row
              label="Allocated Stock"
              value={`${Number(summary.allocated_stock_qty || 0).toLocaleString('en-IN')} m`}
            />
            <Row
              label="Procured Shortage"
              value={`${Number(summary.shortage_procure_qty || 0).toLocaleString('en-IN')} m`}
            />
            <Row
              label="Direct Vendor B Routing"
              value={summary.direct_vendor_b_eligible ? 'Eligible (Stock Route A)' : 'Standard Procurement'}
            />
            <Row
              label="QC Approval Status"
              value={stages.find((s) => s.slug === 'qc_and_stock')?.status || 'Pending QC'}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * OwnProjectTab — Buffer inventory & extra stock allocation
 */
export function OwnProjectTab({ project }) {
  const summary = project.pipelineSummary || {};
  const allocatedStock = Number(summary.allocated_stock_qty || 0);
  const totalStockAvailable = Number(summary.stock_available_qty || 0);
  const surplus = Math.max(0, totalStockAvailable - allocatedStock);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <Stat
          label="Allocated from Grey Stock"
          value={`${allocatedStock.toLocaleString('en-IN')} m`}
          sub="Directly allocated to project"
          tone="blue"
        />
        <Stat
          label="Total Available in Warehouse"
          value={`${totalStockAvailable.toLocaleString('en-IN')} m`}
          sub={summary.stock_source_label || 'Central Warehouse'}
          tone="emerald"
        />
        <Stat
          label="Unallocated Warehouse Surplus"
          value={`${surplus.toLocaleString('en-IN')} m`}
          sub="Free stock for other orders"
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Warehouse Stock Information" icon={Warehouse}>
          <div className="space-y-0.5">
            <Row label="Stock Source Location" value={summary.stock_source_label || 'OSCAR Main Warehouse'} />
            <Row
              label="Inventory Status"
              value={allocatedStock > 0 ? 'Allocated & Reserved' : 'Pending Allocation'}
            />
            <Row
              label="Stock Position Register"
              value={
                <Link to="/inventory/stock-position" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                  View Stock Position <ArrowUpRight size={10} />
                </Link>
              }
            />
            <Row
              label="Lot / Taka Register"
              value={
                <Link to="/inventory/lot-taka" className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium">
                  View Taka Register <ArrowUpRight size={10} />
                </Link>
              }
            />
          </div>
        </Card>

        <Card title="Inventory Buffering Policy" icon={Boxes}>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            Surplus processed fabric remaining after customer delivery requirements are met will be retained in finished goods inventory buckets and made available for future sales orders or sample requests.
          </p>
          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-900">Current Reserved Bucket</span>
            <span className="font-mono font-bold text-blue-700">{allocatedStock.toLocaleString('en-IN')} m</span>
          </div>
        </Card>
      </div>
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
