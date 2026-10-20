import {
  TRACKS,
  SCHEMA,
  POLICY_IDS,
  NOTES_MAX,
  CHOICES,
  DECISION_LABELS,
  QUICK_START,
  emptyPolicy,
  trackGroups,
  normalizePolicy,
  effectiveAnswer,
  questionHash,
  instructionText,
  fileNames,
  answeredCount,
  reviewLine
} from '../src/core/questionnaire.mjs';
import {
  TOOL_FILE_NAMES,
  TOOL_PATHS,
  TOOL_TAG_TEXT,
  toolTag,
  toolDecision,
  compileToolSettings,
  coverageText,
  tokenLabel
} from '../src/core/compiler.mjs';
import {VERSION} from '../src/core/version.mjs';
import {DEMO_ANSWERS, demoRequest} from './demo.mjs';

export const PLUGIN_VERSION = VERSION.slice(1);
export const SERVER_NAME = 'ai-agent-rules';

export const REMINDER = [
  "Unanswered questions and Doesn't apply grant no permission. Ask before acting on them.",
  'An answer that is not reviewed is never an ALLOW.',
  'Tool settings are a strong guardrail, not a lock.',
  "Cursor's file is guidance only. Cursor applies these instructions only in Auto-review mode and does not treat them as security.",
  'This server stays on your machine and makes no network calls.'
].join(' ');

const PERSONAL_FILES =
  'On the Personal track, rules stay as instructions, because everyday assistants do not accept permission files.';

const CHOICE_WORDS = new Map([
  ['allow', 'ALLOW'],
  ['ask', 'ASK'],
  ['deny', 'DENY'],
  ['n/a', 'N/A'],
  ["doesn't apply", 'N/A'],
  ['doesnt apply', 'N/A']
]);

function trackOf(track) {
  emptyPolicy(track);
  return track;
}

function questionNumber(value) {
  const id =
    typeof value === 'number' ? value : typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(id) || id < 1 || id > 100) throw Error('Question numbers run from 1 to 100.');
  return id;
}

export function choiceOf(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw Error("Choose ALLOW, ASK, DENY, or Doesn't apply.");
  const choice = CHOICE_WORDS.get(value.trim().toLowerCase());
  if (!choice) throw Error("Choose ALLOW, ASK, DENY, or Doesn't apply.");
  return choice;
}

function notesOf(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') throw Error('Notes must be text.');
  if (value.length > NOTES_MAX) throw Error('Notes are too long.');
  return value;
}

function cleanAnswers(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw Error('Answers must be an object keyed by question number.');
  const answers = {};
  for (const [id, value] of Object.entries(raw)) {
    questionNumber(id);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid question answer.');
    const answer = {choice: choiceOf(value.choice), notes: notesOf(value.notes)};
    if (value.suggested === true && answer.choice) answer.suggested = true;
    if (value.qh != null) answer.qh = value.qh;
    answers[id] = answer;
  }
  return answers;
}

export function loadAnswers(input, track) {
  const answers = cleanAnswers(input.answers);
  const state = normalizePolicy(
    {
      schema: SCHEMA,
      policyId: POLICY_IDS[track],
      track,
      answers,
      off: input.off || [],
      company: input.company || '',
      owner: input.owner || '',
      channel: input.channel || '',
      version: input.version || '',
      exceptions: input.exceptions || ''
    },
    track
  );
  for (const [id, value] of Object.entries(answers)) {
    if (value.qh) continue;
    const question = TRACKS[track].questions.find(item => String(item.id) === id);
    if (question && state.answers[id]) state.answers[id].qh = questionHash(question.question);
  }
  return state;
}

export function checkDemoBindings() {
  for (const [track, rows] of Object.entries(DEMO_ANSWERS)) {
    for (const row of rows) {
      const question = TRACKS[track].questions.find(item => item.id === row.id);
      if (!question || question.question !== row.question)
        throw Error(`Demo answer ${track} #${row.id} does not match that question.`);
      if (![...CHOICES, ''].includes(row.choice)) throw Error(`Demo answer ${track} #${row.id} has no such choice.`);
    }
  }
}

function questionView(track, question) {
  const tag = toolTag(track, question.id);
  const view = {
    id: question.id,
    group: question.group,
    question: question.question,
    recommendation: question.recommendation,
    example: question.example
  };
  if (question.hint) view.hint = question.hint;
  if (question.overlap) view.overlap = question.overlap;
  if (tag) view.toolSetting = TOOL_TAG_TEXT[tag];
  return view;
}

