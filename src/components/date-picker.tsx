import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { enUS, nl } from "react-day-picker/locale";
import { formatUiDate, toIsoDate } from "../../shared/dates";
import { useLanguage } from "../lib/language";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function DatePicker({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
        >
          {value ? formatUiDate(value) : t("Pick a date")}
          <CalendarIcon size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          locale={locale === "nl" ? nl : enUS}
          weekStartsOn={1}
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : "");
            setOpen(false);
          }}
        />
        <div className="border-t p-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {t("Clear date")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
