"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CustomSelect } from "@/components/ui/custom-select";

interface Branch {
  id: string;
  name: string;
}

export function BranchFilter({ branches, defaultValue }: { branches: Branch[], defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBranchChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("branchId");
    } else {
      params.set("branchId", value);
    }
    router.push(`?${params.toString()}`);
  };

  const options = [
    { value: "all", label: "Все филиалы" },
    ...branches.map(b => ({ value: b.id, label: b.name }))
  ];

  return (
    <div className="w-full">
      <CustomSelect 
        options={options}
        value={defaultValue}
        onChange={handleBranchChange}
        placeholder="Выберите филиал"
      />
    </div>
  );
}
