import { useStore } from "@nanostores/react";
import React from "react";
import { $allowHidingSettings, $developerMode, $hiddenSettingIds } from "../../../utils/stores.ts";
import { OpenBuildChannelManager } from "../../../utils/openBuildChannelPanel.tsx";
import { BuildChannelSettingControl } from "../BuildChannelPanel.tsx";
import { ExperimentSettings } from "./ExperimentsPanel.tsx";
import { matches, Row, SectionTitle, Toggle } from "./components.tsx";

const SECTION_NAME = "Advanced";

export default function DeveloperSection({ query, sectionFilter, showHidden = false }: { query: string; sectionFilter: string; showHidden?: boolean }) {
  const developerMode = useStore($developerMode);
  const allowHidingSettings = useStore($allowHidingSettings);
  const hiddenSettingIds = useStore($hiddenSettingIds);
  if (sectionFilter !== "All" && sectionFilter !== SECTION_NAME) return null;
  const developerModeHit = matches(query, "Developer Mode", "Enable extra logging and debug utilities.");
  const buildChannelHit = matches(query, "Build Channel", "Select a branch or manage saved branches.");
  const experimentsHit = matches(query, "Experiments", "Try out in-progress features.");
  const hidingHit = matches(query, "Show Hide Settings Tab", "Show the Hide Settings action and eye buttons beside settings.");
  const isHidden = hiddenSettingIds.includes("advanced-developer-mode");
  if (showHidden ? !isHidden : (!developerModeHit && !buildChannelHit && !experimentsHit && !hidingHit)) return null;
  return <>
    <SectionTitle>Advanced</SectionTitle>
    {!showHidden && buildChannelHit && <Row label="Build Channel" description="Select a branch or manage saved branches."><BuildChannelSettingControl onManage={OpenBuildChannelManager} /></Row>}
    {!showHidden && hidingHit && <Row settingId="advanced-hide-settings" label="Show Hide Settings Tab" description="Show the Hide Settings action and eye buttons beside settings."><Toggle checked={allowHidingSettings} onChange={(value) => $allowHidingSettings.set(value)} /></Row>}
    {developerModeHit && <Row settingId="advanced-developer-mode" label="Developer Mode" description="Enable extra logging and debug utilities."><Toggle checked={developerMode} onChange={(value) => $developerMode.set(value)} /></Row>}
    {!showHidden && experimentsHit && <ExperimentSettings title />}
  </>;
}
