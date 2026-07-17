/**
 * @fileoverview Parses the `print:` keyword tag embedded in a Hello Club event
 * description. The tag selects an event for printing and optionally overrides
 * the lead time, copy count, and print mode for that specific event.
 * @module tag-parser
 */

const logger = require('../services/logger');

const MIN_LEAD_MINUTES = 1;
const MAX_LEAD_MINUTES = 1440; // 24 hours
const MIN_COPIES = 1;
const MAX_COPIES = 10;

/**
 * Parses a `print:` tag out of an event description.
 *
 * Selection rule: an event is selected for printing if (and only if) its
 * description contains `print:` (case-insensitive, anywhere in the text). The
 * tag's value runs from after the colon to the end of that line.
 *
 * Recognised parameters (all optional, order-independent):
 * - `<n>min` / `<n>minutes` → lead time in minutes (1–1440)
 * - `<n>copy` / `<n>copies` → copy count for local printing (1–10)
 * - `local` or `email`       → print mode
 * - `enabled`                → accepted as a no-op (bare-tag synonym)
 *
 * Unrecognised or out-of-range tokens are logged and ignored — the presence of
 * the tag still selects the event, so a typo never silently drops a printout.
 * Markdown emphasis around the tag (e.g. `**print: 30min**`) is tolerated.
 *
 * @param {string|null|undefined} description - The event description (markdown, nullable).
 * @returns {{leadMinutes: number|null, copies: number|null, printMode: string|null}|null}
 *   `null` when there is no tag or the description is not a string. Otherwise an
 *   object whose fields are `null` where the tag did not specify them (the caller
 *   falls back to config defaults).
 */
function parseTag(description) {
  if (typeof description !== 'string') {
    return null;
  }

  const tagMatch = /print:/i.exec(description);
  if (!tagMatch) {
    return null;
  }

  // Value = text after the colon up to the end of the line.
  const afterTag = description.slice(tagMatch.index + tagMatch[0].length);
  const newlineIndex = afterTag.search(/\r?\n/);
  const rawValue = newlineIndex === -1 ? afterTag : afterTag.slice(0, newlineIndex);

  // Strip markdown emphasis/formatting characters so tokens tokenize cleanly.
  const value = rawValue.replace(/[*_`~]/g, ' ').trim();

  const result = { leadMinutes: null, copies: null, printMode: null };

  // Bare tag (or tag with only markdown noise): event selected, defaults apply.
  if (value === '') {
    return result;
  }

  let leftover = value;

  const leadMatch = /(\d+)\s*min(?:s|utes)?/i.exec(value);
  if (leadMatch) {
    const minutes = parseInt(leadMatch[1], 10);
    if (minutes >= MIN_LEAD_MINUTES && minutes <= MAX_LEAD_MINUTES) {
      result.leadMinutes = minutes;
    } else {
      logger.warn(
        `print: tag lead time out of range (${MIN_LEAD_MINUTES}-${MAX_LEAD_MINUTES}): ${minutes} — ignoring, using default`
      );
    }
    leftover = leftover.replace(leadMatch[0], ' ');
  }

  const copiesMatch = /(\d+)\s*cop(?:y|ies)/i.exec(value);
  if (copiesMatch) {
    const copies = parseInt(copiesMatch[1], 10);
    if (copies >= MIN_COPIES && copies <= MAX_COPIES) {
      result.copies = copies;
    } else {
      logger.warn(`print: tag copies out of range (${MIN_COPIES}-${MAX_COPIES}): ${copies} — ignoring, using default`);
    }
    leftover = leftover.replace(copiesMatch[0], ' ');
  }

  const modeMatch = /\b(local|email)\b/i.exec(value);
  if (modeMatch) {
    result.printMode = modeMatch[1].toLowerCase();
    leftover = leftover.replace(modeMatch[0], ' ');
  }

  // `enabled` is an explicit no-op synonym for a bare tag.
  leftover = leftover.replace(/\benabled\b/gi, ' ');

  const junk = leftover.trim().replace(/\s+/g, ' ');
  if (junk) {
    logger.warn(`Unrecognized token(s) in print: tag: "${junk}" (ignored; event still selected)`);
  }

  return result;
}

module.exports = { parseTag };
