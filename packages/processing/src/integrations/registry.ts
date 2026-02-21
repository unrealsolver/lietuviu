import type { FeatureConfig } from "./models";
import type { Plugin } from "./plugin";

export type PluginFactory = (feature: FeatureConfig) => Plugin;

export type PluginRegistry = {
  register(featureType: string, provider: string, factory: PluginFactory): void;
  resolve(feature: FeatureConfig): PluginFactory | undefined;
};

type RegistryKey = `${string}:${string}`;

export class InMemoryPluginRegistry implements PluginRegistry {
  private readonly factories = new Map<RegistryKey, PluginFactory>();

  register(
    featureType: string,
    provider: string,
    factory: PluginFactory,
  ): void {
    this.factories.set(this.toKey(featureType, provider), factory);
  }

  resolve(feature: FeatureConfig): PluginFactory | undefined {
    for (const [key, factory] of this.factories.entries()) {
      const [, provider] = key.split(":");
      if (provider === feature.provider) {
        return factory;
      }
    }
    return undefined;
  }

  private toKey(featureType: string, provider: string): RegistryKey {
    return `${featureType}:${provider}`;
  }
}
