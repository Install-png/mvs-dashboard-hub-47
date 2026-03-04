import { create } from "zustand";
import type { Incident, IncidentStatus, SeverityLevel, IncidentType } from "@/data/mockIncidents";

export type FilterService = "all" | "ses" | "police" | "medical";
export type FilterSeverity = "all" | SeverityLevel;
export type FilterStatus = "all" | IncidentStatus;

interface IncidentStore {
  // Data
  incidents: Incident[];
  loading: boolean;

  // Filters
  filterService: FilterService;
  filterSeverity: FilterSeverity;
  filterStatus: FilterStatus;
  dateFilter: Date | undefined;
  searchQuery: string;

  // Interactive state
  selectedRegion: string | null;
  selectedIncident: Incident | null;
  hoveredIncidentId: string | null;
  highlightedIncidentId: string | null;

  // Actions — data
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  updateIncidentInStore: (id: string, incident: Incident) => void;
  removeIncident: (id: string) => void;
  setLoading: (loading: boolean) => void;

  // Actions — filters
  setFilterService: (f: FilterService) => void;
  setFilterSeverity: (f: FilterSeverity) => void;
  setFilterStatus: (f: FilterStatus) => void;
  setDateFilter: (d: Date | undefined) => void;
  setSearchQuery: (q: string) => void;
  resetFilters: () => void;

  // Actions — interactive
  setSelectedRegion: (id: string | null) => void;
  setSelectedIncident: (inc: Incident | null) => void;
  setHoveredIncidentId: (id: string | null) => void;
  setHighlightedIncidentId: (id: string | null) => void;
  selectIncidentById: (id: string) => void;
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  // Data
  incidents: [],
  loading: true,

  // Filters
  filterService: "all",
  filterSeverity: "all",
  filterStatus: "all",
  dateFilter: undefined,
  searchQuery: "",

  // Interactive
  selectedRegion: null,
  selectedIncident: null,
  hoveredIncidentId: null,
  highlightedIncidentId: null,

  // Actions — data
  setIncidents: (incidents) => set({ incidents }),
  addIncident: (incident) => set((s) => ({ incidents: [incident, ...s.incidents] })),
  updateIncidentInStore: (id, incident) =>
    set((s) => ({
      incidents: s.incidents.map((i) => (i.id === id ? incident : i)),
      selectedIncident: s.selectedIncident?.id === id ? incident : s.selectedIncident,
    })),
  removeIncident: (id) =>
    set((s) => ({
      incidents: s.incidents.filter((i) => i.id !== id),
      selectedIncident: s.selectedIncident?.id === id ? null : s.selectedIncident,
    })),
  setLoading: (loading) => set({ loading }),

  // Actions — filters
  setFilterService: (filterService) => set({ filterService }),
  setFilterSeverity: (filterSeverity) => set({ filterSeverity }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  resetFilters: () =>
    set({ filterService: "all", filterSeverity: "all", filterStatus: "all", dateFilter: undefined, searchQuery: "" }),

  // Actions — interactive
  setSelectedRegion: (selectedRegion) => set({ selectedRegion }),
  setSelectedIncident: (selectedIncident) => set({ selectedIncident }),
  setHoveredIncidentId: (hoveredIncidentId) => set({ hoveredIncidentId }),
  setHighlightedIncidentId: (id) => {
    set({ highlightedIncidentId: id });
    if (id) setTimeout(() => set((s) => (s.highlightedIncidentId === id ? { highlightedIncidentId: null } : {})), 3000);
  },
  selectIncidentById: (id) => {
    const inc = get().incidents.find((i) => i.id === id);
    if (inc) {
      set({ selectedIncident: inc, selectedRegion: inc.region, highlightedIncidentId: id });
    }
  },
}));
