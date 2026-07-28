// collect-hero-images.js
// รันด้วย: node collect-hero-images.js
// ต้องมี Node.js อยู่แล้ว (ตัวเดียวกับที่ใช้รันโปรเจกต์ Next.js) ไม่ต้อง install อะไรเพิ่ม
//
// สิ่งที่ทำ: เดินเข้าไปดูทุกโฟลเดอร์ย่อยใน SOURCE_DIR (แต่ละโฟลเดอร์ = ชื่อฮีโร่)
// เทียบชื่อโฟลเดอร์กับรายชื่อฮีโร่จริง แล้วคัดลอกไฟล์รูปแรกที่เจอในนั้น
// ไปไว้ที่ DEST_DIR โดยตั้งชื่อใหม่เป็น <slug>.<นามสกุลเดิม>
// (ไม่แปลงไฟล์ ไม่ย่อรูป แค่คัดลอก+เปลี่ยนชื่อ)

const fs = require("fs");
const path = require("path");

// ── แก้ 2 บรรทัดนี้ให้ตรงกับเครื่องคุณ ──
const SOURCE_DIR = String.raw`C:\Users\admin\Downloads\001_Icon Art`; // โฟลเดอร์แม่ที่มีโฟลเดอร์ย่อยชื่อฮีโร่
const DEST_DIR   = String.raw`.\public\heroes`;                        // โฟลเดอร์ปลายทางในโปรเจกต์เว็บ

// ── รายชื่อฮีโร่ + slug (ก็อปมาจาก lib/heroes.js ตรงๆ) ──
const HERO_DATA = [
  {name:"Airi",img:"airi"},{name:"Aleister",img:"aleister"},{name:"Alice",img:"alice"},
  {name:"Allain",img:"allain"},{name:"Amily",img:"amily"},{name:"Annette",img:"annette"},
  {name:"Arum",img:"arum"},{name:"Arthur",img:"arthur"},{name:"Astrid",img:"astrid"},
  {name:"Azzen'Ka",img:"azzenka"},{name:"Baldum",img:"baldum"},{name:"Bijan",img:"bijan"},
  {name:"Butterfly",img:"butterfly"},{name:"Capheny",img:"capheny"},{name:"Celica",img:"celica"},
  {name:"Charlotte",img:"charlotte"},{name:"Chaugnar",img:"chaugnar"},{name:"D'Arcy",img:"darcy"},
  {name:"Diao Chan",img:"diaochan"},{name:"Dirak",img:"dirak"},{name:"Edras",img:"edras"},
  {name:"Eland'orr",img:"elandorr"},{name:"Elsu",img:"elsu"},{name:"Enzo",img:"enzo"},
  {name:"Fennik",img:"fennik"},{name:"Florentino",img:"florentino"},{name:"Gildur",img:"gildur"},
  {name:"Grakk",img:"grakk"},{name:"Hayate",img:"hayate"},{name:"Helen",img:"helen"},
  {name:"Ignis",img:"ignis"},{name:"Ilumia",img:"ilumia"},{name:"Ishar",img:"ishar"},
  {name:"Jinnar",img:"jinnar"},{name:"Kahlii",img:"kahlii"},{name:"Kaine",img:"kaine"},
  {name:"Keera",img:"keera"},{name:"Kil'Groth",img:"kilgroth"},{name:"Kriknak",img:"kriknak"},
  {name:"Krixi",img:"krixi"},{name:"Krizzix",img:"krizzix"},{name:"Lauriel",img:"lauriel"},
  {name:"Laville",img:"laville"},{name:"Lindis",img:"lindis"},{name:"Lorion",img:"lorion"},
  {name:"Lu Bu",img:"lubu"},{name:"Lumburr",img:"lumburr"},{name:"Maloch",img:"maloch"},
  {name:"Marja",img:"marja"},{name:"Max",img:"max"},{name:"Mganga",img:"mganga"},
  {name:"Mina",img:"mina"},{name:"Ming",img:"ming"},{name:"Moren",img:"moren"},
  {name:"Murad",img:"murad"},{name:"Nakroth",img:"nakroth"},{name:"Natalya",img:"natalya"},
  {name:"Omen",img:"omen"},{name:"Ormarr",img:"ormarr"},{name:"Paine",img:"paine"},
  {name:"Preyta",img:"preyta"},{name:"Qi",img:"qi"},{name:"Quillen",img:"quillen"},
  {name:"Raz",img:"raz"},{name:"Riktor",img:"riktor"},{name:"Rouie",img:"rouie"},
  {name:"Rourke",img:"rourke"},{name:"Roxie",img:"roxie"},{name:"Ryoma",img:"ryoma"},
  {name:"Sephera",img:"sephera"},{name:"Sinestrea",img:"sinestrea"},{name:"Skud",img:"skud"},
  {name:"Slimz",img:"slimz"},{name:"Stuart",img:"stuart"},{name:"Taara",img:"taara"},
  {name:"Tachi",img:"tachi"},{name:"Teeri",img:"teeri"},{name:"Tel'Annas",img:"telannas"},
  {name:"Thane",img:"thane"},{name:"Thorne",img:"thorne"},{name:"Toro",img:"toro"},
  {name:"Tulen",img:"tulen"},{name:"Valhein",img:"valhein"},{name:"Veera",img:"veera"},
  {name:"Veres",img:"veres"},{name:"Violet",img:"violet"},{name:"Volkath",img:"volkath"},
  {name:"Wisp",img:"wisp"},{name:"Wukong",img:"wukong"},{name:"Xeniel",img:"xeniel"},
  {name:"Y'bneth",img:"ybneth"},{name:"Yan",img:"yan"},{name:"Yena",img:"yena"},
  {name:"Yorn",img:"yorn"},{name:"Yue",img:"yue"},{name:"Zanis",img:"zanis"},
  {name:"Zata",img:"zata"},{name:"Zephys",img:"zephys"},{name:"Zill",img:"zill"},
  {name:"Zip",img:"zip"},{name:"Zuka",img:"zuka"},{name:"Aoi",img:"aoi"},
  {name:"Arduin",img:"arduin"},
  {name:"Ata",img:"ata"},
  {name:"Aya",img:"aya"},
  {name:"Bonnie",img:"bonnie"},
  {name:"Bright",img:"bright"},
  {name:"Cresht",img:"cresht"},
  {name:"Dextra",img:"dextra"},
  {name:"Erin",img:"erin"},
  {name:"Errol",img:"errol"},
  {name:"Iggy",img:"iggy"},
  {name:"Jinna",img:"jinna"},
  {name:"Liliana",img:"liliana"},
  {name:"Lu Bu",img:"lubu"},
  {name:"Wukong",img:"wukong"},
  {name:"Omega",img:"omega"},
  {name:"Richter",img:"richter"},
  {name:"Superman",img:"superman"},
  {name:"TeeMee",img:"teemee"},
  {name:"The Flash",img:"theflash"},
  {name:"Zanis",img:"zanis"},
  {name:"Wiro",img:"wiro"},
  {name:"Wonder Woman",img:"wonderwoman"},
  {name:"Diao Chan",img:"diaochan"},
  {name:"Dolia",img:"dolia"},
  {name:"Dyadia",img:"dyadia"},
  {name:"Billow",img:"billow"},
  {name:"Heino",img:"heino"},
  {name:"Goverra",img:"goverra"},
  {name:"Biron",img:"biron"},
  {name:"BoltBiron",img:"boltbiron"},
  {name:"Flowborn(Carry)",img:"flowborn_carry"},
  {name:"Flowborn(Mage)",img:"flowborn_mage"},
  {name:"Tamyn",img:"tamyn"}
];

