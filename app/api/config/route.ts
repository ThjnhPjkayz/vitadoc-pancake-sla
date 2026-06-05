import { NextResponse } from "next/server";
import { getSLAConfig, setSLAConfig } from "@/lib/services/sla-config";
import type { SLAConfig } from "@/lib/services/sla-config";

export async function GET() {
  try {
    const config = await getSLAConfig();
    return NextResponse.json({ success: true, config });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as SLAConfig;

    // Validate
    const { thresholds, afterHoursThresholds, businessHours } = body;
    if (
      typeof thresholds?.INBOX !== "number" ||
      typeof thresholds?.COMMENT !== "number" ||
      typeof afterHoursThresholds?.INBOX !== "number" ||
      typeof afterHoursThresholds?.COMMENT !== "number" ||
      typeof businessHours?.startHour !== "number" ||
      typeof businessHours?.endHour !== "number" ||
      !Array.isArray(businessHours?.workDays)
    ) {
      return NextResponse.json({ success: false, error: "Invalid config" }, { status: 400 });
    }

    await setSLAConfig(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
