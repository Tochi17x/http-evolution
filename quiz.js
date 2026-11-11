/*
   quiz.js
   The Evolution of HTTP - IT 3203 Project Milestone #2
   Handles the 10-minute timer, grading, results and retake for quiz.html.
*/

/* ---------- Settings ---------- */

const TIME_LIMIT_SECONDS = 10 * 60;   // 10 minutes
const PASSING_SCORE = 7;              // need 7 out of 10 to pass

/*
   Answer key. Each question has:
   - name:    the "name" attribute of its inputs in quiz.html
   - type:    "text", "radio" or "checkbox"
   - correct: the right answer (an array for checkbox questions)
   - check:   (text questions only) a function that decides if the typed answer is right,
              so small differences in spelling or capitals don't count as wrong
*/
const answerKey = [
    {
        name: "q1",
        type: "text",
        correct: "HyperText Transfer Protocol",
        // Ignore spaces and capitals so "Hypertext transfer protocol" and
        // "Hyper Text Transfer Protocol" are both accepted
        check: function (answer) {
            return normalize(answer).replace(/ /g, "") === "hypertexttransferprotocol";
        }
    },
    {
        name: "q2",
        type: "text",
        correct: "Not Found",
        // Accept "Not Found", "not found", "404 Not Found", "page not found", etc.
        check: function (answer) {
            return normalize(answer).includes("not found");
        }
    },
    { name: "q3", type: "radio", correct: "GET" },
    { name: "q4", type: "radio", correct: "HTTP/1.1" },
    { name: "q5", type: "radio", correct: "QUIC" },
    { name: "q6", type: "radio", correct: "TLS" },
    {
        name: "q7",
        type: "checkbox",
        correct: ["Version numbers", "Status codes", "Headers", "Content-Type"]
    },
    {
        name: "q8",
        type: "checkbox",
        correct: ["GET", "POST", "PUT", "DELETE", "HEAD"]
    },
    { name: "q9", type: "radio", correct: "True" },
    { name: "q10", type: "radio", correct: "It tells what type of data the body contains" }
];

/* ---------- Page elements ---------- */

const form = document.getElementById("quiz-form");
const submitButton = document.getElementById("submit-btn");
const retakeButton = document.getElementById("retake-btn");
const timerBox = document.getElementById("timer");
const timeLeftText = document.getElementById("time-left");
const resultsBox = document.getElementById("results");

/* ---------- Quiz state ---------- */

let startTime = 0;        // when the current attempt started (milliseconds)
let timerId = null;       // id from setInterval so the timer can be stopped
let submitted = false;    // stops the quiz from being graded twice

/* ---------- Helper functions ---------- */

// Lowercase, trim and squash extra spaces/punctuation so typed answers compare fairly
function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Turns a number of seconds into "m:ss", for example 75 -> "1:15"
function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
}

// Reads what the student answered for one question.
// Text gives a string, radio gives the checked value (or ""),
// checkbox gives an array of every checked value.
function getStudentAnswer(question) {
    if (question.type === "text") {
        return form.elements[question.name].value.trim();
    }

    const checked = form.querySelectorAll('input[name="' + question.name + '"]:checked');

    if (question.type === "radio") {
        return checked.length > 0 ? checked[0].value : "";
    }

    // checkbox: collect all the checked values into an array
    const values = [];
    checked.forEach(function (box) {
        values.push(box.value);
    });
    return values;
}

// Decides if one answer is right
function isCorrect(question, answer) {
    if (question.type === "text") {
        return answer !== "" && question.check(answer);
    }

    if (question.type === "radio") {
        return answer === question.correct;
    }

    // checkbox: only correct if the student picked EXACTLY the right options.
    // Same number of boxes, and every box they picked is in the answer key.
    if (answer.length !== question.correct.length) {
        return false;
    }
    return answer.every(function (value) {
        return question.correct.includes(value);
    });
}

// Makes an answer readable for the feedback text
function answerToText(answer) {
    if (Array.isArray(answer)) {
        return answer.length > 0 ? answer.join(", ") : "(no answer)";
    }
    return answer !== "" ? answer : "(no answer)";
}

/* ---------- Timer ---------- */

function startTimer() {
    startTime = Date.now();
    updateTimer();
    timerId = setInterval(updateTimer, 1000);
}

function stopTimer() {
    clearInterval(timerId);
    timerId = null;
}

// Works out the time left from the real clock instead of counting down by 1 each
// second. setInterval can drift or pause in a background tab, so this stays accurate.
function updateTimer() {
    const secondsUsed = Math.floor((Date.now() - startTime) / 1000);
    const secondsLeft = Math.max(TIME_LIMIT_SECONDS - secondsUsed, 0);

    timeLeftText.textContent = formatTime(secondsLeft);

    // Turn the timer red in the last minute
    timerBox.classList.toggle("low-time", secondsLeft <= 60);

    // Out of time: submit automatically
    if (secondsLeft === 0) {
        gradeQuiz(true);
    }
}

