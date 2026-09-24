import base64, os, html
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.environ.get('WEB') == '1'
FONTS = '/home/user/Resume-creator-Job-Finder/public/fonts'
TO = 'jsgrigson@gmail.com'

CW = [
  dict(id='ink-brass', n=1, name='Ink & Brass', short='Ink', note='Navy and brushed brass. Calm and classic. This is the one it has now.',
       acc='#22334a', met='#a8894f', accD='#e6dfcf', metD='#c9ab6e'),
  dict(id='bordeaux', n=2, name='Bordeaux & Rose Gold', short='Bordeaux', note='Deep wine red with a soft rose gold. The warmest of the five.',
       acc='#6e2f3c', met='#b08d6e', accD='#d19aa4', metD='#b4aa9d'),
  dict(id='hunter', n=3, name='Hunter & Antique Gold', short='Hunter', note='Forest green with an old gold. Richest in dark mode.',
       acc='#2e4a3d', met='#9c8a5a', accD='#9dbfa9', metD='#b1ab93'),
  dict(id='graphite', n=4, name='Graphite & Gold', short='Graphite', note='Near-black with a bright gold. The most understated.',
       acc='#2c2c30', met='#b3945b', accD='#e3e6ea', metD='#b9ad92'),
  dict(id='verdigris', n=5, name='Verdigris & Copper', short='Verdigris', note='Weathered teal with copper. The only cool color of the five.',
       acc='#2f5f66', met='#a26b4a', accD='#8fc0c6', metD='#b3a49a'),
]
DV = [('web', 'Web'), ('mobile', 'Mobile')]
TH = [('light', 'Light'), ('dark', 'Dark')]
SC = [('welcome', 'First visit'), ('dashboard', 'Home'), ('jobs', 'Jobs'), ('resume', 'Resume')]

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

def var(cw, th, dv, sc):
    return f'--i-{cw}-{th}-{dv}-{sc}'

css = []
# Fonts: the app's own self-hosted files, embedded so the page looks right offline.
NS = 'fonts/newsreader-latin.woff2' if WEB else f"data:font/woff2;base64,{b64(FONTS + '/newsreader-latin.woff2')}"
IS = 'fonts/inter-latin.woff2' if WEB else f"data:font/woff2;base64,{b64(FONTS + '/inter-latin.woff2')}"
css.append(f"@font-face{{font-family:'Newsreader';src:url({NS}) format('woff2');font-weight:200 800;font-style:normal;font-display:swap}}")
css.append(f"@font-face{{font-family:'Inter';src:url({IS}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}}")

# Every screenshot is embedded once, as a custom property, and reused by the big view and the thumbnails.
imgs = []
for c in CW:
    for th, _ in TH:
        for dv, _ in DV:
            for sc, _ in SC:
                p = os.path.join(HERE, 'img', f"{c['id']}-{th}-{dv}-{sc}.webp")
                if WEB:
                    imgs.append(f"{var(c['id'], th, dv, sc)}:url(img/{c['id']}-{th}-{dv}-{sc}.webp)")
                else:
                    imgs.append(f"{var(c['id'], th, dv, sc)}:url(data:image/webp;base64,{b64(p)})")
css.append(':root{' + ';'.join(imgs) + '}')

