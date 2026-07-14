// @def.boundary infra-engine-system
// @def.doc infra-engine-system

import type { CommandHandler } from 'cli-command';

/** config show — 현재 설정 출력 */
export const configShowHandler: CommandHandler = async (_ctx) => {
  const { loadInfraConfig, formatConfig } = await import('../commands/config-manager.js');
  const cfg = await loadInfraConfig();
  console.log(`\n=== 인프라 설정 ===\n`);
  console.log(formatConfig(cfg));
  console.log('');
};

/** config use <profile> — 프로필 전환 */
export const configUseHandler: CommandHandler = async (ctx) => {
  const { switchProfile, formatConfig, listPresets } =
    await import('../commands/config-manager.js');
  const profile = ctx.args.profile;
  if (!profile) {
    console.log(`사용 가능한 프로필: ${listPresets().join(', ')}`);
    process.exit(1);
  }
  const cfg = await switchProfile(profile);
  console.log(`\n프로필 전환: ${profile}\n`);
  console.log(formatConfig(cfg));
  console.log('');
};

/** config set <field> <value> — 필드 변경 */
export const configSetHandler: CommandHandler = async (ctx) => {
  const { setConfigField, formatConfig } = await import('../commands/config-manager.js');
  const field = ctx.args.field;
  const value = ctx.args.value;
  if (!field || !value) {
    console.error('사용: infra config set <field> <value>');
    console.error(
      '필드: backend, k8s-context, registry, ingest, definition, ingest-store, s3-endpoint, s3-bucket',
    );
    process.exit(1);
  }
  const cfg = await setConfigField(field, value);
  console.log(`\n${field} = ${value}\n`);
  console.log(formatConfig(cfg));
  console.log('');
};

/** config presets — 프리셋 목록 */
export const configPresetsHandler: CommandHandler = async (_ctx) => {
  const { listPresets, getPreset } = await import('../commands/config-manager.js');
  console.log('\n=== 프로필 프리셋 ===\n');
  for (const name of listPresets()) {
    const p = getPreset(name)!;
    console.log(`  [${name}]`);
    console.log(`    backend: ${p.backend}${p.s3Endpoint ? ` (${p.s3Endpoint})` : ''}`);
    console.log(`    services: ${p.services.registry}`);
    console.log('');
  }
};
