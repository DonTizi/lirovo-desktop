import {describe,it,expect} from "vitest";
import {openMemoryDatabase} from "./store/db.js";
import {reviewValue} from "./store/review.js";
import {compareKnowledge,searchKnowledge} from "./knowledge.js";

const fixture = () => {
  const db = openMemoryDatabase();
  for (const [n,text] of [[1,"Modèle local"],[2,"Local model"]] as const) {
    db.prepare("INSERT INTO sources(id,kind,uri,title,duration_s,has_audio,has_video,created_at) VALUES (?,?,?,?,?,?,?,?)").run(`s${n}`,"file",`/test/${n}.mp4`,`Research ${n}`,10,1,1,0);
    db.prepare("INSERT INTO runs(id,source_id,status,created_at) VALUES (?,?,?,?)").run(`r${n}`,`s${n}`,"succeeded",0);
    db.prepare("INSERT INTO extracted_values(observation_id,run_id,field_path,value_json,created_at) VALUES (?,?,?,?,?)").run(`v${n}`,`r${n}`,"topic",JSON.stringify(text),0);
  }
  return db;
};
describe("knowledge retrieval",()=>{
  it("finds full multilingual values across runs and retains provenance",()=>{
    const db=fixture();try{
      expect(searchKnowledge(db,{query:"local"}).hits.map(h=>h.text)).toEqual(["Modèle local","Local model"]);
      expect(searchKnowledge(db,{query:"modele"}).hits[0]?.sourceUri).toBe("/test/1.mp4");
    }finally{db.close();}
  });
  it("handles empty, punctuation and SQL-like queries as text",()=>{
    const db=fixture();try{
      expect(searchKnowledge(db,{query:" ' ; -- "}).hits).toEqual([]);
      expect(searchKnowledge(db,{query:"xyzmissing"}).total).toBe(0);
      expect(db.pragma("integrity_check",{simple:true})).toBe("ok");
    }finally{db.close();}
  });
  it("reads current corrections, excludes rejected values and supports approved-only",()=>{
    const db=fixture();try{
      reviewValue(db,{runId:"r1",observationId:"v1",expectedRevision:0,action:"correct",value:"Hardware memory"});
      expect(searchKnowledge(db,{query:"modele"}).total).toBe(0);
      expect(searchKnowledge(db,{query:"memory"}).hits[0]?.corrected).toBe(true);
      expect(searchKnowledge(db,{query:"memory",approvedOnly:true}).total).toBe(0);
      reviewValue(db,{runId:"r1",observationId:"v1",expectedRevision:1,action:"approve"});
      expect(searchKnowledge(db,{query:"memory",approvedOnly:true}).total).toBe(1);
      reviewValue(db,{runId:"r2",observationId:"v2",expectedRevision:0,action:"reject"});
      expect(searchKnowledge(db,{query:"local"}).total).toBe(0);
    }finally{db.close();}
  });
  it("compares only selected sources without inferring agreement",()=>{
    const db=fixture();try{
      expect(searchKnowledge(db,{query:"local",runIds:["r2"]}).hits.map(h=>h.runId)).toEqual(["r2"]);
      const result=compareKnowledge(db,["r1","r2"]);
      expect(result.fields[0]?.entries).toHaveLength(2);
      expect(result.runs).toHaveLength(2);
      expect(result.note).toContain("not independent evidence");
      expect(()=>compareKnowledge(db,["r1","r1"])).toThrow("at least two");
    }finally{db.close();}
  });
  it("applies reviewed-only to comparisons while keeping legacy calls unchanged",()=>{
    const db=fixture();try{
      const ids=(approvedOnly?:boolean)=>compareKnowledge(db,["r1","r2"],approvedOnly).fields.flatMap(field=>field.entries).map(hit=>hit.observationId);
      expect(ids(true)).toEqual([]);
      reviewValue(db,{runId:"r1",observationId:"v1",expectedRevision:0,action:"approve"});
      expect(ids(true)).toEqual(["v1"]);
      expect(ids()).toEqual(["v1","v2"]);
      expect(ids(false)).toEqual(["v1","v2"]);
      reviewValue(db,{runId:"r1",observationId:"v1",expectedRevision:1,action:"correct",value:"Edited topic"});
      expect(ids(true)).toEqual([]);
      expect(ids(false)).toEqual(["v1","v2"]);
      reviewValue(db,{runId:"r2",observationId:"v2",expectedRevision:0,action:"reject"});
      expect(ids(false)).toEqual(["v1"]);
    }finally{db.close();}
  });
  it("reads corpus values in a constant number of SQL statements",()=>{
    const db=fixture();try{
      const insert=db.prepare("INSERT INTO extracted_values(observation_id,run_id,field_path,value_json,created_at) VALUES (?,'r1',?,'\"local result\"',0)");
      db.transaction(()=>{for(let i=0;i<1500;i++)insert.run(`bulk${i}`,`claims[${i}]`);}).immediate();
      let statements=0;
      const counted={...db,prepare:((...args:Parameters<typeof db.prepare>)=>{statements++;return db.prepare(...args);}) as typeof db.prepare};
      const result=searchKnowledge(counted,{query:"local"});
      expect(result.total).toBe(1502);expect(result.hits).toHaveLength(100);
      expect(statements).toBe(2);
    }finally{db.close();}
  });
  it("excludes archived runs even when explicitly selected",()=>{
    const db=fixture();try{
      db.prepare("INSERT INTO run_archives(run_id,archived_at) VALUES (?,?)").run("r1",1);
      expect(searchKnowledge(db,{query:"local"}).hits.map(hit=>hit.runId)).toEqual(["r2"]);
      expect(searchKnowledge(db,{query:"local",runIds:["r1"]}).hits).toEqual([]);
      expect(compareKnowledge(db,["r1","r2"]).runs.map(run=>run.runId)).toEqual(["r2"]);
    }finally{db.close();}
  });
});
