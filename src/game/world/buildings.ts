import type { NpcId } from '../../core/characters';
import type { BuildingStyle } from '../sprites/buildings';

export interface BuildingDef {
  id: string;
  name: string;
  /** tile coordinates */
  x: number;
  y: number;
  w: number;
  h: number;
  style: BuildingStyle;
  wall: string;
  roof: string;
  trim: string;
  /** Phase 1 SQL world id, if any */
  world?: number;
  phase: number;
  department: string;
  npc?: NpcId;
  comingSoon?: string;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'vault', name: 'Floorplan Vault', x: 3, y: 7, w: 10, h: 7, style: 'vault', wall: '#d9d4c7', roof: '#6d3fd6', trim: '#ffd23f', world: 5, phase: 1, department: 'SQL', npc: 'marge' },
  { id: 'fi', name: 'F&I Office', x: 15, y: 8, w: 9, h: 6, style: 'office', wall: '#e8dcc8', roof: '#1f2937', trim: '#b91c1c', world: 4, phase: 1, department: 'SQL', npc: 'walt' },
  { id: 'showroom', name: 'Showroom', x: 26, y: 6, w: 18, h: 8, style: 'showroom', wall: '#fffaf0', roof: '#e0473b', trim: '#ffd23f', world: 2, phase: 1, department: 'SQL', npc: 'tony' },
  { id: 'hq', name: 'GM Office', x: 47, y: 7, w: 10, h: 7, style: 'hq', wall: '#e8dcc8', roof: '#2f4b8f', trim: '#ffd23f', world: 8, phase: 1, department: 'SQL', npc: 'rhonda' },
  { id: 'service', name: 'Service Bay', x: 60, y: 6, w: 17, h: 8, style: 'bay', wall: '#dfe3e8', roof: '#14b8a6', trim: '#2b1d3a', world: 3, phase: 1, department: 'SQL', npc: 'priya' },
  { id: 'lot', name: 'Lot Office', x: 46, y: 19, w: 7, h: 5, style: 'shack', wall: '#f4d8a8', roof: '#ff7a2f', trim: '#2b1d3a', world: 1, phase: 1, department: 'SQL', npc: 'rhonda' },
  { id: 'data', name: 'Data HQ', x: 59, y: 18, w: 11, h: 7, style: 'data', wall: '#dff5e6', roof: '#37c46b', trim: '#2b1d3a', world: 6, phase: 1, department: 'SQL', npc: 'devin' },
  { id: 'hr', name: 'People Ops', x: 59, y: 28, w: 10, h: 6, style: 'people', wall: '#fde2ee', roof: '#f472b6', trim: '#ffffff', world: 7, phase: 1, department: 'SQL', npc: 'jess' },
  // ---- later phases
  { id: 'excel', name: 'Accounting', x: 3, y: 39, w: 9, h: 6, style: 'office', wall: '#e2f0d9', roof: '#22914b', trim: '#ffffff', phase: 2, department: 'Excel', comingSoon: 'Phase 2: Excel Office. XLOOKUP, SUMIFS, pivot thinking and a real curtailment schedule, on a live spreadsheet grid.' },
  { id: 'ailab', name: 'AI Team Lab', x: 15, y: 39, w: 9, h: 6, style: 'lab', wall: '#e0e7ff', roof: '#6366f1', trim: '#ffffff', phase: 3, department: 'Python', npc: 'nova', comingSoon: 'Phase 3: The AI Team Lab. Real Python + pandas in the browser, SQL ↔ pandas, forecasting and lead scoring.' },
  { id: 'basement', name: 'DE Basement', x: 27, y: 39, w: 9, h: 6, style: 'basement', wall: '#cbd5e1', roof: '#475569', trim: '#ffffff', phase: 4, department: 'Data Engineering', comingSoon: 'Phase 4: Data Engineering Basement. Raw → staging → marts, star schemas, SCDs and data tests.' },
  { id: 'jsonmd', name: 'JSON & MD', x: 39, y: 39, w: 9, h: 6, style: 'studio', wall: '#fef3c7', roof: '#d9a900', trim: '#2b1d3a', phase: 6, department: 'JSON & Markdown', comingSoon: 'Phase 6: JSON & Markdown Workshop. Parse lead-form payloads in SQL and write great docs.' },
  { id: 'dbt', name: 'dbt Factory', x: 3, y: 48, w: 10, h: 6, style: 'factory', wall: '#fed7aa', roof: '#ea580c', trim: '#2b1d3a', phase: 7, department: 'dbt', comingSoon: 'Phase 7: dbt Factory. ref(), the DAG, tests and snapshots. Build stg_leads → fct_deals and watch the lineage light up.' },
  { id: 'streamlit', name: 'Streamlit', x: 16, y: 48, w: 9, h: 6, style: 'studio', wall: '#ffe4e6', roof: '#ff4b4b', trim: '#ffffff', phase: 8, department: 'Streamlit', comingSoon: 'Phase 8: Streamlit Studio. Build a Store Scorecard app with stlite, right in the browser.' },
  { id: 'llm', name: 'LLM Lab', x: 28, y: 48, w: 9, h: 6, style: 'lab', wall: '#ede9fe', roof: '#8b5cf6', trim: '#ffffff', phase: 9, department: 'LLMs & AI', comingSoon: 'Phase 9: LLM & AI Lab. Prompts, structured outputs, RAG over dealer docs and a SQL-writing agent.' },
  { id: 'git', name: 'GitHub Garage', x: 40, y: 48, w: 10, h: 6, style: 'garage', wall: '#e5e7eb', roof: '#24292f', trim: '#ffffff', phase: 10, department: 'Git', comingSoon: 'Phase 10: GitHub Garage. Branches, PRs, merge conflicts, and never committing a .env file.' },
  { id: 'bi', name: 'BI Studio', x: 52, y: 48, w: 9, h: 6, style: 'studio', wall: '#fef9c3', roof: '#eab308', trim: '#2b1d3a', phase: 11, department: 'Power BI & DAX', comingSoon: 'BI Studio: data modeling, measures vs columns, CALCULATE and filter context, plus the DAX Detective minigame.' },
  { id: 'snowflake', name: 'Snowflake', x: 66, y: 38, w: 8, h: 14, style: 'tower', wall: '#dbeafe', roof: '#29b5e8', trim: '#ffffff', phase: 5, department: 'Snowflake', comingSoon: 'Phase 5: Snowflake Tower. Warehouses and credits, RBAC, stages, VARIANT and FLATTEN, time travel, compute pools and Cortex.' },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export function buildingForWorld(world: number): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.world === world);
}
