import { useEffect, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { $allowHidingSettings, $hideHidingIcon } from "../../../utils/stores.ts";
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

export type SettingsPanelState = { query: string; sectionFilter: string; scrollTop: number };
export default function SettingsPanel({ onOpenHiddenSettings, onManageAnimator, initialState, onStateChange }: { onOpenHiddenSettings?: () => void; onManageAnimator?: (state: SettingsPanelState) => void; initialState?: SettingsPanelState; onStateChange?: (state: SettingsPanelState) => void }) {
  const [query, setQuery] = useState(initialState?.query ?? "");
  const [sectionFilter, setSectionFilter] = useState<string>(initialState?.sectionFilter ?? "Appearance");
  const allowHidingSettings = useStore($allowHidingSettings);
  const hideHidingIcon = useStore($hideHidingIcon);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searching = Boolean(query.trim());

  useEffect(() => {
    onStateChange?.({ query, sectionFilter, scrollTop: 0 });
  }, [onStateChange, query, sectionFilter]);

  const selectTab = (tab: string) => {
    setSectionFilter(tab);
    setQuery("");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
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
    <div className="slm sl-sp-panel sl-sp-panel--settings">
      <div className="sl-sp-settings-header">
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
        {allowHidingSettings && <button className={`sl-sp-tab sl-sp-tab--action${hideHidingIcon ? "" : " sl-sp-tab--active"}`} type="button" aria-pressed={!hideHidingIcon} onClick={() => $hideHidingIcon.set(!hideHidingIcon)}><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4-6.5-4-6.5-4Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>Hide Settings</button>}
        </div>
        <div className="sl-sp-toolbar">
          <SearchBar value={query} onChange={(value) => {
            setQuery(value);
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          }} />
        </div>
      </div>

      <div className="sl-sp-settings-scroll" ref={scrollRef}>
        <div className="sl-sp-settings-content">
          <div className="sl-sp-settings-main">
            <ShowHiddenSettingsInSearchContext.Provider value={searching}>
              <div role="tabpanel">
                <AppearanceSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
                <LyricsSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
                <EffectsSection query={query} sectionFilter={searching ? "All" : sectionFilter} onManageAnimator={() => onManageAnimator?.({ query, sectionFilter, scrollTop: scrollRef.current?.scrollTop ?? 0 })} />
                <InterfaceSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
                <SourcesSection query={query} sectionFilter={searching ? "All" : sectionFilter} />
                <DeveloperSection query={query} sectionFilter={searching ? "All" : sectionFilter} onOpenHiddenSettings={onOpenHiddenSettings ?? (() => {})} />
              </div>
            </ShowHiddenSettingsInSearchContext.Provider>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
}
