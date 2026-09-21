const questions = [
  ["Antibiotics can cure the common cold and flu.", ["Myth", "Fact"], 0, "Correct. Colds and flu are usually caused by viruses, and antibiotics do not work against viruses."],
  ["It is safe to share leftover antibiotics with a friend.", ["True", "False"], 1, "Correct. Never share or reuse antibiotics. A health professional must decide what medicine is appropriate."],
  ["Antibiotic resistance can make infections harder to treat.", ["True", "False"], 0, "Correct. Resistant bacteria may no longer respond to usual antibiotic treatments."],
  ["Handwashing can help prevent infections.", ["True", "False"], 0, "Correct. Good hygiene reduces the spread of infections."],
  ["Antibiotics should be used only as directed by a qualified healthcare professional.", ["True", "False"], 0, "Correct. Do not start, stop, share, or change medicines without professional advice."],
  ["Antibiotic resistance affects only hospitals.", ["True", "False"], 1, "Correct. Resistance affects people, animals, food, and the environment."],
];
const topicContent = {
  bacteria: ["Antibiotics and bacteria", "Bacteria are tiny living organisms. Some bacteria cause infections, and antibiotics can be used to treat certain bacterial infections when a qualified clinician decides they are needed."],
  resistance: ["How resistance happens", "When antibiotics are used inappropriately, susceptible bacteria are killed while resistant bacteria may survive and multiply. These resistant bacteria can spread."],
  role: ["Your role in prevention", "Handwashing, food safety, vaccination, and using medicines responsibly are important actions. Sharing accurate information helps other people make safer choices too."],
};
let current = 0, score = 0, answered = false;
const question = document.querySelector("#question"), answers = document.querySelector("#answers"), feedback = document.querySelector("#feedback"), next = document.querySelector("#next-button"), count = document.querySelector("#quiz-count"), progress = document.querySelector("#progress-bar");
function renderQuestion(){
  if(current === questions.length){
    question.textContent = `You scored ${score} out of ${questions.length}!`;
    answers.innerHTML = "";
    feedback.textContent = score >= 5 ? "Excellent work. You are ready to share what you learned." : "Nice effort. Review the learning sections and try the quiz again.";
    next.textContent = "Try again"; next.classList.remove("hidden"); count.textContent = "Quiz complete"; progress.style.width = "100%"; return;
  }
  const item = questions[current]; answered = false; question.textContent = item[0]; count.textContent = `Question ${current + 1} of ${questions.length}`; progress.style.width = `${((current + 1) / questions.length) * 100}%`; feedback.textContent = ""; next.classList.add("hidden"); answers.innerHTML = "";
  item[1].forEach((answer, index) => { const button = document.createElement("button"); button.className = "answer"; button.textContent = answer; button.addEventListener("click", () => selectAnswer(index, button)); answers.appendChild(button); });
}
function selectAnswer(index, button){
  if(answered) return; answered = true; const item = questions[current]; const all = [...answers.children];
  all.forEach((b, i) => { b.disabled = true; if(i === item[2]) b.classList.add("correct"); });
  if(index === item[2]) { score++; feedback.textContent = "✓ " + item[3]; feedback.style.color = "#087454"; } else { button.classList.add("wrong"); feedback.textContent = "Not quite. " + item[3]; feedback.style.color = "#a42e1d"; }
  next.textContent = current === questions.length - 1 ? "See my result" : "Next question"; next.classList.remove("hidden");
}
next.addEventListener("click", () => { if(current === questions.length) { current = 0; score = 0; } else { current++; } renderQuestion(); });
renderQuestion();
const dialog = document.querySelector("#topic-modal"), modalContent = document.querySelector("#modal-content");
document.querySelectorAll("[data-modal]").forEach(button => button.addEventListener("click", () => { const [title, text] = topicContent[button.dataset.modal]; modalContent.innerHTML = `<p class="eyebrow">Learn more</p><h2>${title}</h2><p>${text}</p>`; dialog.showModal(); }));
document.querySelector(".close-button").addEventListener("click", () => dialog.close());
document.querySelector(".menu-button").addEventListener("click", e => { const nav = document.querySelector(".navigation"); nav.classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", nav.classList.contains("open")); });
document.querySelectorAll(".navigation a").forEach(a => a.addEventListener("click", () => document.querySelector(".navigation").classList.remove("open")));
document.querySelector("#share-button").addEventListener("click", async () => { try { await navigator.share({title: document.title, url: location.href}); } catch { await navigator.clipboard.writeText(location.href); alert("Link copied. Share it with a friend!"); } });
