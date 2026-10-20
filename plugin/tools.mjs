import {listQuestions, explainAnswer, compileAnswers, REMINDER} from './session.mjs';

const TRACK = {type: 'string', enum: ['builder', 'personal'], description: 'builder or personal'};
const CHOICE = {
  type: 'string',
  description: "ALLOW, ASK, DENY, or Doesn't apply. Empty means unanswered, which grants nothing."
};

export const TOOLS = [
  {
    name: 'list_questions',
    description:
      'List the 100 questions for the Builder or Personal track. Each question includes its suggested answer. Unanswered questions grant nothing. This tool reads the worksheet on this machine and makes no network calls.',
    inputSchema: {
      type: 'object',
      properties: {
        track: {...TRACK, description: 'builder (I build with AI) or personal (everyday life)'},
        group: {type: 'string', description: 'Optional section name. Omit it to list the whole track.'}
      },
      required: ['track'],
      additionalProperties: false
    },
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}
  },
  {
    name: 'explain_answer',
    description:
      'Explain one answer: what the policy will say, and, on the Builder track, what the coding tool settings will record. An answer that is not reviewed is never an ALLOW. Tool settings are a guardrail, not a lock. Cursor is guidance only.',
    inputSchema: {
      type: 'object',
      properties: {
        track: TRACK,
        id: {type: 'integer', minimum: 1, maximum: 100, description: 'Question number, 1 to 100'},
        choice: CHOICE,
        notes: {type: 'string', description: 'Optional scope, such as a folder, recipient, or limit'},
        suggested: {
          type: 'boolean',
          description: 'True when the choice is still the suggested answer and the person has not reviewed it'
        }
      },
      required: ['track', 'id'],
      additionalProperties: false
    },
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}
  },
  {
    name: 'compile_answers',
    description:
      'Compile answers into the Markdown policy and, for the Builder track, settings files for Claude Code, Codex, Gemini CLI, and Cursor. Returns file text. Writes nothing and makes no network calls. Pass demo true with no answers to compile the built-in demo. Unanswered questions grant nothing. ' +
      REMINDER,
    inputSchema: {
      type: 'object',
      properties: {
        track: TRACK,
        demo: {
          type: 'boolean',
          description: 'True to compile the built-in demo answers. Do not send your own answers in that call.'
        },
        date: {type: 'string', description: 'Optional YYYY-MM-DD date written into the tool files'},
        answers: {
          type: 'object',
          description: 'Map of question number to {choice, notes, suggested}. Omit unanswered questions.'
        },
        off: {type: 'array', items: {type: 'string'}, description: 'Section names that do not apply'},
        owner: {type: 'string'},
        company: {type: 'string', description: 'Project or team'},
        channel: {type: 'string', description: 'Where to ask'},
        version: {type: 'string', description: 'Policy version or date'},
        exceptions: {
          type: 'string',
          description: 'Additional boundaries. Any text here turns every tool allow into ask.'
        }
      },
      required: [],
      additionalProperties: false
    },
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}
  }
];

const HANDLERS = {list_questions: listQuestions, explain_answer: explainAnswer, compile_answers: compileAnswers};

export function callTool(name, args) {
  const handler = HANDLERS[name];
  if (!handler) throw Error(`Unknown tool: ${name}`);
  return handler(args || {});
}
