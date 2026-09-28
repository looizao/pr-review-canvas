// Tour prototype: a scripted walk through one tour's data. No server, no agent, no forge.

const params = new URLSearchParams(location.search)
const prKey = params.get('pr') ?? '67'
const tour = (await import(`./data/pr-${prKey}.js`)).default

const app = document.getElementById('app')
const stage = document.getElementById('stage')
const rail = document.getElementById('rail')
const nav = document.getElementById('nav')
const chat = /** @type {HTMLDialogElement} */ (document.getElementById('chat'))
const helpDialog = /** @type {HTMLDialogElement} */ (document.getElementById('help-dialog'))
app.dataset.mood = tour.mood
document.title = `Tour · #${tour.key} ${tour.title}`

const steps = [
  { kind: 'cover' },
  ...tour.beats.map(beat => ({ kind: 'beat', beat })),
  ...tour.decisions.map(decision => ({ kind: 'decision', decision })),
  ...tour.quiz.map(q => ({ kind: 'quiz', q })),
  { kind: 'plan' },
]
const STAGE_LABEL = { world: 'The world', why: 'Why', respect: 'What to respect' }
const CATEGORY_LABEL = {
  'trade-off': 'Trade-off',
  architecture: 'Architecture',
  product: 'Product and feel',
  pokayoke: 'Pokayoke',
  nfr: 'Non-functional',
  spec: 'Spec fidelity',
}
const PLACE_LABEL = { code: 'code comment', pr: 'PR comment', tour: 'tour only' }

