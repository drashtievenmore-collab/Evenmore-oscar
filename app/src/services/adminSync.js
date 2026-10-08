/**
 * adminSync — users, roles and tenants (api.md §3).
 *
 * These three screens each carried a fixed list of colleagues, roles and
 * clients. All three are real collections, and the permission catalogue the
 * role editor renders is served by `/admin/permissions/` — so the checkbox tree
 * matches what the server will actually enforce, rather than a copy of it that
 * drifts.
 */
import { createSync, compact, asText, isBackendEnabled, isServerId, describeError } from './resourceSync';
import { api } from './api';

export { isBackendEnabled, isServerId, describeError };

export const ADMIN_RESOURCES = {
  users: {
    path: '/admin/users/',
    toApi: (u) => compact({
      name: u.name,
      email: u.email || undefined,
      phone: u.phone || undefined,
      roleId: u.roleId || undefined,
      department: u.department || undefined,
      employeeId: u.employeeId || undefined,
      location: u.location || undefined,
      reportingManager: u.reportingManager || undefined,
      status: u.status || undefined,
      password: u.password || undefined,
      crmRoles: u.crmRoles || u.crm_roles || undefined,
    }),
    /**
     * The screens treat these as text — they search, sort and group on them.
     * The API returns null for anything unset (a user with no role yet, no
     * phone on file), so they are normalised to empty strings here rather than
     * guarded at every read.
     */
    fromApi: (row) => ({
      ...asText(row, [
        'name', 'email', 'phone', 'role', 'department',
        'employeeId', 'location', 'reportingManager',
      ]),
      status: row.status || 'Active',
      _synced: true,
    }),
  },

  roles: {
    path: '/admin/roles/',
    toApi: (r) => compact({
      name: r.name,
      code: r.code || undefined,
      description: r.description || undefined,
      permissions: Array.isArray(r.permissions) ? r.permissions : undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, ['name', 'code', 'description']),
      permissions: row.permissions || [],
      _synced: true,
    }),
  },

  clients: {
    path: '/admin/clients/',
    toApi: (c) => compact({
      name: c.name,
      slug: c.slug || undefined,
      plan: c.plan || undefined,
      status: c.status || undefined,
      timezone: c.timezone || undefined,
      currency: c.currency || undefined,
      fyStartMonth: c.fyStartMonth ?? undefined,
      contactName: c.contactName || undefined,
      contactEmail: c.contactEmail || undefined,
      contactPhone: c.contactPhone || undefined,
      industry: c.industry || undefined,
      notes: c.notes || undefined,
    }),
    fromApi: (row) => ({
      ...asText(row, [
        'name', 'slug', 'plan', 'timezone', 'currency', 'contactName',
        'contactEmail', 'contactPhone', 'industry', 'notes', 'location', 'email', 'phone',
      ]),
      status: row.status || 'Active',
      _synced: true,
    }),
  },
};

export const adminSync = createSync(ADMIN_RESOURCES, { label: 'adminSync' });

/**
 * `GET /admin/permissions/` — the permission catalogue, grouped by module.
 *
 * This is what the role editor's checkbox tree is built from. Keeping it here
 * means a permission added on the server appears in the editor without a
 * frontend change.
 */
export async function pullPermissionCatalogue() {
  if (!isBackendEnabled()) return null;
  try {
    const body = await api.get('/admin/permissions/');
    return body?.modules || body || [];
  } catch (err) {
    console.warn('[adminSync] pull permissions failed:', err?.message || err);
    return null;
  }
}

export async function pullUserStats() {
  if (!isBackendEnabled()) return null;
  try {
    return await api.get('/admin/users/stats/');
  } catch (err) {
    console.warn('[adminSync] pull user stats failed:', err?.message || err);
    return null;
  }
}

export const activateUser = (id) => adminSync.act('users', id, 'activate', {});
export const deactivateUser = (id) => adminSync.act('users', id, 'deactivate', {});
export const resetUserPassword = (id, payload = {}) =>
  adminSync.act('users', id, 'reset-password', payload, { raw: true });
export const duplicateRole = (id, payload = {}) => adminSync.act('roles', id, 'duplicate', payload);

export async function setUserPermissions(id, permissions) {
  if (!isBackendEnabled()) return null;
  return api.post(`/admin/users/${id}/permissions/`, { permissions });
}

export default adminSync;
