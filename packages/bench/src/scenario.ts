import type {
  BenchmarkQaContext,
  BenchmarkIterationContext,
  BenchmarkScenario,
  SequenceScenarioConfig,
  SequenceScenarioStep,
  ScenarioPresetOptions,
  ScenarioValue,
} from "./types.js";
import { mergeAddressContexts } from "./context.js";

export function createSequenceScenario(
  config: SequenceScenarioConfig,
): BenchmarkScenario {
  return {
    id: config.id,
    name: config.name,

    async run(context: BenchmarkIterationContext): Promise<void> {
      for (const step of config.steps) {
        await runStep(step, context);
      }
    },
  };
}

export function createCheckoutScenario(
  options?: ScenarioPresetOptions,
): BenchmarkScenario {
  const contexts = createCheckoutContexts(options?.qaContext, {
    locale: options?.locale ?? "ko",
    userType: options?.userType ?? "guest",
    flowVariant: options?.flowVariant ?? "default",
  });

  return createSequenceScenario({
    id: "checkout",
    name: "Checkout Journey",
    steps: [
      { kind: "session", scenarioId: "checkout" },
      { kind: "event", eventKey: "page_view", payload: { page: "/cart", stage: "cart" }, addressContext: contexts.cartView },
      { kind: "event", eventKey: "click", payload: { element_id: "checkout_cta" }, addressContext: contexts.entryClick },
      { kind: "event", eventKey: "page_view", payload: { page: "/checkout/address", stage: "address" }, addressContext: contexts.checkoutView },
      { kind: "event", eventKey: "input_change", payload: { field_name: "shipping_postal" }, addressContext: contexts.processing },
      { kind: "event", eventKey: "form_submit", payload: { form_id: "shipping_address" }, addressContext: contexts.submit },
      { kind: "event", eventKey: "page_view", payload: { page: "/checkout/payment", stage: "payment" }, addressContext: contexts.paymentView },
      { kind: "event", eventKey: "click", payload: { element_id: "pay_now" }, addressContext: contexts.payment },
      {
        kind: "metric",
        name: "benchmark.checkout.completed",
        value: 1,
        type: "counter",
        labels: { scenario: "checkout" },
        addressContext: contexts.complete,
      },
      { kind: "flush" },
    ],
  });
}

export function createSearchScenario(
  options?: ScenarioPresetOptions,
): BenchmarkScenario {
  const contexts = createSearchContexts(options?.qaContext, {
    locale: options?.locale ?? "ko",
    userType: options?.userType ?? "guest",
    flowVariant: options?.flowVariant ?? "default",
  });

  return createSequenceScenario({
    id: "search",
    name: "Search Journey",
    steps: [
      { kind: "session", scenarioId: "search" },
      { kind: "event", eventKey: "page_view", payload: { page: "/search", stage: "landing" }, addressContext: contexts.homeView },
      { kind: "event", eventKey: "input_change", payload: { field_name: "search_query" }, addressContext: contexts.browse },
      { kind: "event", eventKey: "click", payload: { element_id: "search_submit" }, addressContext: contexts.searchSubmit },
      { kind: "event", eventKey: "page_view", payload: { page: "/search/results", stage: "results" }, addressContext: contexts.resultsView },
      {
        kind: "metric",
        name: "benchmark.search.results_page",
        value: 1,
        type: "counter",
        labels: { scenario: "search" },
        addressContext: contexts.resultsView,
      },
      { kind: "flush" },
    ],
  });
}

export function createLoginScenario(
  options?: ScenarioPresetOptions,
): BenchmarkScenario {
  const contexts = createLoginContexts(options?.qaContext, {
    locale: options?.locale ?? "ko",
    userType: options?.userType ?? "guest",
    flowVariant: options?.flowVariant ?? "default",
  });

  return createSequenceScenario({
    id: "login",
    name: "Login Journey",
    steps: [
      { kind: "session", scenarioId: "login" },
      { kind: "event", eventKey: "page_view", payload: { page: "/login", stage: "login" }, addressContext: contexts.loginView },
      { kind: "event", eventKey: "input_change", payload: { field_name: "email" }, addressContext: contexts.processing },
      { kind: "event", eventKey: "input_change", payload: { field_name: "password" }, addressContext: contexts.processing },
      { kind: "event", eventKey: "form_submit", payload: { form_id: "login_form" }, addressContext: contexts.submit },
      { kind: "event", eventKey: "click", payload: { element_id: "login_submit" }, addressContext: contexts.submit },
      {
        kind: "metric",
        name: "benchmark.login.completed",
        value: 1,
        type: "counter",
        labels: { scenario: "login" },
        addressContext: contexts.success,
      },
      { kind: "flush" },
    ],
  });
}

