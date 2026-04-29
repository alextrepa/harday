import { describe, expect, it } from "vitest";
import {
  getSharedTableDragTolerance,
  shouldStartSharedTableDrag,
} from "./table-drag";

describe("getSharedTableDragTolerance", () => {
  it("uses the same mouse tolerance as backlog drag", () => {
    expect(getSharedTableDragTolerance("mouse")).toBe(4);
  });

  it("uses the same touch tolerance as backlog drag", () => {
    expect(getSharedTableDragTolerance("touch")).toBe(8);
  });
});

describe("shouldStartSharedTableDrag", () => {
  it("does not start when movement stays within tolerance", () => {
    expect(
      shouldStartSharedTableDrag({
        pointerType: "mouse",
        originX: 10,
        originY: 10,
        currentX: 13,
        currentY: 12,
      }),
    ).toBe(false);
  });

  it("starts once movement exceeds the shared tolerance", () => {
    expect(
      shouldStartSharedTableDrag({
        pointerType: "mouse",
        originX: 10,
        originY: 10,
        currentX: 15,
        currentY: 10,
      }),
    ).toBe(true);
  });
});
