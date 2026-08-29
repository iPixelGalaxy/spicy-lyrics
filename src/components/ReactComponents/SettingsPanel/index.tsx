import { useStore } from "@nanostores/react";
import { useState } from "react";
import { $hiddenSettingIds } from "../../../utils/stores.ts";
import AppearanceSection from "./AppearanceSection.tsx";
import DeveloperSection from "./DeveloperSection.tsx";
import ExperimentsSection from "./ExperimentsSection.tsx";
import InterfaceSection from "./InterfaceSection.tsx";
import LyricsSection from "./LyricsSection.tsx";
import Footer from "./Footer.tsx";
import { FilterDropdown, SearchBar } from "./components.tsx";
import { SETTINGS, SETTING_SECTIONS } from "./hiddenSettings.ts";

export default function SettingsPanel({ onOpenExperiments, onOpenHiddenSettings }: { onOpenExperiments?: () => void; onOpenHiddenSettings?: () => void }) {
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const hiddenSettingIds = useStore($hiddenSettingIds);
  const sections = SETTING_SECTIONS.filter((section) => section === "Advanced" || SETTINGS.some((setting) => setting.category === section && !hiddenSettingIds.includes(setting.id)));

  return (
    <div style={{ padding: "8px 0" }} className="slm w-40">
      <div className="sl-sp-toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <FilterDropdown sections={sections} value={sectionFilter} onChange={setSectionFilter} />
      </div>

      <AppearanceSection query={query} sectionFilter={sectionFilter} />
      <LyricsSection query={query} sectionFilter={sectionFilter} />
      <InterfaceSection query={query} sectionFilter={sectionFilter} />
      <ExperimentsSection
        query={query}
        sectionFilter={sectionFilter}
        onOpen={onOpenExperiments ?? (() => {})}
      />
      <DeveloperSection query={query} sectionFilter={sectionFilter} onOpenHiddenSettings={onOpenHiddenSettings ?? (() => {})} />
      <Footer />
    </div>
  );
}
