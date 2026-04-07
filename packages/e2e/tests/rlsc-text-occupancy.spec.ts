import { test, expect } from "@playwright/test";

/**
 * RLSC 텍스트 점유 분석 E2E 테스트
 *
 * - collectLayoutWithText → analyzeTextOccupancy 파이프라인 전체 검증
 * - 반응형 예측: 같은 prepared에 다른 width → lineCount 변화 검증
 */

/** 수집 완료 대기: status-text가 "Collected"로 변경될 때까지 */
async function waitForCollection(page: import("@playwright/test").Page) {
  await expect(page.locator("#status-text")).toHaveText("Collected", {
    timeout: 10_000,
  });
}

/** Text 탭으로 전환 */
async function switchToTextTab(page: import("@playwright/test").Page) {
  await page.locator('.tab[data-tab="text"]').click();
  await expect(page.locator("#panel-text")).toHaveClass(/active/);
}

test.describe("RLSC Text Occupancy", () => {
  test("collectLayoutWithText → analyzeTextOccupancy pipeline full validation", async ({
    page,
  }) => {
    await page.goto("/rlsc.html");

    // 페이지 로드 시 자동으로 runCollection()이 호출됨 (200ms 딜레이)
    await waitForCollection(page);

    // Text 탭으로 전환
    await switchToTextTab(page);

    const panel = page.locator("#panel-text");

    // 텍스트 점유 데이터가 렌더링되었는지 확인 (빈 상태 메시지가 아닌 실제 콘텐츠)
    await expect(panel).not.toContainText("텍스트 분석 데이터 없음", {
      timeout: 5_000,
    });
    await expect(panel).not.toContainText("Collect to view text occupancy");

    // 요약 섹션 확인: "텍스트 노드" 키워드가 포함되어야 함
    await expect(panel).toContainText("텍스트 노드");

    // 평균 점유율 섹션 존재 확인
    await expect(panel).toContainText("평균 x 점유율");
    await expect(panel).toContainText("평균 y 점유율");

    // 텍스트 노드 수가 1 이상인지 확인
    // "텍스트 노드" 행의 값을 추출
    const summaryText = await panel
      .locator(".metrics-section")
      .first()
      .textContent();
    expect(summaryText).toBeTruthy();

    // 노드별 상세: data-nid 속성을 가진 요소가 1개 이상 존재
    const nodeItems = panel.locator("[data-nid]");
    const nodeCount = await nodeItems.count();
    expect(nodeCount).toBeGreaterThan(0);

    // 각 노드 항목에 fillX/fillY 바 시각화가 존재하는지 확인 (X, Y 레이블)
    const firstNode = nodeItems.first();
    await expect(firstNode).toContainText("줄");
    await expect(firstNode).toContainText("natural");

    // 영역별 밀도 섹션 확인
    await expect(panel).toContainText("영역별 텍스트 밀도");

    // 경계 접촉 노드 섹션 확인
    await expect(panel).toContainText("경계 접촉 노드");

    // 오버플로우 노드 섹션 확인
    await expect(panel).toContainText("오버플로우 노드");
  });

  test("responsive prediction: different widths → lineCount change", async ({
    page,
  }) => {
    // 넓은 뷰포트에서 수집
    const wideWidth = 1280;
    const narrowWidth = 400;
    const viewportHeight = 720;

    await page.setViewportSize({ width: wideWidth, height: viewportHeight });
    await page.goto("/rlsc.html");
    await waitForCollection(page);
    await switchToTextTab(page);

    const panel = page.locator("#panel-text");
    await expect(panel).toContainText("텍스트 노드", { timeout: 5_000 });

    // 넓은 뷰포트에서 각 텍스트 노드의 lineCount 수집
    const wideLineCounts = await panel
      .locator("[data-nid]")
      .evaluateAll((nodes) =>
        nodes.map((el) => {
          // "N줄" 패턴에서 숫자 추출
          const match = el.textContent?.match(/(\d+)줄/);
          return {
            nid: (el as HTMLElement).dataset["nid"] ?? "",
            lineCount: match ? parseInt(match[1]!, 10) : 0,
          };
        }),
      );

    expect(wideLineCounts.length).toBeGreaterThan(0);

    // 좁은 뷰포트로 변경 → resize 이벤트가 자동으로 runCollection 재실행 (300ms 딜레이)
    await page.setViewportSize({ width: narrowWidth, height: viewportHeight });

    // resize 이벤트 후 재수집 대기 (300ms 딜레이 + 렌더링)
    // status가 일시적으로 변할 수 있으므로 Collected 상태 재확인
    await page.waitForTimeout(500);
    await waitForCollection(page);

    // Text 탭이 여전히 활성 상태인지 확인
    await expect(page.locator("#panel-text")).toHaveClass(/active/);

    // 좁은 뷰포트에서 lineCount 재수집
    const narrowLineCounts = await panel
      .locator("[data-nid]")
      .evaluateAll((nodes) =>
        nodes.map((el) => {
          const match = el.textContent?.match(/(\d+)줄/);
          return {
            nid: (el as HTMLElement).dataset["nid"] ?? "",
            lineCount: match ? parseInt(match[1]!, 10) : 0,
          };
        }),
      );

    expect(narrowLineCounts.length).toBeGreaterThan(0);

    // 최소 1개 이상의 텍스트 노드에서 lineCount가 변화했는지 검증
    // 좁은 뷰포트에서는 텍스트가 더 많은 줄로 줄 바꿈되어야 함
    let changedCount = 0;
    for (const narrow of narrowLineCounts) {
      const wide = wideLineCounts.find((w) => w.nid === narrow.nid);
      if (wide && narrow.lineCount !== wide.lineCount) {
        changedCount++;
      }
    }

    // 적어도 하나의 텍스트 노드에서 lineCount 변화가 있어야 함
    expect(changedCount).toBeGreaterThan(0);

    // 좁은 뷰포트에서 lineCount가 증가한 노드가 있는지 확인
    // (텍스트가 좁은 공간에서 더 많은 줄로 감싸짐)
    let increasedCount = 0;
    for (const narrow of narrowLineCounts) {
      const wide = wideLineCounts.find((w) => w.nid === narrow.nid);
      if (wide && narrow.lineCount > wide.lineCount) {
        increasedCount++;
      }
    }
    expect(increasedCount).toBeGreaterThan(0);
  });
});
