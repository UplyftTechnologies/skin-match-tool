import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/header";
import { SKIN_GUIDES, getSkinGuide } from "@/lib/seo-pages";
import { absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return SKIN_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const guide = getSkinGuide(slug);
  if (!guide) return {};

  const canonical = `/skincare/${slug}`;
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: absoluteUrl(canonical),
      title: guide.title,
      description: guide.description,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title,
      description: guide.description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function SkinGuidePage({ params }) {
  const { slug } = await params;
  const guide = getSkinGuide(slug);

  if (!guide) notFound();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Header />
      <main style={{marginTop:'10px',padding:'5px 8px'}} className="mx-auto flex max-w-6xl flex-col gap-8 px-8 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.2)] sm:p-8 lg:p-10">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-rose-500">
            {guide.eyebrow}
          </p>
          <h1 className="mt-3 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            {guide.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
            {guide.description}
          </p>

          <div className="mt-8 rounded-2xl bg-rose-50 p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">What to focus on</h2>
            <p className="mt-3 text-sm leading-7 text-slate-700 sm:text-[15px]">
              {guide.answer}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Common questions</h2>
            <div className="mt-5 space-y-4">
              {guide.faqs.map(([question, answer]) => (
                <div key={question} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">{question}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-semibold text-slate-900">Ready to find your match?</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Use the quiz to get a curated skincare routine and product recommendations matched to your skin profile.
            </p>
            <Link
              className="mt-6 inline-flex items-center justify-center rounded-full bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
              href="/"
            >
              Start the quiz
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
