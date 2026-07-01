import type { DataStructureProfile, MeasurementReport } from "./types.js";

const SECONDS_PER_DAY = 86_400;

export function measureProfile(profile: DataStructureProfile): MeasurementReport {
  const expectedEventRatePerSec = profile.measurements.expected_event_rate_per_sec ?? 0;
  const averagePayloadBytes = profile.measurements.average_payload_bytes ?? 0;
  const averageArrayLength = profile.measurements.average_array_length ?? 1;
  const maxArrayLength = profile.measurements.max_array_length ?? averageArrayLength;
  const estimatedFactRowBytes = profile.measurements.estimated_fact_row_bytes ?? averagePayloadBytes;
  const rowMultiplier = averageArrayLength;
  const estimatedFactRowsPerSec = expectedEventRatePerSec * rowMultiplier;

  return {
    kind: "data-structure-profile.measurement-report.v1",
    profile: profile.profile,
    inputs: {
      expectedEventRatePerSec,
      averagePayloadBytes,
      averageArrayLength,
      maxArrayLength,
      estimatedFactRowBytes,
    },
    estimates: {
      rowMultiplier,
      estimatedFactRowsPerSec,
      estimatedOutputBytesPerSec: estimatedFactRowsPerSec * estimatedFactRowBytes,
      estimatedDailyFactRows: estimatedFactRowsPerSec * SECONDS_PER_DAY,
    },
    thresholds: {
      maxRowMultiplier: maxRowMultiplier(profile),
    },
    warnings: [],
  };
}

function maxRowMultiplier(profile: DataStructureProfile): number {
  const gate = profile.quality_gates.find((candidate) => candidate.risk === "array-explosion");
  return gate?.threshold?.max_row_multiplier ?? gate?.threshold?.max_array_length ?? 0;
}
