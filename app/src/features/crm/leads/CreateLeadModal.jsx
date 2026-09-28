import { useEffect, useRef, useState } from "react";
import { useCrmStore } from '../../../stores/crmStore';
import { loadForms, findForm, getActiveFormId, LEAD_FORM } from '../../../services/crmForms';
import { defaultLeadFormSections } from '../../../data/crm/leadFormSchema';
import { CalendarDays, ChevronDown, Clock3, ImagePlus, Plus, X } from "lucide-react";

/** Resolve the active form sections from the store, falling back to defaults. */
function useFormSections() {
  const storeForms = useCrmStore((s) => s.forms);
  const forms = loadForms(LEAD_FORM);
  // Respect the toggle in Manage Lead Create Forms: the form switched on there
  // is the form Create Lead renders. `forms[0]` is only a fallback for older
  // sessions that never toggled anything on.
  const activeId = getActiveFormId();
  const active = (activeId ? findForm(activeId) : null) ?? forms[0] ?? null;
  return active?.sections ?? defaultLeadFormSections;
}

function useUserOptions() {
  return useCrmStore((s) => s.teamMembers);
}

function useSources() {
  return useCrmStore((s) => s.sources);
}

// ---------------------------------------------------------------------------
// Individual field renderers
// ---------------------------------------------------------------------------

function TextField({ field, value, onChange }) {
  const type =
    field.type === "Email" ? "email"
    : field.type === "Phone" ? "tel"
    : field.type === "Number" || field.type === "Currency" ? "number"
    : "text";
  return (
    <input
      type={type}
      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TextAreaField({ field, value, onChange }) {
  return (
    <textarea
      rows={3}
      placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ resize: "vertical" }}
    />
  );
}

function DateField({ field, value, onChange }) {
  const ref = useRef(null);
  return (
    <div className="input-icon-wrap">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        role="button"
        tabIndex={0}
        aria-label="Open calendar"
        style={{ position: "absolute", top: 0, right: 0, width: 34, height: "100%", display: "grid", placeItems: "center", cursor: "pointer" }}
        onClick={() => { try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } } }}
      >
        <CalendarDays size={16} />
      </span>
    </div>
  );
}

function TimeField({ field, value, onChange }) {
  const ref = useRef(null);
  return (
    <div className="input-icon-wrap">
      <input
        ref={ref}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span
        role="button"
        tabIndex={0}
        aria-label="Open time picker"
        style={{ position: "absolute", top: 0, right: 0, width: 34, height: "100%", display: "grid", placeItems: "center", cursor: "pointer" }}
        onClick={() => { try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); try { ref.current?.showPicker?.(); } catch { ref.current?.focus(); } } }}
      >
        <Clock3 size={16} />
      </span>
    </div>
  );
}

