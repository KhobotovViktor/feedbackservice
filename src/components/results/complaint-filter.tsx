"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

export function ComplaintFilter({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("complaint");
    } else {
      params.set("complaint", value);
    }
    params.delete("page"); // back to first page on filter change
    router.push(`?${params.toString()}`);
  };

  const options = [
    { value: "all", label: "Жалобы: все" },
    { value: "open", label: "Открытые" },
    { value: "new", label: "Новые" },
    { value: "in_progress", label: "В работе" },
    { value: "resolved", label: "Решённые" },
  ];

  return (
    <div className="w-full">
      <CustomSelect
        options={options}
        value={defaultValue}
        onChange={handleChange}
        placeholder="Статус жалобы"
      />
    </div>
  );
}