BASE = r"""
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;background:#f5efe1;font-family:'Inter',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;opacity:0}
.page{
  --bg:#f5efe1;--paper:#fffdf8;--line:#e4dac5;--text:#211e18;--muted:#5f5749;--subtle:#7d7362;--onacc:#fffdf8;
  --acc:#22334a;--met:#a8894f;--shadow:0 1px 2px rgba(60,44,20,.08),0 10px 30px -12px rgba(60,44,20,.28);
  min-height:100vh;background:var(--bg);color:var(--text);transition:background-color .25s,color .25s;
  font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;
}
#th-dark:checked~.page{--bg:#111317;--paper:#1a1c21;--line:#2d3038;--text:#ece6d8;--muted:#aaa396;--subtle:#8b8579;--onacc:#111317;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 14px 36px -14px rgba(0,0,0,.7)}
.wrap{max-width:1180px;margin:0 auto;padding:max(14px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 0 max(16px,env(safe-area-inset-left))}

/* ---- top bar: Web | Mobile first, always */
.bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:6px 0 18px}
.seg{display:inline-flex;padding:3px;border-radius:999px;background:var(--paper);border:1px solid var(--line)}
.seg label{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;cursor:pointer;
  font-size:14px;font-weight:500;color:var(--muted);user-select:none;-webkit-tap-highlight-color:transparent;transition:background-color .15s,color .15s}
.seg svg{width:16px;height:16px;flex:none}
.bar .spacer{flex:1}
.brand{display:inline-flex;align-items:center;gap:8px;font:500 19px/1 'Newsreader',Georgia,serif;letter-spacing:-.01em;color:var(--text)}
.brand svg{width:22px;height:22px;color:var(--met)}

header.intro{padding:6px 0 18px;max-width:640px}
.eyebrow{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--met)}
.eyebrow::before{content:'';width:24px;height:1px;background:currentColor}
h1{margin:0;font:420 clamp(34px,6vw,54px)/1.04 'Newsreader',Georgia,serif;letter-spacing:-.02em}
h1 span{color:var(--acc)}
.lede{margin:12px 0 0;color:var(--muted);font-size:16px;max-width:56ch}

/* ---- the five */
.choose{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:4px 0 18px}
.opt{position:relative;display:flex;flex-direction:column;gap:7px;padding:6px 6px 9px;border-radius:16px;border:1px solid var(--line);
  background:var(--paper);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:border-color .15s,box-shadow .15s,transform .15s}
.opt:hover{transform:translateY(-1px)}
.thumb{display:block;width:100%;aspect-ratio:16/10;border-radius:10px;background:var(--line) top center/cover no-repeat;border:1px solid var(--line)}
#dv-mobile:checked~.page .thumb{aspect-ratio:390/560;background-size:100% auto}
@media (min-width:861px){#dv-mobile:checked~.page .thumb{aspect-ratio:390/400}}
.opt .row{display:flex;align-items:center;gap:6px;min-width:0;padding:0 2px}
.opt .num{flex:none;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:650;background:var(--bg);color:var(--muted);border:1px solid var(--line)}
.opt .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:550}
.opt .long{display:none}
.dots{display:inline-flex;margin-left:auto;flex:none}
.dots i{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--paper)}
.dots i+i{margin-left:-4px}

/* ---- screens */
.tabs{display:flex;gap:4px;padding:3px;margin:0 0 16px;border-radius:999px;background:var(--paper);border:1px solid var(--line);width:max-content;max-width:100%}
.tabs label{display:inline-flex;align-items:center;min-height:38px;padding:0 15px;border-radius:999px;font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}

/* ---- stage */
.stage{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start;padding-bottom:28px}
.frame{border-radius:14px;overflow:hidden;background:var(--paper);border:1px solid var(--line);box-shadow:var(--shadow)}
.chrome{display:flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-bottom:1px solid var(--line)}
.chrome i{width:10px;height:10px;border-radius:50%;background:var(--line)}
.chrome span{margin-left:10px;font-size:12px;color:var(--subtle)}
.shot{display:block;width:100%;aspect-ratio:16/10;background:var(--line) top center/cover no-repeat}
#dv-mobile:checked~.page .stage{grid-template-columns:360px 300px;justify-content:center;gap:48px}
#dv-mobile:checked~.page .frame{width:100%;border:10px solid #16171b;border-radius:48px;background:#16171b}
#dv-mobile:checked~#th-dark:checked~.page .frame{border-color:#2c2e34;background:#2c2e34;box-shadow:0 0 0 1px rgba(255,255,255,.06),var(--shadow)}
#dv-mobile:checked~.page .chrome{display:none}
#dv-mobile:checked~.page .shot{aspect-ratio:390/844;border-radius:38px;background-size:100% auto}

.info{position:sticky;top:18px;display:flex;flex-direction:column;gap:14px}
.info .no{margin:0;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--met)}
.info h2{margin:0;font:420 34px/1.08 'Newsreader',Georgia,serif;letter-spacing:-.015em}
.info p.note{margin:0;color:var(--muted)}
.sw{display:flex;gap:10px}
.sw div{flex:1;border-radius:12px;border:1px solid var(--line);background:var(--paper);padding:8px}
.sw b{display:block;height:34px;border-radius:8px;margin-bottom:6px}
.sw small{display:block;font-size:11.5px;color:var(--subtle)}
.pick{display:none;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 22px;border-radius:999px;
  background:var(--acc);color:var(--onacc);font-weight:600;font-size:16px;text-decoration:none;box-shadow:0 1px 0 rgba(255,255,255,.18) inset,0 8px 20px -10px var(--acc)}
.pick svg{width:18px;height:18px}
.pick:focus-visible,.seg label:focus-visible{outline:2px solid var(--met);outline-offset:3px}
.hint{margin:0;font-size:13px;color:var(--subtle)}
.nm-x,.note-x,.cur-x{display:none}

/* sticky pick bar, phones only */
.pickbar{display:none}
footer{padding:8px 0 40px;color:var(--subtle);font-size:13px;border-top:1px solid var(--line)}
footer p{margin:14px 0 0;max-width:70ch}

@media (max-width:860px){
  .stage,#dv-mobile:checked~.page .stage{grid-template-columns:minmax(0,1fr);gap:16px}
  .info{position:static;order:-1;gap:8px}
  .info h2{font-size:28px}
  .info .sw,.info .pick,.info .hint{display:none!important}
  #dv-mobile:checked~.page .frame{margin:0 auto;width:min(320px,100%)}
  .pickbar{display:flex;position:sticky;bottom:0;z-index:5;align-items:center;gap:12px;margin:0 -16px;
    padding:10px max(16px,env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));
    background:color-mix(in srgb,var(--bg) 86%,transparent);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border-top:1px solid var(--line)}
  .pickbar .cur{flex:1;min-width:0;font-size:13px;line-height:1.3;color:var(--muted)}
  .pickbar .cur b{display:block;color:var(--text);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pickbar .pick{min-height:46px;padding:0 18px;font-size:15px;flex:none}
}
@media (max-width:560px){
  .choose{gap:6px}
  .opt{padding:4px 4px 7px;border-radius:12px;gap:5px}
  .thumb{border-radius:8px}
  .opt .nm{display:none}
  .opt .row{justify-content:center}
  .dots{margin-left:0}
  .tabs{width:100%}
  .tabs label{flex:1;justify-content:center;padding:0 6px;font-size:13.5px}
  .seg label{padding:0 13px}
  .brand{display:none}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
"""
css.append(BASE)

