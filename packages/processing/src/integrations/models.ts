export type FeatureConfig = {
  provider: string;
  maxRpm?: number;
  options: Record<string, unknown>;
};

export type FeatureType = "TRANSLATION" | "PHONETICS" | "MORPHOLOGY";

// Canonical TRANSLATION output shape across providers.
export type TranslationOutput =
  | string
  | {
      translatedText: string;
      alternatives?: string[];
    };

export type PhoneticsAccentType = "MULTIPLE_MEANING" | "MULTIPLE_VARIANT";

export type PhoneticsPiece =
  | string
  | {
      accented: string;
      accentType: PhoneticsAccentType;
    };

// Canonical PHONETICS output shape across providers.
export type PhoneticsOutput = PhoneticsPiece[];

export type InputBank = {
  schemaVersion: string;
  title: string;
  description?: string;
  author?: string;
  sourceLanguage: string;
  features: FeatureConfig[];
  data: string[];
};

type FeatureId = string;

export type OutputBankFeature = {
  id: FeatureId;
  type: FeatureType | string;
  provider: string;
  version: string;
};

export type OutputBankItemFeatureValue = {
  output: unknown;
};

export type OutputBankItem = {
  input: string;
  features: Record<FeatureId, OutputBankItemFeatureValue>;
};

export type OutputBank = {
  schemaVersion: string;
  title: string;
  description?: string;
  author?: string;
  sourceLanguage: string;
  generatedAt: string;
  features: OutputBankFeature[];
  data: OutputBankItem[];
};
