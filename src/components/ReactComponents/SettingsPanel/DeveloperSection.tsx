import { useStore } from "@nanostores/react";
import React from "react";
import { $allowHidingSettings, $developerMode, $rememberSettingsMenuLocation } from "../../../utils/stores.ts";
import { OpenBuildChannelManager } from "../../../utils/openBuildChannelPanel.tsx";
import { BuildChannelSettingControl } from "../BuildChannelPanel.tsx";
import { ExperimentSettings } from "./ExperimentsPanel.tsx";
import { matches, Row, SectionTitle, Toggle } from "./components.tsx";

const SECTION_NAME = "Advanced";

export default function DeveloperSection({ query, sectionFilter, onOpenHiddenSettings = () => {}, showHidden = false }: { query: string; sectionFilter: string; onOpenHiddenSettings?: () => void; showHidden?: boolean }) {
  const developerMode = useStore($developerMode);
  const allowHidingSettings = useStore($allowHidingSettings);
  const rememberSettingsMenuLocation = useStore($rememberSettingsMenuLocation);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;
  const developerModeHit = matches(query, "Developer Mode", "Enable extra logging and debug utilities.");
  const buildChannelHit = matches(query, "Build Channel", "Select a branch or manage saved branches.");
  const experimentsHit = matches(query, "Experiments", "Try out in-progress features.");
  const hidingHit = matches(query, "Show Hide Settings Tab", "Show the Hide Settings action and eye buttons beside settings.");
  const manageHiddenHit = matches(query, "Manage Hidden Settings", "Restore settings hidden from the main panel.");
  const rememberLocationHit = matches(query, "Remember Menu Location After Close", "Reopen Settings at the tab or submenu you last used.");
  if (showHidden || (!developerModeHit && !buildChannelHit && !experimentsHit && !hidingHit && !manageHiddenHit && !rememberLocationHit)) return null;
  return <>
    <SectionTitle>Advanced</SectionTitle>
    {!showHidden && buildChannelHit && <Row label="Build Channel" description="Select a branch or manage saved branches."><BuildChannelSettingControl onManage={OpenBuildChannelManager} /></Row>}
    {!showHidden && hidingHit && <Row label="Show Hide Settings Tab" description="Show the Hide Settings action and eye buttons beside settings."><Toggle checked={allowHidingSettings} onChange={(value) => $allowHidingSettings.set(value)} /></Row>}
    {!showHidden && manageHiddenHit && <Row label="Manage Hidden Settings" description="Restore settings hidden from the main panel."><button className="sl-sp-btn" type="button" onClick={onOpenHiddenSettings}>Manage</button></Row>}
    {!showHidden && rememberLocationHit && <Row label="Remember Menu Location After Close" description="Reopen Settings at the tab or submenu you last used."><Toggle checked={rememberSettingsMenuLocation} onChange={(value) => $rememberSettingsMenuLocation.set(value)} /></Row>}
    {developerModeHit && <Row label="Developer Mode" description="Enable extra logging and debug utilities."><Toggle checked={developerMode} onChange={(value) => $developerMode.set(value)} /></Row>}
    {!showHidden && experimentsHit && <ExperimentSettings title experimentIds={[]} />}
  </>;
}
