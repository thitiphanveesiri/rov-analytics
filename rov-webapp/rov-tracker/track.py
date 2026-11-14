#!/usr/bin/env python3
"""
track.py — ดึงเส้นทางฮีโร่จากมินิแมพในวิดีโอแมตช์ RoV → tracks.json (เอาไปเปิดในหน้า 🔥 Heatmap ของเว็บ)

ขั้นตอนใช้งาน (ดู README.md ประกอบ)
  1) ตรวจกรอบมินิแมพ + การเดาฮีโร่ที่เฟรมเริ่มต้น:
       python track.py match.mp4 --minimap 15,55,210,250 --seed-time 5 \
         --our Nakroth,Murad,Krixi,Capheny,Alice --enemy Airi,Raz,Tulen,Valhein,Mina --preview-only
     เปิด seed_preview.png ดูว่าไอคอนแต่ละวงถูกติดชื่อถูกไหม ถ้าผิดให้ระบุตำแหน่งเองด้วย --seed-override seed.json
  2) รันจริง (ทั้งเกม):
       python track.py match.mp4 ...(ตัวเลือกเดิม)... --hz 2 --game-start 0 --out tracks.json
"""
import argparse, base64, json, os, sys
import cv2
import numpy as np
import rovtrack as R


def parse_box(s):
    v = [int(x) for x in s.split(",")]
    if len(v) != 4 or v[2] <= v[0] or v[3] <= v[1]:
        raise SystemExit("--minimap ต้องเป็น x0,y0,x1,y1 (พิกเซลในวิดีโอ) และ x1>x0, y1>y0")
    return v


def grab_minimap(frame, box):
    x0, y0, x1, y1 = box
    H, W = frame.shape[:2]
    if x1 > W or y1 > H:
        raise SystemExit(f"กรอบมินิแมพ {box} เกินขนาดวิดีโอ {W}x{H}")
    return cv2.resize(frame[y0:y1, x0:x1], (R.WORK_W, R.WORK_W), interpolation=cv2.INTER_CUBIC)


def read_at(cap, t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
    ok, fr = cap.read()
    if not ok:
        raise SystemExit(f"อ่านเฟรมที่ {t}s ไม่ได้ (เกินความยาววิดีโอ?)")
    return fr


def draw_preview(mm, icons, heroes, assigned, path):
    vis = mm.copy()
    inv = {i: k for k, i in assigned.items()}
    hk = {h.key: h for h in heroes}
    col = {"red": (60, 60, 255), "blue": (255, 200, 0), "green": (0, 230, 0)}
    for i, ic in enumerate(icons):
        c = (int(ic["x"] * R.WORK_W), int(ic["y"] * R.WORK_W))
        cv2.circle(vis, c, int(ic["r"] * R.WORK_W), col[ic["color"]], 2)
        label = hk[inv[i]].name if i in inv else "?"
        cv2.putText(vis, label, (c[0] - 25, c[1] - int(ic["r"] * R.WORK_W) - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1, cv2.LINE_AA)
    cv2.imwrite(path, vis)


def clean_minimap(mm, icons):
    """ลบไอคอนฮีโร่ออกจากภาพมินิแมพ (inpaint) เพื่อใช้เป็นพื้นหลัง Heatmap"""
    mask = np.zeros(mm.shape[:2], np.uint8)
    for ic in icons:
        cv2.circle(mask, (int(ic["x"] * R.WORK_W), int(ic["y"] * R.WORK_W)), int(ic["r"] * R.WORK_W * 1.18), 255, -1)
    out = cv2.inpaint(mm, mask, 5, cv2.INPAINT_TELEA)
    return cv2.resize(out, (480, 480), interpolation=cv2.INTER_AREA)


def to_data_url(img):
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 72])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()


