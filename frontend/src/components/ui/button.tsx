import * as React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "xs" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-200/90",
          variant === "destructive" && "bg-red-600 text-zinc-100 shadow-sm hover:bg-red-700",
          variant === "outline" && "border border-zinc-700 bg-transparent shadow-sm hover:bg-zinc-800 text-zinc-100",
          variant === "secondary" && "bg-zinc-800 text-zinc-100 shadow-sm hover:bg-zinc-700",
          variant === "ghost" && "hover:bg-zinc-800 text-zinc-100",
          size === "default" && "h-9 px-4 py-2",
          size === "sm" && "h-8 rounded-md px-3 text-xs",
          size === "xs" && "h-6 rounded px-2 text-[11px]",
          size === "lg" && "h-10 rounded-md px-8",
          size === "icon" && "h-9 w-9",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, cn };
