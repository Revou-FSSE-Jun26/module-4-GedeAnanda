/**
 * Identity colours. Every board and every person gets one of six marker
 * colours, worked out from their ID alone, so it is the same on every page and
 * for every viewer without the API storing anything (REQ-33.4, REQ-33.5).
 */

import type { LabelColor } from "@/types";

export const MARKERS: readonly LabelColor[] = ["cobalt", "teal", "plum", "poppy", "amber", "moss"];
export type Marker = LabelColor;

/** The colours' names as a person reads them, for the "new label" form. */
export const MARKER_NAMES: Record<Marker, string> = {
  cobalt: "Blue",
  teal: "Teal",
  plum: "Purple",
  poppy: "Red",
  amber: "Amber",
  moss: "Green",
};

/** Full class names, written out so Tailwind can see them. */
export const MARKER_BG: Record<Marker, string> = {
  cobalt: "bg-marker-cobalt",
  teal: "bg-marker-teal",
  plum: "bg-marker-plum",
  poppy: "bg-marker-poppy",
  amber: "bg-marker-amber",
  moss: "bg-marker-moss",
};

export const MARKER_BORDER: Record<Marker, string> = {
  cobalt: "border-marker-cobalt",
  teal: "border-marker-teal",
  plum: "border-marker-plum",
  poppy: "border-marker-poppy",
  amber: "border-marker-amber",
  moss: "border-marker-moss",
};

/** A stable, well-spread number for a string (FNV-1a). */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

/** The marker colour that belongs to an ID. */
export function markerFor(id: string): Marker {
  return MARKERS[hash(id) % MARKERS.length];
}

/** `Maya Pratama` → `MP`, `maya` → `M`, empty → `?`. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}
