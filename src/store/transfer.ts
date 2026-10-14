import {
  AdrRecordSchema,
  SdrRecordSchema,
  type DecisionRecord,
} from '../core/schema.js';
import type { GraphNode } from './store.js';

export function graphNodeToRecord(node: GraphNode): DecisionRecord {
  const fields = {
    id: node.id,
    title: node.title,
    appliesTo: node.appliesTo,
    tags: node.tags,
    date: node.date,
    path: node.path,
    contentHash: node.contentHash,
    status: node.status,
    body: node.body,
  };
  if (node.type === 'adr') {
    return AdrRecordSchema.parse({
      ...fields,
      type: 'adr',
      rules: node.rules,
      verify: node.verify,
    });
  }
  return SdrRecordSchema.parse({
    ...fields,
    type: 'sdr',
    promotedTo: null,
  });
}
