import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Pancake SLA Monitor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Accent line */}
        <div
          style={{
            width: 56,
            height: 4,
            borderRadius: 999,
            background: "#10b981",
            marginBottom: 32,
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1.1,
            marginBottom: 20,
          }}
        >
          Pancake SLA Monitor
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: "#94a3b8",
            lineHeight: 1.5,
            marginBottom: 56,
            maxWidth: 680,
          }}
        >
          Internal dashboard theo dõi hiệu suất phản hồi tin nhắn trên các trang Pancake
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["SLA Tracking", "Page Leaderboard", "Inbox & Comments", "VI · EN · ZH"].map((label) => (
            <div
              key={label}
              style={{
                padding: "8px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#cbd5e1",
                fontSize: 18,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
