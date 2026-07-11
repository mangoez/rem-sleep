"use strict";

/**
 * UI layer. Renders the catalog and story screens from location.hash.
 * Browser navigation works for free. All narration goes through Narrator.
 * Nothing TTS shaped lives here.
 */

const MOD = "u/AlphaDaddy_Tendicus";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function chrome(mainNode) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="masthead">
      <span class="snoo">🌙</span>
      <span class="subname">r/BedtimeStories</span>
      <span class="tagline">tales of honor, chivalry, and tendies narrated by daddy himself</span>
    </div>
    <div class="page">
      <div class="main"></div>
      <div class="side">
        <h2>About Community</h2>
        <div class="box">
          <button class="subscribe">tuck me in</button>
          <div class="subcount">420,069 tucked in &bull; 1 fedora online</div>
        </div>
        <h2>Rules</h2>
        <div class="box"><ol>
          <li>Respect the fedora.</li>
          <li>M'lady is a term of RESPECT.</li>
          <li>No wolves. Not after last time.</li>
          <li>Chicken tendies are a food group.</li>
          <li>The pwincess is always wight.</li>
          <li>Only ${MOD} may narrate.</li>
          <li>Lights out means lights out.</li>
        </ol></div>
        <h2>Moderators</h2>
        <div class="box">${MOD} 🎩 <i>(alpha, daddy, keeper of this realm)</i></div>
      </div>
    </div>`;
  app.querySelector(".subscribe").onclick = (e) => { e.target.textContent = "tucked in ✓"; };
  app.querySelector(".main").appendChild(mainNode);
}

function renderCatalog() {
  const main = el("div");
  for (const story of REM_STORIES) {
    const post = el("div", "post");

    const votes = el("div", "votes");
    const up = el("div", "arrow up", "▲");
    const score = el("div", "score", String(story.upvotes));
    const down = el("div", "arrow", "▼");
    down.title = "downvotes are disabled in this safe space";
    up.onclick = () => {
      up.classList.add("voted");
      score.textContent = String(story.upvotes + 1);
    };
    votes.append(up, score, down);

    const entry = el("div", "entry");
    const title = el("div", "title");
    const link = el("a", "", story.title + " ");
    link.href = "#/s/" + story.id;
    const flair = el("span", "flair", "STORY");
    title.append(link, flair);
    const blurb = el("div", "blurb", story.blurb);
    const meta = el("div", "meta", `submitted just before bedtime by ${MOD} [M], stickied obviously`);
    const buttons = el("div", "buttons");
    for (const label of [`${story.lines.length} comments (locked)`, "share", "save", "tuck in"]) {
      buttons.appendChild(el("a", "", label));
    }
    entry.append(title, blurb, meta, buttons);

    post.append(votes, entry);
    main.appendChild(post);
  }
  chrome(main);
}

function renderStory(story) {
  const main = el("div");
  const back = el("a", "", "← back to r/BedtimeStories");
  back.href = "#";
  main.appendChild(back);
  main.appendChild(el("h1", "story-title", story.title));
  main.appendChild(el("div", "story-meta",
    `posted by ${MOD} [M] 🎩 • locked • 100% upvoted • read to you like it's 2014`));

  const body = el("div", "usertext");
  const paragraphs = story.lines.map((line) => {
    const isPw = line.speaker === "pwincess";
    const p = el("p", isPw ? "pwincess" : "", (isPw ? "👸 " : "🎩 ") + line.text);
    body.appendChild(p);
    return p;
  });
  main.appendChild(body);

  const player = el("div", "player");
  const playBtn = el("button", "", "▶ play");
  const pauseBtn = el("button", "", "⏸ pause");
  const stopBtn = el("button", "", "⏹ stop");
  const status = el("span", "status", "narration ready, m'lady");
  player.append(playBtn, pauseBtn, stopBtn, status);
  main.appendChild(player);

  let playState = "idle"; // mirrors Narrator purely for button affordance
  const highlight = (i) => {
    paragraphs.forEach((p, j) => p.classList.toggle("now", i === j));
    if (paragraphs[i]) paragraphs[i].scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const setState = (s, text) => {
    playState = s;
    playBtn.disabled = s === "playing";
    playBtn.textContent = s === "paused" ? "▶ resume" : "▶ play";
    pauseBtn.disabled = s !== "playing";
    stopBtn.disabled = s === "idle";
    status.textContent = text;
  };
  setState("idle", "narration ready, m'lady");

  playBtn.onclick = () => {
    if (playState === "paused") {
      setState("playing", "resuming…"); // before resume(): onLine fires synchronously and must win
      Narrator.resume();
    } else {
      Narrator.play(story.lines, {
        storyId: story.id,
        onLine: (i) => {
          setState("playing", `line ${i + 1} of ${story.lines.length}`);
          highlight(i);
        },
        onEnd: () => {
          highlight(-1);
          setState("idle", "THE END. goodnight, sweet subreddit. 🎩");
        },
      });
    }
  };
  pauseBtn.onclick = () => {
    Narrator.pause();
    setState("paused", "paused. daddy will wait.");
  };
  stopBtn.onclick = () => {
    Narrator.stop();
    highlight(-1);
    setState("idle", "narration stopped. the mods saw everything.");
  };

  chrome(main);
}

function route() {
  Narrator.stop(); // navigating away always silences the old screen
  const match = location.hash.match(/^#\/s\/(.+)$/);
  const story = match && REM_STORIES.find((s) => s.id === match[1]);
  if (story) renderStory(story);
  else renderCatalog(); // unknown hash: the catalog, not an error page
}

window.addEventListener("hashchange", route);
route();
