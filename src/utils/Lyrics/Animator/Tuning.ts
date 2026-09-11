import { atom } from "nanostores";
import { persistAtom } from "../../stores.ts";
import { UPSTREAM_ANIMATOR_VALUES } from "./Upstream.ts";

export type AnimatorPreset = "Default" | "Pixel" | "Custom";
export type AnimatorDetail = "Basic" | "Advanced" | "Full" | "Full + Extras";
export type AnimatorParameterId =
  | "wordPeakScale" | "letterPeakScale" | "verticalStrength" | "glowStrength" | "blurStrength"
  | "scaleFrequency" | "scaleDamping" | "verticalFrequency" | "verticalDamping" | "glowFrequency" | "glowDamping";

export type AnimatorParameter = {
  id: AnimatorParameterId; group: string; level: AnimatorDetail; label: string; description: string;
  min: number; max: number; step: number; typedMin: number; typedMax: number; unit?: string; defaultValue: number;
};

export const ANIMATOR_PARAMETERS: readonly AnimatorParameter[] = [
  { id: "wordPeakScale", group: "Words", level: "Basic", label: "Word peak scale", description: "Peak word scale during timing animation.", min: 0, max: 2, step: .005, typedMin: -100, typedMax: 100, defaultValue: 1.0505 },
  { id: "letterPeakScale", group: "Letters", level: "Basic", label: "Emphasis peak scale", description: "Peak emphasis-letter scale during timing animation.", min: 0, max: 2, step: .005, typedMin: -100, typedMax: 100, defaultValue: 1.175 },
  { id: "verticalStrength", group: "Motion", level: "Basic", label: "Vertical-motion strength", description: "Multiplies existing vertical curve output. 1 is current behavior.", min: 0, max: 3, step: .01, typedMin: -100, typedMax: 100, defaultValue: 1 },
  { id: "glowStrength", group: "Glow", level: "Basic", label: "Glow strength", description: "Multiplies existing glow curve output. 1 is current behavior.", min: 0, max: 3, step: .01, typedMin: -100, typedMax: 100, defaultValue: 1 },
  { id: "blurStrength", group: "Blur", level: "Basic", label: "Blur strength", description: "Multiplies existing blur output. 1 is current behavior.", min: 0, max: 3, step: .01, typedMin: -100, typedMax: 100, defaultValue: 1 },
  { id: "scaleFrequency", group: "Words", level: "Advanced", label: "Scale spring frequency", description: "Word and letter scale spring frequency.", min: .1, max: 10, step: .05, typedMin: .001, typedMax: 1000, unit: "Hz", defaultValue: .88 },
  { id: "scaleDamping", group: "Words", level: "Advanced", label: "Scale spring damping", description: "Word and letter scale spring damping ratio.", min: .05, max: 2, step: .01, typedMin: 0, typedMax: 100, defaultValue: .64 },
  { id: "verticalFrequency", group: "Motion", level: "Advanced", label: "Vertical spring frequency", description: "Vertical-motion spring frequency.", min: .1, max: 10, step: .05, typedMin: .001, typedMax: 1000, unit: "Hz", defaultValue: 1.45 },
  { id: "verticalDamping", group: "Motion", level: "Advanced", label: "Vertical spring damping", description: "Vertical-motion spring damping ratio.", min: .05, max: 2, step: .01, typedMin: 0, typedMax: 100, defaultValue: .4 },
  { id: "glowFrequency", group: "Glow", level: "Advanced", label: "Glow spring frequency", description: "Glow spring frequency.", min: .1, max: 10, step: .05, typedMin: .001, typedMax: 1000, unit: "Hz", defaultValue: 1.18 },
  { id: "glowDamping", group: "Glow", level: "Advanced", label: "Glow spring damping", description: "Glow spring damping ratio.", min: .05, max: 2, step: .01, typedMin: 0, typedMax: 100, defaultValue: .56 },
] as const;

export type AnimatorValues = Record<AnimatorParameterId, number>;
export type SavedAnimatorPreset = { id: string; name: string; values: AnimatorValues };
type SharedAnimatorPreset = { name: string; values: Partial<AnimatorValues> };
const defaults = Object.fromEntries(ANIMATOR_PARAMETERS.map((item) => [item.id, item.defaultValue])) as AnimatorValues;
const isValue = (id: AnimatorParameterId, value: unknown) => {
  const item = ANIMATOR_PARAMETERS.find((entry) => entry.id === id)!;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(item.typedMax, Math.max(item.typedMin, value)) * 10_000) / 10_000 : item.defaultValue;
};
const clean = (input: unknown): Partial<AnimatorValues> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(ANIMATOR_PARAMETERS.flatMap((item) => {
    const value = (input as Record<string, unknown>)[item.id];
    return typeof value === "number" && Number.isFinite(value) ? [[item.id, isValue(item.id, value)]] : [];
  })) as Partial<AnimatorValues>;
};

