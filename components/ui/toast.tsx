'use client';

import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { CheckCircle2, XCircle, Info, AlertCircle, X } from 'lucide-react';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className: _className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col md:max-w-[420px]"
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
    variant?: 'success' | 'error' | 'info' | 'warning';
  }
>(({ className, variant = 'info', ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={`
        group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-[6px] border p-6 pr-8 transition-all
        data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
        data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none
        data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out
        data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full
        data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full
        ${
          variant === 'success'
            ? 'border-green-200 bg-green-50 text-green-900'
            : variant === 'error'
            ? 'border-red-200 bg-red-50 text-red-900'
            : variant === 'warning'
            ? 'border-amber-accent-soft bg-amber-accent-soft text-amber-accent-deep'
            : 'border-brand-200 bg-brand-50 text-brand-900'
        }
        ${className || ''}
      `}
      {...props}
    />
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className: _className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className: _className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className: _className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className="text-sm font-semibold"
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className: _className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className="text-sm opacity-90"
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};

// Icons for each variant
export const ToastIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};