const storeKey = `tour-proto-${tour.key}`
const state = load()
function load() {
  try {
    const raw = sessionStorage.getItem(storeKey)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fresh */
  }
  return {
    step: 0,
    picks: {},
    quiz: {},
    audioNoticeSeen: false,
    audioOff: false,
    planConfirmed: false,
    returnTo: null,
    codeOpen: {},
  }
}
function save() {
  try {
    sessionStorage.setItem(storeKey, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

const esc = s =>
  String(s).replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')

// ---- Reachability: a decision must be settled and a question answered before the next step. ----
function settled(step) {
  if (step.kind === 'decision') {
    const p = state.picks[step.decision.id]
    return Boolean(p && (p.pick === 'keep' || (p.pick === 'change' && p.approved)))
  }
  if (step.kind === 'quiz') return state.quiz[step.q.id]?.right === true
  return true
}
function reachable(i) {
  for (let k = 0; k < i; k++) if (!settled(steps[k])) return false
  return true
}

// ---- Rail ----
function renderRail() {
  const groups = [
    { kind: 'cover', label: '', from: 0, to: 0 },
    { kind: 'beats', label: plural(tour.beats.length, 'beat'), from: 1, to: tour.beats.length },
    {
      kind: 'decisions',
      label: plural(tour.decisions.length, 'decision'),
      from: 1 + tour.beats.length,
      to: tour.beats.length + tour.decisions.length,
    },
    {
      kind: 'quiz',
      label: plural(tour.quiz.length, 'question'),
      from: 1 + tour.beats.length + tour.decisions.length,
      to: tour.beats.length + tour.decisions.length + tour.quiz.length,
    },
    { kind: 'plan', label: '', from: steps.length - 1, to: steps.length - 1 },
  ]
  rail.innerHTML = groups
    .map(g => {
      let segs = ''
      for (let i = g.from; i <= g.to; i++) {
        const st =
          i === state.step
            ? 'current'
            : i < state.step || settled(steps[i])
              ? 'done'
              : reachable(i)
                ? 'open'
                : 'ahead'
        segs += `<button class="tour-rail-seg" type="button" data-i="${i}" data-state="${st}" title="${esc(stepTitle(steps[i]))}" aria-label="${esc(stepTitle(steps[i]))}"></button>`
      }
      return `<div class="tour-rail-group" data-kind="${g.kind}"><span class="tour-rail-label">${esc(g.label)}</span><div class="tour-rail-segs">${segs}</div></div>`
    })
    .join('')
}
function stepTitle(step) {
  if (step.kind === 'cover') return 'Cover'
  if (step.kind === 'beat') return step.beat.title
  if (step.kind === 'decision') return step.decision.title
  if (step.kind === 'quiz') return step.q.question
  return 'The plan'
}

// ---- Navigation ----
function go(i) {
  if (i < 0 || i >= steps.length || !reachable(i)) return
  state.step = i
  save()
  render()
  window.scrollTo({ top: 0 })
}
function renderNav() {
  const i = state.step
  const step = steps[i]
  const canNext = i < steps.length - 1 && settled(step)
  const pos =
    step.kind === 'cover'
      ? ''
      : step.kind === 'plan'
        ? 'the plan'
        : `${stepIndexWithin(step)} of ${plural(countOf(step.kind), step.kind === 'quiz' ? 'question' : step.kind)}`
  nav.innerHTML = `<div class="tour-nav-inner">
    <button class="tour-btn quiet" type="button" data-nav="prev" ${i === 0 ? 'disabled' : ''}>← back</button>
    <span class="tour-nav-pos">${esc(pos)}</span>
    <button class="tour-btn ${canNext ? 'accent' : ''}" type="button" data-nav="next" ${canNext ? '' : 'disabled'}>${nextLabel(step)} →</button>
  </div>`
}
function nextLabel(step) {
  const n = steps[state.step + 1]
  if (!n) return 'done'
  if (step.kind === 'cover') return 'start'
  if (n.kind === 'decision' && step.kind !== 'decision') return 'decide'
  if (n.kind === 'quiz' && step.kind !== 'quiz') return 'quiz'
  if (n.kind === 'plan') return 'plan'
  return 'next'
}
function stepIndexWithin(step) {
  return steps.filter(s => s.kind === step.kind).indexOf(step) + 1
}
function countOf(kind) {
  return steps.filter(s => s.kind === kind).length
}

// ---- Screens ----
function render() {
  const step = steps[state.step]
  if (step.kind === 'cover') renderCover()
  else if (step.kind === 'beat') renderBeat(step.beat)
  else if (step.kind === 'decision') renderDecision(step.decision)
  else if (step.kind === 'quiz') renderQuiz(step.q)
  else renderPlan()
  renderRail()
  renderNav()
}

function renderCover() {
  const minutes = Math.max(
    3,
    Math.round(tour.beats.length * 1.2 + tour.decisions.length * 0.8 + tour.quiz.length * 0.4)
  )
  const others = ['67', '68'].filter(k => k !== String(tour.key))
  stage.innerHTML = `
    <p class="tour-eyebrow"><span class="tour-stage-tag">Tour</span><span>#${tour.key} · ${esc(tour.repo)}</span></p>
    <h1 class="tour-title">${esc(tour.title)}</h1>
    <p class="tour-cover-meta"><span>by ${esc(tour.author)}</span><span class="mono">${esc(tour.head)} → main</span><span><span class="ok">+${tour.changed.added}</span> <span class="bad">−${tour.changed.removed}</span> in ${tour.changed.files} files</span>${tour.spec ? `<span>spec: ${esc(tour.spec.title)}</span>` : '<span>no spec on file</span>'}</p>
    <p class="tour-lead">${esc(tour.beats[0].lead)}</p>
    <div class="tour-budget">
      <div><b>${tour.beats.length}</b><span>beats</span></div>
      <div><b>${tour.decisions.length}</b><span>decisions</span></div>
      <div><b>${tour.quiz.length}</b><span>questions</span></div>
      <div><b>~${minutes}</b><span>minutes</span></div>
    </div>
    <div class="tour-cover-actions">
      <button class="tour-btn accent" type="button" data-nav="next">Start the tour</button>
      <span class="tour-hint"><kbd>→</kbd> next · <kbd>←</kbd> back · <kbd>i</kbd> code · <kbd>?</kbd> help</span>
    </div>
    <p class="tour-hint" style="margin-top:28px">Mood: ${esc(tour.mood)} · shared on the pull request · other tours: ${others.map(k => `<a href="?pr=${k}">#${k}</a>`).join(' ')} · <a href="#" data-act="reset">reset this tour</a></p>`
}

function renderBeat(beat) {
  const n = tour.beats.indexOf(beat) + 1
  const decisionsHere = tour.decisions.filter(d => d.beat === beat.id)
  const codeOpen = state.codeOpen[beat.id] === true
  const ret = state.returnTo !== null && state.returnTo !== undefined
  stage.innerHTML = `
    ${ret ? `<div class="tour-return"><span>Reopened from the quiz. Read again, then go back.</span><button class="tour-btn" type="button" data-act="return">back to the question</button></div>` : ''}
    <p class="tour-eyebrow"><span class="tour-stage-tag">${esc(STAGE_LABEL[beat.stage])}</span><span>beat ${n} of ${tour.beats.length}</span></p>
    <h2 class="tour-title">${esc(beat.title)}</h2>
    <p class="tour-lead">${inline(beat.lead)}</p>
    <div class="tour-body">${beat.body.map(p => `<p>${inline(p)}</p>`).join('')}</div>
    ${beat.scene ? `<div class="tour-card tour-scene"><div class="tour-card-h"><span>scene</span></div><div class="sc-root" id="scene-${beat.id}"></div></div>` : ''}
    ${beat.micro ? `<div class="tour-card tour-micro"><div class="tour-card-h"><span>micro-world · play with it</span></div><div class="sc-root" id="micro-${beat.id}"></div></div>` : ''}
    ${decisionsHere.length ? `<div class="tour-chips"><span class="tour-chip">${decisionsHere.length === 1 ? 'one decision waits here' : decisionsHere.length + ' decisions wait here'}</span>${decisionsHere.map(d => `<span class="tour-chip" data-cat="${d.category}">${esc(d.title)}</span>`).join('')}</div>` : ''}
    ${
      beat.code?.length
        ? `<div class="tour-actions"><button class="tour-btn quiet" type="button" data-act="code">${codeOpen ? 'hide code' : 'code behind this beat'} <kbd>i</kbd></button></div>
           <div class="tour-code" ${codeOpen ? '' : 'hidden'}>${beat.code.map(renderChunk).join('')}</div>`
        : ''
    }`
  mount(beat.scene, `scene-${beat.id}`)
  mount(beat.micro, `micro-${beat.id}`)
}
function mount(scene, id) {
  if (!scene) return
  const root = document.getElementById(id)
  if (!root) return
  if (scene.css) {
    const style = document.createElement('style')
    style.textContent = scene.css
    root.appendChild(style)
  }
  const box = document.createElement('div')
  box.innerHTML = scene.html
  root.appendChild(box)
  if (typeof scene.init === 'function') scene.init(box)
}
function renderChunk(c) {
  const lines = c.diff.split('\n').map(l => {
    const cls = l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : l.startsWith('@@') ? 'hunk' : ''
    return `<div class="${cls}">${esc(l) || ' '}</div>`
  })
  return `<div class="tour-code-file">${esc(c.path)}</div><div class="tour-diff">${lines.join('')}</div>`
}

function renderDecision(d) {
  const n = tour.decisions.indexOf(d) + 1
  const beat = tour.beats.find(b => b.id === d.beat)
  const beatIndex = tour.beats.indexOf(beat) + 1
  const p = state.picks[d.id] ?? { pick: d.recommended, place: d.reason.place, tried: false }
  const done = settled({ kind: 'decision', decision: d })
  stage.innerHTML = `
    <p class="tour-eyebrow"><span class="tour-stage-tag">${esc(CATEGORY_LABEL[d.category] ?? d.category)}</span><span>decision ${n} of ${tour.decisions.length}</span><a href="#" data-act="beat" data-beat="${beat.id}">from beat ${beatIndex}: ${esc(beat.title)}</a></p>
    <h2 class="tour-title">${esc(d.title)}</h2>
    <p class="tour-lead">${inline(d.context)}</p>
    <div class="tour-options" role="radiogroup">
      ${option('keep', d.keep, p.pick === 'keep', true, d.recommended === 'keep')}
      ${option('change', d.change, p.pick === 'change', false, d.recommended === 'change')}
    </div>
    ${
      p.pick === 'keep'
        ? `<div class="tour-reason"><div>Reason recorded, in your words: <q>${inline(d.reason.text)}</q></div>
           <label>belongs <select data-act="place">${Object.entries(PLACE_LABEL)
             .map(([k, v]) => `<option value="${k}" ${p.place === k ? 'selected' : ''}>${v}</option>`)
             .join('')}</select></label></div>`
        : ''
    }
    ${
      d.tryIt
        ? `<div class="tour-card tour-tryit"><div class="tour-card-h"><span>try it · verified when this tour was generated</span></div>
           <ol>${d.tryIt.steps.map(s => `<li><code>${esc(s)}</code></li>`).join('')}</ol>
           <ul>${d.tryIt.look.map(s => `<li>${inline(s)}</li>`).join('')}</ul>
           <label><input type="checkbox" data-act="tried" ${p.tried ? 'checked' : ''}> I tried it</label></div>`
        : ''
    }
    <div class="tour-actions">
      ${
        done
          ? p.pick === 'keep'
            ? `<span class="tour-state">✓ kept · reason ${esc(PLACE_LABEL[p.place])}</span><button class="tour-btn quiet" type="button" data-act="unsettle">change my mind</button>`
            : `<span class="tour-state change">✓ change approved · in the plan</span><button class="tour-btn quiet" type="button" data-act="grill">reopen the grilling</button><button class="tour-btn quiet" type="button" data-act="unsettle">change my mind</button>`
          : p.pick === 'keep'
            ? `<button class="tour-btn accent" type="button" data-act="keep">Keep it <kbd>k</kbd></button><span class="tour-hint">or pick <b>change</b> to be grilled on what you want instead</span>`
            : `<button class="tour-btn accent" type="button" data-act="grill">Say what you want instead <kbd>c</kbd></button><span class="tour-hint">the agent asks until it can restate it</span>`
      }
    </div>
    ${done && p.pick === 'change' && p.restatement ? restatedHtml(p.restatement) : ''}`
}
function option(kind, side, checked, isNow, isRec) {
  return `<button class="tour-option" type="button" role="radio" aria-checked="${checked}" data-act="pick" data-pick="${kind}">
    <span class="tour-option-k"><span>${kind}</span>${isNow ? '<span class="now">what the code does</span>' : ''}${isRec ? '<span class="rec">recommended</span>' : ''}</span>
    <span class="tour-option-l">${esc(side.label)}</span>
    <p class="tour-option-c">${inline(side.consequence)}</p></button>`
}
function restatedHtml(r) {
  return `<div class="tour-restated"><b>What changes</b>${inline(r.what)}<b>Where</b>${r.where.map(esc).join(', ')}<b>Stays the same</b>${inline(r.unchanged)}</div>`
}

function renderQuiz(q) {
  const n = tour.quiz.indexOf(q) + 1
  const a = state.quiz[q.id]
  const beat = tour.beats.find(b => b.id === q.beat)
  const beatIndex = tour.beats.indexOf(beat) + 1
  stage.innerHTML = `
    <p class="tour-eyebrow"><span class="tour-stage-tag">Quiz</span><span>question ${n} of ${tour.quiz.length}</span><span>private · stays on this machine</span></p>
    <h2 class="tour-quiz-q">${inline(q.question)}</h2>
    <div class="tour-quiz-opts">${q.options
      .map((o, i) => {
        const result = a && a.answered === i ? (a.right ? 'right' : 'wrong') : ''
        return `<button class="tour-quiz-opt" type="button" data-act="answer" data-i="${i}" data-n="${i + 1}" ${result ? `data-result="${result}"` : ''} ${a?.right ? 'disabled' : ''}>${inline(o)}</button>`
      })
      .join('')}</div>
    ${
      a
        ? a.right
          ? `<div class="tour-quiz-why right">${inline(q.why)}</div>`
          : `<div class="tour-quiz-why wrong">Not quite. ${inline(q.why)}<div class="tour-actions"><button class="tour-btn" type="button" data-act="reopen" data-beat="${beat.id}">reopen beat ${beatIndex}: ${esc(beat.title)}</button><span class="tour-hint">then answer again</span></div></div>`
        : `<p class="tour-hint" style="margin-top:14px">press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to answer · a wrong answer reopens the beat it came from</p>`
    }`
}

function renderPlan() {
  const changes = tour.decisions
    .filter(d => state.picks[d.id]?.pick === 'change')
    .map(d => ({ d, p: state.picks[d.id] }))
  const kept = tour.decisions
    .filter(d => state.picks[d.id]?.pick === 'keep')
    .map(d => ({ d, p: state.picks[d.id] }))
  const right = tour.quiz.filter(q => state.quiz[q.id]?.right).length
  const confirmed = state.planConfirmed
  stage.innerHTML = `
    <p class="tour-eyebrow"><span class="tour-stage-tag">The plan</span><span>the agent restates everything once</span></p>
    <h2 class="tour-title">${changes.length ? `${changes.length} change${changes.length > 1 ? 's' : ''} to make, ${kept.length} kept` : `Nothing to change. ${kept.length} decisions kept.`}</h2>
    <p class="tour-lead">${changes.length ? 'Read it once. When you confirm, the prompt is written and the record is shared. No further plan review.' : 'Your reasons are recorded. When you confirm, the record is shared and the prompt carries the intent and the kept decisions for whoever touches this next.'}</p>
    ${changes.length ? `<h3 class="tour-section-h">Changes</h3><ol class="tour-plan-list">${changes.map(({ d, p }) => `<li><b>${esc(d.title)}</b><br>${inline(p.restatement.what)} <span class="where">${p.restatement.where.map(esc).join(' · ')}</span><span class="where">stays: ${inline(p.restatement.unchanged)}</span></li>`).join('')}</ol>` : ''}
    <h3 class="tour-section-h">Kept, with reasons</h3>
    <ul class="tour-kept">${kept.map(({ d, p }) => `<li><span>${esc(d.keep.label)}</span><span><q>${inline(d.reason.text)}</q></span><span class="place">${esc(PLACE_LABEL[p.place])}</span></li>`).join('') || '<li>none</li>'}</ul>
    ${
      confirmed
        ? `<h3 class="tour-section-h">Done</h3><ul class="tour-sharing">
             <li>Record shared on the pull request comment, updated once.</li>
             ${kept.filter(k => k.p.place === 'pr').length ? `<li>${kept.filter(k => k.p.place === 'pr').length} reason${kept.filter(k => k.p.place === 'pr').length > 1 ? 's' : ''} posted as PR comments on their lines.</li>` : ''}
             ${kept.filter(k => k.p.place === 'code').length ? `<li>${kept.filter(k => k.p.place === 'code').length} reason${kept.filter(k => k.p.place === 'code').length > 1 ? 's' : ''} go into the code as comments, through the prompt.</li>` : ''}
             <li class="private">Quiz ${right} of ${tour.quiz.length}, kept on this machine.</li>
             <li>Prompt written to the tour's directory. Run <code>/pr-tour-apply ${tour.key}</code> to implement it.</li>
           </ul>
           <h3 class="tour-section-h">Re-implementation prompt</h3>
           <div class="tour-prompt"><div class="tour-actions" style="margin:0 0 8px"><button class="tour-btn" type="button" data-act="copy">copy</button></div><pre id="prompt">${esc(buildPrompt(changes, kept))}</pre></div>`
        : `<div class="tour-actions"><button class="tour-btn accent" type="button" data-act="confirm">Confirm the plan</button><span class="tour-hint">writes the prompt, shares the record</span></div>`
    }
    ${tour.notToured?.length ? `<h3 class="tour-section-h">Not toured</h3><ul class="tour-not">${tour.notToured.map(n => `<li><span>${esc(n.title)}</span><span class="path">${esc(n.path)}</span></li>`).join('')}</ul>` : ''}`
}
function buildPrompt(changes, kept) {
  const first = tour.beats[0]
  const respect = tour.beats[tour.beats.length - 1]
  const lines = [
    `# ${changes.length ? 'Re-implement' : 'Keep'} PR #${tour.key} as the tour settled it`,
    '',
    `Change: ${tour.title} (${tour.repo}, head ${tour.head}).`,
    '',
    '## Intent',
    first.lead,
    ...first.body,
    '',
    '## What a change must respect',
    respect.lead,
    ...respect.body,
    '',
    '## Decisions kept by the author (do not reopen)',
    ...kept.map(
      ({ d, p }) =>
        `- ${d.key}: ${d.keep.label}. ${d.reason.text}${p.place === 'code' ? ` (write this as a comment near ${d.anchor.path}:${d.anchor.line})` : ''}`
    ),
  ]
  if (changes.length) {
    lines.push('', '## Changes to make, as approved in the tour')
    changes.forEach(({ d, p }, i) => {
      lines.push(
        `${i + 1}. ${d.title}`,
        `   What: ${p.restatement.what}`,
        `   Where: ${p.restatement.where.join(', ')}`,
        `   Stays the same: ${p.restatement.unchanged}`
      )
    })
  }
  lines.push(
    '',
    '## Then',
    '- Run the project checks.',
    `- Run /pr-tour ${tour.key} again; picks carry by decision key.`
  )
  return lines.join('\n')
}

// ---- Grilling (scripted chat) ----
let grill = null
function openGrill(d) {
  const p = state.picks[d.id] ?? { pick: 'change', place: d.reason.place, tried: false }
  p.pick = 'change'
  state.picks[d.id] = p
  save()
  grill = { d, i: 0, phase: 'questions', log: [], edited: null }
  agentSays(`You want to change this: ${d.change.label.toLowerCase()}. ${d.grill.questions[0]}`)
  chat.showModal()
  renderChat()
}
function agentSays(text) {
  grill.log.push({ who: 'agent', text })
}
function readerSays(text) {
  grill.log.push({ who: 'reader', text })
}
function renderChat() {
  if (!grill) return
  const { d, phase } = grill
  const showCard = phase === 'restate'
  const r = grill.edited ?? d.grill.restatement
  chat.innerHTML = `<div class="tour-chat-box">
    <div class="tour-chat-h"><div><b>Grilling · ${esc(d.title)}</b><span class="agent">claude · opus · read-only · thread tour-${tour.key}</span></div><button class="tour-btn quiet" type="button" data-act="close-chat" aria-label="Close">✕</button></div>
    <div class="tour-chat-log" id="chat-log">
      ${grill.log
        .map(m =>
          m.who === 'note'
            ? `<div class="tour-msg note">${esc(m.text)}</div>`
            : `<div class="tour-msg ${m.who}"><span class="who">${m.who === 'agent' ? 'agent' : 'you'}</span>${inline(m.text)}</div>`
        )
        .join('')}
      ${
        showCard
          ? `<div class="tour-restate"><h4>Here is what I understood</h4>
            ${
              grill.editing
                ? `<b>What changes</b><textarea data-f="what">${esc(r.what)}</textarea><b>Where</b><textarea data-f="where">${esc(r.where.join(', '))}</textarea><b>Stays the same</b><textarea data-f="unchanged">${esc(r.unchanged)}</textarea>
                   <div class="tour-actions"><button class="tour-btn primary" type="button" data-act="save-edit">Save</button><button class="tour-btn quiet" type="button" data-act="cancel-edit">Cancel</button></div>`
                : `<b>What changes</b>${inline(r.what)}<b>Where</b><div class="where">${r.where.map(w => `<span>${esc(w)}</span>`).join('')}</div><b>Stays the same</b>${inline(r.unchanged)}
                   <div class="tour-actions"><button class="tour-btn primary" type="button" data-act="approve">Approve</button><button class="tour-btn" type="button" data-act="edit">Edit</button><button class="tour-btn quiet" type="button" data-act="reject">No, that is not it</button></div>`
            }</div>`
          : ''
      }
    </div>
    ${showCard && !grill.editing ? `<div class="tour-tools"><button class="tour-btn" type="button" data-act="reverse">Ask how it would do it</button><span class="tour-hint" style="align-self:center">reverse quiz · optional</span></div>` : ''}
    ${
      phase === 'done'
        ? `<div class="tour-tools"><span class="tour-state change">✓ approved · added to the plan</span><button class="tour-btn" type="button" data-act="close-chat">back to the decision</button></div>`
        : `<form class="tour-composer" data-act="send">
            ${grill.notice ? `<div class="tour-notice">Speech is turned into text by your browser. In Chrome the audio is sent to Google for that. Project setting: audio on.<div class="tour-actions"><button class="tour-btn" type="button" data-act="notice-ok">Got it</button><button class="tour-btn quiet" type="button" data-act="notice-off">Turn audio off</button></div></div>` : ''}
            <textarea id="composer" rows="1" placeholder="${grill.listening ? 'Listening…' : 'Answer, or press the mic'}" ${grill.listening ? 'disabled' : ''}></textarea>
            <button class="tour-btn icon tour-mic" type="button" data-act="mic" ${state.audioOff ? 'disabled title="Audio is off for this project"' : ''} data-state="${grill.listening ? 'listening' : ''}" aria-label="Speak"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
            <button class="tour-btn primary" type="submit">send</button>
            ${sampleAnswer() ? `<div class="sample">prototype: <button type="button" data-act="sample">use a sample answer</button></div>` : ''}
          </form>`
    }
  </div>`
  const log = document.getElementById('chat-log')
  if (log) log.scrollTop = log.scrollHeight
  const composer = document.getElementById('composer')
  if (composer && !grill.listening) composer.focus()
}
function sampleAnswer() {
  if (!grill) return null
  if (grill.phase === 'questions') return grill.d.grill.answers[grill.i] ?? null
  if (grill.phase === 'reject') return 'The part about where it lives is wrong; keep it in the same module.'
  return null
}
function send(text) {
  if (!grill || !text.trim()) return
  readerSays(text.trim())
  if (grill.phase === 'questions') {
    grill.i += 1
    if (grill.i < grill.d.grill.questions.length) agentSays(grill.d.grill.questions[grill.i])
    else {
      grill.phase = 'restate'
      agentSays('Thanks. Let me restate it before it goes into the plan.')
    }
  } else if (grill.phase === 'reject') {
    grill.phase = 'restate'
    grill.log.push({ who: 'note', text: 'restated after your correction' })
  } else if (grill.phase === 'restate') {
    agentSays('Noted. Approve, edit, or tell me what is wrong with the card above.')
  }
  renderChat()
}
function approve() {
  const p = state.picks[grill.d.id]
  p.pick = 'change'
  p.approved = true
  p.restatement = grill.edited ?? grill.d.grill.restatement
  save()
  grill.phase = 'done'
  renderChat()
  render()
}

// ---- Help ----
function renderHelp() {
  helpDialog.innerHTML = `<h3>Keys</h3><dl>
    <dt><kbd>→</kbd> <kbd>space</kbd></dt><dd>next</dd>
    <dt><kbd>←</kbd></dt><dd>back</dd>
    <dt><kbd>i</kbd></dt><dd>show the code behind a beat</dd>
    <dt><kbd>k</kbd> <kbd>c</kbd></dt><dd>keep, or say what you want instead</dd>
    <dt><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></dt><dd>answer a question</dd>
    <dt><kbd>esc</kbd></dt><dd>close this, or the grilling</dd>
  </dl>
  <p>A tour has beats that explain the change, decisions you keep or change, and a quiz. Everything here is scripted from a data file: no agent, no server, no forge.</p>
  <div class="tour-actions"><button class="tour-btn" type="button" data-act="close-help">close</button></div>`
}

// ---- Events ----
document.addEventListener('click', e => {
  const t = /** @type {HTMLElement} */ (e.target).closest('[data-act], [data-nav], .tour-rail-seg')
  if (!t) return
  const act = t.dataset.act
  const step = steps[state.step]
  if (t.dataset.nav) {
    e.preventDefault()
    go(state.step + (t.dataset.nav === 'next' ? 1 : -1))
    return
  }
  if (t.classList.contains('tour-rail-seg')) {
    go(Number(t.dataset.i))
    return
  }
  if (act === 'reset') {
    e.preventDefault()
    sessionStorage.removeItem(storeKey)
    location.reload()
  } else if (act === 'code' && step.kind === 'beat') {
    state.codeOpen[step.beat.id] = !state.codeOpen[step.beat.id]
    save()
    render()
  } else if (act === 'beat') {
    e.preventDefault()
    const i = steps.findIndex(s => s.kind === 'beat' && s.beat.id === t.dataset.beat)
    state.returnTo = state.step
    go(i)
  } else if (act === 'reopen') {
    const i = steps.findIndex(s => s.kind === 'beat' && s.beat.id === t.dataset.beat)
    state.returnTo = state.step
    delete state.quiz[step.q.id]
    go(i)
  } else if (act === 'return') {
    const i = state.returnTo
    state.returnTo = null
    go(i)
  } else if (act === 'pick' && step.kind === 'decision') {
    const p = state.picks[step.decision.id] ?? { place: step.decision.reason.place, tried: false }
    p.pick = t.dataset.pick
    p.approved = false
    state.picks[step.decision.id] = p
    save()
    render()
  } else if (act === 'keep' && step.kind === 'decision') {
    const p = state.picks[step.decision.id] ?? { place: step.decision.reason.place, tried: false }
    p.pick = 'keep'
    p.approved = true
    state.picks[step.decision.id] = p
    save()
    render()
  } else if (act === 'unsettle' && step.kind === 'decision') {
    delete state.picks[step.decision.id]
    save()
    render()
  } else if (act === 'grill' && step.kind === 'decision') {
    openGrill(step.decision)
  } else if (act === 'tried' && step.kind === 'decision') {
    const p = state.picks[step.decision.id] ?? {
      pick: step.decision.recommended,
      place: step.decision.reason.place,
    }
    p.tried = /** @type {HTMLInputElement} */ (t).checked
    state.picks[step.decision.id] = p
    save()
  } else if (act === 'answer' && step.kind === 'quiz') {
    const i = Number(t.dataset.i)
    state.quiz[step.q.id] = { answered: i, right: i === step.q.answer }
    save()
    render()
  } else if (act === 'confirm') {
    state.planConfirmed = true
    save()
    render()
  } else if (act === 'copy') {
    const pre = document.getElementById('prompt')
    navigator.clipboard?.writeText(pre?.textContent ?? '')
    t.textContent = 'copied'
  } else if (act === 'close-chat') {
    chat.close()
    render()
  } else if (act === 'approve') {
    approve()
  } else if (act === 'edit') {
    grill.editing = true
    renderChat()
  } else if (act === 'cancel-edit') {
    grill.editing = false
    renderChat()
  } else if (act === 'save-edit') {
    const f = k => /** @type {HTMLTextAreaElement} */ (chat.querySelector(`[data-f="${k}"]`)).value
    grill.edited = {
      what: f('what'),
      where: f('where')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      unchanged: f('unchanged'),
    }
    grill.editing = false
    grill.log.push({ who: 'note', text: 'edited by you' })
    renderChat()
  } else if (act === 'reject') {
    grill.phase = 'reject'
    agentSays('What did I get wrong? Say it in your words and I will restate.')
    renderChat()
  } else if (act === 'reverse') {
    readerSays(grill.d.grill.reverse.question)
    agentSays(grill.d.grill.reverse.answer)
    renderChat()
  } else if (act === 'sample') {
    const c = /** @type {HTMLTextAreaElement} */ (document.getElementById('composer'))
    c.value = sampleAnswer() ?? ''
    c.focus()
  } else if (act === 'mic') {
    if (!state.audioNoticeSeen) {
      grill.notice = true
      renderChat()
      return
    }
    listen()
  } else if (act === 'notice-ok') {
    state.audioNoticeSeen = true
    grill.notice = false
    save()
    listen()
  } else if (act === 'notice-off') {
    state.audioNoticeSeen = true
    state.audioOff = true
    grill.notice = false
    save()
    renderChat()
  } else if (act === 'close-help') {
    helpDialog.close()
  }
})
function listen() {
  grill.listening = true
  renderChat()
  setTimeout(() => {
    grill.listening = false
    renderChat()
    const c = /** @type {HTMLTextAreaElement} */ (document.getElementById('composer'))
    if (c) {
      c.value = sampleAnswer() ?? 'Yes, that is what I meant.'
      c.focus()
    }
  }, 1400)
}
document.addEventListener('submit', e => {
  const form = /** @type {HTMLFormElement} */ (e.target)
  if (form.dataset.act !== 'send') return
  e.preventDefault()
  const c = /** @type {HTMLTextAreaElement} */ (document.getElementById('composer'))
  send(c.value)
})
document.addEventListener('change', e => {
  const t = /** @type {HTMLSelectElement} */ (e.target)
  if (t.dataset.act === 'place') {
    const step = steps[state.step]
    const p = state.picks[step.decision.id] ?? { pick: 'keep', tried: false }
    p.place = t.value
    state.picks[step.decision.id] = p
    save()
    render()
  }
})
document.addEventListener('keydown', e => {
  const target = /** @type {HTMLElement} */ (e.target)
  const typing = target.matches('input, textarea, select')
  if (e.key === 'Escape') return
  if (typing && !(e.key === 'Enter' && !e.shiftKey && target.id === 'composer')) return
  if (e.key === 'Enter' && target.id === 'composer') {
    e.preventDefault()
    send(/** @type {HTMLTextAreaElement} */ (target).value)
    return
  }
  if (chat.open || helpDialog.open) return
  const step = steps[state.step]
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    go(state.step + 1)
  } else if (e.key === 'ArrowLeft') go(state.step - 1)
  else if (e.key === 'i' && step.kind === 'beat' && step.beat.code?.length) {
    state.codeOpen[step.beat.id] = !state.codeOpen[step.beat.id]
    save()
    render()
  } else if (e.key === 'k' && step.kind === 'decision') {
    state.picks[step.decision.id] = {
      ...(state.picks[step.decision.id] ?? { place: step.decision.reason.place }),
      pick: 'keep',
      approved: true,
    }
    save()
    render()
  } else if (e.key === 'c' && step.kind === 'decision') openGrill(step.decision)
  else if (/^[1-9]$/.test(e.key) && step.kind === 'quiz' && !state.quiz[step.q.id]?.right) {
    const i = Number(e.key) - 1
    if (i < step.q.options.length) {
      state.quiz[step.q.id] = { answered: i, right: i === step.q.answer }
      save()
      render()
    }
  } else if (e.key === '?') {
    renderHelp()
    helpDialog.showModal()
  }
})
document.getElementById('help').addEventListener('click', () => {
  renderHelp()
  helpDialog.showModal()
})
const SKINS = ['github', 'terminal', 'olive']
const THEMES = ['auto', 'light', 'dark']
document.getElementById('skin-toggle').addEventListener('click', e => {
  const cur = document.documentElement.dataset.skin
  const next = SKINS[(SKINS.indexOf(cur) + 1) % SKINS.length]
  document.documentElement.dataset.skin = next
  ;/** @type {HTMLElement} */ (e.currentTarget).textContent = next
})
document.getElementById('theme-toggle').addEventListener('click', e => {
  const cur = document.documentElement.dataset.theme
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]
  document.documentElement.dataset.theme = next
  ;/** @type {HTMLElement} */ (e.currentTarget).textContent = next
})
chat.addEventListener('close', () => render())

render()
