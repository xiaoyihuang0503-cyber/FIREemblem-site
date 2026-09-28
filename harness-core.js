/** Shared, read-only retrieval layer for browsers, scripts and Harness tools. */
import {createTranslator} from './localization.mjs';
const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase();
const classKey = value => normalize(value).replace(/[^a-z0-9]/g, '').replace('caldarius', 'caladrius');
const rowId = values => values.map(v => encodeURIComponent(String(v ?? ''))).join('~');
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const bounded = (value, fallback, min, max) => { if (value == null || value === '') return fallback; const n = Number(value); if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`Value must be an integer from ${min} to ${max}`); return n; };
const searchable = value => {
  if (Array.isArray(value)) return value.map(searchable).join(' ');
  if (value && typeof value === 'object') return Object.entries(value).filter(([k]) => !/url|source|publisher|audit|copyright|identity_evidence/.test(k)).map(([,v]) => searchable(v)).join(' ');
  return String(value ?? '');
};

export const TOOL_DEFINITIONS = freeze([
  {name:'list_datasets', description:'List available datasets, counts and coverage limits.', parameters:{type:'object',properties:{},additionalProperties:false}},
  {name:'search_records', description:'Search game facts with pagination. Route filters apply to chapter, paralogue and recruitment records; character filters use a canonical ID or game name.', parameters:{type:'object',properties:{collection:{type:'string'},q:{type:'string'},route:{type:'string'},character:{type:'string'},limit:{type:'integer',minimum:1,maximum:100},offset:{type:'integer',minimum:0}},additionalProperties:false}},
  {name:'get_record', description:'Retrieve a record by collection and stable ID with provenance.', parameters:{type:'object',required:['collection','id'],properties:{collection:{type:'string'},id:{type:'string'}},additionalProperties:false}},
  {name:'class_context', description:'Retrieve a class dossier, qualification/item relations and independent skill effect variants with conflicts and missing source values.', parameters:{type:'object',required:['class'],properties:{class:{type:'string'}},additionalProperties:false}},
  {name:'character_context', description:'Retrieve a character dossier, growth variants, skills, recruitment, supports, spells, gifts and build presets. Preserve conflicting facts and missing fields.', parameters:{type:'object',required:['character'],properties:{character:{type:'string'}},additionalProperties:false}},
]);

