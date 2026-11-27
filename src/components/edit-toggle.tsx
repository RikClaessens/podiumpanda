import { Check, Pencil } from "lucide-react";
import { useLanguage } from "../lib/language";
import { Button } from "./ui/button";

export function EditToggle({
  editing,
  onClick,
  editLabel,
  variant = "outline",
}: {
  editing: boolean;
  onClick: () => void;
  editLabel: string;
  variant?: "outline" | "ghost";
}) {
  const { t } = useLanguage();
  return (
    <Button type="button" variant={editing ? "done" : variant} onClick={onClick}>
      {editing ? <Check size={16} /> : <Pencil size={16} />}
      {editing ? t("Done editing") : editLabel}
    </Button>
  );
}
