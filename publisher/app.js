const API = "https://paws-tiktok.pawsapp.workers.dev";
// 틱톡 게시 화면. 틱톡 Content Posting API 의 UX 지침을 따른다:
// 계정 표시, 공개 범위는 기본값 없이 직접 고르기, 상호작용 허용은 기본 꺼짐, 상업 콘텐츠 공시, 동의 문구, 사람이 Post 를 눌러야만 게시.
const PRIVACY = { PUBLIC_TO_EVERYONE: "Everyone", MUTUAL_FOLLOW_FRIENDS: "Friends", FOLLOWER_OF_CREATOR: "Followers", SELF_ONLY: "Only me" };
const MUSIC = '<a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Music Usage Confirmation</a>';
const BRANDED = '<a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Branded Content Policy</a>';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let tok = params.get("d");
let creator = null, duration = null, posting = false, posted = false;

const say = (t) => { $("status").textContent = t; };

async function api(path, opts) {
  const r = await fetch(API + path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function reason() {
  if (posted) return "";
  if (creator.error) return "TikTok says this account can't post right now. Try again later.";
  if (duration === null) return "Loading the video…";
  if (duration > creator.max_video_post_duration_sec)
    return `This video is longer than ${creator.max_video_post_duration_sec} seconds, the limit for your account.`;
  if (!$("privacy").value) return "Choose who can view this video.";
  if ($("disclose").checked) {
    if (!$("brand-own").checked && !$("brand-paid").checked) return "Choose Your brand, Branded content, or both.";
    if ($("brand-paid").checked && $("privacy").value === "SELF_ONLY") return "Branded content can't be private. Choose another audience.";
  }
  return "";
}

function refresh() {
  const paid = $("disclose").checked && $("brand-paid").checked;
  const own = $("disclose").checked && $("brand-own").checked;
  $("disclose-opts").hidden = !$("disclose").checked;
  const only = $("privacy").querySelector('option[value="SELF_ONLY"]');
  if (only) only.disabled = paid && $("privacy").value !== "SELF_ONLY";
  $("label-note").textContent = paid ? "Your video will be labeled as 'Paid partnership'."
    : own ? "Your video will be labeled as 'Promotional content'." : "";
  $("consent").innerHTML = paid ? `By posting, you agree to TikTok's ${BRANDED} and ${MUSIC}.` : `By posting, you agree to TikTok's ${MUSIC}.`;
  $("count").textContent = $("caption").value.length;
  const why = reason();
  $("why").textContent = why;
  $("post").disabled = posting || posted || !!why;
}

function show(d) {
  $("caption").value = d.caption;
  if (!d.connected) {
    $("connect-link").href = `${API}/tt/login?d=${encodeURIComponent(tok)}`;
    $("connect").hidden = false;
    return;
  }
  creator = d.creator || { error: "unknown" };
  $("form").hidden = false;
  if (!creator.error) {
    $("who").textContent = `Posting to @${creator.creator_nickname}`;
    if (creator.creator_avatar_url) $("avatar").src = creator.creator_avatar_url; else $("avatar").hidden = true;
    for (const v of creator.privacy_level_options || []) $("privacy").add(new Option(PRIVACY[v] || v, v));
    for (const [id, off] of [["comment", creator.comment_disabled], ["duet", creator.duet_disabled], ["stitch", creator.stitch_disabled]]) {
      $(id).disabled = !!off;
      if (off) $("interaction-note").hidden = false;
    }
  } else {
    $("avatar").hidden = true;
  }
  $("video").addEventListener("loadedmetadata", () => { duration = $("video").duration; refresh(); });
  $("video").addEventListener("error", () => { say("The video could not be loaded."); });
  $("video").src = `${API}/tt/drafts/${encodeURIComponent(tok)}/video`;
  if (d.status && d.status.state && d.status.state !== "FAILED") { posted = true; say("This video was already posted."); }
  refresh();
}

async function poll() {
  for (let i = 0; i < 60; i++) {
    const s = await api(`/tt/drafts/${encodeURIComponent(tok)}/status`).catch(() => ({}));
    if (s.state === "PUBLISH_COMPLETE") return say("Posted. It can take a few minutes to show on your profile.");
    if (s.state === "FAILED") return say(`TikTok could not post it: ${s.fail_reason || "unknown reason"}.`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  say("Still processing on TikTok. Check your profile in a few minutes.");
}

$("form").addEventListener("input", refresh);
$("form").addEventListener("change", refresh);
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (reason() || posting || posted) return;
  posting = true; refresh();
  say("Posting…");
  try {
    await api(`/tt/drafts/${encodeURIComponent(tok)}/publish`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caption: $("caption").value, privacy_level: $("privacy").value,
        disable_comment: !$("comment").checked, disable_duet: !$("duet").checked, disable_stitch: !$("stitch").checked,
        brand_content_toggle: $("disclose").checked && $("brand-paid").checked,
        brand_organic_toggle: $("disclose").checked && $("brand-own").checked,
        consent: true,
      }),
    });
    posted = true; posting = false; refresh();
    say("Uploaded. TikTok is processing it…");
    await poll();
  } catch (err) {
    posting = false; refresh();
    say(`Not posted: ${err.message}`);
  }
});

(async () => {
  try {
    if (params.get("code") && params.get("state")) {
      say("Connecting your TikTok account…");
      tok = (await api("/tt/token", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: params.get("code"), state: params.get("state") }) })).d;
      history.replaceState(null, "", `?d=${encodeURIComponent(tok)}`);
      say("");
    }
    if (params.get("error")) return say(`TikTok sign-in was cancelled: ${params.get("error_description") || params.get("error")}`);
    if (!tok) return say("This link is missing its post. Open it from the Slack preview.");
    show(await api(`/tt/drafts/${encodeURIComponent(tok)}`));
  } catch (err) {
    say(`Could not load this post: ${err.message}. The link may have expired (48 hours).`);
  }
})();
