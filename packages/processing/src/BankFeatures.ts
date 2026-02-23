import type { FeatureConfig } from "./integrations/models";

type FeatureWithIdGroup = {
  id: string;
  group?: string;
};

export function resolveFeatureIds(features: FeatureConfig[]): string[] {
  const counters = new Map<string, number>();
  const used = new Set<string>();
  return features.map((feature, index) => {
    const customId = feature.id?.trim();
    const nextId =
      customId && customId.length > 0
        ? customId
        : (() => {
            const prefix = toIdPrefix(feature.provider);
            const n = (counters.get(prefix) ?? 0) + 1;
            counters.set(prefix, n);
            return `${prefix}-${n}`;
          })();

    if (used.has(nextId)) {
      throw new Error(
        `Duplicate feature id "${nextId}" at feature index ${index}`,
      );
    }
    used.add(nextId);
    return nextId;
  });
}

export function normalizeFeatureGroup(group: string | undefined): string {
  return normalizeOptionalFeatureGroup(group) ?? "default";
}

export function normalizeOptionalFeatureGroup(
  group: string | undefined,
): string | undefined {
  const raw = group?.trim();
  return raw != null && raw.length > 0 ? raw : undefined;
}

export class FeatureGroupIndex<TFeature extends FeatureWithIdGroup> {
  private readonly featureById = new Map<string, TFeature>();

  constructor(private readonly features: TFeature[]) {
    for (const feature of features) {
      this.featureById.set(feature.id, feature);
    }
  }

  getFeatures(): TFeature[] {
    return this.features;
  }

  getFeatureById(featureId: string): TFeature | null {
    return this.featureById.get(featureId) ?? null;
  }

  getGroupForFeature(featureId: string): string | null {
    const feature = this.getFeatureById(featureId);
    if (feature == null) {
      return null;
    }
    return normalizeFeatureGroup(feature.group);
  }
}

function toIdPrefix(provider: string): string {
  return provider
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