function DropdownField({ field, sources, userOptions, value, onChange }) {
  // Special handling for known semantic fields
  const isSource = field.id === "lead-source" || field.label?.toLowerCase().includes("source");
  const isOwner = field.id === "lead-owner" || field.label?.toLowerCase().includes("owner");
  const isLeadName = field.id === "lead-name";

  if (isLeadName) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>Enter lead name</option>
        <option>Christopher Maclead</option>
        <option>Carissa Kidman</option>
        <option>James Merced</option>
      </select>
    );
  }

  if (isSource) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select source</option>
        {sources.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>
    );
  }

  if (isOwner) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select User</option>
        {userOptions.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    );
  }

  const options = Array.isArray(field.options) && field.options.length > 0
    ? field.options
    : ["Option 1", "Option 2", "Option 3"];

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{field.placeholder || "Select option"}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function UserField({ field, userOptions, value, onChange }) {
  const isLeadUsers = field.id === "lead-users" || field.label?.toLowerCase().includes("lead users");

  if (isLeadUsers) {
    // Multi-value user selector
    const selected = Array.isArray(value) ? value : [];
    const toggle = (name) =>
      onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {selected.map((name) => (
          <span
            key={name}
            className="token-chip"
            onClick={() => toggle(name)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(name); }}
          >
            {name}<X size={12} />
          </span>
        ))}
        <select
          value=""
          onChange={(e) => { if (e.target.value) toggle(e.target.value); }}
          style={{ flex: 1, minWidth: 120 }}
        >
          <option value="">{field.placeholder || "Select Users"}</option>
          {userOptions.filter((m) => !selected.includes(m.name)).map((m) => (
            <option key={m.id} value={m.name}>{m.name}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{field.placeholder || "Select User"}</option>
      {userOptions.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}

function MultiSelectField({ field, value, onChange }) {
  const selected = Array.isArray(value) ? value : [];
  const options = Array.isArray(field.options) && field.options.length > 0
    ? field.options
    : ["Endoscopy System", "OT Light", "Patient Monitor", "X-Ray Machine", "Ventilator"];

  const toggle = (opt) =>
    onChange(selected.includes(opt) ? selected.filter((o) => o !== opt) : [...selected, opt]);

  return (
    <div className="multi-value-select">
      <div className="token-field token-field-button">
        <div className="token-field-values">
          {selected.map((opt) => (
            <span
              key={opt}
              className="token-chip"
              onClick={() => toggle(opt)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(opt); }}
            >
              {opt}<X size={12} />
            </span>
          ))}
          {selected.length === 0 && <span className="token-placeholder">{field.placeholder || "Select options"}</span>}
        </div>
        <ChevronDown size={16} className="token-chevron" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {options.filter((o) => !selected.includes(o)).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            style={{ fontSize: 11, padding: "2px 10px", border: "1px solid #e2e8f0", borderRadius: 99, background: "#f8fafc", cursor: "pointer" }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckboxField({ field, value, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
      {field.placeholder || field.label}
    </label>
  );
}

function RadioField({ field, value, onChange }) {
  const options = Array.isArray(field.options) && field.options.length > 0
    ? field.options
    : ["Option 1", "Option 2", "Option 3"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {options.map((opt) => (
        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
          <input
            type="radio"
            name={field.id}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function LeadImageField({ value, onChange }) {
  const ref = useRef(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="sr-only" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        onChange(url);
      }} />
      <button type="button" className="lead-photo-upload" onClick={() => ref.current?.click()}>
        {value ? (
          <img src={value} alt="Lead preview" className="lead-photo-preview" />
        ) : (
          <>
            <span className="lead-photo-placeholder"><ImagePlus size={24} /></span>
            <strong>Upload Image</strong>
            <small>JPG, PNG or WebP</small>
          </>
        )}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// Renders one field based on its type
// ---------------------------------------------------------------------------
function DynamicField({ field, values, onChange, sources, userOptions }) {
  const value = values[field.id] ?? "";
  const set = (v) => onChange(field.id, v);

  const isWide =
    field.type === "Multi Line" ||
    field.type === "Lead Image" ||
    field.type === "Multi Select" ||
    field.id === "lead-users";

  const inner = (() => {
    switch (field.type) {
      case "Single Line":
      case "Number":
      case "Currency":
        return <TextField field={field} value={value} onChange={set} />;
      case "Email":
        return <TextField field={field} value={value} onChange={set} />;
      case "Phone":
        return <TextField field={field} value={value} onChange={set} />;
      case "Multi Line":
        return <TextAreaField field={field} value={value} onChange={set} />;
      case "Date":
        // task-time is stored as a separate time field in schema but keyed "task-time"
        if (field.id === "task-time") return <TimeField field={field} value={value} onChange={set} />;
        return <DateField field={field} value={value} onChange={set} />;
      case "Dropdown":
        return <DropdownField field={field} sources={sources} userOptions={userOptions} value={value} onChange={set} />;
      case "User":
        return <UserField field={field} userOptions={userOptions} value={value} onChange={set} />;
      case "Multi Select":
        return <MultiSelectField field={field} value={value} onChange={set} />;
      case "Checkbox":
        return <CheckboxField field={field} value={value} onChange={set} />;
      case "Radio":
        return <RadioField field={field} value={value} onChange={set} />;
      case "Lead Image":
        return <LeadImageField value={value} onChange={set} />;
      default:
        return <TextField field={field} value={value} onChange={set} />;
    }
  })();

  // Time field — handle as Single Line with clock icon
  if (field.id === "task-time" && field.type === "Single Line") {
    return (
      <label className={`lead-create-field${isWide ? " lead-create-field-wide" : ""}`}>
        <span>{field.label}{field.required && " *"}</span>
        <TimeField field={field} value={value} onChange={set} />
        {field.helpText && <small className="lead-create-help">{field.helpText}</small>}
      </label>
    );
  }

  return (
    <label className={`lead-create-field${isWide ? " lead-create-field-wide" : ""}`}>
      <span>{field.label}{field.required && " *"}</span>
      {inner}
      {field.helpText && <small className="lead-create-help">{field.helpText}</small>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------
export default function CreateLeadModal({ isOpen, onClose, onCreate, onEditLayout, showTour }) {
  const sections = useFormSections();
  const userOptions = useUserOptions();
  const sources = useSources();

  // Flat map of fieldId → value
  const [values, setValues] = useState({});

  // Derived required fields
  const allFields = sections.flatMap((s) => s.fields);
  const requiredFields = allFields.filter((f) => f.required);
  const isFormComplete = requiredFields.every((f) => {
    const v = values[f.id];
    return v !== undefined && v !== "" && v !== null;
  });

  useEffect(() => {
    if (!isOpen) setValues({});
  }, [isOpen]);

  if (!isOpen) return null;

  function handleChange(fieldId, val) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  }

  function handleClose() {
    onClose();
  }

  function handleCreate() {
    // Map known field ids to the shape LeadsPage.handleCreateLead expects
    const get = (id) => values[id] ?? "";
    const sourceField = allFields.find((f) => f.id === "lead-source" || f.label?.toLowerCase().includes("source"));
    const ownerField  = allFields.find((f) => f.id === "lead-owner"  || (f.type === "User" && f.label?.toLowerCase().includes("owner")));

    onCreate({
      leadName:    get("lead-name"),
      company:     get("company"),
      email:       get("email"),
      phone:       get("phone"),
      sourceId:    sourceField ? get(sourceField.id) : "",
      source:      sourceField ? (sources.find((s) => s.id === get(sourceField.id))?.name ?? "") : "",
      titleValue:  get("title"),
      industry:    get("industry"),
      ownerId:     ownerField  ? get(ownerField.id) : "",
      owner:       ownerField  ? (userOptions.find((m) => m.id === get(ownerField.id))?.name ?? "") : "",
      createdOn:   get("created-on"),
      taskDate:    get("task-date"),
      taskTime:    get("task-time"),
      products:    get("products") || [],
      leadUsers:   get("lead-users") || [],
      photoPreview: get("lead-photo"),
      // Pass through any extra dynamic values
      _extra: values,
    });
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleClose}>
      <section
        className="lead-create-modal relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-lead-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="lead-create-modal-head">
          <h2 id="create-lead-title">Create Lead</h2>
          <button type="button" className="modal-close" onClick={handleClose} aria-label="Close create lead form">
            <X size={18} />
          </button>
        </div>

        {/* Tour hint */}
        {showTour && (
          <div className="pointer-events-none absolute left-[22%] top-[58px] z-30 flex flex-col items-center">
            <div className="inline-flex w-max max-w-[280px] items-center gap-2.5 rounded-[16px] bg-[#1d6bff] px-4 py-2.5 text-left text-[14px] font-medium leading-snug text-white shadow-[0_4px_14px_rgba(29,107,255,0.35)]">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1d6bff]">3</span>
              <span>Fill in the lead details here</span>
            </div>
            <svg width="56" height="48" viewBox="0 0 56 48" fill="none" className="-mt-1" aria-hidden="true">
              <path d="M28 2 C 28 26, 24 36, 14 42" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M6 34 L13 43 L23 35" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        )}

        {/* Dynamic body — renders whatever sections/fields the builder saved */}
        <div className="lead-create-modal-body">
          {sections.map((section) => (
            <div key={section.id} style={{ gridColumn: "1 / -1", display: "contents" }}>
              {sections.length > 1 && (
                <h3 className="lead-create-section-title" style={{ gridColumn: "1 / -1" }}>
                  {section.title}
                </h3>
              )}
              {sections.length === 1 && (
                <h3 className="lead-create-section-title">{section.title}</h3>
              )}
              {section.fields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  values={values}
                  onChange={handleChange}
                  sources={sources}
                  userOptions={userOptions}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="lead-create-modal-actions">
          <div className="relative inline-block">
            {showTour && isFormComplete && (
              <div className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-30 flex flex-col items-start">
                <div className="inline-flex w-max max-w-[280px] items-start gap-2.5 rounded-[16px] bg-[#1d6bff] px-4 py-3 text-left text-[14px] font-medium leading-snug text-white shadow-[0_4px_14px_rgba(29,107,255,0.35)]">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1d6bff]">4</span>
                  <span>Click here to edit the form layout<br />(if needed)</span>
                </div>
                <svg width="64" height="42" viewBox="0 0 64 42" fill="none" className="mb-[-6px] ml-[24px] mt-[-4px]" aria-hidden="true">
                  <path d="M54 2 C 36 10, 22 20, 16 34" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                  <path d="M8 26 L15 35 L25 28" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </div>
            )}
            <button type="button" className="btn-outline" onClick={onEditLayout}>
              <Plus size={15} />
              Edit Page Layout
            </button>
          </div>
          <div className="lead-create-action-right">
            <button type="button" className="btn-outline" onClick={handleClose}>Cancel</button>
            <div className="relative inline-block">
              {showTour && isFormComplete && (
                <div className="pointer-events-none absolute bottom-[calc(100%+6px)] right-0 z-30 flex flex-col items-end">
                  <div className="inline-flex w-max max-w-[280px] items-center gap-2.5 rounded-[16px] bg-[#1d6bff] px-4 py-3 text-left text-[14px] font-medium leading-snug text-white shadow-[0_4px_14px_rgba(29,107,255,0.35)]">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#1d6bff]">5</span>
                    <span>Click Submit to create the lead</span>
                  </div>
                  <svg width="56" height="48" viewBox="0 0 56 48" fill="none" className="mb-[-6px] mr-[52px] mt-[-4px]" aria-hidden="true">
                    <path d="M28 2 C 28 26, 26 36, 20 42" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                    <path d="M12 34 L19 43 L29 35" stroke="#1d6bff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={!isFormComplete}
                style={!isFormComplete ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
