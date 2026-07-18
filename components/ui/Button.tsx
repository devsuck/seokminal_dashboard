import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "buy" | "sell" | "outline" | "ghost";
type Size = "sm" | "md";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent text-black border border-accent",
  buy: "bg-pos text-black border border-pos",
  sell: "bg-neg text-black border border-neg",
  outline: "bg-transparent text-text-2 border border-border hover:text-text-1 hover:border-accent",
  ghost: "bg-transparent text-text-3 border border-transparent hover:text-text-1",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "text-[11px] px-2 py-1",
  md: "text-sm px-4 py-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "outline", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...props}
    />
  );
}
