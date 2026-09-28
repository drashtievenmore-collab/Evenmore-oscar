/**
 * crmForms — the lead-capture and task form definitions, at `/crm/forms/`.
 *
 * The form builders kept their definitions in three `localStorage` keys
 * (`dynamicLeadForms`, `leadFormSections`, `leadTaskFormsV1`), which meant a
 * form designed on one machine did not exist on any other. They are one server
 * collection, distinguished by `kind`, so a form published from the builder is
 * the form the capture page renders.
 *
 * Which form the builder currently has open stays in the browser: that is a
 * per-tab editing position, not part of the form.
 */
import { useCrmStore } from '../stores/crmStore';

const LOCAL_KEY = 'crmFormsV1';

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(forms) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(forms));
  } catch {
    /* private mode — session-only, still works until refresh */
  }
}

export const LEAD_FORM = 'lead';
export const TASK_FORM = 'task';

/** The forms of one kind, as the server returned them. Pure read — never
 * writes, so it is safe to call during render (builders call it in useMemo,
 * the create modal calls it in the render body). */
export function loadForms(kind = LEAD_FORM) {
  const dedupe = (rows) => {
    const seen = new Map();
    rows.forEach((form) => {
      if (form) seen.set(String(form.id), form);
    });
    return [...seen.values()];
  };
  const inStore = dedupe(
    useCrmStore.getState().forms.filter((form) => (form.kind || LEAD_FORM) === kind),
  );
  if (inStore.length > 0) return inStore;
  // Session survived a refresh with no backend: serve the last saved builder
  // state instead of falling back to defaults (which brings back deleted
  // fields like Email). The store is filled on the next saveForms.
  return dedupe(readLocal().filter((form) => (form.kind || LEAD_FORM) === kind));
}

/** Persist the form list a builder just produced. */
export function saveForms(next = [], kind = LEAD_FORM) {
  const seen = new Map();
  next.forEach((form) => {
    if (form) seen.set(String(form.id), { ...form, kind: form.kind || kind });
  });
  const stamped = [...seen.values()];
  const previous = useCrmStore.getState().forms;
  // Forms of the other kind are untouched, so they are carried through as-is.
  const others = previous.filter((form) => (form.kind || LEAD_FORM) !== kind);
  const merged = [...others, ...stamped];
  // No-op when nothing changed. Several pages save on every store/form
  // change (TaskFormPage auto-persists); an unconditional setState hands
  // them a new array reference each time and they re-save forever —
  // "Maximum update depth exceeded".
  if (JSON.stringify(merged) === JSON.stringify(previous)) return;
  // Local-first: the store update IS the save, so the builder, the Create
  // Lead modal and the preview render the edit immediately — even with no
  // backend session. NOTE: no `syncCollection('forms', …)` here. It
  // re-added every row optimistically on top of this exact `setState`
  // (duplicate rows), and the server `toApi` for forms drops `sections`
  // anyway, so a round-trip would wipe the layout.
  try {
    useCrmStore.setState({ forms: merged });
  } catch {
    /* store not ready */
  }
  writeLocal(merged);
}

/** One form by id, across both kinds. */
export function findForm(formId) {
  return useCrmStore.getState().forms.find((form) => String(form.id) === String(formId)) || null;
}

/** Which form the builder has open — a per-tab editing position. */
export function getActiveFormId(key = 'activeLeadFormId') {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setActiveFormId(formId, key = 'activeLeadFormId') {
  try {
    if (formId) localStorage.setItem(key, formId);
    else localStorage.removeItem(key);
  } catch {
    /* private mode — the builder still works, it just does not reopen */
  }
}
