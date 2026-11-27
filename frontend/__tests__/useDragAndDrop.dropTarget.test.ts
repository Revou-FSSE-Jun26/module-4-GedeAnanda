import { act, renderHook } from "@testing-library/react";
import { useState, type DragEvent } from "react";

import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import type { ColumnWithCards } from "@/types";

jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ token: "jwt" }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError: jest.fn() }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { patch: jest.fn(() => new Promise(() => {})) } }));

const columns: ColumnWithCards[] = [
  { id: "todo", board_id: "board", name: "To Do", order: 1024, is_done: false, cards: [] },
  { id: "done", board_id: "board", name: "Done", order: 2048, is_done: true, cards: [] },
];

/** The parts of a drag event the hook touches. */
function dragEvent(cardId = "") {
  return {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer: { setData: jest.fn(), getData: () => cardId, effectAllowed: "", dropEffect: "" },
  } as unknown as DragEvent;
}

function setup() {
  return renderHook(() => {
    const [state, setState] = useState(columns);
    return useDragAndDrop(state, setState);
  });
}

// REQ-33.6: the board can show where a dragged card is and where it will land.
describe("useDragAndDrop drop target", () => {
  it("has no dragged card and no drop target at rest", () => {
    const { result } = setup();

    expect(result.current.draggingId).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it("reports the column and the card under the pointer while dragging", () => {
    const { result } = setup();

    act(() => result.current.onDragStart(dragEvent(), "a"));
    act(() => result.current.onDragOver(dragEvent(), "done", "x"));

    expect(result.current.draggingId).toBe("a");
    expect(result.current.dropTarget).toEqual({ columnId: "done", beforeCardId: "x" });
  });

  it("means the end of the column when the pointer is over the column itself", () => {
    const { result } = setup();

    act(() => result.current.onDragOver(dragEvent(), "done"));

    expect(result.current.dropTarget).toEqual({ columnId: "done", beforeCardId: null });
  });

  it("keeps the same target object while the pointer stays put, so the board does not re-render", () => {
    const { result } = setup();

    act(() => result.current.onDragOver(dragEvent(), "done", "x"));
    const first = result.current.dropTarget;
    act(() => result.current.onDragOver(dragEvent(), "done", "x"));

    expect(result.current.dropTarget).toBe(first);
  });

  it("always allows the drop, even when no target is named", () => {
    const { result } = setup();
    const event = dragEvent();

    act(() => result.current.onDragOver(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.dropTarget).toBeNull();
  });

  it("clears both marks when the card is dropped", () => {
    const { result } = setup();
    act(() => result.current.onDragStart(dragEvent(), "a"));
    act(() => result.current.onDragOver(dragEvent(), "done"));

    act(() => result.current.onDrop(dragEvent("a"), "done"));

    expect(result.current.draggingId).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });

  it("clears both marks when the drag is cancelled", () => {
    const { result } = setup();
    act(() => result.current.onDragStart(dragEvent(), "a"));
    act(() => result.current.onDragOver(dragEvent(), "done"));

    act(() => result.current.onDragEnd());

    expect(result.current.draggingId).toBeNull();
    expect(result.current.dropTarget).toBeNull();
  });
});
