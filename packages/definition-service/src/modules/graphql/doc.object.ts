/**
 * GraphQL Object Types — 문서, 링크, 검증 결과
 */

import { Field, ObjectType, Int } from "@nestjs/graphql";

@ObjectType()
export class DocLink {
  @Field() target!: string;
  @Field() type!: string;
}

@ObjectType()
export class IncomingLink {
  @Field() source!: string;
  @Field() type!: string;
}

@ObjectType()
export class Doc {
  @Field() docId!: string;
  @Field() scope!: string;
  @Field() aspect!: string;
  @Field() depth!: string;
  @Field() lifecycle!: string;
  @Field({ nullable: true }) layer?: string;
  @Field(() => [String]) tags!: string[];
  @Field(() => [DocLink]) links!: DocLink[];
  @Field({ nullable: true }) svc?: string;
  @Field({ nullable: true }) address?: string;
  @Field(() => Int) version!: number;
  @Field({ nullable: true }) purpose?: string;
  @Field({ nullable: true }) intent?: string;
  @Field({ nullable: true }) context?: string;
  @Field({ nullable: true }) caveat?: string;
  @Field({ nullable: true }) sourcePath?: string;

  // resolver에서 채우는 관계 필드
  @Field(() => [Doc], { nullable: true }) children?: Doc[];
  @Field(() => Doc, { nullable: true }) parent?: Doc | null;
  @Field(() => [IncomingLink], { nullable: true }) incomingLinks?: IncomingLink[];
}

@ObjectType()
export class ImpactedDoc {
  @Field() docId!: string;
  @Field() scope!: string;
  @Field({ nullable: true }) layer?: string;
  @Field() path!: string;
  @Field(() => Int) distance!: number;
}

@ObjectType()
export class ImpactAnalysisResult {
  @Field() sourceId!: string;
  @Field(() => [ImpactedDoc]) impacted!: ImpactedDoc[];
  @Field(() => Int) blastRadius!: number;
}

@ObjectType()
export class ConcernItem {
  @Field() tag!: string;
  @Field() source!: string;
}

@ObjectType()
export class ConcernsResult {
  @Field() docId!: string;
  @Field(() => [String]) direct!: string[];
  @Field(() => [ConcernItem]) inherited!: ConcernItem[];
  @Field(() => [String]) all!: string[];
}

@ObjectType()
export class ValidationIssueItem {
  @Field() severity!: string;
  @Field() type!: string;
  @Field() docId!: string;
  @Field() message!: string;
}

@ObjectType()
export class ValidationResultType {
  @Field(() => [ValidationIssueItem]) issues!: ValidationIssueItem[];
  @Field(() => Int) errors!: number;
  @Field(() => Int) warnings!: number;
  @Field() passed!: boolean;
}
