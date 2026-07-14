// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { toRoleId } from './role.ids.js';
import { InvalidRoleInputException } from './role.exceptions.js';
import type { RoleProps, RoleScopeType, RoleSnapshot } from './role.types.js';

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Role Aggregate Root.
 *
 * - private constructor + named factories (create / rehydrate)
 * - 모든 transition 은 새 인스턴스 반환
 * - invariants:
 *     · name 비어 있으면 ValidationError
 *     · defaultMaskHex 가 hex 패턴이 아니면 ValidationError
 */
export class RoleEntity {
  private constructor(private readonly props: RoleProps) {}

  static create(input: {
    readonly id: string;
    readonly name: string;
    readonly scopeType: RoleScopeType;
    readonly defaultMaskHex: string;
    readonly now?: Date;
  }): RoleEntity {
    if (input.name.trim().length === 0) {
      throw new InvalidRoleInputException('Role name must not be empty.');
    }
    if (!HEX_PATTERN.test(input.defaultMaskHex)) {
      throw new InvalidRoleInputException(`defaultMaskHex must be hex: ${input.defaultMaskHex}`);
    }
    const now = input.now ?? new Date();
    return new RoleEntity({
      id: toRoleId(input.id),
      name: input.name,
      scopeType: input.scopeType,
      defaultMaskHex: input.defaultMaskHex.toLowerCase(),
      createdAt: now,
    });
  }

  static rehydrate(snapshot: RoleSnapshot): RoleEntity {
    return new RoleEntity({
      id: toRoleId(snapshot.id),
      name: snapshot.name,
      scopeType: snapshot.scopeType,
      defaultMaskHex: snapshot.defaultMaskHex,
      createdAt: new Date(snapshot.createdAt),
    });
  }

  toSnapshot(): RoleSnapshot {
    return {
      id: this.props.id,
      name: this.props.name,
      scopeType: this.props.scopeType,
      defaultMaskHex: this.props.defaultMaskHex,
      createdAt: this.props.createdAt.toISOString(),
    };
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }
}
