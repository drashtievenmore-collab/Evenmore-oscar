import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Boxes, MapPin, Eye, ArrowLeftRight, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ItemStockDetailModal } from '../../components/common/ItemStockDetailModal';
import PageHeader from '../../components/ui/PageHeader';
export const StockPositionPage = () => {
    const { items, calculateItemStock, formatCurrency } = useERP();
    const navigate = useNavigate();
    const [filterState, setFilterState] = useState('All');
    const [selectedItem, setSelectedItem] = useState(null);
    const enrichedItems = items.map((i) => {
        const calc = calculateItemStock(i.id);
        let status = i.status;
        if (calc.available <= i.reorderLevel / 2) {
            status = 'Critical';
        }
        else if (calc.available <= i.reorderLevel) {
            status = 'Low Stock';
        }
        else {
            status = 'Optimal';
        }
        return {
            ...i,
            calculatedOnHand: calc.onHand,
            calculatedAvailable: calc.available,
            calculatedReserved: calc.reserved,
            calculatedDamaged: calc.damaged,
            status,
        };
    });
    const filteredItems = enrichedItems.filter((i) => {
        if (filterState === 'All')
            return true;
        if (filterState === 'Low Stock')
            return i.status === 'Low Stock';
        if (filterState === 'Critical')
            return i.status === 'Critical';
        if (filterState === 'Optimal')
            return i.status === 'Optimal';
        return true;
    });
    const totalValue = enrichedItems.reduce((acc, i) => acc + (i.costPrice ?? i.unitCost ?? 0) * (i.calculatedOnHand || 0), 0);
    const criticalCount = enrichedItems.filter((i) => i.status === 'Critical').length;
    const lowCount = enrichedItems.filter((i) => i.status === 'Low Stock').length;
    const columns = [
        {
            key: 'sku',
            header: 'SKU Code',
            width: '12%',
            render: (i) => (
              <button
                onClick={() => setSelectedItem(i)}
                className="font-mono font-bold text-primary hover:underline text-left cursor-pointer whitespace-nowrap"
              >
                {i.sku}
              </button>
            ),
        },
        {
            key: 'name',
            header: 'Item Description',
            width: '22%',
            render: (i) => (
              <div>
                <button onClick={() => setSelectedItem(i)} className="font-bold text-text hover:underline text-left block">
                  {i.name}
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted">{i.category}</span>
                  <span className="text-[10px] text-muted flex items-center gap-0.5">
                    <MapPin size={9}/> {i.location}
                  </span>
                </div>
              </div>
            ),
        },
        {
            key: 'calculatedOnHand',
            header: 'Physical On-Hand',
            align: 'center',
            width: '12%',
            render: (i) => (
              <span className="font-mono font-bold text-text bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded whitespace-nowrap">
                {i.calculatedOnHand} {i.unit}
              </span>
            ),
        },
        {
            key: 'calculatedAvailable',
            header: 'Available',
            align: 'center',
            width: '11%',
            render: (i) => (
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap">
                {i.calculatedAvailable} {i.unit}
              </span>
            ),
        },
        {
            key: 'calculatedReserved',
            header: 'Sales Reserved',
            align: 'center',
            width: '11%',
            render: (i) => (
              <span className="font-mono text-muted whitespace-nowrap">
                {i.calculatedReserved || 0} {i.unit}
              </span>
            ),
        },
        {
            key: 'reorderLevel',
            header: 'Safety Reorder',
            align: 'center',
            width: '10%',
            render: (i) => <span className="font-mono text-muted whitespace-nowrap">{i.reorderLevel}</span>,
        },
        {
            key: 'totalValue',
            header: 'Aggregate Asset Value',
            align: 'right',
            width: '12%',
            render: (i) => {
                const itemVal = (i.costPrice ?? i.unitCost ?? 0) * (i.calculatedOnHand || 0);
                return (
                  <span className="font-mono font-semibold text-text whitespace-nowrap">
                    {formatCurrency(itemVal)}
                  </span>
                );
            },
        },
        {
            key: 'status',
            header: 'Status',
            align: 'center',
            width: '10%',
            render: (i) => <StatusBadge status={i.status}/>,
        },
    ];
    return (<div className="space-y-6">
      <PageHeader
        title="Stock Position & Movement Engine"
        subtitle="Dynamic inventory balance computed from verified physical movements, sales reservations, and RMA deductions."
        actions={
          <>
            <Button
              variant="outline"
              icon={ArrowLeftRight}
              onClick={() => navigate('/inventory/transfers')}
            >
              Stock Transfers
            </Button>
            <Button
              icon={ShoppingCart}
              onClick={() => navigate('/purchase/orders')}
            >
              Procure Replenishment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tracked SKUs" value={items.length} icon={Boxes}/>
        <StatCard label="Total Inventory Value" value={formatCurrency(Math.round(totalValue), { noDecimals: true })}/>
        <StatCard label="Critical Depletions" value={criticalCount} trend={{ positive: false, text: 'Requires PO' }}/>
        <StatCard label="Low Stock Warnings" value={lowCount} trend={{ positive: false, text: 'Nearing Reorder' }}/>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-nowrap items-center gap-2 border-b border-[#CED4DA] pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
        {['All', 'Optimal', 'Low Stock', 'Critical'].map((tab) => (<button key={tab} onClick={() => setFilterState(tab)} className={`shrink-0 lg:shrink px-3 py-1.5 rounded-t font-semibold transition-colors ${filterState === tab
                ? 'bg-white border-t-2 border-[#1F2E4A] text-[#1F2E4A] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'}`}>
            {tab}
          </button>))}
      </div>

      <DataTable title="Physical Inventory & Stock Ledgers" columns={columns} data={filteredItems} keyExtractor={(i) => i.id} searchPlaceholder="Search SKU, item title or bin location..."/>

      {/* Item Stock Detail & Movement Modal */}
      {selectedItem && (<ItemStockDetailModal item={selectedItem} isOpen={!!selectedItem} onClose={() => setSelectedItem(null)}/>)}
    </div>);
};