rules = []
# selected-state styling for the toggles and tabs
for grp, items in (('dv', DV), ('th', TH), ('sc', SC)):
    for k, _ in items:
        rules.append(f"#{grp}-{k}:checked~.page label[for={grp}-{k}]{{background:var(--acc);color:var(--onacc)}}")
        rules.append(f"#{grp}-{k}:focus-visible~.page label[for={grp}-{k}]{{outline:2px solid var(--met);outline-offset:2px}}")
for c in CW:
    i = c['id']
    # page accent follows the colorway, and its dark values in Dark
    rules.append(f"#cw-{i}:checked~.page{{--acc:{c['acc']};--met:{c['met']}}}")
    rules.append(f"#th-dark:checked~#cw-{i}:checked~.page{{--acc:{c['accD']};--met:{c['metD']}}}")
    rules.append(f"#cw-{i}:checked~.page .opt-{i}{{border-color:var(--acc);box-shadow:0 0 0 1.5px var(--acc),var(--shadow)}}")
    rules.append(f"#cw-{i}:checked~.page .opt-{i} .num{{background:var(--acc);color:var(--onacc);border-color:var(--acc)}}")
    rules.append(f"#cw-{i}:focus-visible~.page .opt-{i}{{outline:2px solid var(--met);outline-offset:3px}}")
    for cls in ('nm', 'note', 'cur'):
        rules.append(f"#cw-{i}:checked~.page .{cls}-{i}{{display:inline}}")
    rules.append(f"#cw-{i}:checked~.page .sw-{i}{{display:flex}}")
    for th, _ in TH:
        rules.append(f"#th-{th}:checked~#cw-{i}:checked~.page .pk-{i}-{th}{{display:inline-flex}}")
    for dv, _ in DV:
        for th, _ in TH:
            for sc, _ in SC:
                v = var(i, th, dv, sc)
                # the big view
                rules.append(f"#dv-{dv}:checked~#th-{th}:checked~#sc-{sc}:checked~#cw-{i}:checked~.page .shot{{background-image:var({v})}}")
                # this colorway's thumbnail for the current device, theme and screen
                rules.append(f"#dv-{dv}:checked~#th-{th}:checked~#sc-{sc}:checked~.page .th-{i}{{background-image:var({v})}}")
