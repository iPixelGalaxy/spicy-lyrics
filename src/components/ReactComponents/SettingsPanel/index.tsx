import { useStore } from "@nanostores/react";
import { useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { $allowHidingSettings } from "../../../utils/stores.ts";
import AppearanceSection from "./AppearanceSection.tsx";
import DeveloperSection from "./DeveloperSection.tsx";
import EffectsSection from "./EffectsSection.tsx";
import InterfaceSection from "./InterfaceSection.tsx";
import LyricsSection from "./LyricsSection.tsx";
import SourcesSection from "./SourcesSection.tsx";
import Footer from "./Footer.tsx";
import { SearchBar, ShowHiddenSettingsInSearchContext } from "./components.tsx";

const TABS = [
  ["Appearance", "Appearance", "✦"],
  ["Lyrics", "Lyrics Display", "♪"],
  ["Effects", "Effects", "✦"],
  ["Interface", "Interface", "▣"],
  ["Sources", "Sources", "≋"],
  ["Advanced", "Advanced", "⚙"],
] as const;

export default function SettingsPanel({ onOpenHiddenSettings }: { onOpenHiddenSettings?: () => void }) {
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("Appearance");
  const allowHidingSettings = useStore($allowHidingSettings);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searching = Boolean(query.trim());

  const selectTab = (tab: string) => {
    setSectionFilter(tab);
    setQuery("");
  };

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? TABS.length - 1 : (index + (key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    selectTab(TABS[next][1]);
    tabRefs.current[next]?.focus();
  };

  return (
    <div style={{ padding: "8px 0" }} className="slm w-40">
      <div className="sl-sp-tabs" role="tablist" aria-label="Settings categories">
        {TABS.map(([label, tab, icon], index) => <button
          key={tab}
          ref={(element) => { tabRefs.current[index] = element; }}
          className={`sl-sp-tab${sectionFilter === tab && !searching ? " sl-sp-tab--active" : ""}`}
          role="tab"
          type="button"
          aria-selected={sectionFilter === tab && !searching}
          onClick={() => selectTab(tab)}
          onKeyDown={(event) => onTabKeyDown(event, index)}
        ><span aria-hidden="true">{icon}</span>{label}</button>)}
        {allowHidingSettings && <button className="sl-sp-tab sl-sp-tab--action" type="button" onClick={onOpenHiddenSettings}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>Hide Settings</button>}
      </div>
      <div className="sl-sp-toolbar">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <ShowHiddenSettingsInSearchContext.Provider value={searching}>
        <div role="tabpanel">
          <AppearanceSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
          <LyricsSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
          <EffectsSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
          <InterfaceSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
          <SourcesSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
          <DeveloperSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
        </div>
      </ShowHiddenSettingsInSearchContext.Provider>
      <Footer />
    </div>
  );
}
