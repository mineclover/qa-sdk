-- verdict_reports에 경로 관측 컬럼 추가
-- path_observation: PathObservation 전체 객체 (report JSONB에도 포함되지만 직접 조회용)
-- loop_detected: 루프 여부 (필터링 쿼리용)
-- terminal_reason: 종료 사유 (필터링 쿼리용)

ALTER TABLE "verdict_reports" ADD COLUMN "path_observation" jsonb;--> statement-breakpoint
ALTER TABLE "verdict_reports" ADD COLUMN "loop_detected" boolean;--> statement-breakpoint
ALTER TABLE "verdict_reports" ADD COLUMN "terminal_reason" text;--> statement-breakpoint
CREATE INDEX "idx_verdict_reports_loop_detected" ON "verdict_reports" USING btree ("loop_detected");--> statement-breakpoint
CREATE INDEX "idx_verdict_reports_terminal_reason" ON "verdict_reports" USING btree ("terminal_reason");
