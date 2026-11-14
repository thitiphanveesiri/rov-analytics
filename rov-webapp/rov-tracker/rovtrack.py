"""
rovtrack.py — ดึงตำแหน่งฮีโร่จากมินิแมพในวิดีโอแมตช์ RoV (ฟังก์ชันหลัก, ไม่มี CLI)

แนวคิด
  1) ครอบเฉพาะมินิแมพ แล้วหาไอคอนฮีโร่ทั้งหมดด้วยวงแหวนสี (แดง=ศัตรู ฟ้า=ฝั่งน้ำเงิน เขียว=ตัวที่กล้องโฟกัส)
  2) แต่ละไอคอน เทียบหน้าฮีโร่กับรูปใน public/heroes — เทียบเฉพาะฮีโร่ 10 ตัวที่เล่นจริง (จากดราฟต์)
  3) จับคู่ไอคอน↔ฮีโร่แบบ Hungarian ต่อเฟรม + ใช้ตำแหน่งก่อนหน้าช่วยตัดสินตอนไอคอนทับกัน
  4) ได้เส้นทาง [t, x, y, conf] ต่อฮีโร่ (x,y เป็น 0-1 ภายในมินิแมพ) ช่วงที่หายสั้นๆ เติมด้วยการประมาณ
"""
import glob, os, re
import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment

WORK_W = 600                       # ความกว้างมินิแมพหลังขยาย (ใช้ค่าเดียวกันทุกวิดีโอ)
R_MIN, R_MAX = 0.040, 0.070        # รัศมีไอคอนเป็นสัดส่วนของความกว้างมินิแมพ
TPL = 32                           # ขนาดแพตช์เทียบหน้า (px)


