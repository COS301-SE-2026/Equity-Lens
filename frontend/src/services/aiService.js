// Keyword mock responses for demo.
// More categories are added in later commits.

export const normalize = (input = '') =>
  input
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Returned when no keyword matches.
const FALLBACK = {
  text:
    "I'm a demo assistant (Send hi/hello/hey or get fallback message)",
};

export const getMockResponse = (rawInput) => {
  const text = normalize(rawInput);

  if (/\b(hi|hello|hey)\b/.test(text)) {
    return {
      text: "Hi. Good day",
    };
  }

  return FALLBACK;
};
