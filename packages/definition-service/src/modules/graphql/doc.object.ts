/**
 * GraphQL Object Types — 문서, 링크, 검증 결과
 *
 * tsx(esbuild)에서 emitDecoratorMetadata가 동작하지 않으므로
 * 모든 @Field()에 type을 명시적으로 지정한다.
 */

import { Field, ObjectType, Int } from "@nestjs/graphql";

@ObjectType()
export class DocLink {
  @Field(() => String) target!: string;
  @Field(() => String) type!: string;
}

@ObjectType()
export class IncomingLink {
  @Field(() => String) source!: string;
  @Field(() => String) type!: string;
}

@ObjectType()
export class Doc {
  @Field(() => String) docId!: string;
  @Field(() => String) scope!: string;
  @Field(() => String) aspect!: string;
  @Field(() => String) depth!: string;
  @Field(() => String) lifecycle!: string;
  @Field(() => String, { nullable: true }) layer?: string;
  @Field(() => [String]) tags!: string[];
  @Field(() => [DocLink]) links!: DocLink[];
  @Field(() => String, { nullable: true }) svc?: string;
  @Field(() => String, { nullable: true }) address?: string;
  @Field(() => Int) version!: number;
  @Field(() => String, { nullable: true }) purpose?: string;
  @Field(() => String, { nullable: true }) intent?: string;
  @Field(() => String, { nullable: true }) context?: string;
  @Field(() => String, { nullable: true }) caveat?: string;
  @Field(() => String, { nullable: true }) sourcePath?: string;

  @Field(() => [Doc], { nullable: true }) children?: Doc[];
  @Field(() => Doc, { nullable: true }) parent?: Doc | null;
  @Field(() => [IncomingLink], { nullable: true }) incomingLinks?: IncomingLink[];
}

@ObjectType()
export class ImpactedDoc {
  @Field(() => String) docId!: string;
  @Field(() => String) scope!: string;
  @Field(() => String, { nullable: true }) layer?: string;
  @Field(() => String) path!: string;
  @Field(() => Int) distance!: number;
}

@ObjectType()
export class ImpactAnalysisResult {
  @Field(() => String) sourceId!: string;
  @Field(() => [ImpactedDoc]) impacted!: ImpactedDoc[];
  @Field(() => Int) blastRadius!: number;
}

@ObjectType()
export class ConcernItem {
  @Field(() => String) tag!: string;
  @Field(() => String) source!: string;
}

@ObjectType()
export class ConcernsResult {
  @Field(() => String) docId!: string;
  @Field(() => [String]) direct!: string[];
  @Field(() => [ConcernItem]) inherited!: ConcernItem[];
  @Field(() => [String]) all!: string[];
}

@ObjectType()
export class ValidationIssueItem {
  @Field(() => String) severity!: string;
  @Field(() => String) type!: string;
  @Field(() => String) docId!: string;
  @Field(() => String) message!: string;
}

@ObjectType()
export class ValidationResultType {
  @Field(() => [ValidationIssueItem]) issues!: ValidationIssueItem[];
  @Field(() => Int) errors!: number;
  @Field(() => Int) warnings!: number;
  @Field(() => Boolean) passed!: boolean;
}
