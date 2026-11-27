"use client";

import * as React from "react";
import { cn } from "cn";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetContent({
  className,
  children,
  title,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "title"> & { title: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto border-l bg-popover p-6 text-popover-foreground shadow-xl outline-hidden data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="pr-8 text-lg font-semibold">
          {title}
        </DialogPrimitive.Title>
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 rounded-md p-1 opacity-70 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label="Close"
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetContent };
