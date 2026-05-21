"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

// Kept in sync with AI_TAGS in src/lib/ai.ts (not imported to avoid pulling
// the server-only AI module into the client bundle).
const TAGS = ["доставка", "качество товара", "работа менеджера", "цена"];

export function TagFilter({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTagChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tag");
    } else {
      params.set("tag", value);
    }
    params.delete("page"); // back to first page on filter change
    router.push(`?${params.toString()}`);
  };

  const options = [{ value: "all", label: "Все темы" }, ...TAGS.map((t) => ({ value: t, label: t }))];

  return (
    <div className="w-full">
      <CustomSelect
        options={options}
        value={defaultValue}
        onChange={handleTagChange}
        placeholder="Тема (AI)"
      />
    </div>
  );
}
