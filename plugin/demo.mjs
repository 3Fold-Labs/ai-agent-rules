// Demo answers for trying the plugin. Question text is the binding, same as the tool-rule map:
// an answer is kept only while that exact question is still asked. This is a sample, not a policy.

export const DEMO_DATE = '2026-09-29';

export const DEMO_PROFILE = {
  owner: 'Demo',
  company: 'Demo project',
  channel: 'this chat',
  version: 'demo',
  exceptions: ''
};

export const DEMO_ANSWERS = {
  builder: [
    {id: 1, question: 'Can it draft a purchase recommendation with a named cost?', choice: 'N/A'},
    {id: 13, question: 'Can it edit files inside an approved project folder?', choice: 'ALLOW'},
    {id: 14, question: 'Can it create files inside an approved project folder?', choice: 'ALLOW'},
    {
      id: 16,
      question: 'Can it install the packages your project already lists (npm install, pip install -r)?',
      choice: 'ALLOW',
      notes: 'only from the lockfile'
    },
    {id: 15, question: 'Can it run formatters / linters / tests locally?', choice: 'ALLOW'},
    {id: 17, question: 'Can it add a new package or library your project did not use before?', choice: 'ASK'},
    {
      id: 21,
      question: 'Can it delete build artifacts / cache folders that regenerate?',
      choice: 'ALLOW',
      suggested: true
    },
    {id: 29, question: 'Can it force-push or rewrite shared git history?', choice: 'DENY'},
    {id: 48, question: 'Can it deploy updates to your live site or app?', choice: 'DENY'},
    {id: 73, question: 'Can it run commands as administrator (sudo)?', choice: 'DENY'}
  ],
  personal: [
    {id: 1, question: 'Can it compare prices and find deals without buying anything?', choice: 'ALLOW'},
    {
      id: 3,
      question: 'Can it buy something once you approve the exact item and total price?',
      choice: 'ASK'
    },
    {id: 9, question: 'Can it save a new payment card to a website or app?', choice: 'DENY'},
    {
      id: 14,
      question: 'Can it draft a listing for something you are selling without posting it?',
      choice: 'ALLOW',
      suggested: true
    }
  ]
};

export function demoRequest(track = 'builder') {
  const rows = DEMO_ANSWERS[track];
  if (!rows) throw Error('Choose the Builder or Personal track.');
  const answers = {};
  for (const row of rows) {
    const answer = {choice: row.choice, notes: row.notes || ''};
    if (row.suggested) answer.suggested = true;
    answers[row.id] = answer;
  }
  return {track, ...DEMO_PROFILE, answers};
}