for th, label in TH:
    rules.append(f"#th-{th}:checked~.page .md-{th}{{display:inline}}")
rules.append(".sw-x,.md-x{display:none}")
css.append('\n'.join(rules))

def radios():
    out = []
    for grp, items, default in (('dv', DV, 'mobile'), ('th', TH, 'light'), ('sc', SC, 'welcome'),
                                ('cw', [(c['id'], c['name']) for c in CW], 'ink-brass')):
        for k, label in items:
            chk = ' checked' if k == default else ''
            out.append(f'<input class="sr" type="radio" name="{grp}" id="{grp}-{k}" aria-label="{html.escape(label)}"{chk}>')
    return '\n'.join(out)

MARK = '<svg viewBox="84 72 344 352" aria-hidden="true"><g fill="currentColor"><rect x="96" y="120" width="40" height="292"/><rect x="96" y="372" width="252" height="40"/><polygon points="152,350 198,350 404,130 404,84"/><polygon points="376,126 416,84 416,412 376,412"/></g></svg>'
ICON_WEB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
ICON_MOB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>'
ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

def e(s): return html.escape(s)

def mailto(c, th):
    subj = f"Launchpad colors: No. {c['n']}, {c['name']}"
    body = f"I pick No. {c['n']}, {c['name']}.\n\nI looked at it in {th} mode."
    return f"mailto:{TO}?subject={quote(subj)}&body={quote(body)}"

opts = '\n'.join(
    f'''<label for="cw-{c['id']}" class="opt opt-{c['id']}" title="{e(c['name'])}">
  <span class="thumb th-{c['id']}" role="img" aria-label="{e(c['name'])} preview"></span>
  <span class="row"><span class="num">{c['n']}</span><span class="nm">{e(c['short'])}</span><span class="dots" aria-hidden="true"><i style="background:{c['acc']}"></i><i style="background:{c['met']}"></i></span></span>
</label>''' for c in CW)

