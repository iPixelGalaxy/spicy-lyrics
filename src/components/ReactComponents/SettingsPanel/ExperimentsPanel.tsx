import { useStore } from "@nanostores/react";
import { $experiment, EXPERIMENTS, type ExperimentId, type RegisteredExperiment } from "../../../utils/experiments.ts";
import { $enableExperimentalWordSync, $externalCinemaLyricsAllowed } from "../../../utils/stores.ts";
import { Row, SectionTitle, Toggle } from "./components.tsx";

const experimentSettingIds: Partial<Record<ExperimentId, string>> = {
  newProgressBarStyling: "appearance-sliderbar-styling",
  duetLinePadding: "lyrics-wide-duet-padding",
  lyricsSkeleton: "lyrics-loading-skeleton",
};

/**
 * The Experiments sub-panel. Renders straight off the EXPERIMENTS registry, so a
 * new experiment shows up here the moment it's added to `utils/experiments.ts`.
 */
export default function ExperimentsPanel({ onBack }: { onBack: () => void }) {
  return <div style={{ padding: "8px 0" }} className="slm w-40">
    <div className="sl-sp-subheader"><button className="sl-sp-back-btn" onClick={onBack} aria-label="Back to Settings">Settings</button></div>
    <p className="sl-sp-experiments-note">These features are still being shaped. Toggle one off if you prefer how things worked before.</p>
    <ExperimentSettings />
  </div>;
}

export function ExperimentSettings({ title = false, experimentIds, showBuiltIn = true }: { title?: boolean; experimentIds?: readonly ExperimentId[]; showBuiltIn?: boolean }) {
  const experimentalWordSync = useStore($enableExperimentalWordSync);
  const externalCinemaLyricsAllowed = useStore($externalCinemaLyricsAllowed);

  return (
    <>
      {title && <SectionTitle>Experiments</SectionTitle>}
      {EXPERIMENTS.filter((exp) => !experimentIds || experimentIds.includes(exp.id)).map((exp) => (
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

function ExperimentRow({ experiment }: { experiment: RegisteredExperiment }) {
  const store = $experiment(experiment.id);
  const enabled = useStore(store);

  return (
    <Row settingId={experimentSettingIds[experiment.id]} label={experiment.label} description={experiment.description}>
      <Toggle checked={enabled} onChange={(v) => store.set(v)} />
    </Row>
  );
}
