import { describe, expect, test } from "vitest";
import expectedLineage from "../../../../docs/proposals/data-structure-profile/fixtures/expected-lineage.json";
import expectedMeasurement from "../../../../docs/proposals/data-structure-profile/fixtures/expected-measurement-report.json";
import expectedValidation from "../../../../docs/proposals/data-structure-profile/fixtures/expected-validation-report.json";
import expectedCustomerLineage from "../../../../docs/proposals/data-structure-profile/fixtures/expected-customer-orders-lineage.json";
import expectedCustomerMeasurement from "../../../../docs/proposals/data-structure-profile/fixtures/expected-customer-orders-measurement-report.json";
import expectedCustomerValidation from "../../../../docs/proposals/data-structure-profile/fixtures/expected-customer-orders-validation-report.json";
import { DATA_STRUCTURE_PROFILE_EXAMPLES } from "./sample-lineage.js";

describe("Data Structure Profile preview samples", () => {
  test("uses checked-in fixture artifacts for the primary preview example", () => {
    const primary = DATA_STRUCTURE_PROFILE_EXAMPLES[0]!;

    expect(primary.lineage).toEqual(expectedLineage);
    expect(primary.validation).toEqual(expectedValidation);
    expect(primary.measurement).toEqual(expectedMeasurement);
  });

  test("uses checked-in relational fixture artifacts for the database preview example", () => {
    const relational = DATA_STRUCTURE_PROFILE_EXAMPLES.find((example) => (
      example.lineage.profile === "customer-orders-to-pseudonymized-analytics"
    ));

    expect(relational?.lineage).toEqual(expectedCustomerLineage);
    expect(relational?.validation).toEqual(expectedCustomerValidation);
    expect(relational?.measurement).toEqual(expectedCustomerMeasurement);
  });
});
