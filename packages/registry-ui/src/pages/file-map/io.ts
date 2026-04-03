export async function loadHostedReportText(
  baseUrl = "/git-conflicts.json",
): Promise<{ ok: true; rawText: string } | { ok: false; message: string }> {
  try {
    const response = await fetch(baseUrl, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, message: "git-conflicts.json을 찾지 못했습니다." };
    }
    return { ok: true, rawText: await response.text() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "자동 로드 실패";
    return { ok: false, message };
  }
}

export async function loadFileText(
  file: File,
): Promise<string> {
  return file.text();
}
