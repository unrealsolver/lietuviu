export type AppLayoutGate =
  | "loading"
  | "init-error"
  | "disclaimer"
  | "wipe-confirm"
  | "ready";

export function resolveAppLayoutGate(params: {
  initError: string | null;
  isFirstStartup: boolean | null;
  confirmWipe: boolean | null;
}): AppLayoutGate {
  if (params.initError != null) {
    return "init-error";
  }
  if (params.isFirstStartup == null || params.confirmWipe == null) {
    return "loading";
  }
  if (params.isFirstStartup) {
    return "disclaimer";
  }
  if (params.confirmWipe) {
    return "wipe-confirm";
  }
  return "ready";
}
