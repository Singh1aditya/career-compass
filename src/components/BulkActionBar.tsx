import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface Action {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}

interface Props {
  selectedCount: number;
  actions: Action[];
  onClear: () => void;
}

export function BulkActionBar({ selectedCount, actions, onClear }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-background border shadow-lg rounded-full px-4 py-2 animate-in slide-in-from-bottom-2 duration-200">
      <Badge variant="secondary" className="rounded-full text-xs font-semibold">
        {selectedCount} selected
      </Badge>
      <div className="w-px h-4 bg-border mx-1" />
      {actions.map((action, i) => (
        <Button
          key={i}
          size="sm"
          variant={action.variant ?? "outline"}
          className="h-7 text-xs rounded-full"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {action.label}
        </Button>
      ))}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full ml-1"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
