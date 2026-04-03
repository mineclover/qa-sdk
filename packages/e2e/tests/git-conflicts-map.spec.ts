import { test, expect } from "@playwright/test";

const REGISTRY_UI_URL = "http://localhost:5230/#file-map";

test.describe("git conflicts file map", () => {
  test("hosted report를 자동 로드하고 작업중만 필터를 활성화한다", async ({ page }) => {
    await page.goto(REGISTRY_UI_URL, { waitUntil: "domcontentloaded" });

    const workspaceToggle = page.getByRole("button", { name: "작업중만" });
    await workspaceToggle.click();
    await expect(workspaceToggle).toHaveClass(/is-active/);
    await expect(page.locator("#fmap-canvas svg")).toBeVisible();

    const drawerToggle = page.getByRole("button", { name: "정보 패널 펼치기" });
    await drawerToggle.click();

    await expect(page.getByRole("heading", { name: "파일 구조 시각화" })).toBeVisible();
    await expect(page.getByText("호스팅된 git-conflicts.json을 불러왔습니다.")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("workspace:(repo)")).toBeVisible();

    await expect(page.getByText("작업중 변경", { exact: true })).toBeVisible();
    await expect(page.getByText("실행 위치 변경", { exact: true })).toBeVisible();
    await expect(page.getByText("packages/cli/src/commands/git-conflicts.ts")).toBeVisible();
    await expect(page.getByRole("button", { name: "자동 새로고침 끄기" })).toBeVisible();
  });
});
