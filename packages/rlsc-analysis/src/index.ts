export const RLSC_ANALYSIS_PACKAGE_NAME = "@qa-sdk/rlsc-analysis";

export interface AnalysisPackageBoundary {
  readonly packageName: typeof RLSC_ANALYSIS_PACKAGE_NAME;
  readonly ownsScreenAnalysis: true;
  readonly ownsVisualization: false;
}

export function createAnalysisPackageBoundary(): AnalysisPackageBoundary {
  return {
    packageName: RLSC_ANALYSIS_PACKAGE_NAME,
    ownsScreenAnalysis: true,
    ownsVisualization: false,
  };
}
