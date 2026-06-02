"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

interface Props {
  /** Список уникальных responsibleName, полученный страницей из БД. */
  options: string[];
  /** Текущее значение фильтра ("all" — все, иначе имя). */
  defaultValue: string;
}

export function ResponsibleFilter({ options, defaultValue }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("responsible");
    } else {
      params.set("responsible", value);
    }
    // Filter change rewinds pagination — otherwise we'd land on page 5 of
    // a result set that no longer has 5 pages.
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const selectOptions = [
    { value: "all", label: "Все ответственные" },
    // Special bucket for unattributed responses (responsibleName = null).
    { value: "__none__", label: "Без ответственного" },
    ...options.map((name) => ({ value: name, label: name })),
  ];

  return (
    <div className="w-full">
      <CustomSelect
        options={selectOptions}
        value={defaultValue}
        onChange={handleChange}
        placeholder="Ответственный"
      />
    </div>
  );
}
