import { redirect } from "next/navigation";
import { createQRToken } from "@/lib/qr-utils";

export default async function QRPage({ searchParams }: { searchParams: { branchId?: string } }) {
  const branchId = searchParams.branchId;
  const token = await createQRToken(branchId);
  redirect(`/survey/${token}`);
}
