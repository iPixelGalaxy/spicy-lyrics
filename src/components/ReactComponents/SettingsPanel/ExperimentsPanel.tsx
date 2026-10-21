import { useStore } from "@nanostores/react";
import { $experiment, $experimentOverrides, $experimentsSyncing, forcedExperimentState, getAdvancedExperiments, getVisibleExperiments, RefreshExperimentOverrides, setExperiment, type ExperimentId, type ResolvedExperiment } from "../../../utils/experiments.ts";
import { useEffect } from "react";
import { $enableExperimentalWordSync, $externalCinemaLyricsAllowed } from "../../../utils/stores.ts";
import { Row, SectionTitle, Toggle } from "./components.tsx";

const experimentSettingIds: Partial<Record<ExperimentId, string>> = {
  newSettingsDesign: "appearance-settings-design",
  newProgressBarStyling: "appearance-sliderbar-styling",
  lyricsSkeleton: "lyrics-loading-skeleton",
};

/**
 * The Experiments sub-panel. Renders straight off the EXPERIMENTS registry, so a
 * new experiment shows up here the moment it's added to `utils/experiments.ts`.
 */
export default function ExperimentsPanel({ experimentIds, advancedOnly = false, showBuiltIn = true }: { experimentIds?: readonly ExperimentId[]; advancedOnly?: boolean; showBuiltIn?: boolean }) {
  return <div style={{ padding: "8px 0" }} className="slm w-40">
    <p className="sl-sp-experiments-note">These features are still being shaped. Toggle one off if you prefer how things worked before.</p>
    <ExperimentSettings experimentIds={experimentIds} advancedOnly={advancedOnly} showBuiltIn={showBuiltIn} />
  </div>;
}

export function ExperimentSettings({ title = false, experimentIds, advancedOnly = false, showBuiltIn = true }: { title?: boolean; experimentIds?: readonly ExperimentId[]; advancedOnly?: boolean; showBuiltIn?: boolean }) {
  useStore($experimentOverrides);
  useEffect(() => { void RefreshExperimentOverrides(); }, []);
  const experimentalWordSync = useStore($enableExperimentalWordSync);
  const externalCinemaLyricsAllowed = useStore($externalCinemaLyricsAllowed);
  const experiments = advancedOnly ? getAdvancedExperiments() : getVisibleExperiments();

  return (
    <>
      {title && <SectionTitle>Experiments</SectionTitle>}
      {experiments.filter((exp) => !experimentIds || experimentIds.includes(exp.id)).map((exp) => (
        <ExperimentRow key={exp.id} experiment={exp} />
      ))}
      {showBuiltIn && <><Row
        label="Enable Cinema Lyrics Window"
        description="Show or hide the Cinema Lyrics button in the playback bar."
        labelAccessory={
          <a
            className="sl-sp-help-link"
            href="https://github.com/iPixelGalaxy/spicy-lyrics/blob/dev/ENABLE_DEVTOOLS.md"
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Help
          </a>
        }
      >
        <Toggle checked={externalCinemaLyricsAllowed} onChange={(v) => $externalCinemaLyricsAllowed.set(v)} />
      </Row>
      <Row label="Experimental Word Sync" description="Estimate word sync for line or static lyrics.">
        <Toggle checked={experimentalWordSync} onChange={(v) => $enableExperimentalWordSync.set(v)} />
      </Row></>}
    </>
  );
}

function ExperimentRow({ experiment }: { experiment: ResolvedExperiment }) {
  const store = $experiment(experiment.id);
  const enabled = useStore(store);
  const forced = forcedExperimentState(experiment.id);
  const syncing = useStore($experimentsSyncing);

  return (
    <Row settingId={experimentSettingIds[experiment.id]} label={experiment.label} description={experiment.description} disabled={syncing || forced !== undefined} disabledReason={syncing ? "Refreshing experiments" : forced ? "Forced on" : "Forced off"}>
      <Toggle checked={enabled} onChange={(v) => setExperiment(experiment.id, v)} />
    </Row>
  );
}
