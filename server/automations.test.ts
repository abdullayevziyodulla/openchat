import { describe, expect, it } from "vitest";
import { matchAutomationKeywords, renderAutomationMessage } from "./automations";

describe("Instagram automation matching", () => {
  it("matches Unicode whole words without matching inside another word", () => {
    expect(matchAutomationKeywords("Please send the GUIDE!", ["guide"])).toBe("guide");
    expect(matchAutomationKeywords("guided tour", ["guide"])).toBeNull();
    expect(matchAutomationKeywords("менга НАРХ керак", ["нарх"])).toBe("нарх");
  });

  it("supports partial matching and username personalization", () => {
    expect(matchAutomationKeywords("price-list", ["price"], false)).toBe("price");
    expect(renderAutomationMessage("Hi {username}, your link is ready.", "dilnoza")).toBe("Hi dilnoza, your link is ready.");
    expect(renderAutomationMessage("Hi {username}")).toBe("Hi there");
  });
});
