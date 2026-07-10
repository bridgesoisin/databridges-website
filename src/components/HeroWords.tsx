"use client";

export default function HeroWords() {
  const line1Words = ["Making", "AI", "Useful"];
  const line2Words = ["(and", "mildly", "tolerable)"];

  return (
    <>
      <span className="font-syne block leading-none" style={{ fontSize: "clamp(2.75rem, 5.5vw, 5rem)", fontWeight: 800 }}>
        {line1Words.map((word, i) => (
          <span
            key={word}
            className="hero-word text-white"
            style={{ animationDelay: `${i * 80}ms`, marginRight: "0.3em" }}
          >
            {word}
          </span>
        ))}
      </span>
      <span className="font-syne block" style={{ fontSize: "clamp(1.75rem, 4vw, 4rem)", fontWeight: 700, color: "var(--color-cyan)" }}>
        {line2Words.map((word, i) => (
          <span
            key={word}
            className="hero-word"
            style={{
              animationDelay: `${(line1Words.length + i) * 80}ms`,
              marginRight: "0.3em",
            }}
          >
            {word}
          </span>
        ))}
      </span>
    </>
  );
}
