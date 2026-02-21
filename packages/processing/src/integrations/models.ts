export type FeatureConfig = {
  provider: string;
  maxRpm?: number;
  options: Record<string, unknown>;
};

export type InputBank = {
  schemaVersion: string;
  title: string;
  description?: string;
  author?: string;
  sourceLanguage: string;
  features: FeatureConfig[];
  data: string[];
};
