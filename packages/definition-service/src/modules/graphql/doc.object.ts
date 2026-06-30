// @def.doc definition-service

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
  @Field(() => String, { nullable: true }) sourceAddress?: string;
  @Field(() => String, { nullable: true }) targetAddress?: string;
}

@ObjectType()
export class IncomingLink {
  @Field(() => String) source!: string;
  @Field(() => String) type!: string;
  @Field(() => String, { nullable: true }) sourceAddress?: string;
  @Field(() => String, { nullable: true }) targetAddress?: string;
}

@ObjectType()
export class SyntheticIncomingLink {
  @Field(() => String) source!: string;
  @Field(() => String) type!: string;
  @Field(() => String) kind!: string;
  @Field(() => Boolean) synthetic!: boolean;
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => String, { nullable: true }) createdAt?: string;
  @Field(() => String, { nullable: true }) targetModel?: string | null;
}

@ObjectType()
export class FeedbackRequestSummary {
  @Field(() => String) id!: string;
  @Field(() => String) createdAt!: string;
  @Field(() => String) purpose!: string;
  @Field(() => String, { nullable: true }) targetModel?: string | null;
  @Field(() => String) status!: string;
  @Field(() => String, { nullable: true }) serviceScope?: string | null;
}

@ObjectType()
export class BoundaryDoc {
  @Field(() => String) docId!: string;
  @Field(() => String) title!: string;
  @Field(() => String, { nullable: true }) scope?: string;
  @Field(() => String, { nullable: true }) aspect?: string;
  @Field(() => String, { nullable: true }) depth?: string;
  @Field(() => String) lifecycle!: string;
  @Field(() => String, { nullable: true }) layer?: string;
  @Field(() => String, { nullable: true }) svc?: string;
  @Field(() => String, { nullable: true }) purpose?: string;
  @Field(() => String, { nullable: true }) overview?: string;
}

@ObjectType()
export class BoundaryMember {
  @Field(() => String) docId!: string;
  @Field(() => String) title!: string;
  @Field(() => String, { nullable: true }) scope?: string;
  @Field(() => String, { nullable: true }) aspect?: string;
  @Field(() => String, { nullable: true }) depth?: string;
  @Field(() => String) summary!: string;
}

@ObjectType()
export class BoundaryOutgoingCoupling {
  @Field(() => String) type!: string;
  @Field(() => String) target!: string;
  @Field(() => String) summary!: string;
}

@ObjectType()
export class BoundaryIncomingCoupling {
  @Field(() => String) type!: string;
  @Field(() => String) source!: string;
  @Field(() => String) summary!: string;
}

@ObjectType()
export class BoundaryCouplings {
  @Field(() => [BoundaryOutgoingCoupling]) outgoing!: BoundaryOutgoingCoupling[];
  @Field(() => [BoundaryIncomingCoupling]) incoming!: BoundaryIncomingCoupling[];
}

@ObjectType()
export class BoundaryResultType {
  @Field(() => BoundaryDoc) boundary!: BoundaryDoc;
  @Field(() => [BoundaryMember]) members!: BoundaryMember[];
  @Field(() => BoundaryCouplings) couplings!: BoundaryCouplings;
}

@ObjectType()
export class BoundaryContextConcernItem {
  @Field(() => String) tag!: string;
  @Field(() => String) source!: string;
  @Field(() => String) via!: string;
}

@ObjectType()
export class BoundaryContextConcernsResultType {
  @Field(() => String) docId!: string;
  @Field(() => [String]) direct!: string[];
  @Field(() => [BoundaryContextConcernItem]) inherited!: BoundaryContextConcernItem[];
  @Field(() => [String]) all!: string[];
}

@ObjectType()
export class BoundaryContextImpactDoc {
  @Field(() => String) docId!: string;
  @Field(() => String, { nullable: true }) address?: string;
  @Field(() => String) via!: string;
  @Field(() => String) path!: string;
  @Field(() => String) direction!: string;
  @Field(() => Int) distance!: number;
  @Field(() => String, { nullable: true }) layer?: string;
  @Field(() => Boolean) crossLayer!: boolean;
}

@ObjectType()
export class BoundaryContextLayerBreakdown {
  @Field(() => Int) domain!: number;
  @Field(() => Int) operation!: number;
  @Field(() => Int) mediation!: number;
  @Field(() => Int) experience!: number;
  @Field(() => Int) unspecified!: number;
}