/* ---------- Grading ---------- */

// timeExpired is true when the timer ran out, false when the student clicked Submit
function gradeQuiz(timeExpired) {
    // Prevent duplicate submissions (double clicks, or the timer firing after Submit)
    if (submitted) {
        return;
    }
    submitted = true;
    stopTimer();

    // Time taken, capped at 10:00 in case the timer fired a little late
    // (Math.floor matches how the countdown display rounds, so the two always agree)
    const secondsTaken = Math.min(Math.floor((Date.now() - startTime) / 1000), TIME_LIMIT_SECONDS);

    let score = 0;

    answerKey.forEach(function (question) {
        const answer = getStudentAnswer(question);
        const correct = isCorrect(question, answer);
        if (correct) {
            score++;
        }
        showFeedback(question, answer, correct);
    });

    // Lock the form so answers can't be changed after grading
    setFormLocked(true);
    submitButton.hidden = true;

    showResults(score, secondsTaken, timeExpired);
}

// Adds a "Correct / Incorrect" note under one question
function showFeedback(question, answer, correct) {
    const fieldset = form.querySelector('[name="' + question.name + '"]').closest("fieldset");
    fieldset.classList.add(correct ? "correct" : "incorrect");

    const feedback = document.createElement("div");
    feedback.className = "feedback";

    const status = document.createElement("p");
    const statusLabel = document.createElement("strong");
    if (correct) {
        statusLabel.textContent = "Correct (1 point)";
    } else if (answerToText(answer) === "(no answer)") {
        statusLabel.textContent = "Unanswered (0 points)";
    } else {
        statusLabel.textContent = "Incorrect (0 points)";
    }
    status.appendChild(statusLabel);

    // textContent (not innerHTML) so whatever the student typed is shown as plain text
    const yourAnswer = document.createElement("p");
    yourAnswer.textContent = "Your answer: " + answerToText(answer);

    const rightAnswer = document.createElement("p");
    rightAnswer.textContent = "Correct answer: " + answerToText(question.correct);

    feedback.append(status, yourAnswer, rightAnswer);
    fieldset.appendChild(feedback);
}

// Fills in the results box at the top of the quiz
function showResults(score, secondsTaken, timeExpired) {
    const total = answerKey.length;
    const percent = Math.round((score / total) * 100);
    const passed = score >= PASSING_SCORE;

    const status = document.getElementById("result-status");
    status.textContent = passed ? "PASS" : "FAIL";
    status.className = "result-status " + (passed ? "pass" : "fail");

    document.getElementById("result-score").textContent =
        "Score: " + score + " / " + total + " (" + percent + "%). You need " + PASSING_SCORE + "/" + total + " to pass.";

    document.getElementById("result-time").textContent =
        "Time spent: " + formatTime(secondsTaken) + " out of " + formatTime(TIME_LIMIT_SECONDS) + ".";

    document.getElementById("result-note").textContent =
        timeExpired ? "Time ran out, so the quiz was submitted automatically." : "";

    resultsBox.hidden = false;
    resultsBox.scrollIntoView({ behavior: "smooth" });
}

// Disables or enables every input in the quiz
function setFormLocked(locked) {
    form.querySelectorAll("input").forEach(function (input) {
        input.disabled = locked;
    });
}

/* ---------- Retake ---------- */

function resetQuiz() {
    // Clear all typed text, radio buttons and checkboxes
    form.reset();
    setFormLocked(false);

    // Remove the feedback notes and the green/red borders
    form.querySelectorAll(".feedback").forEach(function (note) {
        note.remove();
    });
    form.querySelectorAll("fieldset").forEach(function (fieldset) {
        fieldset.classList.remove("correct", "incorrect");
    });

    resultsBox.hidden = true;
    submitButton.hidden = false;
    submitted = false;

    // Start a fresh 10 minutes
    stopTimer();
    startTimer();

    window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Event listeners ---------- */

form.addEventListener("submit", function (event) {
    // Stop the browser from reloading the page; grade it here instead
    event.preventDefault();
    gradeQuiz(false);
});

retakeButton.addEventListener("click", resetQuiz);

// Pressing Enter inside a text box would normally submit the whole form.
// Block that so the quiz is only submitted with the Submit button (or the timer).
form.querySelectorAll('input[type="text"]').forEach(function (input) {
    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
        }
    });
});

// The quiz begins as soon as the page loads
startTimer();