export class KnowledgeStore {
  constructor(database, manifest = null) {
    if (database?.schema_version !== 1 || !Array.isArray(database.characters) || !database.adventure) throw new TypeError('Unsupported or incomplete database snapshot');
    this.database = freeze(clone(database));
    this.manifest = manifest ? freeze(clone(manifest)) : null;
    this.collections = new Map();
    const d = this.database, o = d.overseas;
    this.translate = createTranslator(d.translations?.terms);
    const add = (key, label, rows, identify, title, summary = () => '', status = 'partial') => {
      const records = rows.map((record,i) => freeze({id:String(identify(record,i)),collection:key,title:this.translate(title(record)),summary:this.translate(summary(record)),record}));
      if (new Set(records.map(r => r.id)).size !== records.length) throw new Error(`Duplicate record IDs in ${key}`);
      this.collections.set(key, {label,status,records,byId:new Map(records.map(r => [r.id,r])),text:new Map(records.map(r => [r.id,normalize(searchable(r.record)+' '+this.translate(searchable(r.record)))]))});
    };
    add('characters','人物',d.characters,r=>r.id,r=>r.name_zh,r=>r.name_en);
    const localNames = new Set(d.characters.map(r=>r.name_en));
    add('supplemental_characters','补充人物',o.characters.filter(r=>!localNames.has(r.name_en)),r=>r.name_en,r=>r.name_en,r=>r.personal_ability,'community_snapshot');
    add('character_profiles','人物档案',d.source_profiles,r=>String(r.page),r=>r.name_zh,r=>r.personal_ability_zh);
    add('character_growth_variants','成长变体',Object.values(d.alternate_growth),r=>r.id,r=>r.name_zh,r=>r.name_en);
    add('character_growth_reference','人物成长对照',o.characters,r=>r.name_en,r=>r.name_en,r=>r.personal_ability,'community_snapshot');
    add('classes','职业',d.classes,r=>r.id,r=>r.name_en,r=>r.unlock);
    add('class_growth_reference','职业成长对照',o.classes,r=>r.name_en,r=>r.name_en,r=>r.mastery_skill || r.mastery,'community_snapshot');
    add('supports','支援',o.supports,r=>rowId([r.name,r.partner,r.rank]),r=>`${r.name} · ${r.partner}`,r=>r.rank,'community_snapshot');
    add('spells','法术',o.spells,r=>rowId([r.name,r.skill_level,r.magic,r.spell]),r=>r.spell,r=>`${r.name} · ${r.skill_level}`,'community_snapshot');
    add('gifts','礼物',o.gifts,r=>rowId([r.name,r.gift]),r=>r.gift,r=>r.name,'community_snapshot');
    add('skill_preferences','技能偏好',o.skill_preferences,r=>rowId([r.name,r.kind,r.skill]),r=>r.skill,r=>`${r.name} · ${r.kind}`,'community_snapshot');
    add('blaze_arts','炎之战技',o.blaze_arts,r=>rowId([r.name,r.art,r.learned]),r=>r.art,r=>r.name,'index_only');
    add('bloodmarks','血印',o.bloodmarks,r=>rowId([r.name,r.mark]),r=>r.mark,r=>r.name,'index_only');
    add('build_presets','培养示例',d.build_presets,r=>r.id,r=>r.name_zh,r=>r.why,'examples_only');
    add('references','机制条目',d.reference_entries,r=>r.id,r=>r.title,r=>r.summary);
    add('character_notes','人物设定',d.official_character_notes,r=>r.character_id,r=>d.characters.find(c=>c.id===r.character_id)?.name_zh || r.character_id,r=>r.summary);
    add('portraits','头像',Object.entries(d.portraits).map(([id,r])=>({id,...r})),r=>r.id,r=>d.characters.find(c=>c.id===r.id)?.name_zh || r.id,r=>`${r.width} × ${r.height}`,'local_roster_covered');
    add('maps','区域地图',d.adventure.regions,r=>r.id,r=>r.title,r=>r.subtitle,'three_regions');
    add('map_nodes','地图地点',d.adventure.regions.flatMap(m=>m.nodes.map(n=>({...n,region_id:m.id,region_title:m.title}))),r=>rowId([r.region_id,r.id]),r=>r.label || `路点 ${r.id}`,r=>r.region_title,'three_regions');
    add('map_edges','地图连接',d.adventure.regions.flatMap(m=>m.edges.map((e,i)=>({...e,region_id:m.id,edge_index:i}))),r=>rowId([r.region_id,r.a,r.b,r.kind]),r=>`${r.a} → ${r.b}`,r=>r.region_id,'three_regions');
    add('chapters','章节',d.adventure.chapters,r=>r.id,r=>r.title,r=>`${d.adventure.routes[r.route]} · ${r.number}`,'part3_incomplete');
    add('battles','战斗目标',d.adventure.chapters.flatMap(c=>c.battles.map((b,i)=>({...b,chapter_id:c.id,route:c.route,battle_index:i}))),r=>rowId([r.chapter_id,r.battle_index]),r=>r.name,r=>r.location,'objectives_only');
    add('paralogues','外传',d.adventure.paralogues,r=>r.id,r=>r.title,r=>r.character,'nine_records');
    add('paralogue_windows','外传接受期',d.adventure.paralogues.flatMap(p=>p.availability.map(a=>({...a,paralogue_id:p.id,title:p.title,character:p.character}))),r=>rowId([r.paralogue_id,r.route]),r=>r.title,r=>`${d.adventure.routes[r.route]} · ${r.window}`,'nine_records');
    add('sources','来源记录',Object.entries(d.sources).map(([id,r])=>({id,...r})),r=>r.id,r=>r.title,r=>r.status,'audit_only');
    const guides=d.guide_facts??{};
    const extra=(key,label,source,title,summary)=>{const rows=guides[source]??[];if(rows.length)add(key,label,rows,r=>r.id,title,summary,'reference_partial');};
    extra('character_reference_profiles','人物资料补充','character_profiles',r=>r.name_zh||r.name_en,r=>r.personal_ability_name||'');
    extra('recruitment_conditions','路线招募条件','recruitment_conditions',r=>`${r.name_zh||r.character} · ${d.adventure.routes[r.route]}`,r=>r.availability==='not_recruitable'?'该路线不可招募':r.chapter==null?'章节待补':`第 ${r.chapter} 章`);
    extra('level_abilities','等级习得技能','level_abilities',r=>r.ability,r=>`${d.characters.find(c=>c.id===r.character_id)?.name_zh||r.character} · Lv.${r.level}`);
    extra('spell_unlocks','法术习得补充','spell_unlocks',r=>r.spell,r=>`${d.characters.find(c=>c.id===r.character_id)?.name_zh||r.character} · ${r.skill_level}`);
    extra('class_requirements','职业资格补充','class_requirements',r=>r.name_en,r=>r.ideal_level==null?'推荐等级未列出':`推荐等级 ${r.ideal_level}`);
    extra('certification_requirements','职业考试门槛','certification_requirements',r=>`${r.tier_name} · Certification`,r=>r.exam_level==null?'等级未列出':`等级 ${r.exam_level}`);
    extra('class_profiles','职业数值档案','class_profiles',r=>r.name_en,r=>r.movement==null?'移动力待补':`移动 ${r.movement}`);
    extra('class_abilities','职业技能效果','class_abilities',r=>r.ability,r=>`${r.name_en} · ${r.effect_zh||'效果待补'}`);
    for(const [key,label] of [['certification_items','转职道具'],['diadem_key_locations','冠冕之钥位置'],['divine_chambers','神殿房间'],['class_change_rules','转职规则']])extra(key,label,key,r=>r.title_zh,r=>r.summary_zh);
    for(const [key,label] of [['weapon_profiles','武器与法术数值'],['weapon_type_rules','武器类别规则'],['ability_catalog','职业技能目录'],['item_profiles','战斗道具'],['proficiency_abilities','熟练度技能'],['mount_abilities','坐骑技能'],['personal_ability_catalog','个人技能效果'],['level_ability_catalog','等级技能效果'],['bloodmark_ability_catalog','血印技能效果'],['material_profiles','矿石、食材与鱼类'],['other_item_profiles','探索与交付道具'],['item_usage_rules','道具使用规则']])extra(key,label,key,r=>r.title_zh,r=>r.summary_zh);
    if(d.source_inventory?.pages?.length)add('ingestion_pages','入库进度',d.source_inventory.pages,r=>r.id,r=>r.label,r=>r.status,'audit_only');
    for(const [key,label] of [['gift_profiles','礼物档案'],['gift_preferences','人物送礼偏好']])extra(key,label,key,r=>r.title_zh,r=>r.summary_zh);
  }
  catalog() {
    return {schema_version:1,snapshot_id:this.manifest?.snapshot_id ?? null,updated_at:this.database.updated_at,collections:[...this.collections].map(([id,c])=>({id,label:c.label,count:c.records.length,coverage:c.status})),limitations:this.manifest?.limitations ?? [],tools:TOOL_DEFINITIONS};
  }
  collection(key) { const c=this.collections.get(key); if(!c) throw new RangeError(`Unknown collection: ${key}`); return c; }
  resolveCharacter(value) {
    const n=normalize(value);
    return this.database.characters.find(c=>[c.id,c.name_en,c.name_zh,this.translate(c.name_en),this.translate(c.name_zh)].some(x=>normalize(x)===n)) ?? this.database.overseas.characters.find(c=>[c.name_en,this.translate(c.name_en)].some(x=>normalize(x)===n)) ?? null;
  }
  search({collection='characters',q='',route='',character='',limit=20,offset=0}={}) {
    const c=this.collection(collection),take=bounded(limit,20,1,100),skip=bounded(offset,0,0,1000000),needle=normalize(q);
    const resolved=character?this.resolveCharacter(character):null;
    if(character&&!resolved) throw new RangeError(`Unknown character: ${character}`);
    if(route&&!Object.hasOwn(this.database.adventure.routes,route)) throw new RangeError(`Unknown route: ${route}`);
    const hasCharacter = r => {
      const en=resolved?.name_en,zh=resolved?.name_zh;
      if(Array.isArray(r.character_relations)&&r.character_relations.some(h=>h.character_identity_status!=='unresolved'&&(resolved?.id?h.character_id===resolved.id:h.supplemental_character_name===en)))return true;
      if(Array.isArray(r.holders)&&r.holders.some(h=>h.character_identity_status!=='unresolved'&&(resolved?.id?h.character_id===resolved.id:h.supplemental_character_name===en)))return true;
      return [r.name,r.name_en,r.name_zh,r.character,r.partner].some(v=>v&&(v===en||v===zh)) || !!resolved?.id&&(r.id===resolved.id||r.character_id===resolved.id);
    };
    const hasRoute = r => {
      if(r.route)return r.route===route;
      if(Array.isArray(r.effect_facts?.routes))return r.effect_facts.routes.includes(route);
      if(r.availability)return r.availability.some(a=>a.route===route);
      const p=r.recruitment && Array.isArray(r.recruitment)?r:this.database.source_profiles.find(p=>p.name_zh===r.name_zh);
      const zh=this.database.adventure.routes[route];
      return p?.recruitment?.some(a=>a.route?.replace('蕾妲','蕾达')===zh) ?? false;
    };
    const rows=c.records.filter(r=>(!needle||c.text.get(r.id).includes(needle))&&(!character||hasCharacter(r.record))&&(!route||hasRoute(r.record)));
    if(needle){const rank=r=>{const fields=[r.id,r.title,r.record.name_en,r.record.name_zh,r.record.label].filter(Boolean).map(normalize);return fields.includes(needle)?0:fields.some(v=>v.startsWith(needle))?1:fields.some(v=>v.includes(needle))?2:3;};rows.sort((a,b)=>rank(a)-rank(b));}
    return {collection,snapshot_id:this.manifest?.snapshot_id ?? null,total:rows.length,offset:skip,limit:take,has_more:skip+take<rows.length,records:rows.slice(skip,skip+take)};
  }
  get(collection,id) {
    const record=this.collection(collection).byId.get(String(id));
    if(!record)return null;
    return {...record,snapshot_id:this.manifest?.snapshot_id ?? null,provenance:this.provenance(collection,record.record),...(collection==='weapon_profiles'?{source_variants:this.weaponVariants(record.record.name_en)}:{}),...(collection==='material_profiles'?{source_variants:this.materialVariants(record.record.name_en)}:{}),...(['gift_profiles','gift_preferences'].includes(collection)?{preference_variants:this.giftVariants({gift:record.record.gift_name_en||record.record.name_en,character:collection==='gift_preferences'?record.record.character:null})}:{})};
  }
  provenance(collection,r) {
    const d=this.database;
    if(r.source_id&&r.content_sha256)return {dataset:'guide_facts',source_id:r.source_id,source_url:r.source_url,source_updated_text:r.source_updated_text,retrieved_at:r.retrieved_at,content_sha256:r.content_sha256,verification:r.verification};
    if(['supplemental_characters','character_growth_reference','class_growth_reference','supports','spells','gifts','skill_preferences','blaze_arts','bloodmarks'].includes(collection))return {dataset:'overseas_database',review_status:d.overseas.review_status,source_url:r.source_url ?? d.overseas.source_url,source_commit:d.overseas.source_commit};
    if(['maps','map_nodes','map_edges'].includes(collection)){const m=collection==='maps'?r:d.adventure.regions.find(m=>m.id===r.region_id);return {dataset:'adventure',method:d.adventure.audit.map_method,source_url:m?.source_url,title_status:d.adventure.audit.title_status};}
    if(['chapters','battles','paralogues','paralogue_windows'].includes(collection))return {dataset:'adventure',source_url:r.source_url ?? d.adventure.chapters.find(c=>c.id===r.chapter_id)?.source_url ?? d.adventure.paralogues.find(p=>p.id===r.paralogue_id)?.source_url,source_commit:d.adventure.audit.structured_revision,title_status:d.adventure.audit.title_status};
    return {dataset:collection,source_url:r.source_url ?? r.url ?? d.sources[r.source]?.url ?? null,status:r.source_status ?? r.status ?? 'reference_snapshot'};
  }
  characterContext(character) {
    const c=this.resolveCharacter(character);if(!c)return null;
    const d=this.database,o=d.overseas,en=c.name_en,local=!!c.id;
    const profile=d.source_profiles.find(p=>p.name_zh===c.name_zh),foreign=o.characters.find(p=>p.name_en===en);
    const variants=[];
    if(local)variants.push({variant:'base',growth:c.growth,provenance:this.provenance('characters',c)});
    if(profile)variants.push({variant:'profile',growth:profile.growth,provenance:this.provenance('character_profiles',profile)});
    if(foreign)variants.push({variant:'reference',growth:foreign.growth,provenance:this.provenance('character_growth_reference',foreign)});
    const guide=d.guide_facts??{},guideProfile=guide.character_profiles?.find(p=>p.character_id===c.id);
    if(guideProfile?.growth)variants.push({variant:'reference_update',growth:guideProfile.growth,provenance:this.provenance('character_reference_profiles',guideProfile)});
    if(c.id==='mu')for(const alt of Object.values(d.alternate_growth))variants.push({variant:'skill_effective',growth:alt.growth,provenance:this.provenance('character_growth_variants',alt)});
    const comparable=variants.filter(v=>v.variant!=='skill_effective');
    const conflicts=[...new Set(comparable.flatMap(v=>Object.keys(v.growth||{})))].filter(stat=>new Set(comparable.map(v=>v.growth?.[stat]).filter(v=>v!=null)).size>1);
    const growthDifferences=conflicts.map(stat=>({stat,values:[...new Set(comparable.map(v=>v.growth?.[stat]).filter(v=>v!=null))].sort((a,b)=>a-b),records:comparable.filter(v=>v.growth?.[stat]!=null).map(v=>({variant:v.variant,value:v.growth[stat]}))}));
    const skillEffective=variants.find(v=>v.variant==='skill_effective');
    const growthScopeNote=c.id==='mu'&&profile?.growth&&skillEffective?.growth&&JSON.stringify(profile.growth)===JSON.stringify(skillEffective.growth)?'earlier_profile_matches_skill_effective_values_scope_unverified':null;
    const select=key=>o[key].filter(r=>r.name===en || key==='supports'&&r.partner===en);
    const dedicatedSkills=(guide.proficiency_abilities??[]).filter(r=>r.character_id===c.id);
    const personal=(guide.personal_ability_catalog??[]).filter(r=>local?r.character_id===c.id:r.character_identity_status==='supplemental'&&r.supplemental_character_name===en);
    const levels=(guide.level_abilities??[]).filter(r=>local&&r.character_id===c.id);
    const levelCatalog=(guide.level_ability_catalog??[]).filter(r=>local?r.character_id===c.id:r.character_identity_status==='supplemental'&&r.supplemental_character_name===en);
    const bloodmarkCatalog=(guide.bloodmark_ability_catalog??[]).filter(r=>r.holders.some(h=>local?h.character_id===c.id:h.character_identity_status==='supplemental'&&h.supplemental_character_name===en));
    const characterItemRelations=(guide.other_item_profiles??[]).filter(r=>r.character_relations.some(h=>local?h.character_id===c.id:h.character_identity_status==='supplemental'&&h.supplemental_character_name===en));
    const itemUsageRules=(guide.item_usage_rules??[]).filter(r=>r.character_relations.some(h=>local?h.character_id===c.id:h.character_identity_status==='supplemental'&&h.supplemental_character_name===en));
    const giftPreferences=(guide.gift_preferences??[]).filter(r=>local?r.character_id===c.id:r.character_identity_status==='supplemental'&&r.supplemental_character_name===en);
    const giftVariants=this.giftVariants({character:en});
    const giftCoverage=(d.source_inventory?.pages??[]).filter(p=>['en_621535','en_623690'].includes(p.id)).map(p=>({source_id:p.id,status:p.status,character_listed_without_gifts:p.characters_without_listed_gifts?.includes(en)??false,absence_means:'not_listed_not_disliked'}));
    const itemVariants=[...new Set(characterItemRelations.map(r=>r.name_en))].map(name=>{const assertions=characterItemRelations.filter(r=>r.name_en===name);return {name_en:name,assertions,effect_comparison_status:assertions.some(r=>!r.effect_facts)?'missing_in_some_sources':new Set(assertions.map(r=>JSON.stringify(r.effect_facts))).size>1?'conflicting':assertions.length>1?'same':'single_source'};});
    const bloodmarkVariants=bloodmarkCatalog.map(r=>({ability:r.ability,structured_assertion:r,index_assertions:o.bloodmarks.filter(v=>(v.name===en||v.holders?.split(',').map(s=>s.trim()).includes(en))&&v.mark===r.ability),effect_comparison_status:'prior_index_has_no_structured_effect',provenance:this.provenance('bloodmark_ability_catalog',r)}));
    const levelVariants=[...new Set([...levels,...levelCatalog].map(r=>r.ability))].map(ability=>{
      const assertions=[...levels.filter(r=>r.ability===ability).map(r=>({collection:'level_abilities',...r,required_level:r.level,effect_facts:null,effect_status:r.effect?'prior_description_not_structured':'not_listed',provenance:this.provenance('level_abilities',r)})),...levelCatalog.filter(r=>r.ability===ability).map(r=>({collection:'level_ability_catalog',...r,provenance:this.provenance('level_ability_catalog',r)}))];
      const known=assertions.map(r=>r.required_level).filter(n=>n!=null);
      const levelStatus=new Set(known).size>1?'conflicting':assertions.some(r=>r.required_level==null)?'missing_in_some_sources':assertions.length>1?'same':'single_source';
      return {ability,assertions,level_comparison_status:levelStatus,effect_comparison_status:assertions.some(r=>!r.effect_facts)?'not_compared_structurally':'single_structured_source'};
    });
    const personalVariants=[];
    if(c.personal_ability?.description)personalVariants.push({variant:'base',ability:c.personal_ability.name,effect_zh:this.translate(c.personal_ability.description),effect_facts:null,comparison_status:'prior_description_not_structured',provenance:this.provenance('characters',c)});
    if(profile?.personal_ability_zh)personalVariants.push({variant:'profile',ability:guideProfile?.personal_ability_name??null,effect_zh:profile.personal_ability_zh,effect_facts:null,comparison_status:'prior_description_not_structured',provenance:this.provenance('character_profiles',profile)});
    for(const r of personal)personalVariants.push({variant:'directory',...r,provenance:this.provenance('personal_ability_catalog',r)});
    return {schema_version:1,snapshot_id:this.manifest?.snapshot_id ?? null,character:c,gift_preferences:giftPreferences,gift_preference_variants:giftVariants,gift_preference_coverage:giftCoverage,gift_support_points_used_in_build_calculation:false,roster_status:local?'canonical':'supplemental',other_item_profiles:characterItemRelations,other_item_variants:itemVariants,item_usage_rules:itemUsageRules,other_item_stats_used_in_build_calculation:false,portrait:local?d.portraits[c.id]??null:null,profile:profile??null,reference_profile:foreign??null,reference_update:guideProfile??null,bloodmark_ability_catalog:bloodmarkCatalog,bloodmark_ability_variants:bloodmarkVariants,bloodmark_abilities_used_in_build_calculation:false,level_ability_catalog:levelCatalog,level_ability_variants:levelVariants,level_abilities_used_in_build_calculation:false,personal_ability_catalog:personal,personal_ability_variants:personalVariants,personal_ability_comparison_status:personal.length&&personalVariants.some(v=>v.comparison_status)?'not_compared_structurally':'single_structured_source_or_missing',personal_abilities_used_in_build_calculation:false,proficiency_abilities:dedicatedSkills,route_recruitment:(guide.recruitment_conditions??[]).filter(r=>r.character_id===c.id),level_abilities:levels,spell_unlocks:(guide.spell_unlocks??[]).filter(r=>r.character_id===c.id),growth_variants:variants,growth_conflicts:conflicts,growth_differences:growthDifferences,growth_scope_note:growthScopeNote,growth_review_status:conflicts.length?'conflicting_unverified':'available_records_consistent_not_game_verified',recruitment:profile?.recruitment?.length?profile.recruitment:c.recruitment??null,recruitment_variants:{base:c.recruitment??null,profile:profile?.recruitment??[]},supports:select('supports'),spells:select('spells'),gifts:select('gifts'),skill_preferences:select('skill_preferences'),blaze_arts:select('blaze_arts'),bloodmarks:o.bloodmarks.filter(r=>r.name===en||r.holders?.split(',').map(s=>s.trim()).includes(en)),character_notes:d.official_character_notes.filter(r=>r.character_id===c.id),build_presets:d.build_presets.filter(p=>p.character===en),coverage:{has_portrait:local&&!!d.portraits[c.id],has_recruitment_profile:!!profile?.recruitment?.length,empty_relations_mean:'not_recorded_not_confirmed_absent',source_status:o.review_status}};
  }
  giftVariants({gift=null,character=null}={}) {
    const rows=(this.database.guide_facts.gift_preferences??[]).filter(r=>(!gift||r.gift_name_en===gift)&&(!character||r.character===character));
    const pairs=new Map();
    for(const row of rows){const k=rowId([row.character,row.gift_name_en]);if(!pairs.has(k))pairs.set(k,[]);pairs.get(k).push(row);}
    return [...pairs.values()].map(assertions=>{
      const r=assertions[0],levels=[...new Set(assertions.map(a=>a.preference_level))].sort(),sources=[...new Set(assertions.map(a=>a.source_id))];
      return {gift_name_en:r.gift_name_en,gift_name_zh:r.gift_name_zh,gift_profile_id:r.gift_profile_id,character:r.character,character_id:r.character_id,supplemental_character_name:r.supplemental_character_name,assertions,levels,preference_comparison_status:levels.length>1?'conflicting':sources.length>1?'same':'single_source',support_points:null,source_count:sources.length};
    });
  }
  weaponVariants(name) {
    const assertions=(this.database.guide_facts.weapon_profiles??[]).filter(r=>r.name_en===name);
    const fields=['might','durability','range_min','range_max','weight','hit','crit','avoid','curse','price_gold','required_skill_rank'];
    const conflicts=fields.filter(k=>new Set(assertions.filter(r=>r[k]!=null).map(r=>JSON.stringify(r[k]))).size>1);
    const missing=fields.filter(k=>assertions.some(r=>r[k]==null));
    return {name_en:name,assertions,conflicting_fields:conflicts,missing_in_some_sources:missing,comparison_status:conflicts.length?'conflicting':missing.length?'missing_in_some_sources':assertions.length>1?'same':'single_source',used_in_build_calculation:false};
  }
  materialVariants(name) {
    const assertions=(this.database.guide_facts.material_profiles??[]).filter(r=>r.name_en===name);
    const known=assertions.filter(r=>r.effect_facts);
    const status=new Set(known.map(r=>JSON.stringify(r.effect_facts))).size>1?'conflicting':assertions.some(r=>!r.effect_facts)?'missing_in_some_sources':assertions.length>1?'same':'single_source';
    return {name_en:name,assertions,effect_comparison_status:status,identity_review_status:assertions.some(r=>r.possible_alias_names.length)?'possible_alias_unresolved':'source_name_retained'};
  }
  classContext(id) {
    const c=this.database.classes.find(c=>c.id===id || classKey(c.name_en)===classKey(id));if(!c)return null;
    const reference=this.database.overseas.classes.find(r=>classKey(r.name_en)===classKey(c.name_en));
    const requirements=(this.database.guide_facts?.class_requirements??[]).filter(r=>r.class_id===c.id);
    const fields=['license_type','ideal_level','renown_level','unlock_condition','license_item','skill_requirement_groups','mastery_ability_names','class_ability_names'];
    const conflicts=fields.filter(field=>new Set(requirements.map(r=>JSON.stringify(r[field]))).size>1);
    const profiles=(this.database.guide_facts?.class_profiles??[]).filter(r=>r.class_id===c.id);
    const abilities=(this.database.guide_facts?.class_abilities??[]).filter(r=>r.class_id===c.id);
    const growthConflicts=Object.keys(reference?.growth_bonus??{}).filter(stat=>profiles.some(p=>p.growth_bonus[stat]!=null&&reference.growth_bonus[stat]!=null&&p.growth_bonus[stat]!==reference.growth_bonus[stat]));
    const related={weapon_profiles:(this.database.guide_facts.weapon_profiles??[]).filter(r=>r.class_ids?.includes(c.id))};for(const key of ['certification_items','divine_chambers','class_change_rules','ability_catalog'])related[key]=(this.database.guide_facts?.[key]??[]).filter(r=>r.class_id===c.id||r.class_ids?.includes(c.id));
    const byAbility=new Map();for(const r of [...abilities,...related.ability_catalog]){const key=r.kind+':'+normalize(r.ability);if(!byAbility.has(key))byAbility.set(key,[]);byAbility.get(key).push(r);}
    const variants=[...byAbility.values()].filter(rows=>rows.length>1).map(rows=>({ability:rows[0].ability,kind:rows[0].kind,source_variants:rows,status:rows.some(r=>r.effect_facts==null)?'missing_in_some_sources':new Set(rows.map(r=>JSON.stringify(r.effect_facts))).size>1?'conflicting_structured_effect':'same_structured_effect'}));
    return {...related,ability_effect_variants:variants,class:c,growth_reference:reference??null,requirements_variants:requirements,reference_profiles:profiles,class_abilities:abilities,growth_conflicts:growthConflicts,reference_conflicts:conflicts,used_in_build_calculation:false,provenance:reference?this.provenance('class_growth_reference',reference):this.provenance('classes',c)};
  }
  invoke(tool,args={}) {
    const definition=TOOL_DEFINITIONS.find(t=>t.name===tool);if(!definition)throw new RangeError(`Unknown tool: ${tool}`);
    if(!args||typeof args!=='object'||Array.isArray(args))throw new TypeError('Tool arguments must be an object');
    for(const key of Object.keys(args))if(!Object.hasOwn(definition.parameters.properties,key))throw new TypeError(`Unknown tool argument: ${key}`);
    for(const [key,value]of Object.entries(args)){const type=definition.parameters.properties[key].type;if(type==='string'&&typeof value!=='string'||type==='integer'&&!Number.isInteger(value))throw new TypeError(`Invalid type for ${key}`);}
    for(const key of definition.parameters.required??[])if(typeof args[key]!=='string'||!args[key])throw new TypeError(`Required string: ${key}`);
    if(tool==='list_datasets')return this.catalog();
    if(tool==='search_records')return this.search(args);
    if(tool==='get_record')return this.get(args.collection,args.id);
    if(tool==='class_context')return this.classContext(args.class);
    return this.characterContext(args.character);
  }
}
