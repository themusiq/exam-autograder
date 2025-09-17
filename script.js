// ==== 기본 상수/상태 ====
const TOTAL = 60;

let current = 0;                  // 현재 문항(0~59)
let nickname = '';
let examYear = '';
let examRound = '';
let examId = '';                  // "2025-01"

let choices = Array(TOTAL).fill(null);         // 1..4 or null
let wrongs  = Array(TOTAL).fill(false);        // true/false
let perExamAnswerKey = Array(TOTAL).fill(null);// 1..4 or null

// ==== 도우미 ====
const $  = s => document.querySelector(s);
const show = s => $(s).hidden = false;
const hide = s => $(s).hidden = true;
const key = k => `grader:${k}`;

function updateDockVisibility(){
  const dock = $('#dock');
  const hasActiveRow = !$('#dockCard').hidden || !$('#dockReview').hidden;
  dock.hidden = !hasActiveRow;
}

// ==== 초기 바인딩 ====
bindUI();
hydrateFromLocal();
renderHome();

function bindUI(){
  // 홈
  $('#startBtn').addEventListener('click', startExam);
  $('#resumeBtn').addEventListener('click', resumeExam);
  $('#viewReportBtn').addEventListener('click', openReport);

  // 풀이
  $('#helpBtn').addEventListener('click', ()=>$('#helpBox').hidden = !$('#helpBox').hidden);
  $('#goReviewBtn').addEventListener('click', goReview);
  $('#toReviewBtn').addEventListener('click', goReview);
  $('#toggleWrongBtn').addEventListener('click', ()=>{ wrongs[current] = !wrongs[current]; persistAndRender(); });
  for (let i=1;i<=4;i++){
    $(`#c${i}`).addEventListener('click', ()=>{ choices[current] = i; persistAndRender(); });
  }
  $('#prevQBtn').addEventListener('click', ()=>{ if (current>0){ current--; persistAndRender(); }});
  $('#nextQBtn').addEventListener('click', ()=>{ if (current<TOTAL-1){ current++; persistAndRender(); } else { goReview(); }});

  // 검토(60개 한 화면)
  $('#backToSolveBtn').addEventListener('click', goCard);
  $('#backHomeBtn').addEventListener('click', goHome);
  $('#toHomeBtn').addEventListener('click', goHome);
  $('#retryBtn').addEventListener('click', ()=>{ resetAll(); goCard(); });
  $('#resetWrongBtn').addEventListener('click', resetWrong);
  $('#resetAllBtn').addEventListener('click', resetAll);
  $('#finishBtn').addEventListener('click', showResultInline);

  // 리포트
  $('#reportBackBtn').addEventListener('click', goHome);

  // 스와이프(풀이)
  let sx=null;
  document.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; }, {passive:true});
  document.addEventListener('touchend', e=>{
    if (sx==null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 60 && !$('#cardView').hidden){
      dx<0 ? $('#nextQBtn').click() : $('#prevQBtn').click();
    }
    sx=null;
  }, {passive:true});
}

// ==== 로컬 저장/불러오기 ====
function hydrateFromLocal(){
  nickname = localStorage.getItem(key('nickname')) || '';
  examYear = localStorage.getItem(key('examYear')) || '';
  examRound= localStorage.getItem(key('examRound')) || '';
  examId   = localStorage.getItem(key('examId')) || '';

  if (nickname) $('#nicknameInput').value = nickname;
  if (examYear) $('#yearInput').value = examYear;
  if (examRound) $('#roundInput').value = examRound;

  try {
    const c = JSON.parse(localStorage.getItem(key('choices')));
    const w = JSON.parse(localStorage.getItem(key('wrongs')));
    const a = JSON.parse(localStorage.getItem(key('answerKey')));
    if (Array.isArray(c) && c.length===TOTAL) choices = c;
    if (Array.isArray(w) && w.length===TOTAL) wrongs  = w;
    if (Array.isArray(a) && a.length===TOTAL) perExamAnswerKey = a;
  } catch(e){}
}
function persistLocal(){
  localStorage.setItem(key('nickname'), nickname);
  localStorage.setItem(key('examYear'), examYear);
  localStorage.setItem(key('examRound'), examRound);
  localStorage.setItem(key('examId'), examId);
  localStorage.setItem(key('choices'), JSON.stringify(choices));
  localStorage.setItem(key('wrongs'), JSON.stringify(wrongs));
  localStorage.setItem(key('answerKey'), JSON.stringify(perExamAnswerKey));
}

