"use client";

import {
  createSupportDashboard,
  type SupportDashboardOptions,
} from "@crazyglegit/support-dashboard";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type SupportDashboardProps = Omit<SupportDashboardOptions, "target"> & {
  readonly className?: string;
};
export interface SupportDashboardHandle {
  refreshInbox(): Promise<void>;
  closeConversation(): void;
  destroy(): void;
}

export const SupportDashboard = forwardRef<
  SupportDashboardHandle,
  SupportDashboardProps
>(function SupportDashboard(props, ref) {
  const target = useRef<HTMLDivElement>(null);
  const controller = useRef<
    ReturnType<typeof createSupportDashboard> | undefined
  >(undefined);
  useImperativeHandle(
    ref,
    () => ({
      refreshInbox: () =>
        controller.current?.refreshInbox() ?? Promise.resolve(),
      closeConversation: () => controller.current?.closeConversation(),
      destroy: () => controller.current?.destroy(),
    }),
    [],
  );
  useEffect(() => {
    let cancelled = false;
    let instance: ReturnType<typeof createSupportDashboard> | undefined;
    queueMicrotask(() => {
      if (cancelled || !target.current) return;
      instance = createSupportDashboard({ ...props, target: target.current });
      controller.current = instance;
      void instance.initialize();
    });
    return () => {
      cancelled = true;
      instance?.destroy();
      if (controller.current === instance) controller.current = undefined;
    };
  }, [
    props.apiBaseUrl,
    props.socketUrl,
    props.credentials,
    props.theme,
    props.layout,
    props.accentColor,
    props.requestTimeoutMs,
  ]);
  return (
    <div ref={target} className={props.className} data-support-dashboard-host />
  );
});
