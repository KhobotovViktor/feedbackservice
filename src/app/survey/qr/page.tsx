import { redirect } from "next/navigation";
import { createQRToken } from "@/lib/auth-utils";

export default async function QRPage({ searchParams }: { searchParams: Promise<{ branchId?: string }> }) {
  const { branchId } = await searchParams;
  const token = await createQRToken(branchId);
  redirect(`/survey/${token}`);
}
