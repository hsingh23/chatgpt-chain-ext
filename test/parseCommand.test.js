const assert = require('assert');
const parseCommand = require('../parseCommand');

describe('parseCommand', function() {
  const testCommands = [
    "Tell me about AI $wait 5s$",
    "$wait 2m$ Then explain machine learning",
    "Create a summary $wait 30s$ and analyze it",
    "$pause$",
    "Review this document $pause$",
    "$pause$ Manual checkpoint",
    "$sleep10s$ Old format test",
    "Legacy command $sleep2m$",
    "Normal prompt without any special syntax",
    "Another regular command",
  ];

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
    it(`parses command ${idx + 1}`, function() {
      const result = parseCommand(cmd);
      const expected = expectedResults[idx];
      assert.strictEqual(result.command, expected.command);
      assert.strictEqual(result.explicitDelayMs, expected.explicitDelayMs);
      assert.strictEqual(result.isPauseCommand, expected.isPauseCommand);
    });
  });
});
