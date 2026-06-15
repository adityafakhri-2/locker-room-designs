import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  number?: string;
  children: ReactNode;
  bare?: boolean;
}

export function Section({
  eyebrow,
  number,
  children,
  className,
  bare,
  ...rest
}: SectionProps) {
  return (
    <section
      className={cn(
        "relative",
        !bare && "py-20 md:py-28 lg:py-36 border-t border-border",
        className
      )}
      {...rest}
    >
      <div className="container-swiss">
        {(eyebrow || number) && (
          <div className="mb-12 md:mb-16 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
            <span className="eyebrow text-foreground">{eyebrow}</span>
            {number && (
              <span className="eyebrow text-muted-foreground tabular-nums">
                {number}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
