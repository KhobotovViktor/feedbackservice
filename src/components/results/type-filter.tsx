"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

export function TypeFilter({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    router.push(`?${params.toString()}`);
  };

  const options = [
    { value: "all", label: "Все отзывы" },
    { value: "positive", label: "Положительные (4.5-5 ★)" },
    { value: "negative", label: "Отрицательные (< 4.5 ★)" },
  ];

  return (
    <div className="w-full">
      <CustomSelect 
        options={options}
        value={defaultValue}
        onChange={handleTypeChange}
        placeholder="Фильтр по оценке"
      />
    </div>
  );
}
