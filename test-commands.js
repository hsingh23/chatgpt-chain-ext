// Test cases for new command syntax
const testCommands = [
  // New $wait syntax
  "Tell me about AI $wait 5s$",
  "$wait 2m$ Then explain machine learning",
  "Create a summary $wait 30s$ and analyze it",
  
  // Pause commands
  "$pause$",
  "Review this document $pause$",
  "$pause$ Manual checkpoint",
  
  // Legacy sleep syntax (should still work)
  "$sleep10s$ Old format test",
  "Legacy command $sleep2m$",
  
  // Regular commands
  "Normal prompt without any special syntax",
  "Another regular command"
];

// Test parseCommand function logic
function testParseCommand(promptText) {
  // Check for pause command first
  const pauseRegex = /\$pause\$/i;
  if (pauseRegex.test(promptText)) {
    const command = promptText.replace(pauseRegex, "").trim();
    return { command, explicitDelayMs: 0, isPauseCommand: true };
  }

  // Check for new wait syntax: $wait 30s$ or $wait 2m$
  const waitTagRegex = /\$wait\s*(\d+)([sm])\$/i;
  let explicitDelayMs = 0;
  let command = promptText;
  const waitMatch = promptText.match(waitTagRegex);

  if (waitMatch) {
    const duration = parseInt(waitMatch[1]);
    const unit = waitMatch[2].toLowerCase();
    if (unit === "s") {
      explicitDelayMs = duration * 1000;
    } else if (unit === "m") {
      explicitDelayMs = duration * 60 * 1000;
    }
    command = promptText.replace(waitTagRegex, "").trim();
  } else {
    // Legacy support for old sleep syntax: $sleep30s$
    const sleepTagRegex = /\$sleep\s*(\d+)([sm])\$/i;
    const sleepMatch = promptText.match(sleepTagRegex);

    if (sleepMatch) {
      const duration = parseInt(sleepMatch[1]);
      const unit = sleepMatch[2].toLowerCase();
      if (unit === "s") {
        explicitDelayMs = duration * 1000;
      } else if (unit === "m") {
        explicitDelayMs = duration * 60 * 1000;
      }
      command = promptText.replace(sleepTagRegex, "").trim();
    }
  }

  return { command, explicitDelayMs, isPauseCommand: false };
}

const assert = require("assert");

// Expected results for each test command
const expectedResults = [
  { command: "Tell me about AI", explicitDelayMs: 5000, isPauseCommand: false },
  {
    command: "Then explain machine learning",
    explicitDelayMs: 120000,
    isPauseCommand: false,
  },
  {
    command: "Create a summary  and analyze it",
    explicitDelayMs: 30000,
    isPauseCommand: false,
  },
  { command: "", explicitDelayMs: 0, isPauseCommand: true },
  { command: "Review this document", explicitDelayMs: 0, isPauseCommand: true },
  { command: "Manual checkpoint", explicitDelayMs: 0, isPauseCommand: true },
  { command: "Old format test", explicitDelayMs: 10000, isPauseCommand: false },
  { command: "Legacy command", explicitDelayMs: 120000, isPauseCommand: false },
  {
    command: "Normal prompt without any special syntax",
    explicitDelayMs: 0,
    isPauseCommand: false,
  },
  { command: "Another regular command", explicitDelayMs: 0, isPauseCommand: false },
];

testCommands.forEach((cmd, idx) => {
  const result = testParseCommand(cmd);
  const expected = expectedResults[idx];
  assert.strictEqual(
    result.command,
    expected.command,
    `Command mismatch for test ${idx + 1}`
  );
  assert.strictEqual(
    result.explicitDelayMs,
    expected.explicitDelayMs,
    `Delay mismatch for test ${idx + 1}`
  );
  assert.strictEqual(
    result.isPauseCommand,
    expected.isPauseCommand,
    `Pause flag mismatch for test ${idx + 1}`
  );
});

console.log("All tests passed!");
