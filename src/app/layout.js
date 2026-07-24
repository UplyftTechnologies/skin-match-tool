import "./globals.css";

export const metadata = {
  title: "Roopsee Match Studio",
  description: "Simple skincare product matching backed by Roopsee catalog scores.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
