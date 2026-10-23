import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepoPicker } from "./RepoPicker";
import type { GitHubRepo } from "../api/github";

const repos: GitHubRepo[] = [
  { full_name: "octocat/Hello-World", owner: "octocat", name: "Hello-World", private: false },
  { full_name: "octocat/Secret-Repo", owner: "octocat", name: "Secret-Repo", private: true },
  { full_name: "acme-org/widgets", owner: "acme-org", name: "widgets", private: false },
];

afterEach(() => {
  cleanup();
});

describe("RepoPicker", () => {
  it("shows the placeholder when nothing is selected", () => {
    render(<RepoPicker repos={repos} value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select a repository")).toBeInTheDocument();
  });

  it("does not list any repos until opened", () => {
    render(<RepoPicker repos={repos} value="" onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText("Search repos…")).not.toBeInTheDocument();
    expect(screen.queryByText("octocat/Hello-World")).not.toBeInTheDocument();
  });

  it("lists every repo, including org-owned ones, once opened", () => {
    render(<RepoPicker repos={repos} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /select a repository/i }));

    expect(screen.getByText("octocat/Hello-World")).toBeInTheDocument();
    expect(screen.getByText("octocat/Secret-Repo")).toBeInTheDocument();
    expect(screen.getByText("acme-org/widgets")).toBeInTheDocument();
  });

  it("filters the list as the user types", () => {
    render(<RepoPicker repos={repos} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /select a repository/i }));

    fireEvent.change(screen.getByPlaceholderText("Search repos…"), {
      target: { value: "acme" },
    });

    expect(screen.getByText("acme-org/widgets")).toBeInTheDocument();
    expect(screen.queryByText("octocat/Hello-World")).not.toBeInTheDocument();
  });

  it("shows a 'No repos found' message when the search matches nothing", () => {
    render(<RepoPicker repos={repos} value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /select a repository/i }));

    fireEvent.change(screen.getByPlaceholderText("Search repos…"), {
      target: { value: "no-such-repo" },
    });

    expect(screen.getByText("No repos found")).toBeInTheDocument();
  });

  it("calls onChange and closes the dropdown when a repo is picked", () => {
    const onChange = vi.fn();
    render(<RepoPicker repos={repos} value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /select a repository/i }));

    fireEvent.click(screen.getByText("acme-org/widgets"));

    expect(onChange).toHaveBeenCalledWith("acme-org/widgets");
    expect(screen.queryByPlaceholderText("Search repos…")).not.toBeInTheDocument();
  });

  it("shows the selected repo's name and a lock icon for private repos", () => {
    render(<RepoPicker repos={repos} value="octocat/Secret-Repo" onChange={vi.fn()} />);
    expect(screen.getByText("octocat/Secret-Repo")).toBeInTheDocument();
    expect(screen.queryByText("Select a repository")).not.toBeInTheDocument();
  });

  it("closes when clicking outside the picker", () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <RepoPicker repos={repos} value="" onChange={vi.fn()} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /select a repository/i }));
    expect(screen.getByPlaceholderText("Search repos…")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByPlaceholderText("Search repos…")).not.toBeInTheDocument();
  });
});
