import { useState } from "react";
import AppearanceSection from "./AppearanceSection.tsx";
import DeveloperSection from "./DeveloperSection.tsx";
import ExperimentsSection from "./ExperimentsSection.tsx";
import InterfaceSection from "./InterfaceSection.tsx";
import LyricsSection from "./LyricsSection.tsx";
import { FilterDropdown, SearchBar } from "./components.tsx";

const SECTIONS = ["Appearance", "Lyrics Display", "Interface", "Advanced"];

export default function SettingsPanel({ onOpenExperiments }: { onOpenExperiments?: () => void }) {
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");

  return (
    <div style={{ padding: "8px 0" }} className="slm w-40">
      <div className="sl-sp-toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <FilterDropdown sections={SECTIONS} value={sectionFilter} onChange={setSectionFilter} />
      </div>

      <AppearanceSection query={query} sectionFilter={sectionFilter} />
      <LyricsSection query={query} sectionFilter={sectionFilter} />
      <InterfaceSection query={query} sectionFilter={sectionFilter} />
      <ExperimentsSection
        query={query}
        sectionFilter={sectionFilter}
        onOpen={onOpenExperiments ?? (() => {})}
      />
      <DeveloperSection query={query} sectionFilter={sectionFilter} />
    </div>
  );
}
