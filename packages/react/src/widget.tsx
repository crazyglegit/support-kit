"use client";

import {
  createSupportWidget,
  type SupportWidgetController,
  type SupportWidgetOptions,
} from "@crazyglegit/support-widget";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type SupportWidgetProps = Omit<SupportWidgetOptions, "container">;

export interface SupportWidgetHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

/** SSR-safe React lifecycle wrapper; all transport and state remain in support-widget. */
export const SupportWidget = forwardRef<
  SupportWidgetHandle,
  SupportWidgetProps
>(function SupportWidget(props, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SupportWidgetController | undefined>(undefined);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let controller: SupportWidgetController | undefined;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      controller = createSupportWidget({ ...props, container });
      controllerRef.current = controller;
    });
    return () => {
      cancelled = true;
      controller?.destroy();
      if (controllerRef.current === controller)
        controllerRef.current = undefined;
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: () => controllerRef.current?.open(),
      close: () => controllerRef.current?.close(),
      toggle: () => controllerRef.current?.toggle(),
      isOpen: () => controllerRef.current?.isOpen() ?? false,
    }),
    [],
  );

  return <div ref={mountRef} data-support-widget-mount="" />;
});
