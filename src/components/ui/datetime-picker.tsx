import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateTimePickerProps {
  value?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "mm/dd/yyyy --:-- --",
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Time picker columns state
  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const periods = ["AM", "PM"];

  // Helper to extract local date and time fields
  const getParts = (dateVal?: Date) => {
    if (!dateVal) {
      return {
        date: undefined,
        hour: "12",
        minute: "00",
        period: "AM",
      };
    }

    let hour24 = dateVal.getHours();
    const minuteStr = String(dateVal.getMinutes()).padStart(2, "0");
    const period = hour24 >= 12 ? "PM" : "AM";

    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;
    const hourStr = String(hour12).padStart(2, "0");

    return {
      date: dateVal,
      hour: hourStr,
      minute: minuteStr,
      period,
    };
  };

  const { date, hour, minute, period } = getParts(value);

  // Helper to merge date, hour12, minute, and period (AM/PM) into a single Date object
  const handleUpdate = (
    newDate: Date | undefined,
    newHour: string,
    newMinute: string,
    newPeriod: string,
  ) => {
    if (!newDate) {
      onChange?.(undefined);
      return;
    }

    const updated = new Date(newDate.getTime());
    let hourNum = parseInt(newHour, 10);
    const minuteNum = parseInt(newMinute, 10);

    if (newPeriod === "PM" && hourNum < 12) {
      hourNum += 12;
    } else if (newPeriod === "AM" && hourNum === 12) {
      hourNum = 0;
    }

    updated.setHours(hourNum);
    updated.setMinutes(minuteNum);
    updated.setSeconds(0);
    updated.setMilliseconds(0);

    onChange?.(updated);
  };

  const handleDateChange = (newDate?: Date) => {
    handleUpdate(newDate, hour, minute, period);
  };

  const handleHourChange = (newHour: string) => {
    handleUpdate(date || new Date(), newHour, minute, period);
  };

  const handleMinuteChange = (newMinute: string) => {
    handleUpdate(date || new Date(), hour, newMinute, period);
  };

  const handlePeriodChange = (newPeriod: string) => {
    handleUpdate(date || new Date(), hour, minute, newPeriod);
  };

  const handleToday = () => {
    const now = new Date();
    const hour24 = now.getHours();
    const periodVal = hour24 >= 12 ? "PM" : "AM";
    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;

    handleUpdate(
      now,
      String(hour12).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      periodVal,
    );
  };

  const handleClear = () => {
    onChange?.(undefined);
  };

  // Scroll active items into view when popover opens
  const hourRef = React.useRef<HTMLDivElement>(null);
  const minuteRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const activeHour = hourRef.current?.querySelector("[data-active='true']");
        if (activeHour) {
          activeHour.scrollIntoView({ block: "center", behavior: "auto" });
        }
        const activeMinute = minuteRef.current?.querySelector("[data-active='true']");
        if (activeMinute) {
          activeMinute.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }, 50);
    }
  }, [isOpen]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between text-left font-normal h-10 px-3 cursor-pointer bg-background border-input hover:bg-accent",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {value ? format(value, "MM/dd/yyyy hh:mm a") : placeholder}
          </span>
          <CalendarIcon className="size-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 flex flex-col md:flex-row bg-background border border-border shadow-lg"
        align="start"
      >
        {/* Left side: Calendar */}
        <div className="flex flex-col border-b md:border-b-0 md:border-r border-border p-2">
          <Calendar mode="single" selected={date} onSelect={handleDateChange} initialFocus />
          <div className="flex justify-between items-center border-t border-border mt-2 pt-2 px-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-destructive hover:underline font-semibold cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>

        {/* Right side: Time Scroll Selector */}
        <div className="flex divide-x divide-border h-[300px] p-2 bg-background select-none">
          {/* Hours Column */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 px-2">
              H
            </span>
            <div
              ref={hourRef}
              className="flex-1 w-12 overflow-y-auto scrollbar-none space-y-1 pb-24"
            >
              {hours.map((h) => {
                const isActive = h === hour;
                return (
                  <button
                    key={h}
                    type="button"
                    data-active={isActive}
                    onClick={() => handleHourChange(h)}
                    className={cn(
                      "w-8 h-8 rounded text-sm flex items-center justify-center cursor-pointer transition-colors mx-auto",
                      isActive
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minutes Column */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 px-2">
              M
            </span>
            <div
              ref={minuteRef}
              className="flex-1 w-12 overflow-y-auto scrollbar-none space-y-1 pb-24"
            >
              {minutes.map((m) => {
                const isActive = m === minute;
                return (
                  <button
                    key={m}
                    type="button"
                    data-active={isActive}
                    onClick={() => handleMinuteChange(m)}
                    className={cn(
                      "w-8 h-8 rounded text-sm flex items-center justify-center cursor-pointer transition-colors mx-auto",
                      isActive
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period Column (AM/PM) */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 px-2">
              P
            </span>
            <div className="w-12 space-y-1">
              {periods.map((p) => {
                const isActive = p === period;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePeriodChange(p)}
                    className={cn(
                      "w-8 h-8 rounded text-sm flex items-center justify-center cursor-pointer transition-colors mx-auto",
                      isActive
                        ? "bg-primary text-primary-foreground font-bold"
                        : "hover:bg-accent text-foreground",
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
