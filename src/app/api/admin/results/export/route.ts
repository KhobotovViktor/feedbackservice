import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAccessibleBranchIds } from "@/lib/access";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  RESOLVED: "Решена",
};

// CSV cell with Excel-safe quoting.
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Export survey responses (respecting the same branch/type filters and the
// caller's role scope) as a CSV. Session-gated; MANAGERs get only their
// branches. UTF-8 BOM so Excel opens Cyrillic correctly.
export async function GET(req: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || undefined;
  const type = searchParams.get("type") || "all";
  const tag = searchParams.get("tag") || "all";

  const accessible = await getAccessibleBranchIds();
  const where: Prisma.SurveyResponseWhereInput = {};
  if (branchId === "crm") {
    where.branchId = null;
    where.dealId = { not: "QR_GUEST" };
  } else if (branchId && branchId !== "all") {
    where.branchId = branchId;
  }
  if (type === "positive") where.averageScore = { gte: 4.5 };
  if (type === "negative") where.averageScore = { lt: 4.5 };
  if (tag && tag !== "all") where.tags = { has: tag };
  if (accessible !== null) {
    if (branchId === "crm") where.branchId = { in: [] };
    else if (typeof where.branchId === "string") {
      if (!accessible.includes(where.branchId)) where.branchId = { in: [] };
    } else {
      where.branchId = { in: accessible };
    }
  }

  const rows = await prisma.surveyResponse.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { branch: true },
    take: 10000,
  });

  const header = [
    "Дата", "Время", "Источник", "Клиент", "Тип", "Номер",
    "Оценка", "Ответственный", "Жалоба", "Теги", "Комментарий",
  ];
  const lines = [header.join(",")];

  for (const r of rows) {
    const isCRM =
      r.dealId && r.dealId !== "0" && r.dealId !== "TEST_DEAL" && r.dealId !== "QR_GUEST";
    const source = r.branch?.name
      ? `${r.branch.name} ${isCRM ? "(CRM)" : "(QR)"}`
      : isCRM
        ? "Bitrix24 (CRM)"
        : "Прямая ссылка / QR";
    const d = new Date(r.createdAt);
    const date = d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
    const time = d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Moscow",
    });
    const entity = r.entityType === "lead" ? "Лид" : "Сделка";
    const complaint = r.complaintStatus
      ? STATUS_LABEL[r.complaintStatus] || r.complaintStatus
      : "";
    const tags = Array.isArray(r.tags) ? r.tags.join("; ") : "";
    lines.push(
      [
        date, time, source, r.clientId || "", entity, r.dealId || "",
        r.averageScore.toFixed(1), r.responsibleName || "", complaint, tags, r.comment || "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = "﻿" + lines.join("\r\n");
  const fname = `results-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
