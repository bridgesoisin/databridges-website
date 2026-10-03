import { describe, it, expect } from "vitest";
import {
  codePointLength,
  countWordCharacters,
  countWords,
  foldCase,
  hasWordCharacter,
  isQuestionForm,
  isSpaceDelimitedLang,
  median,
  normaliseText,
  parseIsoDate,
  splitSentences,
  takeWords,
  truncateEvidence,
} from "@/lib/visibility/text";

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
const NBSP = cp(0xa0);
const ZWSP = cp(0x200b);
const ZWNJ = cp(0x200c);
const ZWJ = cp(0x200d);
const WORD_JOINER = cp(0x2060);
const BOM = cp(0xfeff);
const RLO = cp(0x202e);
const LRO = cp(0x202d);
const LRM = cp(0x200e);
const RLM = cp(0x200f);
const LRI = cp(0x2066);
const PDI = cp(0x2069);

describe("normaliseText", () => {
  it("applies NFKC", () => {
    expect(normaliseText(cp(0xfb01) + "nd")).toBe("find");
    expect(normaliseText(cp(0xff21, 0xff22, 0xff23))).toBe("ABC");
    expect(normaliseText("e" + cp(0x301))).toBe(cp(0xe9));
    expect(normaliseText(cp(0x2460))).toBe("1");
  });

  it("turns NBSP and other Unicode spaces into ordinary spaces", () => {
    expect(normaliseText(`a${NBSP}b`)).toBe("a b");
    expect(normaliseText(`a${cp(0x3000)}b${cp(0x2003)}c${cp(0x202f)}d`)).toBe("a b c d");
  });

  it("removes zero-width characters U+200B-U+200D, U+2060 and U+FEFF", () => {
    expect(normaliseText(`foo${ZWSP}bar`)).toBe("foobar");
    expect(normaliseText(`foo${ZWNJ}bar${ZWJ}baz`)).toBe("foobarbaz");
    expect(normaliseText(`${BOM}hello${WORD_JOINER}world`)).toBe("helloworld");
    expect(normaliseText(`${ZWSP}${ZWNJ}${ZWJ}${WORD_JOINER}${BOM}`)).toBe("");
  });

  it("does not leave a space where a zero-width character sat between a word and a space", () => {
    expect(normaliseText(`a${ZWSP} b`)).toBe("a b");
    expect(normaliseText(`a ${ZWSP}b`)).toBe("a b");
  });

  it("collapses whitespace runs of every kind and trims", () => {
    expect(normaliseText("  a \t\n\r\n  b\f\vc  ")).toBe("a b c");
    expect(normaliseText("a" + cp(0x85) + "b")).toBe("a b");
    expect(normaliseText("a" + cp(0x2028) + cp(0x2029) + "b")).toBe("a b");
  });

  it("handles empty and whitespace-only input", () => {
    expect(normaliseText("")).toBe("");
    expect(normaliseText(" \n\t ")).toBe("");
  });

  it("is idempotent", () => {
    const samples = [`  A${NBSP}${NBSP}b ${ZWSP}c  `, cp(0xfb01) + " x", "plain text", `\n${BOM}x\n`];
    for (const sample of samples) {
      const once = normaliseText(sample);
      expect(normaliseText(once)).toBe(once);
    }
  });

  it("does not change case", () => {
    expect(normaliseText("Hello WORLD")).toBe("Hello WORLD");
  });
});

describe("foldCase", () => {
  it("lowercases without locale rules", () => {
    expect(foldCase("TITLE Index")).toBe("title index");
    expect(foldCase("I")).toBe("i");
    expect(foldCase(cp(0xc9, 0xc0))).toBe(cp(0xe9, 0xe0));
  });

  it("equals toLowerCase for the dotted capital I (no tailoring)", () => {
    const dotted = cp(0x130);
    expect(foldCase(dotted)).toBe(dotted.toLowerCase());
  });
});

