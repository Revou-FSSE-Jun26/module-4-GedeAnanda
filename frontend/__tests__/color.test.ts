import { MARKERS, initials, markerFor } from "@/lib/color";

describe("markerFor", () => {
  it("gives the same colour for the same ID every time", () => {
    const id = "5b2fac8b-76bf-40a4-9dd5-53087e96ab90";

    expect(markerFor(id)).toBe(markerFor(id));
    expect(MARKERS).toContain(markerFor(id));
  });

  it("spreads IDs over all six colours", () => {
    const used = new Set(Array.from({ length: 200 }, (_, index) => markerFor(`id-${index}`)));

    expect(used.size).toBe(MARKERS.length);
  });
});

describe("initials", () => {
  it.each([
    ["Maya Pratama", "MP"],
    ["maya", "M"],
    ["  Gede   Ananda  Putra ", "GP"],
    ["", "?"],
    ["   ", "?"],
  ])("turns %p into %p", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
