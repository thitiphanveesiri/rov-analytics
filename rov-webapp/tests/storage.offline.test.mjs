import "fake-indexeddb/auto";
import assert from "node:assert/strict";

// ---- fake server ----
let server, calls, online;
function resetServer(){ server={updatedAt:"2026-01-01T00:00:00.000Z", teamId:"T1", matches:[{id:1}], rivals:[], roster:["a"]}; calls=[]; online=true; }
const bump=()=>{ server.updatedAt=new Date(Date.parse(server.updatedAt)+1000).toISOString(); };
Object.defineProperty(globalThis,"navigator",{value:{ get onLine(){return online;} },configurable:true});
globalThis.fetch=async(url,opt={})=>{
  if(!online) throw new TypeError("Failed to fetch");
  calls.push((opt.method||"GET"));
  const j=(b,status=200)=>({ok:status<400,status,json:async()=>b});
  if(!opt.method||opt.method==="GET") return j({...server});
  const body=JSON.parse(opt.body);
  if(body.expectedUpdatedAt!==server.updatedAt) return j({error:"CONFLICT",currentUpdatedAt:server.updatedAt},409);
  for(const k of Object.keys(body)) if(k!=="expectedUpdatedAt") server[k]=body[k];
  bump(); return j({ok:true,updatedAt:server.updatedAt});
};
const S=await import("../lib/storage.js");

resetServer();
let st=await S.loadFromStorage();
assert.equal(st._loaded,true); assert.deepEqual(st.matches,[{id:1}]);

// 1) dirty check: unchanged state -> no PUT
calls=[]; await S.saveToStorage(st);
assert.deepEqual(calls,[],"no PUT when nothing changed");

// 2) real change -> PUT
st={...st,matches:[{id:2},{id:1}]}; await S.saveToStorage(st);
assert.deepEqual(calls,["PUT"]); assert.equal(S.hasUnsyncedChanges(),false);

// 3) offline edit -> isOffline, unsynced, no fetch
online=false; calls=[];
st={...st,matches:[{id:3},...st.matches]};
await assert.rejects(()=>S.saveToStorage(st),e=>e.isOffline===true);
assert.equal(S.hasUnsyncedChanges(),true); assert.deepEqual(calls,[]);

// 4) reload offline (new session) -> from snapshot incl. offline edit
let off=await S.loadFromStorage();
assert.equal(off.offline,true); assert.deepEqual(off.matches.map(m=>m.id),[3,2,1]);

// 5) back online, someone else edited meanwhile -> recovered state, PUT 409 -> merge
online=true; server.rivals=[{id:9,name:"X"}]; bump();
let rec=await S.loadFromStorage();
assert.equal(rec.recoveredOffline,true); assert.deepEqual(rec.matches.map(m=>m.id),[3,2,1]);
let merged=false;
try{ await S.saveToStorage(rec); }catch(e){ merged=!!e.wasMerged; assert.ok(e.sentFieldJson); }
assert.equal(merged,true,"3-way merge path");
assert.deepEqual(server.matches.map(m=>m.id),[3,2,1],"offline edit reached server");
assert.deepEqual(server.rivals,[{id:9,name:"X"}],"other user's edit preserved");
assert.equal(S.hasUnsyncedChanges(),false);

// 6) clearOfflineData wipes snapshot -> offline load has no snapshot
await S.clearOfflineData(); online=false;
const none=await S.loadFromStorage();
assert.equal(none.offlineNoSnapshot,true);
console.log("storage tests ok");
