/**
 * Textile Masters Sync (Phase 2.1)
 *
 * Provides API client sync and offline fallbacks for:
 * - Agency (External grey production agencies)
 * - Processor (Outsourced job workers)
 * - Broker (Fabric commission brokers)
 * - ProcessMaster (Dyeing, Printing, Washing, Finishing, etc.)
 * - JobWorkRateMaster (Contracted rates: processor × process × fabric quality)
 * - DefectMaster (Defect taxonomy: category, severity)
 * - LossReasonMaster (Shrinkage, Short meter, Damage, etc.)
 * - ReturnReasonMaster (Quality failure, Shade mismatch, etc.)
 */
import { compact, createSync } from './resourceSync';

export { isBackendEnabled, describeError, isServerId } from './resourceSync';

const num = (value) => (value === '' || value === null || value === undefined ? null : Number(value));

const master = (path, extra = () => ({})) => ({
  path,
  toApi: (row) => compact({
    code: row.code ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    isActive: row.isActive ?? row.is_active ?? true,
    ...extra(row),
  }),
});

export const textileMasterSync = createSync({
  agencies: master('/masters/agencies/', (row) => ({
    contactPerson: row.contactPerson || row.contact_person || null,
    phone: row.phone || null,
    email: row.email || null,
    gstin: row.gstin || null,
    address: row.address || null,
    city: row.city || null,
    state: row.state || null,
    pincode: row.pincode || null,
    defaultRate: num(row.defaultRate ?? row.default_rate),
    rateUom: row.rateUom || row.rate_uom || 'MTR',
  })),

  brokers: master('/masters/brokers/', (row) => ({
    contactPerson: row.contactPerson || row.contact_person || null,
    phone: row.phone || null,
    email: row.email || null,
    pan: row.pan || null,
    gstin: row.gstin || null,
    commissionType: row.commissionType || row.commission_type || 'percent',
    defaultValue: num(row.defaultValue ?? row.default_value) ?? 0,
  })),

  processes: master('/masters/processes/', (row) => ({
    category: row.category || null,
    expectedLossPct: num(row.expectedLossPct ?? row.expected_loss_pct) ?? 0,
    tolerancePct: num(row.tolerancePct ?? row.tolerance_pct) ?? 0,
  })),

  jobworkRates: master('/masters/jobwork-rates/', (row) => ({
    processorId: row.processorId || row.processor || null,
    processId: row.processId || row.process || null,
    fabricQualityId: row.fabricQualityId || row.fabric_quality || null,
    rate: num(row.rate) ?? 0,
    rateUom: row.rateUom || row.rate_uom || 'MTR',
    effectiveFrom: row.effectiveFrom || row.effective_from || null,
    effectiveTo: row.effectiveTo || row.effective_to || null,
  })),

  defects: master('/masters/defects/', (row) => ({
    category: row.category || 'other',
    severity: row.severity || 'minor',
  })),

  lossReasons: master('/masters/loss-reasons/'),

  returnReasons: master('/masters/return-reasons/'),
}, { label: 'textileMasters' });
