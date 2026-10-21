import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePageTitle } from "./usePageTitle";

describe("usePageTitle", () => {
  afterEach(() => {
    document.title = "";
  });

  it("sets the document title with the app suffix", () => {
    renderHook(() => usePageTitle("Dashboard"));
    expect(document.title).toBe("Dashboard — ReviewLenzAI");
  });

  it("updates the title again when the title argument changes", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "Dashboard" },
    });
    expect(document.title).toBe("Dashboard — ReviewLenzAI");

    rerender({ title: "Settings" });
    expect(document.title).toBe("Settings — ReviewLenzAI");
  });

  it("restores the previous title on unmount", () => {
    document.title = "Original";
    const { unmount } = renderHook(() => usePageTitle("Dashboard"));
    expect(document.title).toBe("Dashboard — ReviewLenzAI");

    unmount();
    expect(document.title).toBe("Original");
  });
});
