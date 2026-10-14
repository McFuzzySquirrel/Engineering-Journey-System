import type { DecisionRecord, Rule, Verification } from '../core/schema.js';

export type EdgeKind =
  | 'supersedes'
  | 'relates_to'
  | 'derived_from'
  | 'promoted_to'
  | 'conflicts_with';

export interface GraphEdge {
  src: string;
  dst: string;
  kind: EdgeKind;
}

export interface Project {
  id: string;
  name: string;
  type: string;
  origin?: string;
}

export interface GraphNode {
  projectId: string;
  id: string;
  type: DecisionRecord['type'];
  title: string;
  status: string;
  appliesTo: string[];
  tags: string[];
  rules: Rule[];
  verify: Verification[];
  body: string;
  path: string;
  contentHash: string;
  date?: string;
  updatedAt: string;
}

export interface NodeFilter {
  type?: DecisionRecord['type'];
  status?: string;
  tag?: string;
}

export interface SearchResult extends GraphNode {
  snippet: string;
}

export interface Store {
  upsertProject(project: Project): Promise<void>;
  listProjects(): Promise<Project[]>;
  upsertNode(projectId: string, record: DecisionRecord): Promise<boolean>;
  insertNodeIfAbsent(
    projectId: string,
    record: DecisionRecord,
  ): Promise<boolean>;
  applyProjectPush(
    project: Project,
    records: DecisionRecord[],
    edges: GraphEdge[],
  ): Promise<number>;
  deleteMissing(projectId: string, ids: string[]): Promise<number>;
  deleteEdges(
    projectId: string,
    sources?: string[],
    kind?: EdgeKind,
  ): Promise<void>;
  addEdge(
    projectId: string,
    src: string,
    dst: string,
    kind: EdgeKind,
  ): Promise<void>;
  listEdges(projectId: string): Promise<GraphEdge[]>;
  get(projectId: string, id: string): Promise<GraphNode | null>;
  list(projectId: string, filter?: NodeFilter): Promise<GraphNode[]>;
  search(
    projectId: string,
    query: string,
    filter?: NodeFilter,
  ): Promise<SearchResult[]>;
  related(
    projectId: string,
    id: string,
    depth?: number,
    kinds?: EdgeKind[],
  ): Promise<GraphNode[]>;
  byGlobMatch(projectId: string, files: string[]): Promise<GraphNode[]>;
}