// ── ทำชื่อให้เทียบกันง่าย: ตัวเล็กหมด, ตัด apostrophe/ช่องว่าง/เครื่องหมายพิเศษออก ──
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const heroBySlug = {}; // normalized(name) -> {name, img}
for (const h of HERO_DATA) heroBySlug[normalize(h.name)] = h;

const IMG_EXT = [".png", ".jpg", ".jpeg", ".webp"];

function findFirstImage(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile() && IMG_EXT.includes(path.extname(e.name).toLowerCase())) {
      return e.name;
    }
  }
  return null;
}

function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`ไม่เจอโฟลเดอร์ต้นทาง: ${SOURCE_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });

  const folders = fs.readdirSync(SOURCE_DIR, { withFileTypes: true }).filter(e => e.isDirectory());

  const matched = [];
  const unmatched = [];
  const noImage = [];

  for (const folder of folders) {
    const hero = heroBySlug[normalize(folder.name)];
    if (!hero) { unmatched.push(folder.name); continue; }

    const folderPath = path.join(SOURCE_DIR, folder.name);
    const imgFile = findFirstImage(folderPath);
    if (!imgFile) { noImage.push(folder.name); continue; }

    const ext = path.extname(imgFile);
    const destPath = path.join(DEST_DIR, `${hero.img}${ext}`);
    fs.copyFileSync(path.join(folderPath, imgFile), destPath);
    matched.push(`${folder.name} → ${hero.img}${ext}`);
  }

  console.log(`\n✅ คัดลอกสำเร็จ ${matched.length} ไฟล์:`);
  matched.forEach(m => console.log("   " + m));

  if (noImage.length) {
    console.log(`\n⚠️  โฟลเดอร์ที่จับคู่ฮีโร่ได้ แต่ไม่เจอไฟล์รูปข้างใน (${noImage.length}):`);
    noImage.forEach(n => console.log("   " + n));
  }

  if (unmatched.length) {
    console.log(`\n❓ โฟลเดอร์ที่จับคู่ชื่อฮีโร่ไม่ได้ (${unmatched.length}) — เช็คชื่อสะกดหรือเพิ่มเองทีหลัง:`);
    unmatched.forEach(u => console.log("   " + u));
  }
}

main();