names = ''.join(f'<span class="nm-x nm-{c["id"]}">{e(c["name"])}</span>' for c in CW)
nos = ''.join(f'<span class="nm-x nm-{c["id"]}">No. {c["n"]} of 5</span>' for c in CW)
notes = ''.join(f'<span class="note-x note-{c["id"]}">{e(c["note"])}</span>' for c in CW)
swatches = ''.join(f'''<div class="sw sw-x sw-{c['id']}"><div><b style="background:{c['acc']}"></b><small>Accent</small></div><div><b style="background:{c['met']}"></b><small>Metal</small></div><div><b style="background:#111317;box-shadow:inset 0 0 0 7px #111317,inset 0 0 0 30px {c['accD']}"></b><small>In dark</small></div></div>''' for c in CW)
picks = ''.join(f'<a class="pick pk-{c["id"]}-{th}" href="{e(mailto(c, th))}">{ICON_MAIL}This is the one</a>' for c in CW for th, _ in TH)
curs = ''.join(f'<span class="cur-x cur-{c["id"]}"><b>No. {c["n"]} · {e(c["name"])}</b></span>' for c in CW)
modes = ''.join(f'<span class="md-x md-{th}">{label} mode</span>' for th, label in TH)

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Launchpad — pick your colors</title>
<meta name="description" content="Five color options for the Launchpad app. Tap the one you like.">
<meta property="og:title" content="Pick your colors for Launchpad">
<meta property="og:description" content="Five looks for the same app. Tap the one you like.">
<meta property="og:image" content="https://launchpad-colors.netlify.app/overview.jpg">
<meta property="og:url" content="https://launchpad-colors.netlify.app/">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<style>
{chr(10).join(css)}
</style>
</head>
<body>
{radios()}
<div class="page">
<div class="wrap">
  <div class="bar">
    <div class="seg" role="group" aria-label="Device">
      <label for="dv-web">{ICON_WEB}Web</label>
      <label for="dv-mobile">{ICON_MOB}Mobile</label>
    </div>
    <div class="seg" role="group" aria-label="Light or dark">
      <label for="th-light">Light</label>
      <label for="th-dark">Dark</label>
    </div>
    <span class="spacer"></span>
    <span class="brand">{MARK}Launchpad</span>
  </div>

  <header class="intro">
    <p class="eyebrow">Launchpad</p>
    <h1>Pick your <span>colors.</span></h1>
    <p class="lede">Five looks for the same app. Tap one to see it up close, and flip between Web and Mobile, Light and Dark. When one feels right, tap <strong>This is the one</strong>.</p>
  </header>

  <div class="choose" role="group" aria-label="The five colorways">
{opts}
  </div>

  <div class="tabs" role="group" aria-label="Screen">
    {''.join(f'<label for="sc-{k}">{e(v)}</label>' for k, v in SC)}
  </div>

  <section class="stage" aria-label="Preview">
    <div class="frame">
      <div class="chrome"><i></i><i></i><i></i><span>launchpad</span></div>
      <div class="shot" role="img" aria-label="The app in the chosen colors"></div>
    </div>
    <aside class="info">
      <p class="no">{nos}</p>
      <h2>{names}</h2>
      <p class="note">{notes}</p>
      {swatches}
      {picks}
      <p class="hint">Opens an email with your pick filled in. Or just reply with the number.</p>
    </aside>
  </section>

  <div class="pickbar">
    <span class="cur">{curs}{modes}</span>
    {picks}
  </div>

  <footer>
    <p>Every picture is the real app, not a drawing. Whichever you choose can be changed later in Settings. Can't tap the button? Reply to the email with the number, 1 to 5.</p>
  </footer>
</div>
</div>
<script>
// Optional: on a laptop, start on Web. Everything else works without scripts.
try {{ if (window.innerWidth >= 900) document.getElementById('dv-web').checked = true; }} catch (e) {{}}
// A link ending in #hunter (or #3) opens straight to that option.
try {{
  var h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
  var ids = ['ink-brass', 'bordeaux', 'hunter', 'graphite', 'verdigris'];
  var id = ids[parseInt(h, 10) - 1] || (ids.indexOf(h) >= 0 ? h : null);
  if (id) document.getElementById('cw-' + id).checked = true;
}} catch (e) {{}}
</script>
</body>
</html>
'''
with open(os.path.join(HERE, 'site/index.html' if WEB else 'Launchpad-colors.html'), 'w') as f:
    f.write(page)
print(len(page) // 1024, 'KB')
