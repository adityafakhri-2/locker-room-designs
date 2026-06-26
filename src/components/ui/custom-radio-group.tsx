import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface RadioOption {
  label: string;
  value: string;
}

export interface CustomRadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  orientation?: "horizontal" | "vertical";
  className?: string;
  name?: string;
  disabled?: boolean;
}

export function CustomRadioGroup({
  value,
  onChange,
  options,
  orientation = "horizontal",
  className,
  name,
  disabled = false,
}: CustomRadioGroupProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className={className}
      name={name}
      disabled={disabled}
    >
      <div
        className={cn(
          "flex gap-6",
          orientation === "vertical" ? "flex-col" : "flex-row items-center",
        )}
      >
        {options.map((opt) => {
          const optionId = `radio-${name || "opt"}-${opt.value}`;
          return (
            <div key={opt.value} className="flex items-center space-x-2.5">
              <RadioGroupItem value={opt.value} id={optionId} className="cursor-pointer" />
              <Label
                htmlFor={optionId}
                className={cn(
                  "text-sm font-semibold cursor-pointer select-none text-foreground hover:opacity-80 transition-opacity",
                  disabled && "pointer-events-none opacity-55",
                )}
              >
                {opt.label}
              </Label>
            </div>
          );
        })}
      </div>
    </RadioGroup>
  );
}
