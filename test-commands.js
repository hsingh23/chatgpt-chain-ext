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
  const waitTagRegex = /\$wait\s+(\d+)([sm])\$/i;
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
    const sleepTagRegex = /\$sleep(\d+)([sm])\$/i;
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

console.log("Testing new command syntax:");
console.log("=".repeat(50));

testCommands.forEach((cmd, idx) => {
  const result = testParseCommand(cmd);
  console.log(`Test ${idx + 1}: "${cmd}"`);
  console.log(`  -> Command: "${result.command}"`);
  console.log(`  -> Delay: ${result.explicitDelayMs}ms`);
  console.log(`  -> Is Pause: ${result.isPauseCommand}`);
  console.log("");
});
