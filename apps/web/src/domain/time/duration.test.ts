import { describe, expect, it } from "vitest";
import { parseHoursInput } from "@/domain/time/duration";

describe("parseHoursInput", () => {
  it("rejects values that overflow milliseconds", () => {
    expect(parseHoursInput("1e308")).toBeNull();
    expect(parseHoursInput(`${"9".repeat(400)}:00`)).toBeNull();
  });

  it("rejects non-decimal numeric syntaxes", () => {
    expect(parseHoursInput("0x10")).toBeNull();
    expect(parseHoursInput("1e3")).toBeNull();
  });
});