describe("countWords", () => {
  it("counts whitespace-delimited tokens", () => {
    expect(countWords("one two  three\nfour\tfive")).toBe(5);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });

  it("counts a token only if it holds a letter or a number", () => {
    expect(countWords("a - b")).toBe(2);
    expect(countWords("... --- !!! | * _")).toBe(0);
    expect(countWords("3.14 is pi")).toBe(3);
    expect(countWords("(2024)")).toBe(1);
    expect(countWords("don't stop")).toBe(2);
    expect(countWords("a-b c_d")).toBe(2);
  });

  it("splits on NBSP and other Unicode spaces", () => {
    expect(countWords(`one${NBSP}two${cp(0x3000)}three`)).toBe(3);
  });

  it("counts non-ASCII letters, digits and supplementary-plane letters", () => {
    expect(countWords(`${cp(0xe9, 0x63, 0x6f, 0x6c, 0x65)} ${cp(0x0e01)}${cp(0x0e02)} ${cp(0x20000)}`)).toBe(3);
    expect(countWords(cp(0x0663, 0x0664))).toBe(1);
  });

  it("does not count symbol-only tokens such as emoji", () => {
    expect(countWords(`${cp(0x1f600)} ${cp(0x1f4a1)} hello`)).toBe(1);
  });

  it("treats a run of CJK without spaces as one token", () => {
    expect(countWords(cp(0x6e2f, 0x753a, 0x30ed, 0x30fc, 0x30b9, 0x30bf, 0x30fc, 0x30ba))).toBe(1);
  });

  it("is linear on long inputs", () => {
    const text = "word ".repeat(400_000);
    const started = Date.now();
    expect(countWords(text)).toBe(400_000);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("takeWords, countWordCharacters, hasWordCharacter, codePointLength", () => {
  it("takeWords returns text up to and including the nth counted word", () => {
    expect(takeWords("one two three four", 2)).toBe("one two");
    expect(takeWords("one - two three", 2)).toBe("one - two");
    expect(takeWords("one two", 5)).toBe("one two");
    expect(takeWords("one two", 0)).toBe("");
  });

  it("countWordCharacters counts letters and numbers by code point and honours the limit", () => {
    expect(countWordCharacters("ab 1-c")).toBe(4);
    expect(countWordCharacters(cp(0x20000, 0x20001, 0x20002))).toBe(3);
    expect(countWordCharacters("abcdef", 3)).toBe(3);
  });

  it("hasWordCharacter detects letters and numbers", () => {
    expect(hasWordCharacter("--- 7")).toBe(true);
    expect(hasWordCharacter("--- ***")).toBe(false);
  });

  it("codePointLength counts surrogate pairs once", () => {
    expect(codePointLength("abc")).toBe(3);
    expect(codePointLength(cp(0x1f600) + "a")).toBe(2);
    expect(codePointLength("")).toBe(0);
  });
});

describe("isSpaceDelimitedLang", () => {
  it("is false for zh, ja, ko and th, with or without region and in any case", () => {
    for (const lang of ["zh", "ja", "ko", "th", "zh-Hans", "ja-JP", "ZH-cn", "Th", " ko "]) {
      expect(isSpaceDelimitedLang(lang), lang).toBe(false);
    }
  });

  it("is true for other languages and for a missing language", () => {
    for (const lang of ["en", "en-GB", "de", "ga", "fr-CA", "vi", "", null, undefined]) {
      expect(isSpaceDelimitedLang(lang), String(lang)).toBe(true);
    }
  });
});

describe("splitSentences", () => {
  it("splits on terminators followed by whitespace", () => {
    expect(splitSentences("One. Two! Three? Four")).toEqual(["One.", "Two!", "Three?", "Four"]);
  });

  it("treats runs of terminators as one boundary", () => {
    expect(splitSentences("Really?! Yes... Fine.")).toEqual(["Really?!", "Yes...", "Fine."]);
  });

  it("does not split when the terminator is not followed by whitespace", () => {
    expect(splitSentences("Version 3.14 is out. See example.com now.")).toEqual([
      "Version 3.14 is out.",
      "See example.com now.",
    ]);
  });

  it("splits at abbreviations (documented limitation absorbed by wide thresholds)", () => {
    expect(splitSentences("Dr. Smith arrived.")).toEqual(["Dr.", "Smith arrived."]);
  });

  it("handles a trailing terminator, extra whitespace and newlines", () => {
    expect(splitSentences("  A b.  \n\n C d!  ")).toEqual(["A b.", "C d!"]);
  });

  it("drops pieces that hold no letter or number", () => {
    expect(splitSentences("... ... Hello.")).toEqual(["Hello."]);
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
    expect(splitSentences("!!!")).toEqual([]);
  });

  it("returns one sentence when there is no terminator", () => {
    expect(splitSentences("no terminator here")).toEqual(["no terminator here"]);
  });

  it("runs in linear time on pathological input", () => {
    const started = Date.now();
    splitSentences("!".repeat(1_000_000));
    splitSentences(". ".repeat(500_000));
    splitSentences("a. ".repeat(300_000));
    splitSentences(("?".repeat(1000) + "x").repeat(500));
    expect(Date.now() - started).toBeLessThan(3000);
  });
});

describe("median", () => {
  it("returns the middle value for odd counts", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("averages the two middle values for even counts", () => {
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("returns null for an empty list", () => {
    expect(median([])).toBeNull();
  });

  it("handles a single value and duplicates", () => {
    expect(median([7])).toBe(7);
    expect(median([2, 2, 2, 9])).toBe(2);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("truncateEvidence", () => {
  it("caps at 200 code points by default", () => {
    const out = truncateEvidence("a".repeat(500));
    expect(out).toHaveLength(200);
    expect(truncateEvidence("a".repeat(200))).toHaveLength(200);
    expect(truncateEvidence("a".repeat(150))).toHaveLength(150);
  });

  it("accepts an explicit limit, including zero", () => {
    expect(truncateEvidence("abcdef", 3)).toBe("abc");
    expect(truncateEvidence("abcdef", 0)).toBe("");
  });

  it("never splits a surrogate pair", () => {
    const emoji = cp(0x1f600);
    const out = truncateEvidence(emoji.repeat(300));
    expect(codePointLength(out)).toBe(200);
    expect(out.length).toBe(400);
    expect(truncateEvidence(emoji.repeat(3), 2)).toBe(emoji + emoji);
  });

  it("strips bidirectional override and isolate characters", () => {
    const hostile = `safe${RLO}evil${LRO}more${LRI}x${PDI}${LRM}${RLM}`;
    expect(truncateEvidence(hostile)).toBe("safeevilmorex");
    for (const mark of [RLO, LRO, LRI, PDI, LRM, RLM, cp(0x202a), cp(0x202b), cp(0x202c), cp(0x2067), cp(0x2068), cp(0x61c)]) {
      expect(truncateEvidence(`a${mark}b`)).toBe("ab");
    }
  });

  it("strips control characters and turns line breaks into spaces", () => {
    expect(truncateEvidence("a" + cp(0, 1, 7, 0x1b, 0x7f, 0x9f) + "b")).toBe("ab");
    expect(truncateEvidence("a\nb\tc\r\nd")).toBe("a b c  d");
    expect(truncateEvidence("a" + cp(0x2028) + "b")).toBe("a b");
  });

  it("leaves ordinary text, punctuation and non-ASCII letters alone", () => {
    expect(truncateEvidence("Caf" + cp(0xe9) + " <b>\"x\"</b> & more")).toBe("Caf" + cp(0xe9) + " <b>\"x\"</b> & more");
  });

  it("counts the cap after stripping, so removed characters do not use up the budget", () => {
    const out = truncateEvidence(RLO.repeat(300) + "a".repeat(250));
    expect(out).toBe("a".repeat(200));
  });
});

describe("isQuestionForm", () => {
  it("accepts text that ends with a question mark", () => {
    expect(isQuestionForm("Price list?")).toBe(true);
    expect(isQuestionForm('Is it "good"?')).toBe(true);
    expect(isQuestionForm("What is this? ")).toBe(true);
  });

  it("accepts text that starts with a question starter, ignoring case and leading symbols", () => {
    expect(isQuestionForm("How we work")).toBe(true);
    expect(isQuestionForm("WHY choose us")).toBe(true);
    expect(isQuestionForm("- Can we help")).toBe(true);
    expect(isQuestionForm(cp(0x201c) + "Where to start")).toBe(true);
    expect(isQuestionForm("1. Can we help")).toBe(false);
    expect(isQuestionForm("Don't be shy")).toBe(false);
  });

  it("rejects statements and empty text", () => {
    expect(isQuestionForm("Our services")).toBe(false);
    expect(isQuestionForm("Whatever you need")).toBe(false);
    expect(isQuestionForm("")).toBe(false);
    expect(isQuestionForm("---")).toBe(false);
  });
});

describe("parseIsoDate", () => {
  it("parses calendar dates to UTC midnight", () => {
    expect(parseIsoDate("2024-03-05")).toBe("2024-03-05T00:00:00.000Z");
    expect(parseIsoDate("2024-03")).toBe("2024-03-01T00:00:00.000Z");
    expect(parseIsoDate("2024")).toBe("2024-01-01T00:00:00.000Z");
  });

  it("parses date-times with Z and numeric offsets to UTC", () => {
    expect(parseIsoDate("2024-03-05T10:20:30Z")).toBe("2024-03-05T10:20:30.000Z");
    expect(parseIsoDate("2024-03-05T10:20:30+02:00")).toBe("2024-03-05T08:20:30.000Z");
    expect(parseIsoDate("2024-03-05T01:00:00-0530")).toBe("2024-03-05T06:30:00.000Z");
    expect(parseIsoDate("2024-03-05T10:20+01:00")).toBe("2024-03-05T09:20:00.000Z");
    expect(parseIsoDate("2024-03-05T10:20:30.5Z")).toBe("2024-03-05T10:20:30.500Z");
  });

  it("applies the offset across a day boundary", () => {
    expect(parseIsoDate("2024-01-01T00:30:00+01:00")).toBe("2023-12-31T23:30:00.000Z");
  });

  it("rejects impossible dates and times", () => {
    expect(parseIsoDate("2024-02-30")).toBeNull();
    expect(parseIsoDate("2023-02-29")).toBeNull();
    expect(parseIsoDate("1900-02-29")).toBeNull();
    expect(parseIsoDate("2024-13-01")).toBeNull();
    expect(parseIsoDate("2024-00-10")).toBeNull();
    expect(parseIsoDate("2024-04-31")).toBeNull();
    expect(parseIsoDate("2024-03-05T24:00:00Z")).toBeNull();
    expect(parseIsoDate("2024-03-05T10:60:00Z")).toBeNull();
    expect(parseIsoDate("2024-03-05T10:00:00+25:00")).toBeNull();
  });

  it("accepts leap days in leap years", () => {
    expect(parseIsoDate("2024-02-29")).toBe("2024-02-29T00:00:00.000Z");
    expect(parseIsoDate("2000-02-29")).toBe("2000-02-29T00:00:00.000Z");
  });

  it("rejects text that is not ISO 8601 or W3C datetime", () => {
    for (const bad of ["", "yesterday", "5 March 2024", "03/05/2024", "2024-3-5", "20240305", "2024-03-05foo", "T10:00", "2024-03-05 10:00", "12"]) {
      expect(parseIsoDate(bad), bad).toBeNull();
    }
    expect(parseIsoDate("2024-03-05T10:00:00Z".padEnd(80, " x"))).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseIsoDate("  2024-03-05  ")).toBe("2024-03-05T00:00:00.000Z");
  });
});
