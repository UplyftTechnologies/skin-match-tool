import "./globals.css";
import Script from "next/script";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { WishlistProvider } from "@/context/WishlistContext";
import SiteExitTracker from "@/components/tracking/site-exit-tracker";
import ScrollTracker from "@/components/tracking/scroll-tracker";
import QuizRehydrator from "@/components/tracking/quiz-rehydrator";
import { Cormorant_Garamond, Lato } from 'next/font/google'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Match My Skin | Roopsee",
    template: "%s | Match My Skin",
  },
  icons: {
    icon: [
      {
        url: "/icons/icon-48.webp",
        type: "image/webp",
        sizes: "48x48",
      },
      {
        url: "/icons/icon-96.webp",
        type: "image/webp",
        sizes: "96x96",
      },
    ],

    shortcut: "/icons/icon-48.webp",

    apple: "/apple-icon.png",
  },

  description:
    "Discover your skin type and get personalized skincare recommendations with Match My Skin by Roopsee.",
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
  manifest: "/manifest.webmanifest",
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


const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-lato',
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${lato.variable}`}>
      <body suppressHydrationWarning>
        <SiteExitTracker />
        <ScrollTracker />
        <QuizRehydrator />
        <WishlistProvider>
          {children}
        </WishlistProvider>

        {process.env.NODE_ENV === "production" &&
          process.env.NEXT_PUBLIC_GA_ID ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());

        gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
          page_path: window.location.pathname,
        });
      `}
            </Script>
          </>
        ) : null}

        {process.env.NODE_ENV === "production" &&
          process.env.NEXT_PUBLIC_CLARITY_ID ? (
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
      (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          l.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
              link.setAttribute('data-clarity-unmask', 'true');
          });
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${process.env.NEXT_PUBLIC_CLARITY_ID}");

      (function() {
          function createId() {
              return typeof crypto !== 'undefined' && crypto.randomUUID
                  ? crypto.randomUUID()
                  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(char) {
                      var random = Math.random() * 16 | 0;
                      var value = char === 'x' ? random : (random & 3 | 8);
                      return value.toString(16);
                  });
          }

          try {
              var visitorId = localStorage.getItem('app_visitor_id');
              var sessionId = sessionStorage.getItem('app_session_id');

              if (!visitorId) {
                  visitorId = createId();
                  localStorage.setItem('app_visitor_id', visitorId);
              }
              if (!sessionId) {
                  sessionId = createId();
                  sessionStorage.setItem('app_session_id', sessionId);
              }

              window.clarity('identify', visitorId, sessionId, window.location.pathname);
              window.clarity('set', 'visitor_id', visitorId);
              window.clarity('set', 'session_id', sessionId);
          } catch (error) {
              console.warn('[clarity] Identity setup failed:', error);
          }
      })();
    `}
          </Script>
        ) : null}
      </body>
    </html>
  );
}