export function listQuestions(input = {}) {
  const track = trackOf(input.track);
  const spec = TRACKS[track];
  const group = input.group == null || input.group === '' ? '' : input.group;
  if (typeof group !== 'string') throw Error('Section must be text.');
  const groups = trackGroups(track);
  if (group && !groups.includes(group)) throw Error(`No section named "${group}" on the ${spec.label} track.`);
  const questions = spec.questions
    .filter(question => !group || question.group === group)
    .map(question => questionView(track, question));
  return {
    track,
    label: spec.label,
    title: spec.title,
    count: questions.length,
    total: spec.questions.length,
    groups,
    choices: ['ALLOW', 'ASK', 'DENY', "Doesn't apply"],
    reminder: REMINDER,
    questions
  };
}

function meaning(effect) {
  if (!effect.choice) return 'Unanswered grants nothing. Ask before acting.';
  if (effect.off) return "Doesn't apply grants no permission. Ask before acting.";
  if (effect.decision === 'DENY') return 'DENY means never do this.';
  if (effect.choice === 'ALLOW' && effect.unreviewed)
    return 'This ALLOW is not reviewed, so the policy reads it as ASK. An answer that is not reviewed is never an ALLOW.';
  if (effect.decision === 'ASK' && effect.choice === 'ASK')
    return 'ASK means get an explicit yes for that exact action first.';
  if (effect.choice === 'N/A') return "Doesn't apply grants no permission. Ask before acting.";
  if (effect.notes.trim())
    return 'The policy keeps ALLOW with these notes. Coding tool settings become ask, because a settings file cannot hold a limit you wrote.';
  return 'ALLOW means this action is OK within the scope written in the policy. A settings file can record allow only when the answer is reviewed, has no notes, and additional boundaries are empty.';
}

export function explainAnswer(input = {}) {
  const track = trackOf(input.track);
  const spec = TRACKS[track];
  const id = questionNumber(input.id);
  const question = spec.questions.find(item => item.id === id);
  if (!question) throw Error(`Question ${id} is not on the ${spec.label} track.`);
  const choice = choiceOf(input.choice);
  const notes = notesOf(input.notes);
  const state = emptyPolicy(track);
  if (choice) {
    const answer = {choice, notes};
    if (input.suggested === true) answer.suggested = true;
    state.answers[id] = {...answer, qh: questionHash(question.question)};
  }
  const effect = effectiveAnswer(state, track, question);
  const result = {
    track,
    id,
    question: question.question,
    group: question.group,
    choice: effect.choice || 'UNANSWERED',
    decision: effect.choice ? DECISION_LABELS[effect.decision] : 'UNANSWERED',
    suggested: effect.suggested,
    needsReview: effect.unreviewed,
    meaning: meaning(effect),
    reminder: REMINDER
  };
  if (track === 'builder') {
    const tag = toolTag(track, id);
    result.toolSetting = tag ? TOOL_TAG_TEXT[tag] : TOOL_TAG_TEXT.own;
    if (tag) result.toolDecision = effect.choice || effect.off ? toolDecision(state, question) : 'ask';
  }
  return result;
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dateOf(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Date must be YYYY-MM-DD.');
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day)
    throw Error('Date must be YYYY-MM-DD.');
  return value;
}

function hasOwnAnswers(input) {
  return (
    (input.answers && Object.keys(input.answers).length > 0) ||
    (Array.isArray(input.off) && input.off.length > 0) ||
    ['owner', 'company', 'channel', 'version', 'exceptions'].some(key => typeof input[key] === 'string' && input[key])
  );
}

export function compileAnswers(input = {}) {
  if (input.demo === true && hasOwnAnswers(input))
    throw Error('Pass demo on its own. Send your own answers in a separate call.');
  const track = trackOf(input.demo === true ? input.track || 'builder' : input.track);
  if (input.demo === true) checkDemoBindings();
  const request = input.demo === true ? demoRequest(track) : input;
  const state = loadAnswers(request, track);
  const date = dateOf(input.date) || localDate();
  const names = fileNames(track);
  const full = instructionText(state, track);
  const compact = instructionText(state, track, {compact: true});
  const files = [
    {role: 'policy', name: names.policy, saveAs: names.policy, contents: full},
    {role: 'compact', name: names.compact, saveAs: names.compact, contents: compact}
  ];
  const result = {
    track,
    label: TRACKS[track].label,
    demo: input.demo === true,
    date,
    answered: answeredCount(state, track),
    total: TRACKS[track].questions.length,
    review: reviewLine(state, track),
    quickStart: QUICK_START,
    reminder: REMINDER,
    tokens: {policy: tokenLabel(full), compact: tokenLabel(compact)},
    files
  };
  if (track !== 'builder') {
    result.toolFiles = PERSONAL_FILES;
    return result;
  }
  const compiled = compileToolSettings(state, {date});
  for (const key of ['claude', 'codexRules', 'codexConfig', 'gemini', 'cursor']) {
    files.push({
      role: key,
      name: TOOL_FILE_NAMES[key],
      saveAs: TOOL_PATHS[key],
      contents: compiled.files[key]
    });
  }
  result.coverage = coverageText(compiled.coverage);
  result.cursor = REMINDER;
  return result;
}