// ==== Firebase 저장 ====
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
const db = window.__fb.db;

async function saveToFirestore(){
  if (!nickname || !examId) return;
  const ref = doc(db, 'users', nickname, 'sessions', examId);
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60))*10)/10;
  const pass = wrongCount <= 24;

  await setDoc(ref, {
    nickname, examYear, examRound, examId,
    choices, wrongs, perExamAnswerKey,
    score, wrongCount, pass,
    updatedAt: serverTimestamp()
  }, { merge:true });

  localStorage.setItem(key('lastResult'),
    JSON.stringify({ examId, score, wrongCount, pass, at: Date.now() }));
}

// ==== 네비게이션 ====
function goHome(){
  hide('#cardView'); hide('#reviewView'); hide('#reportView'); show('#homeView');
  hide('#dockCard'); hide('#dockReview'); updateDockVisibility();
  renderHome();   // ❗ 상태는 유지 (초기화하지 않음)
}
function goCard(){
  hide('#homeView'); hide('#reviewView'); hide('#reportView'); show('#cardView');
  show('#dockCard'); hide('#dockReview'); updateDockVisibility();
  render();
}
function goReview(){
  hide('#homeView'); hide('#cardView'); hide('#reportView'); show('#reviewView');
  hide('#dockCard'); show('#dockReview'); updateDockVisibility();
  render();
}
function openReport(){ // 최근 기록 읽기 전용
  const last = loadLastResultCache();
  if (!last){ alert('최근 기록이 없습니다. 먼저 한 회차를 풀어주세요.'); return; }
  buildReportFromLocal(last);
  hide('#homeView'); hide('#cardView'); hide('#reviewView'); show('#reportView');
  hide('#dockCard'); hide('#dockReview'); updateDockVisibility();
}

// ==== 홈 렌더 ====
function loadLastResultCache(){
  try { return JSON.parse(localStorage.getItem(key('lastResult')) || 'null'); } catch(e){ return null; }
}
async function renderHome(){
  $('#resumeBtn').hidden = !(choices.some(v=>v!=null) || wrongs.some(Boolean));
  $('#viewReportBtn').hidden = !loadLastResultCache();

  const last = loadLastResultCache();
  const box = $('#lastResultBox');
  if (!last){ box.textContent = '저장된 기록이 없습니다.'; }
  else {
    box.innerHTML = `
      <div><b>회차:</b> ${last.examId}</div>
      <div><b>점수:</b> ${last.score} / <b>오답:</b> ${last.wrongCount}</div>
      <div><b>결과:</b> ${last.pass ? '합격' : '탈락'}</div>
      <div class="muted" style="margin-top:4px;">'최근 기록 보기'에서 전체 문항(선택/정답) 확인 가능</div>
    `;
  }
  renderTopStats(); // 진행바/뱃지 갱신
}

// ==== 공통 렌더 ====
function renderTopStats(){
  const answered = choices.filter(v=>v!=null).length;
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60)) * 10)/10;
  const pct = Math.round(answered / TOTAL * 100);
  const pass = wrongCount <= 24;

  $('#wrongStat').textContent = `틀린 ${wrongCount}`;
  $('#scoreStat').textContent = `점수 ${score}`;
  $('#progressStat').textContent = `${pct}%`;
  $('#progressBar').style.width = `${pct}%`;
  const badge = $('#passBadge');
  badge.textContent = pass ? '합격' : '탈락';
  badge.className = `badge ${pass ? 'pass' : 'fail'}`;
}

function render(){
  renderTopStats();

  if (!$('#cardView').hidden){
    $('#qTitle').textContent = `문항 ${current+1} / ${TOTAL}`;
    for (let i=1;i<=4;i++){
      $(`#c${i}`).classList.toggle('selected', choices[current] === i);
    }
    $('#toggleWrongBtn').textContent = wrongs[current] ? '오답 해제' : '오답 표시';
  }

  if (!$('#reviewView').hidden){
    buildReviewGrid();
    updateInlineResult();
  }

  persistLocal();
  scheduleSave();
}

