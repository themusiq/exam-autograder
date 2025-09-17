// script.js (module)

// ====== 상수 & 상태 ======
const TOTAL = 60;
const GROUP = 30;        // 검토 2분할 고정
let current = 0;
let page = 0;            // 0..1

// 세션 상태
let nickname = '';
let examYear = '';
let examRound = '';
let examId = '';         // `${examYear}-${examRound}`

// 답/오답/정답키(회차별로 사용자가 입력)
let choices = Array(TOTAL).fill(null);      // 1..4 or null
let wrongs  = Array(TOTAL).fill(false);     // true/false
let perExamAnswerKey = Array(TOTAL).fill(null); // 1..4 or null

// ====== 초기화 ======
const $ = (sel) => document.querySelector(sel);
const show = (sel) => $(sel).hidden = false;
const hide = (sel) => $(sel).hidden = true;

initUI();
hydrateFromLocal();
renderHome();

function initUI() {
  // 홈
  $('#startBtn').addEventListener('click', startExam);
  $('#resumeBtn').addEventListener('click', resumeExam);

  // 카드뷰
  $('#helpBtn').addEventListener('click', ()=>$('#helpBox').hidden = !$('#helpBox').hidden);
  $('#toReviewBtn').addEventListener('click', goReview);
  $('#toggleWrongBtn').addEventListener('click', ()=>{ wrongs[current] = !wrongs[current]; persistAndRender(); });

  for (let i=1;i<=4;i++){
    $(`#c${i}`).addEventListener('click', ()=>{ choices[current] = i; persistAndRender(); });
  }
  $('#prevQBtn').addEventListener('click', ()=>{ if (current>0){ current--; persistAndRender(); }});
  $('#nextQBtn').addEventListener('click', ()=>{ if (current<TOTAL-1){ current++; persistAndRender(); } else { goReview(); }});
  $('#resetAllBtn').addEventListener('click', resetAll);

  // 검토뷰
  $('#prevPageBtn').addEventListener('click', ()=>{ page = Math.max(0, page-1); persistAndRender(); });
  $('#nextPageBtn').addEventListener('click', ()=>{ page = Math.min(1, page+1); persistAndRender(); });
  $('#resetWrongBtn').addEventListener('click', resetWrong);
  $('#backToSolveBtn').addEventListener('click', goCard);
  $('#backHomeBtn').addEventListener('click', ()=>{ goHome(); });

  // 결과
  $('#toHomeFromResult').addEventListener('click', ()=>{ goHome(); });
  $('#againBtn').addEventListener('click', ()=>{ resetAll(); goCard(); });

  // 스와이프(카드/검토)
  let sx=null;
  document.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; }, {passive:true});
  document.addEventListener('touchend', e=>{
    if (sx==null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 60){
      if (!$('#cardView').hidden){
        dx<0 ? $('#nextQBtn').click() : $('#prevQBtn').click();
      } else if (!$('#reviewView').hidden){
        dx<0 ? $('#nextPageBtn').click() : $('#prevPageBtn').click();
      }
    }
    sx=null;
  }, {passive:true});
}

// ====== 로컬 저장/복원 ======
function key(k){ return `grader:${k}`; }
function hydrateFromLocal(){
  nickname = localStorage.getItem(key('nickname')) || '';
  examYear = localStorage.getItem(key('examYear')) || '';
  examRound= localStorage.getItem(key('examRound')) || '';
  if (nickname) $('#nicknameInput').value = nickname;
  if (examYear) $('#yearInput').value = examYear;
  if (examRound) $('#roundInput').value = examRound;

  const savedExamId = localStorage.getItem(key('examId'));
  if (savedExamId) examId = savedExamId;

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

// ====== Firebase 저장/불러오기 ======
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const db = window.__fb.db;

// Firestore에 현재 진행상황 저장 (덮어쓰기)
async function saveToFirestore(isFinish=false){
  if (!nickname || !examId) return;
  const ref = doc(db, 'users', nickname, 'sessions', examId);
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60))*10)/10;
  const pass = wrongCount <= 24;

  await setDoc(ref, {
    nickname, examYear, examRound, examId,
    choices, wrongs, perExamAnswerKey,
    score, wrongCount, pass,
    finishedAt: isFinish ? new Date() : null,
    updatedAt: serverTimestamp()
  }, { merge:true });

  // 홈의 최근 결과 카드 업데이트용 캐시
  localStorage.setItem(key('lastResult'), JSON.stringify({ examId, score, wrongCount, pass, at: Date.now() }));
}

async function loadLastResultFromFirestore(){
  // 간단: 로컬 캐시 우선 사용
  const j = localStorage.getItem(key('lastResult'));
  if (!j) return null;
  try { return JSON.parse(j); } catch(e){ return null; }
}

// ====== 네비게이션 ======
function goHome(){
  hide('#cardView'); hide('#reviewView'); hide('#resultView'); show('#homeView');
  renderHome();
}
function goCard(){
  hide('#homeView'); hide('#reviewView'); hide('#resultView'); show('#cardView');
  show('#dockCard'); hide('#dockReview');
  render();
}
function goReview(){
  hide('#homeView'); hide('#cardView'); hide('#resultView'); show('#reviewView');
  hide('#dockCard'); show('#dockReview');
  render();
}
function showResult(){
  hide('#homeView'); hide('#cardView'); hide('#reviewView'); show('#resultView');
  hide('#dockCard'); hide('#dockReview');
  // 값 채우기
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60))*10)/10;
  $('#finalScore').textContent = score;
  $('#finalWrong').textContent = wrongCount;
  const pass = wrongCount <= 24;
  const b = $('#finalBadge');
  b.textContent = pass ? '합격' : '탈락';
  b.className = `badge ${pass?'pass':'fail'}`;
}

