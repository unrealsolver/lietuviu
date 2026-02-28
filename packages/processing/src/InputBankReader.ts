import {
  FeatureGroupIndex,
  normalizeFeatureGroup,
  resolveFeatureIds,
} from "./BankFeatures";
import type { FeatureConfig, InputBank } from "./integrations/models";

export type InputBankResolvedFeature = {
  featureId: string;
  featureOrder: number;
  group: string;
  provider: string;
  maxRpm?: number;
  options: FeatureConfig["options"];
  source: FeatureConfig;
};

type IndexedInputFeature = {
  id: string;
  group?: string;
  featureOrder: number;
  provider: string;
  maxRpm?: number;
  options: FeatureConfig["options"];
  source: FeatureConfig;
};

export class InputBankReader {
  private readonly bank: InputBank;
  private readonly resolvedFeatures: InputBankResolvedFeature[];
  private readonly featureIndex: FeatureGroupIndex<IndexedInputFeature>;

  constructor(bank: InputBank) {
    this.bank = {
      ...bank,
      version: bank.version ?? "0.0.0",
    };
    const featureIds = resolveFeatureIds(this.bank.features);
    const indexedFeatures: IndexedInputFeature[] = this.bank.features.map(
      (feature, featureOrder) => ({
        id: featureIds[featureOrder] ?? `feature-${featureOrder + 1}`,
        group: feature.group,
        featureOrder,
        provider: feature.provider,
        maxRpm: feature.maxRpm,
        options: feature.options,
        source: feature,
      }),
    );
    this.featureIndex = new FeatureGroupIndex(indexedFeatures);
    this.resolvedFeatures = indexedFeatures.map((feature) => ({
      featureId: feature.id,
      featureOrder: feature.featureOrder,
      group: normalizeFeatureGroup(feature.group),
      provider: feature.provider,
      maxRpm: feature.maxRpm,
      options: feature.options,
      source: feature.source,
    }));
  }

  /** Exposes the original parsed databank object for advanced consumers. */
  getBank(): InputBank {
    return this.bank;
  }

  /** Returns source input items in author-defined order. */
  getItems(): string[] {
    return this.bank.data;
  }

  /** Returns the number of source items. */
  getItemCount(): number {
    return this.bank.data.length;
  }

  /** Returns features with resolved runtime ids and normalized groups. */
  getResolvedFeatures(): InputBankResolvedFeature[] {
    return this.resolvedFeatures;
  }

  /** Resolves normalized group for a resolved feature id, or `null` when missing. */
  getGroupForFeature(featureId: string): string | null {
    return this.featureIndex.getGroupForFeature(featureId);
  }

  /** Resolves a feature descriptor by its resolved runtime id, or `null` when missing. */
  getFeatureById(featureId: string): InputBankResolvedFeature | null {
    return (
      this.resolvedFeatures.find(
        (feature) => feature.featureId === featureId,
      ) ?? null
    );
  }
}
