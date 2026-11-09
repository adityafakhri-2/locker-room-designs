import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveStarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const RATING_LABELS: Record<number, string> = {
  1: "Kecewa (1/5)",
  2: "Kurang Puas (2/5)",
  3: "Cukup (3/5)",
  4: "Puas (4/5)",
  5: "Sangat Puas! (5/5)",
};

export function InteractiveStarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  showLabel = true,
  className,
}: InteractiveStarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const currentDisplay = hoverRating ?? value;

  const starSizes = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8",
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className="flex items-center gap-1.5"
        onMouseLeave={() => !readOnly && setHoverRating(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= currentDisplay;
          return (
            <button
              key={star}
              type="button"
              disabled={readOnly}
              aria-label={`Bintang ${star}`}
              onClick={() => {
                if (!readOnly && onChange) {
                  onChange(star);
                }
              }}
              onMouseEnter={() => {
                if (!readOnly) {
                  setHoverRating(star);
                }
              }}
              className={cn(
                "p-1 rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                readOnly
                  ? "cursor-default"
                  : "cursor-pointer hover:scale-115 active:scale-95",
              )}
            >
              <Star
                className={cn(
                  starSizes[size],
                  "transition-colors duration-150",
                  isFilled
                    ? "text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.4)]"
                    : "text-muted-foreground/30 fill-muted/10 hover:text-amber-300",
                )}
              />
            </button>
          );
        })}

        {showLabel && (
          <span className="text-xs font-bold text-amber-500 ml-1.5 tabular-nums">
            {currentDisplay}.0
          </span>
        )}
      </div>

      {showLabel && !readOnly && (
        <p className="text-xs font-medium text-muted-foreground animate-in fade-in duration-200">
          {RATING_LABELS[currentDisplay] || "Pilih rating Anda"}
        </p>
      )}
    </div>
  );
}