async function runStep(
  step: SequenceScenarioStep,
  context: BenchmarkIterationContext,
): Promise<void> {
  switch (step.kind) {
    case "session":
      context.client.startSession(
        resolveValue(step.scenarioId, context),
        resolveValue(step.existingSessionId, context),
      );
      return;

    case "event":
      context.client.emitEvent(
        resolveRequiredValue(step.eventKey, context, "eventKey"),
        resolveValue(step.payload, context),
        {
          eventVersion: resolveValue(step.eventVersion, context),
          address_context: resolveValue(step.addressContext, context),
        },
      );
      return;

    case "metric":
      context.client.emitMetric(
        resolveRequiredValue(step.name, context, "metric.name"),
        resolveRequiredValue(step.value, context, "metric.value"),
        {
          type: resolveValue(step.type, context),
          unit: resolveValue(step.unit, context),
          labels: resolveValue(step.labels, context),
          address_context: resolveValue(step.addressContext, context),
        },
      );
      return;

    case "flush":
      await context.client.flush();
      return;

    case "wait": {
      const durationMs = Math.max(0, resolveValue(step.durationMs, context) ?? 0);
      if (durationMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, durationMs));
      }
      return;
    }
  }
}

function resolveValue<T>(
  value: ScenarioValue<T | undefined> | undefined,
  context: BenchmarkIterationContext,
): T | undefined {
  if (typeof value === "function") {
    return (value as (innerContext: BenchmarkIterationContext) => T | undefined)(context);
  }
  return value;
}

function resolveRequiredValue<T>(
  value: ScenarioValue<T | undefined>,
  context: BenchmarkIterationContext,
  label: string,
): T {
  const resolved = resolveValue(value, context);
  if (resolved === undefined) {
    throw new Error(`SequenceScenario step requires ${label}`);
  }
  return resolved;
}

function createCheckoutContexts(
  qaContext: BenchmarkQaContext | undefined,
  options: { locale: string; userType: string; flowVariant: string },
) {
  return {
    cartView: mergeAddressContexts(
      track(qaContext, { page_view: { page: "cart", locale: options.locale, userType: options.userType } }),
      track(qaContext, { tracking: { trackAction: "view", page: "cart", userType: options.userType } }),
    ),
    entryClick: mergeAddressContexts(
      track(qaContext, { tracking: { trackAction: "click", page: "cart", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "checkout", flow_step: "entry", flow_variant: options.flowVariant } }),
    ),
    checkoutView: mergeAddressContexts(
      track(qaContext, { page_view: { page: "checkout", locale: options.locale, userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "checkout", flow_step: "processing", flow_variant: options.flowVariant } }),
    ),
    processing: track(qaContext, {
      flow_point: { flow_name: "checkout", flow_step: "processing", flow_variant: options.flowVariant },
    }),
    submit: mergeAddressContexts(
      track(qaContext, { tracking: { trackAction: "submit", page: "checkout", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "checkout", flow_step: "processing", flow_variant: options.flowVariant } }),
    ),
    paymentView: mergeAddressContexts(
      track(qaContext, { page_view: { page: "checkout", locale: options.locale, userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "checkout", flow_step: "payment", flow_variant: options.flowVariant } }),
    ),
    payment: mergeAddressContexts(
      track(qaContext, { tracking: { trackAction: "click", page: "checkout", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "checkout", flow_step: "payment", flow_variant: options.flowVariant } }),
    ),
    complete: track(qaContext, {
      flow_point: { flow_name: "checkout", flow_step: "complete", flow_variant: options.flowVariant },
    }),
  };
}

function createSearchContexts(
  qaContext: BenchmarkQaContext | undefined,
  options: { locale: string; userType: string; flowVariant: string },
) {
  return {
    homeView: mergeAddressContexts(
      track(qaContext, { page_view: { page: "home", locale: options.locale, userType: options.userType } }),
      track(qaContext, { tracking: { trackAction: "view", page: "home", userType: options.userType } }),
    ),
    browse: track(qaContext, {
      flow_point: { flow_name: "browse", flow_step: "processing", flow_variant: options.flowVariant },
    }),
    searchSubmit: mergeAddressContexts(
      track(qaContext, { tracking: { trackAction: "submit", page: "home", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "browse", flow_step: "branch", flow_variant: options.flowVariant } }),
    ),
    resultsView: mergeAddressContexts(
      track(qaContext, { page_view: { page: "product_list", locale: options.locale, userType: options.userType } }),
      track(qaContext, { tracking: { trackAction: "view", page: "product_list", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "browse", flow_step: "success", flow_variant: options.flowVariant } }),
    ),
  };
}

function createLoginContexts(
  qaContext: BenchmarkQaContext | undefined,
  options: { locale: string; userType: string; flowVariant: string },
) {
  return {
    loginView: mergeAddressContexts(
      track(qaContext, { page_view: { page: "login", locale: options.locale, userType: options.userType } }),
      track(qaContext, { tracking: { trackAction: "view", page: "login", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "login", flow_step: "entry", flow_variant: options.flowVariant } }),
    ),
    processing: track(qaContext, {
      flow_point: { flow_name: "login", flow_step: "processing", flow_variant: options.flowVariant },
    }),
    submit: mergeAddressContexts(
      track(qaContext, { tracking: { trackAction: "submit", page: "login", userType: options.userType } }),
      track(qaContext, { flow_point: { flow_name: "login", flow_step: "success", flow_variant: options.flowVariant } }),
    ),
    success: track(qaContext, {
      flow_point: { flow_name: "login", flow_step: "success", flow_variant: options.flowVariant },
    }),
  };
}

function track(
  qaContext: BenchmarkQaContext | undefined,
  prefixes: Record<string, Record<string, string | number>>,
): Record<string, string> | undefined {
  if (!qaContext) return undefined;
  try {
    return qaContext.track(prefixes);
  } catch {
    return undefined;
  }
}