// ==== 검토(60개) ====
function buildReviewGrid(){
  const g = $('#grid');
  let html = '';
  for (let i=0;i<TOTAL;i++){
    const ch = choices[i];
    const selTxt = ch==null ? '—' : ['①','②','③','④'][ch-1];
    const ans = perExamAnswerKey[i] ? `정답 ${['①','②','③','④'][perExamAnswerKey[i]-1]}` : '정답 —';
    html += `
      <div class="tile ${wrongs[i]?'wrong':''} ${(ch!=null)?'answered':''}" onclick="__toggleWrongAt(${i})">
        <div class="num">${i+1}</div>
        <div class="sel">${selTxt}</div>
        <div class="ans">${ans}</div>
      </div>`;
  }
  g.innerHTML = html;
}
window.__toggleWrongAt = async function(i){
  wrongs[i] = !wrongs[i];
  if (wrongs[i] && perExamAnswerKey[i]==null){
    const ans = prompt('정답 번호 입력 (1~4), 취소=미저장');
    const v = Number(ans);
    if ([1,2,3,4].includes(v)) perExamAnswerKey[i] = v;
  }
  persistAndRender();
};

// 결과 플로팅 갱신
function updateInlineResult(){
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60))*10)/10;
  $('#inlineScore').textContent = score;
  $('#inlineWrong').textContent = wrongCount;
  const pass = wrongCount <= 24;
  const b = $('#inlineBadge');
  b.textContent = pass ? '합격' : '탈락';
  b.className = `badge ${pass?'pass':'fail'}`;
}
function showResultInline(){
  updateInlineResult();
  alert('결과가 갱신되었습니다. (하단 결과 카드 확인)');
}

// ==== 리포트(읽기 전용) ====
function buildReportFromLocal(last){
  $('#reportMeta').innerHTML = `<b>회차:</b> ${last.examId} · <b>점수:</b> ${last.score} · <b>오답:</b> ${last.wrongCount} · <b>${last.pass?'합격':'탈락'}</b>`;

  const g = $('#reportGrid');
  let html = '';
  for (let i=0;i<TOTAL;i++){
    const ch = choices[i];
    const selTxt = ch==null ? '—' : ['①','②','③','④'][ch-1];
    const ans = perExamAnswerKey[i] ? `정답 ${['①','②','③','④'][perExamAnswerKey[i]-1]}` : '정답 —';
    html += `
      <div class="tile ${wrongs[i]?'wrong':''} ${(ch!=null)?'answered':''}">
        <div class="num">${i+1}</div>
        <div class="sel">${selTxt}</div>
        <div class="ans">${ans}</div>
      </div>`;
  }
  g.innerHTML = html;
}

// ==== 액션 ====
async function startExam(){
  nickname = $('#nicknameInput').value.trim();
  examYear = ($('#yearInput').value || '').trim();
  examRound= ($('#roundInput').value || '').trim();
  if (!nickname || !examYear || !examRound){ alert('닉네임/연도/회차를 입력해 주세요.'); return; }
  examId = `${examYear}-${examRound}`;

  // 새 회차 시작 (초기화)
  current = 0;
  choices = Array(TOTAL).fill(null);
  wrongs  = Array(TOTAL).fill(false);
  perExamAnswerKey = Array(TOTAL).fill(null);

  persistLocal();
  await saveToFirestore();
  goCard();
}
function resumeExam(){
  nickname = $('#nicknameInput').value.trim() || nickname;
  examYear = $('#yearInput').value.trim() || examYear;
  examRound= $('#roundInput').value.trim() || examRound;
  if (!nickname || !examYear || !examRound){
    alert('닉네임/연도/회차를 입력해 주세요.');
    return;
  }
  examId = `${examYear}-${examRound}`;
  goCard();
}
function resetWrong(){
  if (!confirm('오답 표시만 초기화할까요?')) return;
  wrongs = Array(TOTAL).fill(false);
  persistAndRender();
}
function resetAll(){
  if (!confirm('선택/오답/정답기록을 모두 초기화합니다. 계속할까요?')) return;
  current = 0;
  choices = Array(TOTAL).fill(null);
  wrongs  = Array(TOTAL).fill(false);
  perExamAnswerKey = Array(TOTAL).fill(null);
  persistAndRender();
}
function persistAndRender(){ render(); }

let saveTimer=null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=> saveToFirestore(), 600);
}
