import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  FileText,
  MapPin,
  X,
  Layers,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import PageInfoButton from '../../../components/ui/PageInfoButton';

export default function TripListPage() {
  const [trips, setTrips] = useState([]);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form
  const [tripForm, setTripForm] = useState({
    tripType: 'OUTWARD',
    tripDate: new Date().toISOString().slice(0, 10),
    transporterId: '',
    vehicleNumber: '',
    driverName: '',
    driverMobile: '',
    lrNumber: '',
    lrDate: '',
    fromLocation: '',
    toLocation: '',
    freightAmount: '0',
    loadingCharges: '0',
    unloadingCharges: '0',
    otherCharges: '0',
    paidBy: 'Company',
    costAllocationTarget: 'LOT',
    remarks: '',
    materials: [],
  });

  // Material line form in modal
  const [materialDraft, setMaterialDraft] = useState({
    lotNumber: '',
    takaNumber: '',
    meters: '',
    weightKg: '',
  });

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const [tripsRes, transpRes] = await Promise.all([
        inventoryService.getTrips({ status: statusFilter || undefined }),
        inventoryService.getTransporters(),
      ]);
      const data = tripsRes?.data || tripsRes?.results || tripsRes || [];
      const transpData = transpRes?.data || transpRes?.results || transpRes || [];
      setTrips(Array.isArray(data) ? data : []);
      setTransporters(Array.isArray(transpData) ? transpData : []);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleAddMaterial = () => {
    if (!materialDraft.lotNumber || !materialDraft.meters) return;
    setTripForm({
      ...tripForm,
      materials: [...tripForm.materials, { ...materialDraft }],
    });
    setMaterialDraft({ lotNumber: '', takaNumber: '', meters: '', weightKg: '' });
  };

  const handleRemoveMaterial = (index) => {
    setTripForm({
      ...tripForm,
      materials: tripForm.materials.filter((_, i) => i !== index),
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await inventoryService.createTrip(tripForm);
      setShowCreateModal(false);
      setTripForm({
        tripType: 'OUTWARD',
        tripDate: new Date().toISOString().slice(0, 10),
        transporterId: '',
        vehicleNumber: '',
        driverName: '',
        driverMobile: '',
        lrNumber: '',
        lrDate: '',
        fromLocation: '',
        toLocation: '',
        freightAmount: '0',
        loadingCharges: '0',
        unloadingCharges: '0',
        otherCharges: '0',
        paidBy: 'Company',
        costAllocationTarget: 'LOT',
        remarks: '',
        materials: [],
      });
      fetchTrips();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record trip.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateFreight = async (tripId) => {
    try {
      await inventoryService.allocateTripFreight(tripId);
      fetchTrips();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Freight allocation failed.');
    }
  };

  const filteredTrips = trips.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.trip_number || '').toLowerCase().includes(q) ||
      (t.vehicle_number || '').toLowerCase().includes(q) ||
      (t.transporter_name || '').toLowerCase().includes(q) ||
      (t.driver_name || '').toLowerCase().includes(q) ||
      (t.lr_number || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-indigo-600" />
              Logistics & Tempo Register
            </h1>
            <PageInfoButton title="Logistics & Trip Register" />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track inward/outward vehicle trips, LR details, freight charges, and direct landed-cost allocation to lots.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Record New Trip
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search trip, vehicle, driver, LR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">Trip No / Date</th>
                <th className="py-3 px-4">Vehicle & Driver</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">LR / Transporter</th>
                <th className="py-3 px-4 text-right">Total Charges</th>
                <th className="py-3 px-4">Cost Allocation</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">Loading trips...</td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">No transport trips recorded.</td>
                </tr>
              ) : (
                filteredTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {t.trip_number}
                      <div className="text-xs text-slate-400 font-normal">{t.trip_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-500" />
                        {t.vehicle_number}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t.driver_name ? `${t.driver_name} (${t.driver_mobile || 'No Mob'})` : 'Driver not assigned'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div className="font-medium text-slate-700">{t.from_location || 'Mill / Godown'} → {t.to_location || 'Destination'}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                        {t.trip_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-800">{t.transporter_name || t.transporter?.name || 'Local Tempo'}</div>
                      <div className="text-slate-500">LR: {t.lr_number || 'Direct'}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-semibold text-slate-900">₹{(Number(t.total_charges) || 0).toLocaleString()}</div>
                      <div className="text-xs text-slate-400">Paid by: {t.paid_by}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {t.freight_allocated ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Allocated to Lots
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                          Pending Allocation
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!t.freight_allocated && (
                        <button
                          onClick={() => handleAllocateFreight(t.id)}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                        >
                          Allocate Cost
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Trip Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Record Logistics & Tempo Trip
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trip Date *</label>
                  <input
                    type="date"
                    required
                    value={tripForm.tripDate}
                    onChange={(e) => setTripForm({ ...tripForm, tripDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trip Type</label>
                  <select
                    value={tripForm.tripType}
                    onChange={(e) => setTripForm({ ...tripForm, tripType: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="OUTWARD">Outward Dispatch</option>
                    <option value="INWARD">Inward Purchase / JWO</option>
                    <option value="TRANSFER">Internal Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Transporter</label>
                  <select
                    value={tripForm.transporterId}
                    onChange={(e) => setTripForm({ ...tripForm, transporterId: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="">Direct / Self Tempo</option>
                    {transporters.map((tr) => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ05AB1234"
                    value={tripForm.vehicleNumber}
                    onChange={(e) => setTripForm({ ...tripForm, vehicleNumber: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="Ramesh Bhai"
                    value={tripForm.driverName}
                    onChange={(e) => setTripForm({ ...tripForm, driverName: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Driver Mobile</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={tripForm.driverMobile}
                    onChange={(e) => setTripForm({ ...tripForm, driverMobile: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">From Location</label>
                  <input
                    type="text"
                    placeholder="Main Godown"
                    value={tripForm.fromLocation}
                    onChange={(e) => setTripForm({ ...tripForm, fromLocation: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">To Destination</label>
                  <input
                    type="text"
                    placeholder="Party Godown / Job Worker"
                    value={tripForm.toLocation}
                    onChange={(e) => setTripForm({ ...tripForm, toLocation: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              {/* Financial Charges */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  Freight & Logistics Charges Breakdown
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Freight (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.freightAmount}
                      onChange={(e) => setTripForm({ ...tripForm, freightAmount: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Loading (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.loadingCharges}
                      onChange={(e) => setTripForm({ ...tripForm, loadingCharges: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Unloading (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.unloadingCharges}
                      onChange={(e) => setTripForm({ ...tripForm, unloadingCharges: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Paid By</label>
                    <select
                      value={tripForm.paidBy}
                      onChange={(e) => setTripForm({ ...tripForm, paidBy: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    >
                      <option value="Company">Company</option>
                      <option value="Party">Party</option>
                      <option value="Transporter">Transporter</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Material Lines (Optional for Lot Cost Allocation) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Material Lines (For Landed Cost Allocation)</div>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Lot Number</label>
                    <input
                      type="text"
                      placeholder="LOT-2026-001"
                      value={materialDraft.lotNumber}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, lotNumber: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Taka No</label>
                    <input
                      type="text"
                      placeholder="TAK-01"
                      value={materialDraft.takaNumber}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, takaNumber: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Meters *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="100"
                      value={materialDraft.meters}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, meters: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Weight (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="12.5"
                      value={materialDraft.weightKg}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, weightKg: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded"
                    >
                      + Add Line
                    </button>
                  </div>
                </div>

                {tripForm.materials.length > 0 && (
                  <div className="border border-slate-200 rounded overflow-hidden mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="p-2 text-left">Lot</th>
                          <th className="p-2 text-left">Taka</th>
                          <th className="p-2 text-right">Meters</th>
                          <th className="p-2 text-right">Weight (Kg)</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tripForm.materials.map((m, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{m.lotNumber}</td>
                            <td className="p-2">{m.takaNumber || '—'}</td>
                            <td className="p-2 text-right">{m.meters} M</td>
                            <td className="p-2 text-right">{m.weightKg || '—'}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(idx)}
                                className="text-rose-600 hover:text-rose-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                >
                  {submitting ? 'Recording...' : 'Save Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
