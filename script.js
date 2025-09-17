const totalQ = 60;
let current = 0;
let choices = Array(totalQ).fill(null);
let wrongs = Array(totalQ).fill(false);

function render() {
  document.getElementById("qnum").textContent = `문항 ${current+1}`;
  // 선택 버튼 상태 반영
  document.querySelectorAll(".choices button").forEach((btn,i)=>{
    btn.classList.toggle("selected", choices[current] === i+1);
  });
  document.querySelector(".wrong-btn").textContent = wrongs[current] ? "오답 해제" : "오답 표시";

  // 통계
  const wrongCount = wrongs.filter(v=>v).length;
  const score = Math.round((100 - wrongCount*(100/60))*10)/10;
  document.getElementById("stats").textContent = `틀린 개수: ${wrongCount} | 점수: ${score}`;
}

function pick(n){ choices[current] = n; render(); }
function toggleWrong(){ wrongs[current] = !wrongs[current]; render(); }
function prevQ(){ if(current>0){ current--; render(); } }
function nextQ(){ if(current<totalQ-1){ current++; render(); } }
function resetAll(){
  if(!confirm("초기화할까요?")) return;
  choices.fill(null); wrongs.fill(false); current=0; render();
}

render();
