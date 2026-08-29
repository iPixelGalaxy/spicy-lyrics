import { useStore } from "@nanostores/react";
import React, { useEffect, useMemo, useState } from "react";
import { $hiddenSettingIds } from "../../../utils/stores.ts";
import { FilterDropdown, Row, SearchBar, SectionTitle } from "./components.tsx";
import { SETTINGS, SETTING_SECTIONS } from "./hiddenSettings.ts";

function EyeIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/></svg>;
}

export default function HiddenSettingsPanel({ onBack }: { onBack: () => void }) {
  const hiddenIds = useStore($hiddenSettingIds);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All");
  const hiddenSettings = useMemo(() => SETTINGS.filter((setting) => hiddenIds.includes(setting.id)), [hiddenIds]);
  const sections = SETTING_SECTIONS.filter((section) => hiddenSettings.some((setting) => setting.category === section));

  useEffect(() => {
    if (sectionFilter !== "All" && !sections.includes(sectionFilter)) setSectionFilter("All");
  }, [sectionFilter, sections.join("|")]);

  const restore = (id: string) => $hiddenSettingIds.set(hiddenIds.filter((hiddenId) => hiddenId !== id));

  return <div style={{ padding: "8px 0" }} className="slm w-40">
    <div className="sl-sp-subheader"><button className="sl-sp-back-btn" onClick={onBack} aria-label="Back to Settings"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>Settings</button></div>
    <div className="sl-sp-toolbar"><SearchBar value={query} onChange={setQuery} /><FilterDropdown sections={sections} value={sectionFilter} onChange={setSectionFilter} /></div>
    {hiddenSettings.length === 0 ? <p className="sl-sp-empty">No hidden settings.</p> : SETTING_SECTIONS.map((section) => {
      const entries = hiddenSettings.filter((setting) => setting.category === section && (sectionFilter === "All" || sectionFilter === section) && (setting.label.toLowerCase().includes(query.toLowerCase()) || setting.description.toLowerCase().includes(query.toLowerCase())));
      if (!entries.length) return null;
      return <React.Fragment key={section}><SectionTitle>{section}</SectionTitle>{entries.map((setting) => <Row key={setting.id} label={setting.label} description={setting.description}><button className="sl-sp-visibility-btn" onClick={() => restore(setting.id)} aria-label={`Restore ${setting.label}`} title="Restore setting"><EyeIcon /></button></Row>)}</React.Fragment>;
    })}
  </div>;
}
