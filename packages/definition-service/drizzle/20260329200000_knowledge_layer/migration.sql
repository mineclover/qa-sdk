-- 지식 문서 계층 + level 3단계 마이그레이션
-- spec vs knowledge 구분, knowledge_kind 6종 지원
-- level: system/area/unit → group, module → module, leaf → leaf

-- 1. documents 테이블에 doc_type, knowledge_kind 컬럼 추가
ALTER TABLE `documents` ADD COLUMN `doc_type` text;
ALTER TABLE `documents` ADD COLUMN `knowledge_kind` text;

-- 2. document_history 테이블에도 동일 추가
ALTER TABLE `document_history` ADD COLUMN `doc_type` text;
ALTER TABLE `document_history` ADD COLUMN `knowledge_kind` text;

-- 3. level 값 마이그레이션 (구 5종 → 신 3종)
UPDATE `documents` SET `level` = 'group' WHERE `level` IN ('system', 'area');
UPDATE `documents` SET `level` = 'module' WHERE `level` = 'unit';
UPDATE `document_history` SET `level` = 'group' WHERE `level` IN ('system', 'area');
UPDATE `document_history` SET `level` = 'module' WHERE `level` = 'unit';

-- 4. doc_type 인덱스 (knowledge 문서 쿼리 지원)
CREATE INDEX IF NOT EXISTS `idx_doc_type` ON `documents` (`doc_type`);
CREATE INDEX IF NOT EXISTS `idx_doc_knowledge_kind` ON `documents` (`knowledge_kind`);
CREATE INDEX IF NOT EXISTS `idx_doc_level` ON `documents` (`level`);
