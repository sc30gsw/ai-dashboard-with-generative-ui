// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";

import { ThemeSwitcher } from "~/components/layout/theme-switcher";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  cleanup();
});

test("renders a button for each theme option", () => {
  render(<ThemeSwitcher />);

  expect(screen.getByRole("button", { name: "Light theme" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Dark theme" })).toBeDefined();
  expect(screen.getByRole("button", { name: "System theme" })).toBeDefined();
});

test("switching to dark persists the choice and applies the dark class to <html>", () => {
  render(<ThemeSwitcher />);

  fireEvent.click(screen.getByRole("button", { name: "Dark theme" }));

  expect(localStorage.getItem("heroui-theme")).toBe("dark");
  expect(document.documentElement.classList.contains("dark")).toBe(true);
});

test("switching to light persists the choice and applies the light class to <html>", () => {
  render(<ThemeSwitcher />);

  fireEvent.click(screen.getByRole("button", { name: "Light theme" }));

  expect(localStorage.getItem("heroui-theme")).toBe("light");
  expect(document.documentElement.classList.contains("light")).toBe(true);
});
