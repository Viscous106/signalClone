import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CallsPage from "@/app/(app)/calls/page";
import StoriesPage from "@/app/(app)/stories/page";
import { ComingSoon } from "./ComingSoon";

describe("ComingSoon", () => {
  it("says plainly that the feature is not built", () => {
    render(<ComingSoon title="No calls" blurb="Not in this build." />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});

describe("the stubbed sections the brief names", () => {
  it("Calls has a placeholder", () => {
    render(<CallsPage />);
    expect(screen.getByText("No calls")).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });

  it("Stories has a placeholder", () => {
    render(<StoriesPage />);
    expect(screen.getByText("No stories")).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  });
});
