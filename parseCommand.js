function parseCommand(promptText) {
  const pauseRegex = /\$pause\$/i;
  if (pauseRegex.test(promptText)) {
    const command = promptText.replace(pauseRegex, "").trim();
    return { command, explicitDelayMs: 0, isPauseCommand: true };
  }

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

if (typeof module !== 'undefined') {
  module.exports = parseCommand;
}
