import { useState, useMemo, useEffect, useRef } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Search,
  Download,
  Filter,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Check,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import { useCalendarStore } from "../../../stores/calendarStore";
import { EVENT_CATEGORIES, DEPARTMENTS, MONTH_NAMES } from "./calendarConfig";
import {
  formatDateKey,
  generateMonthGrid,
  generateWeekDays,
  getQuarterInfo,
  exportEventsToICS,
  isEventOnDate,
} from "./calendarUtils";

import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarListView } from "./CalendarListView";
import { CalendarAgendaSidebar } from "./CalendarAgendaSidebar";
import { AddEditEventModal } from "./AddEditEventModal";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

export function CalendarPage() {
  const showToast = useAppStore((s) => s.showToast);

  // Store state
  const { events, addEvent, updateEvent, deleteEvent, resetToDefaults } = useCalendarStore();

  // Active view: 'Month' | 'Week' | 'Schedule List'
  const [view, setView] = useState("Month");

  // Navigation state - default to October 2024 for immediate context, or dynamic
  const [activeYear, setActiveYear] = useState(2024);
  const [activeMonth, setActiveMonth] = useState(9); // 0-indexed: 9 = October
  const [selectedDate, setSelectedDate] = useState("2024-10-11");

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [modalDefaultDate, setModalDefaultDate] = useState("");
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const deptRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (deptRef.current && !deptRef.current.contains(e.target)) {
        setDeptDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigation handlers
  const handlePrev = () => {
    if (view === "Week") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 7);
      const newDateStr = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(newDateStr);
      setActiveYear(d.getFullYear());
      setActiveMonth(d.getMonth());
    } else {
      if (activeMonth === 0) {
        setActiveMonth(11);
        setActiveYear((y) => y - 1);
      } else {
        setActiveMonth((m) => m - 1);
      }
    }
  };

  const handleNext = () => {
    if (view === "Week") {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 7);
      const newDateStr = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      setSelectedDate(newDateStr);
      setActiveYear(d.getFullYear());
      setActiveMonth(d.getMonth());
    } else {
      if (activeMonth === 11) {
        setActiveMonth(0);
        setActiveYear((y) => y + 1);
      } else {
        setActiveMonth((m) => m + 1);
      }
    }
  };

  const handleToday = () => {
    const today = new Date();
    setActiveYear(today.getFullYear());
    setActiveMonth(today.getMonth());
    const todayStr = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    setSelectedDate(todayStr);
    showToast("Jumped to Today");
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (categoryFilter !== "All" && ev.type !== categoryFilter) {
        return false;
      }
      // Department filter
      if (deptFilter !== "All" && ev.dept !== deptFilter && ev.dept !== "All Staff") {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (ev.title || "").toLowerCase().includes(q);
        const matchesDesc = (ev.description || "").toLowerCase().includes(q);
        const matchesLoc = (ev.location || "").toLowerCase().includes(q);
        const matchesOrg = (ev.organizer || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesLoc && !matchesOrg) {
          return false;
        }
      }
      return true;
    });
  }, [events, categoryFilter, deptFilter, searchQuery]);

  // Month grid cells
  const monthCells = useMemo(() => {
    return generateMonthGrid(activeYear, activeMonth);
  }, [activeYear, activeMonth]);

  // Week days
  const weekDays = useMemo(() => {
    return generateWeekDays(selectedDate);
  }, [selectedDate]);

  // Selected date agenda items
  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter((e) => isEventOnDate(e, selectedDate));
  }, [filteredEvents, selectedDate]);

  // Upcoming holidays
  const upcomingHolidays = useMemo(() => {
    return events
      .filter((ev) => ev.type === "Holiday" && (ev.startDate || ev.date) >= selectedDate)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
      .slice(0, 4);
  }, [events, selectedDate]);

  // Upcoming fun & culture events
  const upcomingFunEvents = useMemo(() => {
    return events
      .filter((ev) => ev.type === "Fun" && (ev.startDate || ev.date) >= selectedDate)
      .sort((a, b) => (a.startDate || a.date).localeCompare(b.startDate || b.date))
      .slice(0, 3);
  }, [events, selectedDate]);

  // CRUD actions
  const handleOpenCreateModal = (dateStr = "") => {
    setEditingEvent(null);
    setModalDefaultDate(dateStr || selectedDate);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event) => {
    setEditingEvent(event);
    setModalDefaultDate(event.startDate || event.date || selectedDate);
    setIsModalOpen(true);
  };

  const handleSaveEvent = (eventData, id) => {
    if (id) {
      updateEvent(id, eventData);
      showToast(`Updated "${eventData.title}"`);
    } else {
      const created = addEvent(eventData);
      showToast(`Scheduled "${created.title}"`);
    }
    setIsModalOpen(false);
  };

  const handleDeleteEvent = (id) => {
    const target = events.find((e) => e.id === id);
    deleteEvent(id);
    setIsModalOpen(false);
    showToast(target ? `Deleted "${target.title}"` : "Event deleted");
  };

  const handleExport = () => {
    exportEventsToICS(filteredEvents, `HRMS-Calendar-${MONTH_NAMES[activeMonth]}-${activeYear}`);
    showToast("Calendar (.ics) downloaded successfully");
  };

  const handleResetDefaults = () => {
    if (confirm("Reset calendar to default company events and holidays?")) {
      resetToDefaults();
      showToast("Calendar reset to defaults");
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      <PageHeader
        title="Personal & Team Calendar"
        subtitle="Track leaves, company public holidays, scheduled training sessions, and key milestones."
        guide={hrmsGuides.calendar}
        actions={
          <>
            {/* View Switcher */}
            <div className="flex p-1 bg-white border border-bdr rounded-xl shadow-xs">
              {["Month", "Week", "Schedule List"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition cursor-pointer ${
                    view === v ? "bg-navy text-white shadow-xs" : "text-muted hover:text-slate-900"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Export to ICS button */}
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-bdr text-slate-700 rounded-xl text-[13px] font-medium hover:bg-off transition shadow-xs cursor-pointer"
              title="Export calendar to iCal (.ics) for Google/Outlook Calendar"
            >
              <Download size={15} />
              Export (.ics)
            </button>

            {/* Add Event Button */}
            <button
              type="button"
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-navy text-white rounded-xl text-[13.5px] font-medium hover:bg-navy/90 transition shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              Add Event
            </button>
          </>
        }
      />

      {/* Filter & Search Bar */}
      <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3.5">
        {/* Category Chips with Scrollbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0 w-full md:w-auto pb-2 custom-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryFilter("All")}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium whitespace-nowrap transition cursor-pointer ${
              categoryFilter === "All"
                ? "bg-navy text-white shadow-2xs"
                : "bg-off text-slate-600 hover:bg-slate-200/70 border border-bdr/60"
            }`}
          >
            All Events ({events.length})
          </button>

          {Object.keys(EVENT_CATEGORIES).map((key) => {
            const cat = EVENT_CATEGORIES[key];
            const isSelected = categoryFilter === key;
            const count = events.filter((e) => e.type === key).length;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategoryFilter(isSelected ? "All" : key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium whitespace-nowrap transition cursor-pointer border ${
                  isSelected
                    ? `${cat.badgeClass} ring-1 ring-offset-1`
                    : "bg-white border-bdr/60 text-slate-600 hover:bg-off"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${cat.dotClass}`} />
                <span>{cat.shortLabel}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Right Search & Department dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          {/* Department Select Dropdown with Scrollbar */}
          <div className="relative shrink-0" ref={deptRef}>
            <button
              type="button"
              onClick={() => setDeptDropdownOpen(!deptDropdownOpen)}
              className="h-9 px-3 pr-2.5 bg-off border border-bdr rounded-xl text-[12px] text-slate-700 hover:bg-slate-200/60 focus:outline-none focus:border-navy cursor-pointer font-medium inline-flex items-center gap-2 transition"
            >
              <span className="truncate max-w-[130px]">{deptFilter === "All" ? "All Departments" : deptFilter}</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${deptDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {deptDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-bdr rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      setDeptFilter("All");
                      setDeptDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[12px] rounded-lg transition-colors cursor-pointer ${
                      deptFilter === "All"
                        ? "bg-navy/10 text-navy font-semibold"
                        : "text-slate-700 hover:bg-off"
                    }`}
                  >
                    <span>All Departments</span>
                    {deptFilter === "All" && <Check size={13} className="text-navy shrink-0" />}
                  </button>
                  {DEPARTMENTS.map((d) => {
                    const isSelected = deptFilter === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDeptFilter(d);
                          setDeptDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[12px] rounded-lg transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-navy/10 text-navy font-semibold"
                            : "text-slate-700 hover:bg-off"
                        }`}
                      >
                        <span className="truncate">{d}</span>
                        {isSelected && <Check size={13} className="text-navy shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 bg-off border border-bdr rounded-xl text-[12px] focus:bg-white focus:outline-none focus:border-navy transition"
            />
          </div>

          {(categoryFilter !== "All" || deptFilter !== "All" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("All");
                setDeptFilter("All");
                setSearchQuery("");
              }}
              title="Reset active filters"
              className="h-9 px-2.5 rounded-xl border border-bdr text-muted hover:text-slate-800 hover:bg-off text-[12px] flex items-center gap-1 transition"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Grid + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Main Calendar Canvas */}
        <div className="lg:col-span-8 bg-white border border-bdr rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            {/* Calendar Controls & Month/Year Title */}
            <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-bdr gap-3">
              <div className="flex items-center gap-3">
                {/* Month & Year Selection */}
                <div className="flex items-center gap-2">
                  <select
                    value={activeMonth}
                    onChange={(e) => setActiveMonth(Number(e.target.value))}
                    className="font-bold text-[18px] text-slate-900 bg-transparent hover:bg-off rounded-lg px-2 py-0.5 border border-transparent hover:border-bdr focus:outline-none focus:border-navy cursor-pointer transition"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={activeYear}
                    onChange={(e) => setActiveYear(Number(e.target.value))}
                    className="font-bold text-[18px] text-slate-900 bg-transparent hover:bg-off rounded-lg px-2 py-0.5 border border-transparent hover:border-bdr focus:outline-none focus:border-navy cursor-pointer transition"
                  >
                    {[2023, 2024, 2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="px-2.5 py-0.5 bg-off border border-bdr rounded-full text-[11.5px] text-muted font-medium">
                  {getQuarterInfo(activeMonth, activeYear)}
                </span>
              </div>

              {/* Today Button */}
              <div>
                <button
                  type="button"
                  onClick={handleToday}
                  className="h-8 px-3.5 rounded-lg border border-bdr text-[12px] font-medium hover:bg-off text-slate-700 transition cursor-pointer shadow-2xs"
                  title="Visit Today"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Active View Canvas */}
            {view === "Month" && (
              <CalendarMonthView
                cells={monthCells}
                events={filteredEvents}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onEventClick={handleOpenEditModal}
                onQuickAddDate={handleOpenCreateModal}
              />
            )}

            {view === "Week" && (
              <CalendarWeekView
                weekDays={weekDays}
                events={filteredEvents}
                selectedDate={selectedDate}
                onSelectDate={(d) => setSelectedDate(d)}
                onEventClick={handleOpenEditModal}
                onQuickAddDate={handleOpenCreateModal}
              />
            )}

            {view === "Schedule List" && (
              <CalendarListView
                events={filteredEvents}
                onEventClick={handleOpenEditModal}
                onDeleteEvent={handleDeleteEvent}
                onAddNewEvent={() => handleOpenCreateModal()}
              />
            )}
          </div>

            {/* Comprehensive Legend at Bottom */}
          <div className="pt-4 mt-6 border-t border-bdr flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted">
            <div className="flex flex-wrap items-center gap-4">
              {Object.keys(EVENT_CATEGORIES).map((key) => {
                const cat = EVENT_CATEGORIES[key];
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.dotClass}`} />
                    <span className="text-slate-700 font-medium">{cat.label}</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-[11px] text-muted hover:text-slate-800 underline decoration-dotted transition"
            >
              Reset Seed Data
            </button>
          </div>
        </div>

        {/* Right 4 Cols: Dynamic Agenda & Upcoming Cards */}
        <div className="lg:col-span-4">
          <CalendarAgendaSidebar
            selectedDate={selectedDate}
            events={selectedDateEvents}
            upcomingHolidays={upcomingHolidays}
            upcomingFunEvents={upcomingFunEvents}
            onEventClick={handleOpenEditModal}
            onAddEventForDate={handleOpenCreateModal}
          />
        </div>
      </div>

      {/* Add / Edit Event Modal */}
      <AddEditEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        initialEvent={editingEvent}
        defaultDate={modalDefaultDate}
      />
    </div>
  );
}

export const Calendar = CalendarPage;
export default CalendarPage;
