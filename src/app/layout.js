import "./globals.css";
import Script from "next/script";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { WishlistProvider } from "@/context/WishlistContext";
import NotificationOptIn from "@/components/notification-opt-in";
import SiteExitTracker from "@/components/tracking/site-exit-tracker";
import ScrollRestoreGuard from "@/components/scroll-restore-guard";
import ScrollTracker from "@/components/tracking/scroll-tracker";
import QuizRehydrator from "@/components/tracking/quiz-rehydrator";
import BottomNav from "@/components/bottom-nav";
import GlobalQuizPrompt from "@/components/global-quiz-prompt";
import MetaPixelPageView from "@/components/tracking/meta-pixel-page-view";
import { Cormorant_Garamond, Lato } from 'next/font/google'

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Without this, env(safe-area-inset-*) is always 0 and the fixed bottom nav
  // stops short of the home indicator instead of painting behind it.
  viewportFit: "cover",
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  alternates: {
    canonical: "https://roopsee.com",  
  },
  title: {
    default: "Match My Skin | Roopsee",
    template: "%s | Match My Skin",
  },
  icons: {
    icon: [
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "48x48",
      },
      {
        url: "/icons/icon-96.png",
        type: "image/png",
        sizes: "96x96",
      },
    ],

    shortcut: "/favicon.png",

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
        <ScrollRestoreGuard />
        <SiteExitTracker />
        <ScrollTracker />
        <QuizRehydrator />
        <GlobalQuizPrompt />
        <WishlistProvider>
          <div className="pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
            {children}
          </div>
          <BottomNav />
        </WishlistProvider>

        <NotificationOptIn />

        {process.env.NODE_ENV === "production" ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window,document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '1721498525601686');
                fbq('track', 'PageView');
              `}
            </Script>
            <MetaPixelPageView />
            <noscript
              dangerouslySetInnerHTML={{
                __html: '<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=1721498525601686&amp;ev=PageView&amp;noscript=1" alt="" />',
              }}
            />
          </>
        ) : null}

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
              var sessionId = localStorage.getItem('app_session_id');
              var sessionLastSeen = Number(localStorage.getItem('app_session_last_seen'));
              var now = Date.now();
              var sessionExpired = Number.isFinite(sessionLastSeen)
                  && sessionLastSeen > 0
                  && now - sessionLastSeen > 30 * 60 * 1000;

              if (!visitorId) {
                  visitorId = createId();
                  localStorage.setItem('app_visitor_id', visitorId);
              }
              if (!sessionId && !sessionExpired) {
                  sessionId = sessionStorage.getItem('app_session_id');
              }
              if (!sessionId || sessionExpired) {
                  sessionId = createId();
              }
              localStorage.setItem('app_session_id', sessionId);
              localStorage.setItem('app_session_last_seen', String(now));
              sessionStorage.setItem('app_session_id', sessionId);

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