// ====== 홈 렌더 ======
async function renderHome(){
  show('#homeView'); hide('#cardView'); hide('#reviewView'); hide('#resultView');
  $('#resumeBtn').hidden = !(choices.some(v=>v!=null) || wrongs.some(Boolean));
  const last = await loadLastResultFromFirestore();
  const box = $('#lastResultBox');
  if (!last){ box.textContent = '저장된 기록이 없습니다.'; }
  else {
    box.innerHTML = `
      <div><b>회차:</b> ${last.examId}</div>
      <div><b>점수:</b> ${last.score} / <b>오답:</b> ${last.wrongCount}</div>
      <div><b>결과:</b> ${last.pass ? '합격' : '탈락'}</div>
    `;
  }
}

// ====== 메인 렌더 ======
function render(){
  const answered = choices.reduce((a,c,i)=> a + ((c!=null || wrongs[i]) ? 1 : 0), 0);
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60)) * 10)/10;
  const pct = Math.round(answered / TOTAL * 100);
  const pass = wrongCount <= 24;

  // 상단바
  $('#wrongStat').textContent = `틀린 ${wrongCount}`;
  $('#scoreStat').textContent = `점수 ${score}`;
  $('#progressStat').textContent = `${pct}%`;
  $('#progressBar').style.width = `${pct}%`;
  const badge = $('#passBadge');
  badge.textContent = pass ? '합격' : '탈락';
  badge.className = `badge ${pass ? 'pass' : 'fail'}`;

  // 카드뷰
  if (!$('#cardView').hidden){
    $('#qTitle').textContent = `문항 ${current+1} / ${TOTAL}`;
    for (let i=1;i<=4;i++){
      $(`#c${i}`).classList.toggle('selected', choices[current] === i);
    }
    $('#toggleWrongBtn').textContent = wrongs[current] ? '오답 해제' : '오답 표시';
  }

  // 검토뷰
  if (!$('#reviewView').hidden){
    page = Math.max(0, Math.min(page, 1));  // 0..1
    buildGrid();
  }

  // 진행 100%면 자동 검토
  if (pct === 100 && !$('#reviewView').hidden && !$('#resultView').hidden) {
    // no-op (이미 다른 화면)
  } else if (pct === 100 && !$('#reviewView').hidden === false && !$('#resultView').hidden){
    goReview();
  }

  // 저장
  persistLocal();
  scheduleSave();
}

function buildGrid(){
  const g = $('#grid');
  const start = page * GROUP;
  const end = Math.min(start + GROUP, TOTAL);
  let html = '';
  for (let i=start;i<end;i++){
    const ch = choices[i];
    const small = ch==null ? '—' : `선택 ${['①','②','③','④'][ch-1]}`;
    html += `
      <div class="tile ${wrongs[i]?'wrong':''} ${(ch!=null||wrongs[i])?'answered':''}" onclick="__toggleWrongAt(${i})">
        <div class="big">${i+1}</div>
        <div class="small">${small}</div>
      </div>`;
  }
  g.innerHTML = html;
}

// 페이지에서 쓸 수 있게 전역 함수로 노출
window.__toggleWrongAt = async function(i){
  wrongs[i] = !wrongs[i];
  // 오답으로 바꿀 때 정답번호 입력 팝업
  if (wrongs[i] && perExamAnswerKey[i] == null){
    const ans = prompt('정답 번호 입력 (1~4), 취소=미저장');
    const v = Number(ans);
    if ([1,2,3,4].includes(v)) perExamAnswerKey[i] = v;
  }
  persistAndRender();
};

// ====== 동작 유틸 ======
function resetWrong(){
  if (!confirm('오답 표시만 초기화할까요?')) return;
  wrongs = Array(TOTAL).fill(false);
  persistAndRender();
}
function resetAll(){
  if (!confirm('선택/오답을 모두 초기화하고 첫 화면으로 돌아갈까요?')) return;
  current = 0; page = 0;
  choices = Array(TOTAL).fill(null);
  wrongs  = Array(TOTAL).fill(false);
  perExamAnswerKey = Array(TOTAL).fill(null);
  persistAndRender();
  goHome();
}

function persistAndRender(){ render(); }

// 저장 디바운스
let saveTimer=null;
function scheduleSave(){
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=> saveToFirestore(false), 600);
}

// ====== 홈 액션 ======
async function startExam(){
  nickname = $('#nicknameInput').value.trim();
  examYear = ($('#yearInput').value || '').trim();
  examRound= ($('#roundInput').value || '').trim();
  if (!nickname || !examYear || !examRound){ alert('닉네임/연도/회차를 입력해 주세요.'); return; }
  examId = `${examYear}-${examRound}`;
  // 초기화(새 회차 시작)
  current = 0; page = 0;
  choices = Array(TOTAL).fill(null);
  wrongs  = Array(TOTAL).fill(false);
  perExamAnswerKey = Array(TOTAL).fill(null);
  persistLocal();
  await saveToFirestore(false);
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

// ====== 시험 종료(옵션: 결과화면으로 수동 이동) ======
window.finishExam = async function(){
  await saveToFirestore(true);
  showResult();
};
