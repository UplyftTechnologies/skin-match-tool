import "./globals.css";
import Script from "next/script";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Personalised Skincare Product Matcher | Roopsee",
    template: "%s | Roopsee",
  },
  description: "Find skincare products matched to your skin type, sensitivity, age and main concern using Roopsee's product-specific scoring system.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: SITE_NAME,
    title: "Personalised Skincare Product Matcher | Roopsee",
    description: "Compare skincare products for your skin type and concern, then build a practical morning and night routine.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Personalised Skincare Product Matcher | Roopsee",
    description: "Find skincare products matched to your skin type, sensitivity, age and main concern.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "beauty",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}

        {process.env.NEXT_PUBLIC_CLARITY_ID ? (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");
            `}
          </Script>
        ) : null}
      </body>
    </html>
  );
}