"use client";

import { useState } from "react";

const questions = [
  {
    question: "What does your organisation use AI for?",
    note: "Select all that apply",
    multi: true,
    options: [
      "Screening CVs or job applications",
      "Credit scoring or insurance risk",
      "Eligibility for public benefits or services",
      "Safety-critical systems or infrastructure",
      "General productivity tools (Copilot, ChatGPT, etc.)",
      "We don't use AI yet",
    ],
  },
  {
    question:
      "Is your organisation based in the EU or serving EU customers?",
    multi: false,
    options: ["Yes", "No", "Not sure"],
  },
  {
    question: "How many people work in your organisation?",
    multi: false,
    options: ["Under 10", "10–50", "50–250", "250+"],
  },
  {
    question:
      "When did you last review your AI policies or governance?",
    multi: false,
    options: [
      "In the last 6 months",
      "Over a year ago",
      "Never",
      "We don't have any",
    ],
  },
];

function getDaysUntilDeadline() {
  const deadline = new Date("2026-08-02");
  const today = new Date();
  return Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

type ResultType = "high" | "low" | "unsure";

function getResult(answers: (string | string[])[]): ResultType {
  const q1 = answers[0] as string[];
  const q2 = answers[1] as string;

  const highRiskUses = [
    "Screening CVs or job applications",
    "Credit scoring or insurance risk",
    "Eligibility for public benefits or services",
    "Safety-critical systems or infrastructure",
  ];

  const hasHighRisk = q1.some((a) => highRiskUses.includes(a));

  if (q2 === "Not sure") return "unsure";
  if (hasHighRisk && q2 === "Yes") return "high";
  if (!hasHighRisk || q2 === "No") return "low";
  return "unsure";
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
    const daysLeft = getDaysUntilDeadline();

    return (
      <div className="animate-fade-in">
        {resultType === "high" && (
          <div className="text-center">
            <div className="text-5xl mb-4" aria-hidden="true">
              &#9888;
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              Your systems likely fall under Annex III.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-lg mx-auto">
              The EU AI Act classifies AI used for recruitment, credit
              scoring, and public benefit eligibility as high-risk. The
              enforcement deadline is August 2, 2026 &mdash; that&apos;s{" "}
              <strong>{daysLeft} days away</strong>. The gap analysis
              process takes time. You should start now.
            </p>
            <a
              href="mailto:hello@databridges.ie"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Book a compliance chat with Ois&iacute;n &rarr;
            </a>
          </div>
        )}

        {resultType === "low" && (
          <div className="text-center">
            <div className="text-5xl mb-4 text-emerald-600" aria-hidden="true">
              &#10003;
            </div>
            <h3 className="font-syne text-2xl font-bold text-navy mb-4">
              You&apos;re likely outside the highest-risk categories.
            </h3>
            <p className="text-navy/70 text-lg leading-relaxed max-w-lg mx-auto">
              General AI obligations still apply under the EU AI Act, but
              you&apos;re not in the most urgent tier. A 30-minute review
              would confirm your position and give you peace of mind.
            </p>
            <a
              href="mailto:hello@databridges.ie"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Book a free 30-minute chat &rarr;
            </a>
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
            <p className="text-navy/70 text-lg leading-relaxed max-w-lg mx-auto">
              If you&apos;re not sure whether the Act applies to you, that
              uncertainty is usually the answer. Let&apos;s spend 30 minutes
              finding out &mdash; it&apos;s free and there&apos;s no obligation.
            </p>
            <a
              href="mailto:hello@databridges.ie"
              className="font-syne inline-block mt-8 bg-navy text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-navy/90 transition-colors duration-200"
            >
              Book a free chat &rarr;
            </a>
          </div>
        )}

        <p className="text-sm text-navy/40 text-center mt-8">
          This tool gives a general indication only, not legal advice. For
          formal compliance assessment, consult a qualified solicitor.
        </p>

        <div className="text-center mt-6">
          <button
            onClick={handleReset}
            className="text-navy/60 text-sm underline hover:text-navy transition-colors duration-200"
          >
            Start again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-10" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={4} aria-label={`Question ${currentStep + 1} of 4`}>
        {[0, 1, 2, 3].map((step) => (
          <div
            key={step}
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
              step === currentStep ? "bg-navy" : "bg-navy/20"
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <h3 className="font-syne text-xl font-bold text-navy mb-2">
        {currentQuestion.question}
      </h3>
      {currentQuestion.note && (
        <p className="text-sm text-navy/50 mb-6">
          ({currentQuestion.note})
        </p>
      )}

      {/* Options */}
      <div className="flex flex-wrap gap-3 mb-8">
        {currentQuestion.options.map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
              isSelected(option)
                ? "bg-navy text-white"
                : "bg-white border border-navy/20 text-navy hover:border-navy/40"
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
            className="text-navy/60 text-sm hover:text-navy transition-colors duration-200"
          >
            &larr; Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleNext}
          disabled={!canAdvance()}
          className={`px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
            canAdvance()
              ? "bg-navy text-white hover:bg-navy/90"
              : "bg-navy/20 text-navy/40 cursor-not-allowed"
          }`}
        >
          {currentStep === 3 ? "See my result →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
