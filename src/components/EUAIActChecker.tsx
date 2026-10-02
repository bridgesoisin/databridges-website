"use client";

import { useState } from "react";
import Link from "next/link";

const questions = [
  {
    question: "How does AI show up in your organisation?",
    note: "Select all that apply",
    multi: true,
    options: [
      "A chatbot, AI assistant or AI phone line people talk to",
      "AI-generated or AI-edited content we publish (text, images, video)",
      "Emotion recognition or biometric categorisation",
      "Screening CVs or job applicants",
      "Credit scoring, insurance or eligibility decisions",
      "Internal productivity tools only (Copilot, ChatGPT, etc.)",
      "We don't use AI yet",
    ],
  },
  {
    question:
      "Is your organisation in the EU, or do you serve EU customers?",
    multi: false,
    options: ["Yes", "No", "Not sure"],
  },
  {
    question: "How many people work in your organisation?",
    multi: false,
    options: ["Under 10", "10–50", "50–250", "250+"],
  },
  {
    question: "When did you last review your AI use against the AI Act?",
    multi: false,
    options: [
      "In the last 6 months",
      "Over a year ago",
      "Never",
      "We don't have a policy",
    ],
  },
];

// The Article 50 transparency deadline. Date-safe: never renders negative.
const TRANSPARENCY_DATE = "2026-08-02";

function transparencyCountdown(): string {
  const target = new Date(TRANSPARENCY_DATE).getTime();
  const days = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
  if (days > 1) return `that's ${days} days away`;
  if (days === 1) return "that's tomorrow";
  if (days === 0) return "that's today";
  return "now in force";
}

// Uses that trigger Article 50 transparency duties (live from 2 Aug 2026).
const TRANSPARENCY_USES = [
  "A chatbot, AI assistant or AI phone line people talk to",
  "AI-generated or AI-edited content we publish (text, images, video)",
  "Emotion recognition or biometric categorisation",
];

// Uses that fall under Annex III high-risk (delayed to 2027/2028).
const HIGH_RISK_USES = [
  "Screening CVs or job applicants",
  "Credit scoring, insurance or eligibility decisions",
];

type ResultType = "highRisk" | "transparency" | "minimal" | "none" | "unsure";

function getResult(answers: (string | string[])[]): ResultType {
  const uses = answers[0] as string[];
  const euScope = answers[1] as string;

  if (euScope === "Not sure") return "unsure";
  if (uses.length === 1 && uses[0] === "We don't use AI yet") return "none";

  const hasHighRisk = uses.some((u) => HIGH_RISK_USES.includes(u));
  const hasTransparency = uses.some((u) => TRANSPARENCY_USES.includes(u));

  if (hasHighRisk) return "highRisk";
  if (hasTransparency) return "transparency";
  return "minimal";
}