@ObjectType()
export class BoundaryContextImpactResultType {
  @Field(() => String) sourceId!: string;
  @Field(() => String, { nullable: true }) sourceAddress?: string;
  @Field(() => [BoundaryContextImpactDoc]) impacted!: BoundaryContextImpactDoc[];
  @Field(() => [String]) affectedGroups!: string[];
  @Field(() => Int) blastRadius!: number;
  @Field(() => BoundaryContextLayerBreakdown) byLayer!: BoundaryContextLayerBreakdown;
}

@ObjectType()
export class BoundaryContextResultType {
  @Field(() => String) mode!: string;
  @Field(() => String) level!: string;
  @Field(() => BoundaryResultType) boundary!: BoundaryResultType;
  @Field(() => BoundaryContextConcernsResultType) concerns!: BoundaryContextConcernsResultType;
  @Field(() => BoundaryContextImpactResultType) impact!: BoundaryContextImpactResultType;
  @Field(() => [FeedbackRequestSummary]) feedbackTrace!: FeedbackRequestSummary[];
}

@ObjectType()
export class QualityGate {
  @Field(() => String) kind!: string;
  @Field(() => String) workDomain!: string;
  @Field(() => String, { nullable: true }) subDomainId?: string;
  @Field(() => String, { nullable: true }) storyId?: string;
  @Field(() => String, { nullable: true }) package?: string;
  @Field(() => String) command!: string;
  @Field(() => String, { nullable: true }) successPattern?: string;
  @Field(() => [String], { nullable: true }) references?: string[];
  @Field(() => [String], { nullable: true }) suggestOnPass?: string[];
  @Field(() => [String], { nullable: true }) suggestOnFail?: string[];
}

@ObjectType()
export class Doc {
  @Field(() => String) docId!: string;
  @Field(() => String) title!: string;
  @Field(() => String, { nullable: true }) level?: string;
  @Field(() => String, { nullable: true }) tier?: string;
  @Field(() => String) scope!: string;
  @Field(() => String) aspect!: string;
  @Field(() => String) depth!: string;
  @Field(() => String) lifecycle!: string;
  @Field(() => String, { nullable: true }) layer?: string;
  @Field(() => [String]) tags!: string[];
  @Field(() => [DocLink]) links!: DocLink[];
  @Field(() => String, { nullable: true }) svc?: string;
  @Field(() => String, { nullable: true }) docVersion?: string;
  @Field(() => Int, { nullable: true }) revision?: number;
  @Field(() => String, { nullable: true }) address?: string;
  @Field(() => Int) version!: number;
  @Field(() => String, { nullable: true }) purpose?: string;
  @Field(() => String, { nullable: true }) intent?: string;
  @Field(() => String, { nullable: true }) context?: string;
  @Field(() => String, { nullable: true }) caveat?: string;
  @Field(() => QualityGate, { nullable: true }) gate?: QualityGate;
  @Field(() => String, { nullable: true }) sourcePath?: string;

  @Field(() => [Doc], { nullable: true }) children?: Doc[];
  @Field(() => Doc, { nullable: true }) parent?: Doc | null;
  @Field(() => [DocLink], { nullable: true }) outgoingLinks?: DocLink[];
  @Field(() => [IncomingLink], { nullable: true }) incomingLinks?: IncomingLink[];
  @Field(() => [SyntheticIncomingLink], { nullable: true }) syntheticIncomingLinks?: SyntheticIncomingLink[];
  @Field(() => [FeedbackRequestSummary], { nullable: true }) feedbackRequests?: FeedbackRequestSummary[];
  @Field(() => BoundaryResultType, { nullable: true }) boundary?: BoundaryResultType | null;
  @Field(() => BoundaryContextResultType, { nullable: true }) boundaryContext?: BoundaryContextResultType | null;
}

@ObjectType()
export class ImpactedDoc {
  @Field(() => String) docId!: string;
  @Field(() => String, { nullable: true }) address?: string;
  @Field(() => String) scope!: string;
  @Field(() => String, { nullable: true }) layer?: string;
  @Field(() => String) path!: string;
  @Field(() => Int) distance!: number;
}

@ObjectType()
export class ImpactAnalysisResult {
  @Field(() => String) sourceId!: string;
  @Field(() => String, { nullable: true }) sourceAddress?: string;
  @Field(() => [ImpactedDoc]) impacted!: ImpactedDoc[];
  @Field(() => Int) blastRadius!: number;
  @Field(() => [FeedbackRequestSummary], { nullable: true }) feedbackTrace?: FeedbackRequestSummary[];
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
