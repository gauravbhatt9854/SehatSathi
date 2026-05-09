import type { Metadata } from "next";
import Image from "next/image";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "HealthBuddy AI | Smart Doctor Discovery",
  description:
    "AI-powered healthcare assistant for symptom analysis and doctor matching.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${dmSans.variable} ${dmSerif.variable} antialiased bg-gradient-to-br from-blue-50 via-white to-blue-50 min-h-screen text-slate-900`}
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        {/* ================= HERO SECTION ================= */}
        <section className="relative min-h-[100vh] flex items-center px-6 overflow-hidden">
          {/* Decorative background blobs */}
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-40" />
          <div className="absolute top-10 -right-20 w-72 h-72 bg-cyan-100 rounded-full blur-3xl opacity-40" />

          <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 mb-6 text-xs font-semibold tracking-wide text-blue-600 uppercase bg-blue-100 rounded-full border border-blue-200">
                AI-Powered Healthcare
              </span>

              <h1
                className="text-4xl md:text-5xl font-bold leading-tight mb-6"
                style={{ fontFamily: "var(--font-dm-serif)" }}
              >
                Your Health, <span className="text-blue-600">Simpler.</span>
              </h1>

              <p className="text-lg text-slate-600 mb-10 max-w-xl leading-relaxed">
                Describe your symptoms in plain English. Our AI analyzes your
                condition and recommends the right medical specialists near you.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="#app"
                  className="px-8 py-4 bg-blue-600 text-white text-base font-semibold rounded-xl hover:bg-blue-700 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 text-center shadow-lg shadow-blue-600/20"
                >
                  Start Health Check
                </a>

                <a
                  href="#how-it-works"
                  className="px-8 py-4 bg-white text-blue-600 text-base font-semibold rounded-xl border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
                >
                  How it works
                </a>
              </div>
            </div>

            <div className="hidden md:flex justify-center relative">
              <div className="absolute inset-0 bg-blue-200 rounded-full blur-[120px] opacity-20" />
              <Image
                src="/health-illustration.webp"
                alt="Healthcare Illustration"
                width={448}
                height={448}
                className="relative w-full max-w-md drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section
          id="how-it-works"
          className="py-24 border-t border-blue-100/50 bg-black"
        >
          <div className="max-w-6xl mx-auto px-6 text-center">
            <h2
              className="text-3xl font-bold mb-16"
              style={{ fontFamily: "var(--font-dm-serif)" }}
            >
              Three simple steps to care
            </h2>

            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  step: "01",
                  title: "Share Symptoms",
                  desc: "Describe how you feel using simple, natural language.",
                },
                {
                  step: "02",
                  title: "AI Analysis",
                  desc: "Our AI maps your symptoms to medical specialties.",
                },
                {
                  step: "03",
                  title: "Find Doctors",
                  desc: "Get nearby doctor recommendations instantly.",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative p-8 bg-white rounded-2xl border border-blue-100 shadow-sm hover:shadow-lg hover:border-blue-200 hover:-translate-y-1 transition-all duration-300"
                >
                  <span className="absolute top-4 right-6 text-5xl font-black text-blue-600/5">
                    {item.step}
                  </span>
                  <h3 className="text-xl font-semibold mb-3 relative z-10 text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-slate-600 relative z-10 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================= APPLICATION SECTION ================= */}
        <section id="app" className="py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2
                className="text-3xl font-bold mb-3"
                style={{ fontFamily: "var(--font-dm-serif)" }}
              >
                Symptom Checker
              </h2>
              <p className="text-slate-500">
                Your data is processed securely and privately.
              </p>
            </div>

            <div className="rounded-3xl border border-blue-100 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-md">
              {children}
            </div>
          </div>
        </section>

        {/* ================= FOOTER ================= */}
        <footer className="py-12 border-t border-blue-100/50 text-center text-slate-400 text-sm">
          © {new Date().getFullYear()} HealthBuddy AI. Informational use only.
        </footer>
      </body>
    </html>
  );
}