export default function EUAIActChecker() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<(string | string[])[]>([[], "", "", ""]);
  const [showResult, setShowResult] = useState(false);

  const currentQuestion = questions[currentStep];

  const handleSelect = (option: string) => {
    const newAnswers = [...answers];
    if (currentQuestion.multi) {
      const current = (newAnswers[currentStep] as string[]) || [];
      if (current.includes(option)) {
        newAnswers[currentStep] = current.filter((o) => o !== option);
      } else {
        newAnswers[currentStep] = [...current, option];
      }
    } else {
      newAnswers[currentStep] = option;
    }
    setAnswers(newAnswers);
  };

  const canAdvance = () => {
    const answer = answers[currentStep];
    if (currentQuestion.multi) {
      return (answer as string[]).length > 0;
    }
    return answer !== "";
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResult(true);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setAnswers([[], "", "", ""]);
    setShowResult(false);
  };

  const isSelected = (option: string) => {
    const answer = answers[currentStep];
    if (currentQuestion.multi) {
      return (answer as string[]).includes(option);
    }
    return answer === option;
  };

  if (showResult) {
    const resultType = getResult(answers);
    const countdown = transparencyCountdown();

    return (
      <div>
        {resultType === "highRisk" && (
          <div className="text-center">
            <div className="text-5xl mb-4" aria-hidden="true">
              &#9888;
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              You likely have high-risk (Annex III) AI, and probably
              transparency duties too.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-xl mx-auto">
              Uses like CV screening, credit scoring or eligibility decisions
              fall under <strong>Annex III</strong>. The timing news is good:
              those high-risk obligations were pushed back to{" "}
              <strong>2 December 2027</strong> (and 2 August 2028 for AI built
              into regulated products). The catch: if any system is a
              chatbot, AI phone line or publishes AI-generated content, the{" "}
              <strong>Article 50 transparency duties still apply from 2 August
              2026</strong>, {countdown}. Use the high-risk runway now for an AI
              inventory and gap analysis.
            </p>
            <Link
              href="/contact"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Get in touch with Ois&iacute;n &rarr;
            </Link>
          </div>
        )}

        {resultType === "transparency" && (
          <div className="text-center">
            <div className="text-5xl mb-4 text-cyan" aria-hidden="true">
              &#9888;
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              The August 2026 transparency deadline applies to you.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-xl mx-auto">
              You don&apos;t have obvious high-risk systems, but
              chatbots, AI phone lines, deepfakes and published AI-generated
              content trigger the AI Act&apos;s{" "}
              <strong>Article 50 transparency duties</strong>, and those land on{" "}
              <strong>2 August 2026</strong> ({countdown}), whether or not you
              run any high-risk AI. Most fixes are a line of disclosure copy or a
              label, not an engineering project, but they have to be
              there.
            </p>
            <Link
              href="/contact"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Get in touch with Ois&iacute;n &rarr;
            </Link>
          </div>
        )}

        {resultType === "minimal" && (
          <div className="text-center">
            <div className="text-5xl mb-4 text-emerald-600" aria-hidden="true">
              &#10003;
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              You&apos;re light-touch, for now.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-xl mx-auto">
              Using AI for internal productivity (Copilot, ChatGPT) doesn&apos;t
              put you in the high-risk or transparency tiers. General-purpose AI
              obligations and basic AI literacy still apply, and that
              changes the moment you add a customer-facing chatbot or publish
              AI-generated content. A short review keeps you ahead of it.
            </p>
            <Link
              href="/contact"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Get in touch &rarr;
            </Link>
          </div>
        )}

        {resultType === "none" && (
          <div className="text-center">
            <div className="text-5xl mb-4 text-emerald-600" aria-hidden="true">
              &#10003;
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              Nothing to disclose yet, a good time to plan.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-xl mx-auto">
              You&apos;re not using AI, so the Act&apos;s obligations don&apos;t
              bite today. The value now is doing it right first time: when you do
              adopt, building disclosure and governance in from the start is far
              cheaper than retrofitting. That&apos;s exactly what the Four
              Bridges approach is for.
            </p>
            <Link
              href="/contact"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Get in touch &rarr;
            </Link>
          </div>
        )}

        {resultType === "unsure" && (
          <div className="text-center">
            <div className="text-5xl mb-4 text-cyan" aria-hidden="true">
              ?
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              Hard to say without a bit more context.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-xl mx-auto">
              If you&apos;re not sure whether the Act reaches you, that
              uncertainty is a reason to get the use case reviewed before
              relying on a general checker.
            </p>
            <Link
              href="/contact"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Get in touch &rarr;
            </Link>
          </div>
        )}

        <p className="text-sm text-navy/70 text-center mt-8 max-w-xl mx-auto">
          This tool gives a general indication only, not legal advice. Dates
          reflect the May 2026 Digital Omnibus: high-risk (Annex III) duties now
          apply from December 2027, while Article 50 transparency duties still
          apply from 2 August 2026. For a formal assessment, consult a qualified
          solicitor.
        </p>

        <div className="text-center mt-6">
          <button
            onClick={handleReset}
            className="text-navy/80 text-sm underline hover:text-navy transition-colors duration-200"
          >
            Start again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Question */}
      <h3 className="font-syne text-xl font-bold text-navy mb-2">
        {currentQuestion.question}
      </h3>
      {currentQuestion.note && (
        <p className="text-sm text-navy/70 mb-6">
          ({currentQuestion.note})
        </p>
      )}

      {/* Options */}
      <div className="flex flex-wrap gap-3 mb-8">
        {currentQuestion.options.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            aria-pressed={isSelected(option)}
            className={`inline-flex items-center min-h-[44px] px-4 py-2.5 rounded-2xl text-sm font-medium border transition-colors duration-200 ${
              isSelected(option)
                ? "bg-navy border-navy text-white"
                : "bg-white border-navy/20 text-navy hover:border-navy/40"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {currentStep > 0 ? (
          <button
            onClick={handleBack}
            className="text-navy/80 text-sm hover:text-navy transition-colors duration-200"
          >
            &larr; Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleNext}
          disabled={!canAdvance()}
          className={`px-6 py-3 rounded-full text-sm font-semibold transition-colors duration-200 ${
            canAdvance()
              ? "bg-navy text-white hover:bg-navy/90"
              : "bg-navy/20 text-navy/40 cursor-not-allowed"
          }`}
        >
          {currentStep === 3 ? "See my result →" : "Next →"}
        </button>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mt-10" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={4} aria-label={`Question ${currentStep + 1} of 4`}>
        {[0, 1, 2, 3].map((step) => (
          <div
            key={step}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
              step === currentStep ? "bg-navy" : "bg-navy/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