def norm_name(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


# ───────────── แม่แบบหน้าฮีโร่ ─────────────
def _circle_mask(n, frac=0.80):
    m = np.zeros((n, n), np.uint8)
    cv2.circle(m, (n // 2, n // 2), int(n / 2 * frac), 255, -1)
    return m.astype(bool)

_MASK = _circle_mask(TPL)


def _feat(bgr32):
    """เวกเตอร์ฟีเจอร์ของแพตช์ 32x32: Lab ในวงกลม, เอาค่าเฉลี่ยออกแล้ว normalize"""
    lab = cv2.cvtColor(bgr32, cv2.COLOR_BGR2LAB).astype(np.float32)
    v = lab[_MASK]                                 # (N,3)
    v = v - v.mean(axis=0, keepdims=True)
    v = v.reshape(-1)
    n = np.linalg.norm(v)
    return v / n if n > 1e-6 else v


def load_templates(heroes_dir, names):
    """names: รายชื่อฮีโร่ (ตามชื่อในระบบ) → {name: feature}"""
    files = {}
    for p in glob.glob(os.path.join(heroes_dir, "*")):
        if p.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            files.setdefault(norm_name(os.path.splitext(os.path.basename(p))[0]), p)
    out = {}
    for name in names:
        p = files.get(norm_name(name))
        if not p:
            raise SystemExit(f"ไม่พบรูปฮีโร่ '{name}' ใน {heroes_dir}")
        im = cv2.imread(p)
        h, w = im.shape[:2]
        s = min(h, w)                              # ครอบกลางเป็นจัตุรัส
        im = im[(h - s) // 2:(h - s) // 2 + s, (w - s) // 2:(w - s) // 2 + s]
        # รูปโปรไฟล์ขอบนอกมักเป็นกรอบ/พื้นหลัง → ตัดขอบ 12% ให้ใกล้ไอคอนบนมินิแมพ
        c = int(s * 0.12)
        im = im[c:s - c, c:s - c]
        out[name] = _feat(cv2.resize(im, (TPL, TPL), interpolation=cv2.INTER_AREA))
    return out


# ───────────── หาไอคอนในเฟรมมินิแมพ ─────────────
def _ring_masks(hsv):
    """มาสก์พิกเซลสีวงแหวนแต่ละสี — ฟ้าต้องอิ่มตัว/สว่างกว่า เพราะพื้นแผนที่ (แม่น้ำ/ลาน) เป็นสีเขียวอมฟ้าจางๆ"""
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    return {
        "red":   (s > 120) & (v > 85) & ((h < 10) | (h > 165)),
        "blue":  (s > 100) & (v > 150) & (h >= 88) & (h <= 110),
        "green": (s > 100) & (v > 100) & (h >= 40) & (h <= 75),
    }


def _ringness(mask, cx, cy, r):
    """สัดส่วนรอบวงที่เป็นสีวงแหวน (ที่ r*0.9-0.97) และความ 'กลวง' ของวง (ข้างในไม่ใช่สีเดียวกันทึบ)"""
    H, W = mask.shape
    hit = tot = 0
    for a in np.linspace(0, 2 * np.pi, 48, endpoint=False):
        for k in (0.90, 0.97):
            x = int(round(cx + r * k * np.cos(a)))
            y = int(round(cy + r * k * np.sin(a)))
            if 0 <= x < W and 0 <= y < H:
                tot += 1
                hit += bool(mask[y, x])
    ring = hit / max(tot, 1)
    inner = 0.0
    yy, xx = np.ogrid[:H, :W]
    d = (xx - cx) ** 2 + (yy - cy) ** 2 <= (r * 0.55) ** 2
    if d.any():
        inner = float(mask[d].mean())
    return ring, inner


def _textured(bgr, cx, cy, r, min_std=22.0):
    """ภายในไอคอนฮีโร่มีลายภาพคน (ค่าเบี่ยงเบนมาตรฐานของความสว่างสูง) — พื้นแผนที่/ป้อมเรียบกว่า"""
    H, W = bgr.shape[:2]
    x0, x1 = max(int(cx - r * 0.6), 0), min(int(cx + r * 0.6), W)
    y0, y1 = max(int(cy - r * 0.6), 0), min(int(cy + r * 0.6), H)
    if x1 - x0 < 6 or y1 - y0 < 6:
        return False
    g = cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    return float(g.std()) >= min_std


def detect_icons(mm_bgr):
    """
    mm_bgr: มินิแมพที่ขยายเป็น WORK_W x WORK_W → [{x,y,r,color,ring,feat}] (x,y,r เป็น 0-1)
    หาวงกลมบนมาสก์สีวงแหวนแต่ละสีแยกกัน (ทนต่อไอคอนที่ซ้อนกันกว่าหาจากภาพเทา) แล้วกรองสิ่งที่ไม่ใช่วงแหวน (เช่น ป้อม)
    """
    H, W = mm_bgr.shape[:2]
    hsv = cv2.cvtColor(mm_bgr, cv2.COLOR_BGR2HSV)
    masks = _ring_masks(hsv)
    found = []
    for color, m in masks.items():
        mk = cv2.morphologyEx(m.astype(np.uint8) * 255, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
        mk = cv2.GaussianBlur(mk, (5, 5), 0)
        circles = cv2.HoughCircles(mk, cv2.HOUGH_GRADIENT, dp=1.2, minDist=int(W * 0.03),
                                   param1=80, param2=14,
                                   minRadius=int(W * R_MIN), maxRadius=int(W * R_MAX))
        if circles is None:
            continue
        for cx, cy, r in circles[0]:
            ring, inner = _ringness(m, cx, cy, r)
            if ring >= 0.28 and inner < 0.30 and _textured(mm_bgr, cx, cy, r):
                found.append([cx, cy, r, color, ring])
    # ตัดวงซ้ำ (หลายสี/หลายรัศมีบนไอคอนเดียวกัน) เก็บอันที่วงแหวนชัดสุด ; ไอคอนที่ทับกันบางส่วนยังแยกได้ถ้าห่าง > ~0.7 เท่ารัศมี
    found.sort(key=lambda d: -d[4])
    keep = []
    for d in found:
        if all(np.hypot(d[0] - k[0], d[1] - k[1]) > 0.7 * min(d[2], k[2]) for k in keep):
            keep.append(d)
    out = []
    for cx, cy, r, col, ring in keep:
        ri = int(r * 0.80)
        x0, y0 = int(cx) - ri, int(cy) - ri
        if x0 < 0 or y0 < 0 or x0 + 2 * ri > W or y0 + 2 * ri > H or ri < 4:
            feat = None                   # ไอคอนติดขอบ — ตำแหน่งใช้ได้ แต่เทียบหน้าไม่ได้
        else:
            patch = mm_bgr[y0:y0 + 2 * ri, x0:x0 + 2 * ri]
            feat = _feat(cv2.resize(patch, (TPL, TPL), interpolation=cv2.INTER_AREA))
        out.append({"x": cx / W, "y": cy / H, "r": r / W, "color": col, "ring": float(ring), "feat": feat})
    return out


def score(feat, tpl):
    if feat is None:
        return 0.0
    return float(np.dot(feat, tpl))


# ───────────── ตัวติดตามฮีโร่ ─────────────
class Hero:
    """หนึ่งฮีโร่ที่ติดตาม — มีรูปโปรไฟล์ (ใช้เดาตอนเริ่ม) + ลายไอคอนจริงบนมินิแมพที่เรียนรู้ระหว่างทาง"""
    def __init__(self, key, side, name, portrait_feat):
        self.key, self.side, self.name = key, side, name
        self.port = portrait_feat
        self.app = []                 # ลายไอคอนจริง (สูงสุด 4)
        self.last = None              # (t, x, y)

    def sim(self, feat):
        if feat is None:
            return 0.0
        if self.app:
            return max(float(np.dot(feat, f)) for f in self.app)
        return 0.6 * float(np.dot(feat, self.port))   # ยังไม่เคยเห็นไอคอนจริง → ใช้รูปโปรไฟล์แบบถ่วงน้ำหนักต่ำ

    def learn(self, feat, s):
        if feat is None:
            return
        if not self.app:
            self.app.append(feat)
        elif s > 0.6 and len(self.app) < 4 and max(float(np.dot(feat, f)) for f in self.app) < 0.9:
            self.app.append(feat)


def _color_ok(icon_color, side, our_color):
    if icon_color == "green":
        return True                               # ตัวที่กล้องโฟกัส เป็นได้ทั้งสองทีม
    want = our_color if side == "our" else ("red" if our_color == "blue" else "blue")
    return icon_color == want


def assign_frame(icons, heroes, t, our_color="blue", max_speed=0.20, gate_s=3.0, min_sim=0.30):
    """
    จับคู่ไอคอน↔ฮีโร่ด้วย Hungarian ; ต้นทุน = (1 - ความเหมือน) + โทษระยะห่างจากตำแหน่งล่าสุด
    คืน {key: (x, y, conf, sim)}
    """
    if not icons or not heroes:
        return {}
    BIG = 9.0
    cost = np.full((len(icons), len(heroes)), BIG, np.float32)
    sims = np.zeros_like(cost)
    for i, ic in enumerate(icons):
        for j, h in enumerate(heroes):
            if not _color_ok(ic["color"], h.side, our_color):
                continue
            s = h.sim(ic["feat"])
            sims[i, j] = s
            c = 1.0 - s
            if h.last and t - h.last[0] <= gate_s:
                d = float(np.hypot(ic["x"] - h.last[1], ic["y"] - h.last[2]))
                allowed = max_speed * max(t - h.last[0], 0.5)
                c += 0.6 * min(d / allowed, 2.0)
            cost[i, j] = c
    ri, cj = linear_sum_assignment(cost)
    out = {}
    for i, j in zip(ri, cj):
        if cost[i, j] >= BIG:
            continue
        ic, h, s = icons[i], heroes[j], float(sims[i, j])
        if ic["feat"] is None:
            conf = 0.25                           # ติดขอบแผนที่ → ไม่มีลายให้เทียบ ยอมรับแบบมั่นใจต่ำ
            if not (h.last and t - h.last[0] <= gate_s):
                continue                          # และต้องมีตำแหน่งก่อนหน้าใกล้ๆ รองรับเท่านั้น
        elif not h.app:
            conf = 0.3                            # ฮีโร่ที่ยังไม่เคยเห็นไอคอนจริง: รับไอคอนสีทีมที่ยังว่างแบบมั่นใจต่ำ แล้วเริ่มเรียนรู้ลายจากตรงนี้
        else:
            if s < min_sim:
                continue
            conf = max(0.0, min(1.0, s))
        out[h.key] = (ic["x"], ic["y"], conf, s, ic["feat"])
    return out


def seed_assign(icons, heroes, our_color="blue", override=None):
    """
    เฟรมเริ่มต้น: เดาด้วยรูปโปรไฟล์ (จำกัดแค่ฮีโร่ 10 ตัว) หรือใช้ override {key: (x,y)} ที่ผู้ใช้ระบุ
    คืน {key: icon_index}
    """
    assigned = {}
    used = set()
    for key, (ox, oy) in (override or {}).items():
        if not icons:
            break
        k = int(np.argmin([np.hypot(ic["x"] - ox, ic["y"] - oy) for ic in icons]))
        assigned[key] = k
        used.add(k)
    rest = [h for h in heroes if h.key not in assigned]
    idx = [i for i in range(len(icons)) if i not in used]
    if rest and idx:
        cost = np.full((len(idx), len(rest)), 9.0, np.float32)
        for a, i in enumerate(idx):
            for b, h in enumerate(rest):
                if _color_ok(icons[i]["color"], h.side, our_color) and icons[i]["feat"] is not None:
                    cost[a, b] = 1.0 - float(np.dot(icons[i]["feat"], h.port))
        ri, cj = linear_sum_assignment(cost)
        for a, b in zip(ri, cj):
            if cost[a, b] < 9.0:
                assigned[rest[b].key] = idx[a]
    return assigned


def fill_gaps(samples, hz, max_gap_s=3.0):
    """samples: list ยาวเท่ากับจำนวนช่วงเวลา ของ [x,y,conf] หรือ None → เติมช่องว่างสั้นๆ ด้วยเส้นตรง conf=0.2"""
    n = len(samples)
    out = [list(s) if s else None for s in samples]
    max_gap = max(1, int(max_gap_s * hz))
    i = 0
    while i < n:
        if out[i] is None:
            j = i
            while j < n and out[j] is None:
                j += 1
            if i > 0 and j < n and (j - i) <= max_gap:
                a, b = out[i - 1], out[j]
                for k in range(i, j):
                    w = (k - (i - 1)) / (j - (i - 1))
                    out[k] = [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, 0.2]
            i = j
        else:
            i += 1
    return out
