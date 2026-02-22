import type {
  FeatureOutputByType,
  FeatureType,
  OutputBank,
  OutputBankFeature,
  OutputBankItem,
  OutputBankItemFeatureValue,
} from "./integrations/models";

export class OutputBankView {
  private readonly featureById = new Map<string, OutputBankFeature>();
  private readonly featureTypes: FeatureType[] = [];
  private readonly groupsByType = new Map<FeatureType, string[]>();
  private readonly featuresByTypeGroupKey = new Map<
    string,
    OutputBankFeature[]
  >();

  constructor(private readonly bank: OutputBank) {
    const seenFeatureTypes = new Set<FeatureType>();
    const groupsByTypeSet = new Map<FeatureType, Set<string>>();

    for (const feature of bank.features) {
      this.featureById.set(feature.id, feature);

      const type = feature.type as FeatureType;
      if (!seenFeatureTypes.has(type)) {
        seenFeatureTypes.add(type);
        this.featureTypes.push(type);
      }

      const group = this.normalizeGroup(feature.group);
      const groupSet = groupsByTypeSet.get(type) ?? new Set<string>();
      if (!groupsByTypeSet.has(type)) {
        groupsByTypeSet.set(type, groupSet);
      }
      groupSet.add(group);

      const key = this.typeGroupKey(type, group);
      const list = this.featuresByTypeGroupKey.get(key) ?? [];
      if (list.length === 0) {
        this.featuresByTypeGroupKey.set(key, list);
      }
      list.push(feature);
    }

    for (const [type, groups] of groupsByTypeSet.entries()) {
      this.groupsByType.set(type, [...groups]);
    }
  }

  /** Exposes the original parsed databank object for advanced consumers. */
  getBank(): OutputBank {
    return this.bank;
  }

  /** Returns feature metadata exactly as stored in the databank. */
  getFeatures(): OutputBankFeature[] {
    return this.bank.features;
  }

  /** Lists feature kinds that are present, preserving first-seen order. */
  getFeatureTypes(): FeatureType[] {
    return this.featureTypes;
  }

  /** Resolves the normalized group of a feature id, or `null` when missing. */
  getGroupForFeature(featureId: string): string | null {
    const feature = this.featureById.get(featureId);
    if (feature == null) {
      return null;
    }
    return this.normalizeGroup(feature.group);
  }

  /** Lists normalized groups that exist for a given feature kind. */
  getGroupsForType(type: FeatureType): string[] {
    return this.groupsByType.get(type) ?? [];
  }

  /** Returns metadata entries that belong to one feature kind/group bucket. */
  getFeaturesForType(
    type: FeatureType,
    group = "default",
  ): OutputBankFeature[] {
    const normalizedGroup = this.normalizeGroup(group);
    return (
      this.featuresByTypeGroupKey.get(
        this.typeGroupKey(type, normalizedGroup),
      ) ?? []
    );
  }

  /**
   * Resolves the winning feature metadata and output for one kind/group bucket,
   * or `null` when absent or ambiguous.
   */
  resolveFeatureMatch<TType extends FeatureType>(
    item: OutputBankItem,
    type: TType,
    group = "default",
  ): { feature: OutputBankFeature; output: FeatureOutputByType[TType] } | null {
    const features = this.getFeaturesForType(type, group);
    if (features.length === 0) {
      return null;
    }

    const matches = features
      .map((feature) => {
        const value = item.features[feature.id];
        if (value == null) {
          return null;
        }
        return { feature, value };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          feature: OutputBankFeature;
          value: OutputBankItemFeatureValue;
        } => candidate != null,
      );

    if (matches.length !== 1) {
      return null;
    }

    return {
      feature: matches[0].feature,
      output: matches[0].value.output as FeatureOutputByType[TType],
    };
  }

  /**
   * Resolves a single output for feature kind/group and returns `null` when absent
   * or ambiguous (more than one matching feature output is present on the item).
   */
  resolveFeatureOutput<TType extends FeatureType>(
    item: OutputBankItem,
    type: TType,
    group = "default",
  ): FeatureOutputByType[TType] | null {
    return this.resolveFeatureMatch(item, type, group)?.output ?? null;
  }

  private normalizeGroup(group: string | undefined): string {
    const raw = group?.trim();
    return raw != null && raw.length > 0 ? raw : "default";
  }

  private typeGroupKey(type: FeatureType, group: string): string {
    return `${type}:${group}`;
  }
}
