import { Search } from "lucide-react";
import { colors } from "@/utils/colors";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** The small search box shown in most panel headers. */
export function SearchBar({ value, onChange, placeholder = "Search records" }: SearchBarProps) {
  return (
    <div className="cc-search">
      <Search size={15} color={colors.textFaint} />
      <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
