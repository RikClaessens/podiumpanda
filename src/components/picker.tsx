import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const emptyValue = "__none__";
export function Picker({
  value,
  onValueChange,
  options,
  id,
  ariaLabel,
  disabled,
  className,
  contentPosition,
  contentClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  contentPosition?: "item-aligned" | "popper";
  contentClassName?: string;
}) {
  return (
    <Select
      value={value || emptyValue}
      onValueChange={(next) => onValueChange(next === emptyValue ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position={contentPosition} className={contentClassName}>
        {options.map((option) => (
          <SelectItem key={option.value || emptyValue} value={option.value || emptyValue}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
