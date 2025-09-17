// ---- 상태 ----
const TOTAL = 60;
let current = 0;
let choices = load('choices') ?? Array(TOTAL).fill(null);   // 1..4 or null
let wrongs  = load('wrongs')  ?? Array(TOTAL).fill(false);  // true/false
let groupSize = load('groupSize') ?? 30;                     // 30(2분할) | 20(3분할)
let page = 0;                                                // 검토 페이지 인덱스(0~)

// ---- 렌더 ----
function render() {
  // 진행 통계
  const answered = choices.reduce((a,c,i)=> a + ((c!=null || wrongs[i]) ? 1 : 0), 0);
  const wrongCount = wrongs.filter(Boolean).length;
  const score = Math.round((100 - wrongCount*(100/60)) * 10)/10;
  const pct = Math.round(answered / TOTAL * 100);
  const pass = score >= 60;

  // 상단바
  $('#wrongStat').textContent = `틀린 ${wrongCount}`;
  $('#scoreStat').textContent = `점수 ${score}`;
  $('#progressStat').textContent = `${pct}%`;
  $('#progressBar').style.width = `${pct}%`;
  const badge = $('#passBadge');
  badge.textContent = pass ? '합격' : '대기';
  badge.className = `badge ${pass ? 'pass' : 'mute'}`;

  // 카드뷰
  $('#qTitle').textContent = `문항 ${current+1} / ${TOTAL}`;
  for (let i=1;i<=4;i++){
    const el = $(`#c${i}`);
    el.classList.toggle('selected', choices[current] === i);
  }
  const wb = $('#wrongBtn');
  wb.textContent = wrongs[current] ? '오답 해제' : '오답 표시';

  // 검토뷰
  updateGroupButtons();
  updatePageLabel();
  buildGrid();  // 현재 페이지 타일 생성/갱신

  // 100%면 자동 검토 전환
  if (pct === 100 && !isReview()) {
    goReview();
    toast('모든 문항 응답 완료! 검토 화면으로 이동합니다.');
  }

  // 저장
  save('choices', choices);
  save('wrongs', wrongs);
  save('groupSize', groupSize);
}

function updateGroupButtons(){
  $('#g20').classList.toggle('active', groupSize===20);
  $('#g30').classList.toggle('active', groupSize===30);
}
function updatePageLabel(){
  const totalPages = Math.ceil(TOTAL / groupSize);
  page = Math.max(0, Math.min(page, totalPages-1));
  $('#pageLabel').textContent = `${page+1} / ${totalPages}`;
}

function buildGrid(){
  const g = $('#grid');
  const start = page * groupSize;
  const end = Math.min(start + groupSize, TOTAL);
  // 빌드
  let html = '';
  for (let i=start;i<end;i++){
    const ch = choices[i];
    const small = ch==null ? '—' : `선택 ${['①','②','③','④'][ch-1]}`;
    html += `
      <div class="tile ${wrongs[i]?'wrong':''} ${(ch!=null||wrongs[i])?'answered':''}" data-i="${i}" onclick="toggleWrongAt(${i})">
        <div class="big">${i+1}</div>
        <div class="small">${small}</div>
      </div>`;
  }
  g.innerHTML = html;
}

// ---- 조작: 풀이(카드) ----
function pick(n){ choices[current] = n; render(); }
function toggleWrong(){ wrongs[current] = !wrongs[current]; render(); }
function prevQ(){ if (current>0){ current--; render(); } }
function nextQ(){ if (current<TOTAL-1){ current++; render(); } else { goReview(); } }

// ---- 조작: 검토(오답체크) ----
function setGroupSize(n){ groupSize = n; page = 0; render(); }
function prevPage(){ page = Math.max(0, page-1); render(); }
function nextPage(){ page = Math.min(Math.ceil(TOTAL/groupSize)-1, page+1); render(); }
function toggleWrongAt(i){ wrongs[i] = !wrongs[i]; render(); }

// ---- 전환/도움말/초기화 ----
function goReview(){ show('#reviewView'); hide('#cardView'); render(); }
function goCard(){ show('#cardView'); hide('#reviewView'); render(); }
function toggleHelp(){ const el = $('#helpBox'); el.hidden = !el.hidden; }
function resetAll(){
  if (!confirm('모든 응답/오답 표시를 초기화할까요?')) return;
  choices = Array(TOTAL).fill(null);
  wrongs  = Array(TOTAL).fill(false);
  current = 0; page = 0;
  render();
}

// ---- 유틸 ----
function $(sel){ return document.querySelector(sel); }
function show(sel){ $(sel).hidden = false; }
function hide(sel){ $(sel).hidden = true; }
function isReview(){ return !$('#reviewView').hidden; }
function save(k,v){ localStorage.setItem(`grader:${k}`, JSON.stringify(v)); }
function load(k){ try{ return JSON.parse(localStorage.getItem(`grader:${k}`)); }catch(e){ return null; } }

// 토스트
let _toastTimer=null;
function toast(msg){
  let el = $('#toast');
  if (!el){
    el = document.createElement('div'); el.id='toast';
    el.style.cssText='position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#000c;color:#fff;padding:10px 14px;border-radius:10px;z-index:999;box-shadow:0 4px 18px #0008;';
    document.body.appendChild(el);
  }
  el.textContent = msg; el.style.opacity='1';
  clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>el.style.opacity='0',1600);
}

// 스와이프(카드 모드 좌우)
let sx=null;
document.addEventListener('touchstart', e=>{ sx=e.touches[0].clientX; }, {passive:true});
document.addEventListener('touchend', e=>{
  if ($('#cardView').hidden || sx==null) return;
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx)>60){ dx<0?nextQ():prevQ(); }
  sx=null;
},{passive:true});

// 초기 렌더
render();
