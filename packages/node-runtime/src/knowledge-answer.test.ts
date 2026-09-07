import {afterEach,describe,expect,it,vi} from "vitest";
import type {CompletionResult,InferenceBackend} from "@lirovo/contracts";
import {openMemoryDatabase,type Db} from "./store/db.js";
import {reviewValue} from "./store/review.js";
import {askKnowledge,type AskKnowledgeRequest} from "./knowledge-answer.js";

const databases:Db[]=[];
const fixture=()=>{
  const db=openMemoryDatabase();databases.push(db);
  db.exec(`INSERT INTO sources VALUES ('s','file','scratch',NULL,'Local benchmarks',20,1,1,1);
    INSERT INTO runs(id,source_id,status,created_at) VALUES ('r','s','succeeded',1);
    INSERT INTO extracted_values(observation_id,run_id,field_path,value_json,created_at) VALUES ('v','r','claim','"Local model costs less"',1);
    INSERT INTO evidence VALUES ('e','r','audio','transcript:1',10,12,'Local model costs less',NULL);
    INSERT INTO value_evidence VALUES ('v','e','value');`);
  return db;
};
const request:AskKnowledgeRequest={question:"What does the local model cost?",query:"local model",backendId:"stub",requestId:"test",consent:true};
const valid={insufficientEvidence:false,claims:[{text:"The source says the local model costs less.",citationIds:["E1"]}]};
const backend=(json:unknown=valid):InferenceBackend=>({
  id:"stub",setup:null,capabilities:{images:"none",nativeJsonSchema:true,spawnsProcessPerCall:false},
  detect:async()=>({available:true,version:"stub"}),
  complete:vi.fn(async():Promise<CompletionResult>=>({text:JSON.stringify(json),json,model:"stub",backendVersion:"stub",elapsedMs:1,truncated:false})),
});
const signal=()=>new AbortController().signal;
afterEach(()=>{for(const db of databases)db.close();databases.length=0;});
describe("cited knowledge synthesis",()=>{
  it("sends complete retrieved context and resolves citations to exact source moments",async()=>{
    const db=fixture();const model=backend();
    const longValue="Local model evidence ".repeat(1000)+"final evidence sentinel";
    db.prepare("UPDATE extracted_values SET value_json=? WHERE observation_id='v'").run(JSON.stringify(longValue));
    const answer=await askKnowledge(db,request,{backend:model,signal:signal()});
    expect(answer.status).toBe("answered");expect(answer.citations[0]?.hit.evidence[0]?.tStart).toBe(10);
    const call=vi.mocked(model.complete).mock.calls[0]?.[0];
    expect(call?.messages[1]?.content).toContain(longValue);
    expect(call?.messages[0]?.content).toContain("untrusted data");
    expect(answer.limitations.join(" ")).toContain("does not prove");
  });
  it("does not call a provider on no hits, rejected values or missing source moments",async()=>{
    const db=fixture();const model=backend();
    const missing=await askKnowledge(db,{...request,query:"neverfound"},{backend:model,signal:signal()});
    expect(missing).toMatchObject({status:"insufficient-evidence",model:null,claims:[]});
    db.exec("DELETE FROM value_evidence");
    expect((await askKnowledge(db,request,{backend:model,signal:signal()})).status).toBe("insufficient-evidence");
    reviewValue(db,{runId:"r",observationId:"v",expectedRevision:0,action:"reject"});
    expect((await askKnowledge(db,request,{backend:model,signal:signal()})).matchedCount).toBe(0);
    expect(model.complete).not.toHaveBeenCalled();
  });
  it.each([
    {insufficientEvidence:false,claims:[{text:"Claim",citationIds:["E999"]}]},
    {insufficientEvidence:false,claims:[{text:"Claim",citationIds:[]}]},
    {insufficientEvidence:false,claims:[{text:" ",citationIds:["E1"]}]},
    {insufficientEvidence:true,claims:valid.claims},
    {insufficientEvidence:false,claims:[]},
  ])("rejects invalid or inconsistent citations without a repair call",async(output)=>{
    const model=backend(output);
    await expect(askKnowledge(fixture(),request,{backend:model,signal:signal()})).rejects.toMatchObject({code:"SCHEMA_VALIDATION_FAILED"});
    expect(model.complete).toHaveBeenCalledOnce();
  });
  it("requires explicit consent and the same selected provider",async()=>{
    const db=fixture();const model=backend();
    await expect(askKnowledge(db,{...request,consent:false},{backend:model,signal:signal()})).rejects.toThrow("Confirm");
    await expect(askKnowledge(db,{...request,backendId:"other"},{backend:model,signal:signal()})).rejects.toThrow("provider changed");
    expect(model.complete).not.toHaveBeenCalled();
  });
  it("does not accept cancelled or incomplete output",async()=>{
    const db=fixture();const controller=new AbortController();controller.abort();const model=backend();
    await expect(askKnowledge(db,request,{backend:model,signal:controller.signal})).rejects.toMatchObject({code:"CANCELLED"});
    expect(model.complete).not.toHaveBeenCalled();
    model.complete=vi.fn(async()=>({text:"partial",model:"stub",backendVersion:"stub",elapsedMs:1,truncated:true}));
    await expect(askKnowledge(db,request,{backend:model,signal:signal()})).rejects.toMatchObject({code:"INFERENCE_TRUNCATED"});
  });
  it("supports an honest insufficient-evidence response despite lexical matches",async()=>{
    const answer=await askKnowledge(fixture(),request,{backend:backend({insufficientEvidence:true,claims:[]}),signal:signal()});
    expect(answer).toMatchObject({status:"insufficient-evidence",claims:[],matchedCount:1,model:"stub"});
  });
});
