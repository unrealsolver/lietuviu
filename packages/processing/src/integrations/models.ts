export type FeatureConfig = {
  id?: string;
  group?: string;
  provider: string;
  maxRpm?: number;
  options: Record<string, unknown>;
};

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

// Canonical MORPHOLOGY output shape placeholder until first morphology plugin lands.
export type MorphologyOutput = Record<string, unknown>;

export type FeatureOutputByType = {
  TRANSLATION: TranslationOutput;
  PHONETICS: PhoneticsOutput;
  MORPHOLOGY: MorphologyOutput;
};

export type FeatureType = keyof FeatureOutputByType;

export type AnyFeatureOutput = FeatureOutputByType[keyof FeatureOutputByType];

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
  group?: string;
  provider: string;
  version: string;
};

export type OutputBankItemFeatureValue = {
  output: AnyFeatureOutput;
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
