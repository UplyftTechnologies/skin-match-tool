import { ImageResponse } from "next/og";

export const alt = "Roopsee personalised skincare product matcher";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #fff9f2 0%, #f5e5ef 55%, #fff2df 100%)",
          color: "#3d3341",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "980px" }}>
          <div style={{ color: "#963d7e", fontSize: 28, fontWeight: 700, letterSpacing: 3 }}>
            ROOPSEE MATCH STUDIO
          </div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 24 }}>
            Skincare matches made for your profile.
          </div>
          <div style={{ color: "#766b7d", fontSize: 32, marginTop: 28 }}>
            Compare products by skin type, sensitivity, age and concern.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
