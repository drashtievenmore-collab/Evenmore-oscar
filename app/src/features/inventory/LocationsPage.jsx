import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Plus, MapPin, User } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
export const LocationsPage = () => {
    const { locations, addLocation } = useERP();
    const [showAddModal, setShowAddModal] = useState(false);
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [type, setType] = useState('Assembly Bay');
    const [manager, setManager] = useState('');
    const handleCreate = (e) => {
        e.preventDefault();
        addLocation({
            code: code || `LOC-${String(locations.length + 1).padStart(2, '0')}`,
            name: name || 'New Facility Zone',
            type,
            capacityPct: 15,
            totalSkus: 0,
            manager: manager || 'Carlos Mendoza',
        });
        setShowAddModal(false);
        setCode('');
        setName('');
    };
    const columns = [
        {
            key: 'code',
            header: 'Location Code',
            width: '16%',
            render: (l) => (<span className="font-mono font-bold text-text-secondary flex items-center gap-1.5">
          <MapPin size={13} className="text-muted"/> {l.code}
        </span>),
        },
        {
            key: 'name',
            header: 'Facility Zone Name',
            width: '26%',
            render: (l) => <span className="font-bold text-text">{l.name}</span>,
        },
        {
            key: 'type',
            header: 'Zone Type',
            width: '14%',
            render: (l) => (<span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-text-secondary text-[11px] font-semibold rounded border border-border">
          {l.type}
        </span>),
        },
        {
            key: 'capacityPct',
            header: 'Capacity Utilization',
            align: 'center',
            width: '20%',
            render: (l) => (<div className="flex items-center justify-center gap-2">
          <div className="w-24 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div className={`h-full ${l.capacityPct > 85 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${l.capacityPct}%` }}/>
          </div>
          <span className="font-mono text-xs font-semibold text-text">
            {l.capacityPct}%
          </span>
        </div>),
        },
        {
            key: 'totalSkus',
            header: 'Assigned SKUs',
            align: 'center',
            width: '12%',
            render: (l) => (<span className="font-mono font-bold text-text">{l.totalSkus}</span>),
        },
        {
            key: 'manager',
            header: 'Zone Manager',
            width: '12%',
            render: (l) => (<span className="text-text-secondary flex items-center gap-1 text-xs">
          <User size={12} className="text-muted"/> {l.manager}
        </span>),
        },
    ];
    return (<div className="space-y-6">
      <PageHeader
        title="Locations Management"
        subtitle="Physical and logical warehouse zones, assembly bays, quarantine containment, and storage racks."
        actions={
          <Button icon={Plus} onClick={() => setShowAddModal(true)}>
            Add Warehouse Location
          </Button>
        }
      />

      <DataTable title="Warehouse Facilities & Zones" columns={columns} data={locations} keyExtractor={(l) => l.id} searchPlaceholder="Search location code, zone name, or manager..." searchFilter={(l, term) => String(l.code ?? '').toLowerCase().includes(term) ||
            String(l.name ?? '').toLowerCase().includes(term) ||
            String(l.manager ?? '').toLowerCase().includes(term) ||
            String(l.type ?? '').toLowerCase().includes(term)}/>

      {showAddModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-2 sm:p-4">
          <div className="bg-white rounded-lg border border-[#CED4DA] shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[95vh] overflow-y-auto">
            <h3 className="font-bold text-base text-[#1F2E4A] mb-1">
              Add Storage Location
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Register a storage bay, clean room, or transit area for inventory management.
            </p>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Location Code</label>
                <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA] font-mono uppercase" placeholder="BAY-EAST-01"/>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Facility Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]" placeholder="e.g. Clean Assembly Room 2"/>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Zone Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]">
                  <option value="Central Warehouse">Central Warehouse</option>
                  <option value="Assembly Bay">Assembly Bay</option>
                  <option value="Storage Rack">Storage Rack</option>
                  <option value="Quarantine">Quarantine / Defect Bay</option>
                  <option value="Transit Zone">Transit Zone</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Zone Manager</label>
                <input required value={manager} onChange={(e) => setManager(e.target.value)} className="w-full border border-[#CED4DA] rounded p-2 bg-[#F8F9FA]" placeholder="e.g. Alex Rivera"/>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap justify-end gap-2 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3.5 py-1.5 border border-[#CED4DA] rounded text-slate-600 hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-1.5 bg-[#1F2E4A] hover:bg-[#152033] text-white rounded font-semibold">
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>)}
    </div>);
};
