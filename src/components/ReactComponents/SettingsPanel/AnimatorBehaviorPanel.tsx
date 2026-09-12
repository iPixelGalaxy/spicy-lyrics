import { useStore } from "@nanostores/react";
import React, { useEffect, useState } from "react";
import { ANIMATOR_PARAMETERS, $animatorDetail, $animatorValues, $savedAnimatorPresets, $selectedAnimatorPresetId, deleteSelectedAnimatorPreset, importAnimatorPreset, loadSavedAnimatorPreset, randomizeAnimatorValues, saveAnimatorPreset, shareAnimatorPreset, type AnimatorDetail, resetAnimatorValues, setAnimatorValue } from "../../../utils/Lyrics/Animator/Tuning.ts";
import { Row, SectionTitle, Select, Slider } from "./components.tsx";

const levels: AnimatorDetail[] = ["Basic", "Advanced", "Full", "Full + Extras"];
export default function AnimatorBehaviorPanel({ onBack, onClose, eventDocument = document }: { onBack: () => void; onClose: () => void; eventDocument?: Document }) {
  const detail = useStore($animatorDetail); const values = useStore($animatorValues);
  const presets = useStore($savedAnimatorPresets); const selectedPresetId = useStore($selectedAnimatorPresetId);
  const [name, setName] = useState("");
  const [importCode, setImportCode] = useState(""); const [message, setMessage] = useState("");
  const [presetToLoad, setPresetToLoad] = useState(selectedPresetId ?? "");
  const visible = ANIMATOR_PARAMETERS.filter((parameter) => levels.indexOf(parameter.level) <= levels.indexOf(detail));
  const groups = [...new Set(visible.map((parameter) => parameter.group))];
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  useEffect(() => setPresetToLoad(selectedPresetId ?? ""), [selectedPresetId]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault(); event.stopImmediatePropagation(); onClose();
    };
    eventDocument.addEventListener("keydown", closeOnEscape, true);
    return () => eventDocument.removeEventListener("keydown", closeOnEscape, true);
  }, [eventDocument, onClose]);
  return <div className="slm sl-sp-panel" style={{ padding: "8px 0" }}>
    <div className="sl-sp-toolbar sl-sp-animator-toolbar"><button className="sl-sp-btn" type="button" onClick={onBack}>Back</button><button className="sl-sp-btn" type="button" onClick={() => randomizeAnimatorValues(visible.map((parameter) => parameter.id))}>Randomize</button></div>
    <SectionTitle>Presets</SectionTitle>
    <Row label="Saved preset" description="Loading a preset copies it into working Custom tuning." disabled={presets.length === 0}><span style={{ display: "flex", gap: 8 }}><Select value={presetToLoad} options={presets.map((preset) => preset.id)} labels={presets.map((preset) => preset.name)} disabled={presets.length === 0} onChange={setPresetToLoad} /><button className="sl-sp-btn" type="button" disabled={!presetToLoad} onClick={() => loadSavedAnimatorPreset(presetToLoad)}>Load</button></span></Row>
    <div className="sl-sp-preset-actions"><input className="sl-sp-text-input" value={name} onChange={(event) => setName(event.currentTarget.value)} placeholder="Preset name" aria-label="Preset name" /><button className="sl-sp-btn" type="button" disabled={!name.trim()} onClick={() => { if (saveAnimatorPreset(name)) setName(""); }}>Save</button><button className="sl-sp-btn" type="button" disabled={!selectedPreset} onClick={deleteSelectedAnimatorPreset}>Delete Current</button><button className="sl-sp-btn" type="button" onClick={async () => { try { if (!navigator.clipboard) throw new Error("Clipboard is unavailable."); await navigator.clipboard.writeText(shareAnimatorPreset(selectedPreset?.name ?? name)); setMessage("Preset copied to clipboard."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not copy preset."); } }}>Share</button></div>
    <div className="sl-sp-preset-actions"><input className="sl-sp-text-input" value={importCode} onChange={(event) => setImportCode(event.currentTarget.value)} placeholder="Paste SLP1 or SLAP1 code" aria-label="Import preset code" /><button className="sl-sp-btn" type="button" disabled={!importCode.trim()} onClick={() => { try { const imported = importAnimatorPreset(importCode.trim()); setImportCode(""); setMessage(`Imported ${imported}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import preset."); } }}>Import</button><button className="sl-sp-btn" type="button" onClick={async () => { try { if (!navigator.clipboard) throw new Error("Clipboard is unavailable. Paste code above instead."); const code = await navigator.clipboard.readText(); if (!code.trim()) throw new Error("Clipboard has no preset code."); setMessage(`Imported ${importAnimatorPreset(code.trim())}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not import preset."); } }}>Import Clipboard</button></div>
    {message && <p className="sl-sp-description sl-sp-preset-message">{message}</p>}
    <SectionTitle>Animator Behavior</SectionTitle>
    <Row label="Detail level" description="Levels add controls; changing level never changes saved values."><Select value={detail} options={levels} onChange={(value) => $animatorDetail.set(value as AnimatorDetail)} /></Row>
    <Row label="Reset all to Default" description="Resets saved Custom tuning only."><button className="sl-sp-btn" type="button" onClick={resetAnimatorValues}>Reset all</button></Row>
    {groups.map((group) => <React.Fragment key={group}><SectionTitle>{group}</SectionTitle>{visible.filter((parameter) => parameter.group === group).map((parameter) => <Row key={parameter.id} label={parameter.label} description={parameter.description} stacked><Slider value={values[parameter.id]} min={parameter.min} max={parameter.max} step={parameter.step} unit={parameter.unit} defaultValue={parameter.defaultValue} editable onChange={(value) => setAnimatorValue(parameter.id, value)} /></Row>)}</React.Fragment>)}
    {detail === "Full" || detail === "Full + Extras" ? <p className="sl-sp-description">More Full controls will appear as renderer options are made configurable.</p> : null}
  </div>;
}
