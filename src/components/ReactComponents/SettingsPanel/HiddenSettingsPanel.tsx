import { useStore } from "@nanostores/react";
import React, { useEffect, useMemo, useState } from "react";
import { $hiddenSettingIds } from "../../../utils/stores.ts";
import AppearanceSection from "./AppearanceSection.tsx";
import DeveloperSection from "./DeveloperSection.tsx";
import InterfaceSection from "./InterfaceSection.tsx";
import LyricsSection from "./LyricsSection.tsx";
import { FilterDropdown, HiddenSettingsContext, SearchBar } from "./components.tsx";
import { SETTINGS, SETTING_SECTIONS } from "./hiddenSettings.ts";

export default function HiddenSettingsPanel({ onBack }: { onBack: () => void }) {
  const hiddenIds = useStore($hiddenSettingIds);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const hiddenSettings = useMemo(() => SETTINGS.filter((setting) => hiddenIds.includes(setting.id)), [hiddenIds]);
  const sections = SETTING_SECTIONS.filter((section) => hiddenSettings.some((setting) => setting.category === section));

  useEffect(() => {
    if (sectionFilter !== "All" && !sections.includes(sectionFilter)) setSectionFilter("All");
  }, [sectionFilter, sections.join("|")]);

  return <div style={{ padding: "8px 0" }} className="slm w-40">
    <div className="sl-sp-subheader"><button className="sl-sp-back-btn" onClick={onBack} aria-label="Back to Settings"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>Settings</button></div>
    <div className="sl-sp-toolbar"><SearchBar value={query} onChange={setQuery} /><FilterDropdown sections={sections} value={sectionFilter} onChange={setSectionFilter} /></div>
    {hiddenSettings.length === 0 ? <p className="sl-sp-empty">No hidden settings.</p> : <HiddenSettingsContext.Provider value>
      <AppearanceSection query={query} sectionFilter={sectionFilter} showHidden />
      <LyricsSection query={query} sectionFilter={sectionFilter} showHidden />
      <InterfaceSection query={query} sectionFilter={sectionFilter} showHidden />
      <DeveloperSection query={query} sectionFilter={sectionFilter} onOpenHiddenSettings={() => {}} showHidden />
    </HiddenSettingsContext.Provider>}
  </div>;
}
