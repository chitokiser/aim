import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Text-to-Speech — AI119",
  description:
    "Convert text to natural AI voice powered by ElevenLabs. Supports Korean, English, Vietnamese and 30+ languages with studio-quality output.",
  openGraph: {
    title: "AI Text-to-Speech — AI119",
    description:
      "Convert text to natural AI voice powered by ElevenLabs. Supports Korean, English, Vietnamese and 30+ languages.",
    url: "https://ai119.netlify.app/tts",
    siteName: "AI119",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Text-to-Speech — AI119",
    description:
      "Convert text to natural AI voice powered by ElevenLabs. Supports 30+ languages.",
  },
};

export default function TtsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
