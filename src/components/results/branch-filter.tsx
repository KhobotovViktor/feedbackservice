"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Branch {
  id: string;
  name: string;
}

export function BranchFilter({ branches, defaultValue }: { branches: Branch[], defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("branchId");
    } else {
      params.set("branchId", value);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <select 
      name="branchId"
      className="w-full bg-white border-none px-6 py-3 rounded-xl font-black outline-none shadow-sm text-xs md:text-sm appearance-none cursor-pointer hover:bg-slate-50 transition-all font-black"
      defaultValue={defaultValue}
      onChange={handleChange}
    >
      <option value="all">Все филиалы</option>
      {branches.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  );
}