def main():
    ap = argparse.ArgumentParser(description="ดึงเส้นทางฮีโร่จากมินิแมพ RoV")
    ap.add_argument("video")
    ap.add_argument("--minimap", required=True, help="กรอบมินิแมพ x0,y0,x1,y1 (พิกเซลในวิดีโอ)")
    ap.add_argument("--our", required=True, help="ฮีโร่ทีมเรา 5 ตัว (ชื่อตามระบบ คั่นด้วย ,) เรียงตามลำดับ slot ในเว็บ")
    ap.add_argument("--enemy", required=True, help="ฮีโร่ทีมศัตรู 5 ตัว")
    ap.add_argument("--our-players", default="", help="ชื่อผู้เล่นทีมเรา (ไม่บังคับ)")
    ap.add_argument("--enemy-players", default="", help="ชื่อผู้เล่นทีมศัตรู (ไม่บังคับ)")
    ap.add_argument("--our-color", choices=["blue", "red"], default="blue", help="สีวงแหวนทีมเรา (ปกติฟ้า)")
    ap.add_argument("--seed-time", type=float, default=5.0, help="วินาทีในวิดีโอที่ฮีโร่แยกกันเห็นชัด ใช้ผูกไอคอนกับชื่อฮีโร่")
    ap.add_argument("--seed-override", help="ไฟล์ JSON {\"our:0\":[x,y], ...} ระบุตำแหน่ง (0-1) ของฮีโร่ที่เดาผิด")
    ap.add_argument("--game-start", type=float, default=0.0, help="เวลาในเกม (วินาที) ที่ตรงกับวินาทีที่ 0 ของวิดีโอ")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--hz", type=float, default=2.0, help="จำนวนครั้งที่ตรวจต่อวินาที (ค่าเริ่มต้น 2)")
    ap.add_argument("--heroes-dir", default=os.path.join(os.path.dirname(__file__), "..", "rov-webapp", "public", "heroes"))
    ap.add_argument("--map-image", help="ภาพมินิแมพสะอาด (ไม่มีไอคอน) ถ้าไม่ระบุ จะลบไอคอนออกจากเฟรมเริ่มต้นให้")
    ap.add_argument("--out", default="tracks.json")
    ap.add_argument("--preview-only", action="store_true", help="ทำแค่ภาพตรวจการผูกชื่อที่เฟรมเริ่มต้น แล้วหยุด")
    a = ap.parse_args()

    box = parse_box(a.minimap)
    our = [x.strip() for x in a.our.split(",") if x.strip()]
    enemy = [x.strip() for x in a.enemy.split(",") if x.strip()]
    if len(our) != 5 or len(enemy) != 5:
        raise SystemExit("ต้องระบุฮีโร่ฝั่งละ 5 ตัว")
    op = [x.strip() for x in a.our_players.split(",")] if a.our_players else [""] * 5
    ep = [x.strip() for x in a.enemy_players.split(",")] if a.enemy_players else [""] * 5

    tpl = R.load_templates(a.heroes_dir, our + enemy)
    heroes = [R.Hero(f"our:{i}", "our", n, tpl[n]) for i, n in enumerate(our)] + \
             [R.Hero(f"enemy:{i}", "enemy", n, tpl[n]) for i, n in enumerate(enemy)]
    meta = {h.key: {"key": h.key, "side": h.side, "hero": h.name,
                    "player": (op if h.side == "our" else ep)[int(h.key.split(":")[1])]} for h in heroes}

    cap = cv2.VideoCapture(a.video)
    if not cap.isOpened():
        raise SystemExit("เปิดวิดีโอไม่ได้")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    dur = cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps if cap.get(cv2.CAP_PROP_FRAME_COUNT) else 0
    end = min(a.end, dur) if a.end else dur

    # ── เฟรมเริ่มต้น: ผูกไอคอนกับชื่อฮีโร่ ──
    seed_fr = read_at(cap, a.seed_time)
    mm0 = grab_minimap(seed_fr, box)
    icons0 = R.detect_icons(mm0)
    override = json.load(open(a.seed_override, encoding="utf-8")) if a.seed_override else None
    assigned = R.seed_assign(icons0, heroes, a.our_color, override)
    base = os.path.splitext(a.out)[0]
    draw_preview(mm0, icons0, heroes, assigned, base + "_seed_preview.png")
    print(f"เฟรมเริ่มต้นที่ {a.seed_time}s: เจอไอคอน {len(icons0)} วง ผูกชื่อได้ {len(assigned)}/10 → ดู {base}_seed_preview.png")
    if a.preview_only:
        return
    if len(assigned) < 3:
        raise SystemExit("ผูกชื่อได้น้อยเกินไป — ลองเลือก --seed-time ที่ฮีโร่แยกกัน หรือตรวจกรอบ --minimap")
    for key, i in assigned.items():
        h = next(x for x in heroes if x.key == key)
        h.learn(icons0[i]["feat"], 1.0)
        h.last = (a.seed_time, icons0[i]["x"], icons0[i]["y"])

    # ── วนทั้งคลิป ──
    step = max(1, int(round(fps / a.hz)))
    first = int(a.start * fps)
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    n_samples = int((end - a.start) * a.hz) + 1
    raw = {h.key: [None] * n_samples for h in heroes}
    fi, si = first, 0
    bg_frames, bg_every = [], max(1, n_samples // 60)
    while si < n_samples:
        ok, fr = cap.read()
        if not ok:
            break
        if (fi - first) % step == 0:
            t = fi / fps
            mm_now = grab_minimap(fr, box)
            if si % bg_every == 0 and len(bg_frames) < 60:
                bg_frames.append(mm_now)
            icons = R.detect_icons(mm_now)
            res = R.assign_frame(icons, heroes, t, a.our_color)
            for key, (x, y, conf, s, feat) in res.items():
                raw[key][si] = [float(x), float(y), float(conf)]
                h = next(z for z in heroes if z.key == key)
                h.last = (t, x, y)
                h.learn(feat, s)
            si += 1
            if si % 120 == 0:
                print(f"  {t:7.1f}s / {end:.0f}s", flush=True)
        fi += 1
    cap.release()

    tracks, coverage = {}, {}
    for h in heroes:
        filled = R.fill_gaps(raw[h.key], a.hz)
        seen = sum(1 for s in raw[h.key] if s is not None)
        coverage[h.key] = round(seen / max(si, 1), 3)
        pts = []
        for k, s in enumerate(filled):
            if s is not None:
                pts.append([round(a.game_start + a.start + k / a.hz, 2), round(s[0], 4), round(s[1], 4), round(s[2], 2)])
        tracks[h.key] = pts

    if a.map_image:
        bg = cv2.resize(cv2.imread(a.map_image), (480, 480), interpolation=cv2.INTER_AREA)
    elif len(bg_frames) >= 8:
        # median ข้ามหลายเฟรม: ฮีโร่เคลื่อนที่จึงหายไป เหลือแต่พื้นแผนที่/ป้อม (สะอาดกว่า inpaint)
        bg = cv2.resize(np.median(np.stack(bg_frames), axis=0).astype(np.uint8), (480, 480), interpolation=cv2.INTER_AREA)
    else:
        bg = clean_minimap(mm0, icons0)
    out = {
        "version": 1,
        "source": {"video": os.path.basename(a.video), "hz": a.hz, "gameStart": a.game_start, "samples": si},
        "minimap": to_data_url(bg),
        "heroes": [meta[h.key] for h in heroes],
        "tracks": tracks,
        "coverage": coverage,
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"บันทึก {a.out}  ({os.path.getsize(a.out)/1024:.0f} KB)")
    print("ความครอบคลุม (สัดส่วนช่วงเวลาที่เห็นไอคอนจริง ไม่รวมที่เติมช่องว่าง):")
    for h in heroes:
        print(f"  {h.key:8s} {h.name:12s} {coverage[h.key]*100:5.1f}%")


if __name__ == "__main__":
    main()