export const $animatorPreset = persistAtom<AnimatorPreset>("animatorPreset", "Default");
export const $animatorDetail = persistAtom<AnimatorDetail>("animatorDetail", "Basic");
export const $animatorCustom = persistAtom<Partial<AnimatorValues>>("animatorCustom", {});
export const $savedAnimatorPresets = persistAtom<SavedAnimatorPreset[]>("savedAnimatorPresets", []);
export const $selectedAnimatorPresetId = persistAtom<string | null>("selectedAnimatorPresetId", null);
export const $animatorValues = atom<AnimatorValues>({ ...defaults });
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function cleanupCustom() {
  const current = $animatorCustom.get();
  const normalized = clean(current);
  if (!same(current, normalized)) $animatorCustom.set(normalized);
}
function cleanupSavedPresets() {
  const current = $savedAnimatorPresets.get();
  if (!Array.isArray(current)) { $savedAnimatorPresets.set([]); return; }
  const normalized = current.flatMap((preset) => {
    if (!preset || typeof preset !== "object" || typeof preset.id !== "string" || typeof preset.name !== "string") return [];
    return [{ id: preset.id, name: preset.name, values: { ...defaults, ...clean(preset.values) } }];
  });
  if (!same(current, normalized)) $savedAnimatorPresets.set(normalized);
}
let firstCustom = Object.keys($animatorCustom.get()).length > 0;
function resolve() {
  const preset = $animatorPreset.get();
  $animatorValues.set(preset === "Default"
    ? { ...UPSTREAM_ANIMATOR_VALUES }
    : { ...defaults, ...clean(preset === "Custom" ? $animatorCustom.get() : {}) });
}
$animatorPreset.listen((preset) => {
  if (preset === "Custom" && !firstCustom) { $animatorCustom.set({ ...$animatorValues.get() }); firstCustom = true; }
  resolve();
});
$animatorCustom.listen(() => { cleanupCustom(); if ($animatorPreset.get() === "Custom") resolve(); });
$savedAnimatorPresets.listen(cleanupSavedPresets);
export function setAnimatorValue(id: AnimatorParameterId, value: number) {
  const next = { ...$animatorCustom.get(), [id]: isValue(id, value) };
  firstCustom = true;
  if ($animatorPreset.get() !== "Custom") $animatorPreset.set("Custom");
  $animatorCustom.set(next);
}
export function resetAnimatorValue(id: AnimatorParameterId) { setAnimatorValue(id, defaults[id]); }
export function resetAnimatorValues() { firstCustom = true; $animatorCustom.set({ ...defaults }); }
export function loadSavedAnimatorPreset(id: string) {
  const preset = $savedAnimatorPresets.get().find((item) => item.id === id);
  if (!preset) return;
  firstCustom = true; $animatorPreset.set("Custom"); $animatorCustom.set({ ...defaults, ...clean(preset.values) }); $selectedAnimatorPresetId.set(id);
}
export function saveAnimatorPreset(name: string): string | null {
  const trimmed = name.trim(); if (!trimmed) return null;
  const presets = $savedAnimatorPresets.get();
  const existing = presets.find((item) => item.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
  const values = { ...defaults, ...clean($animatorCustom.get()) };
  const id = existing?.id ?? `animator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  $savedAnimatorPresets.set(existing ? presets.map((item) => item.id === id ? { id, name: trimmed, values } : item) : [...presets, { id, name: trimmed, values }]);
  $selectedAnimatorPresetId.set(id); return id;
}
export function deleteSelectedAnimatorPreset() {
  const id = $selectedAnimatorPresetId.get(); if (!id) return;
  $savedAnimatorPresets.set($savedAnimatorPresets.get().filter((item) => item.id !== id)); $selectedAnimatorPresetId.set(null);
}
const SHARE_PREFIX = "SLAP1:";
const encodeBase64Url = (value: string) => btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const decodeBase64Url = (value: string) => decodeURIComponent(escape(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4))));
export function shareAnimatorPreset(name: string): string {
  return SHARE_PREFIX + encodeBase64Url(JSON.stringify(({ name: name.trim() || "Shared Preset", values: { ...defaults, ...clean($animatorCustom.get()) } } satisfies SharedAnimatorPreset)));
}
export function importAnimatorPreset(code: string): string {
  if (code.length > 65_536 || !code.startsWith(SHARE_PREFIX)) throw new Error("Not a Spicy Lyrics animator preset.");
  let parsed: unknown;
  try { parsed = JSON.parse(decodeBase64Url(code.slice(SHARE_PREFIX.length))); } catch { throw new Error("Preset code is invalid or damaged."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Preset code has no preset data.");
  const input = parsed as { name?: unknown; values?: unknown };
  const values = clean(input.values);
  if (Object.keys(values).length === 0) throw new Error("Preset has no recognized animator values.");
  const baseName = typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 80) : "Imported Preset";
  const existing = new Set($savedAnimatorPresets.get().map((preset) => preset.name.toLocaleLowerCase()));
  let name = baseName; let suffix = 2;
  while (existing.has(name.toLocaleLowerCase())) name = `${baseName} (${suffix++})`;
  const id = `animator-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const preset = { id, name, values: { ...defaults, ...values } };
  firstCustom = true; $animatorPreset.set("Custom"); $animatorCustom.set(preset.values); $savedAnimatorPresets.set([...$savedAnimatorPresets.get(), preset]); $selectedAnimatorPresetId.set(id);
  return name;
}
export function randomizeAnimatorValues(ids: AnimatorParameterId[]) {
  const next = { ...defaults, ...clean($animatorCustom.get()) };
  for (const id of ids) {
    const parameter = ANIMATOR_PARAMETERS.find((item) => item.id === id)!;
    const steps = Math.round((parameter.max - parameter.min) / parameter.step);
    next[id] = Math.round((parameter.min + Math.floor(Math.random() * (steps + 1)) * parameter.step) * 100) / 100;
  }
  firstCustom = true; $animatorPreset.set("Custom"); $animatorCustom.set(next); $selectedAnimatorPresetId.set(null);
}
cleanupCustom();
cleanupSavedPresets();
resolve();
