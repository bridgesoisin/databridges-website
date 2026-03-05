"use client";

export default function HeroWords() {
  const line1Words = ["Making", "AI", "Useful"];
  const line2Words = ["(and", "mildly", "tolerable)"];

  return (
    <>
      <span className="block leading-none" style={{ fontFamily: "var(--font-syne)", fontSize: "clamp(3rem, 8vw, 6.5rem)", fontWeight: 800 }}>
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
      <span className="block whitespace-nowrap" style={{ fontFamily: "var(--font-syne)", fontSize: "clamp(2rem, 6vw, 5.5rem)", fontWeight: 700, color: "var(--color-cyan)" }}>
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
