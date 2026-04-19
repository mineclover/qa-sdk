// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import type { SchemaDef, SchemaAxis, SchemaConstraint } from "./schema.types.js";
import type { SchemaRegistry } from "./schema.registry.js";
import type { ValidationErrorDetail } from "./shared/errors.js";

type ValidationInputValue =
  | string
  | number
  | boolean
  | null
  | readonly ValidationInputValue[]
  | { readonly [key: string]: ValidationInputValue };

type ValidationInputMap = Record<string, ValidationInputValue>;

/** 검증 결과 */
export interface ValidationResult {
  valid: boolean;
  errors: readonly ValidationErrorDetail[];
}

/**
 * Layer 0 → 1 → 2 순서로 구조 검증을 수행하는 validator.
 *
 * - Layer 0: vocabulary 값 유효성 (축 이름 존재, 타입 일치)
 * - Layer 1: 좌표 구조 정규성 (unknown axis 검출)
 * - Layer 2: 구조적 제약 (required, cardinality, exclusive)
 *
 * 의미적 규칙(Layer 3)은 이 validator의 범위 밖이다.
 *
 * 순수 TypeScript — NestJS 의존 없음.
 */
export class SchemaValidator {
  constructor(private readonly registry: SchemaRegistry) {}

  /**
   * 데이터를 스키마에 대해 검증한다.
   * fragment를 resolve한 완전한 스키마 기준으로 검증.
   */
  validate(
    schemaId: string,
    data: ValidationInputMap,
  ): ValidationResult {
    const schema = this.registry.resolveSchema(schemaId);
    const errors: ValidationErrorDetail[] = [];

    errors.push(...this.validateLayer0(schema, data));
    errors.push(...this.validateLayer1(schema, data));
    errors.push(...this.validateLayer2(schema, data));

    return { valid: errors.length === 0, errors };
  }

  /** Layer 0: vocabulary 값 유효성 */
  private validateLayer0(
    schema: SchemaDef,
    data: ValidationInputMap,
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];

    for (const [key, value] of Object.entries(data)) {
      const axis = schema.axes[key];
      if (!axis) continue; // Layer 1에서 처리

      const typeErrors = this.validateAxisType(axis, key, value);
      errors.push(...typeErrors);
    }

    return errors;
  }

  /** Layer 1: 좌표 구조 정규성 (unknown axis 검출) */
  private validateLayer1(
    schema: SchemaDef,
    data: ValidationInputMap,
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];

    for (const key of Object.keys(data)) {
      if (!(key in schema.axes)) {
        errors.push({
          layer: 1,
          axis: key,
          rule: "unknownAxis",
          message: `Unknown axis "${key}" — not defined in schema "${schema.id}"`,
        });
      }
    }

    return errors;
  }

  /** Layer 2: 구조적 제약 */
  private validateLayer2(
    schema: SchemaDef,
    data: ValidationInputMap,
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];

    // required 검사
    for (const [key, axis] of Object.entries(schema.axes)) {
      if (axis.required && !(key in data)) {
        errors.push({
          layer: 2,
          axis: key,
          rule: "required",
          message: `Required axis "${key}" is missing`,
        });
      }
    }

    // constraint 검사
    if (schema.constraints) {
      for (const constraint of schema.constraints) {
        const constraintErrors = this.validateConstraint(constraint, data);
        errors.push(...constraintErrors);
      }
    }

    return errors;
  }

  /** 축의 값 타입 검증 */
  private validateAxisType(
    axis: SchemaAxis,
    key: string,
    value: ValidationInputValue,
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];

    switch (axis.valueType) {
      case "vocabulary":
      case "literal":
        if (typeof value !== "string" && typeof value !== "number") {
          errors.push({
            layer: 0,
            axis: key,
            rule: "type",
            message: `Axis "${key}" expects string or number, got ${typeof value}`,
          });
        }
        break;
      case "ref":
        if (typeof value !== "string" && typeof value !== "number") {
          errors.push({
            layer: 0,
            axis: key,
            rule: "type",
            message: `Axis "${key}" (ref) expects string or number identifier, got ${typeof value}`,
          });
        }
        break;
      case "coordinate":
        if (typeof value !== "string" && typeof value !== "number") {
          errors.push({
            layer: 0,
            axis: key,
            rule: "type",
            message: `Axis "${key}" (coordinate) expects address string or number, got ${typeof value}`,
          });
        }
        break;
    }

    // multi 검사: 배열이 허용되는 경우
    if (axis.multi && Array.isArray(value)) {
      // 배열 허용 — 개별 원소 검증은 재귀적으로 할 수 있으나 초기에는 skip
    } else if (!axis.multi && Array.isArray(value)) {
      errors.push({
        layer: 0,
        axis: key,
        rule: "multi",
        message: `Axis "${key}" does not allow multiple values`,
      });
    }

    return errors;
  }

  /** 개별 constraint 검증 */
  private validateConstraint(
    constraint: SchemaConstraint,
    data: ValidationInputMap,
  ): ValidationErrorDetail[] {
    const errors: ValidationErrorDetail[] = [];
    const value = data[constraint.axis];

    switch (constraint.rule) {
      case "maxCount": {
        if (Array.isArray(value) && constraint.value !== undefined && value.length > constraint.value) {
          errors.push({
            layer: 2,
            axis: constraint.axis,
            rule: "maxCount",
            message: `Axis "${constraint.axis}" has ${value.length} values, max is ${constraint.value}`,
          });
        }
        break;
      }
      case "minCount": {
        if (Array.isArray(value) && constraint.value !== undefined && value.length < constraint.value) {
          errors.push({
            layer: 2,
            axis: constraint.axis,
            rule: "minCount",
            message: `Axis "${constraint.axis}" has ${value.length} values, min is ${constraint.value}`,
          });
        }
        break;
      }
      case "requiredIf": {
        if (constraint.condition) {
          const condValue = data[constraint.condition.axis];
          if (condValue === constraint.condition.value && !(constraint.axis in data)) {
            errors.push({
              layer: 2,
              axis: constraint.axis,
              rule: "requiredIf",
              message: `Axis "${constraint.axis}" is required when "${constraint.condition.axis}" is "${constraint.condition.value}"`,
            });
          }
        }
        break;
      }
      case "exclusive": {
        // exclusive: 이 축이 존재하면 다른 특정 축과 동시에 존재할 수 없음
        // 초기 구현에서는 단일 축 존재 여부만 체크
        break;
      }
    }

    return errors;
  }
}
