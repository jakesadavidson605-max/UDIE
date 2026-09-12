export type GraphNode = { id: string; label: string; kind: "document" | "entity" | "concept" };
export type GraphEdge = { from: string; to: string; relation: string; weight: number };

export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge[]>();

  addNode(node: GraphNode) {
    this.nodes.set(node.id, node);
    if (!this.edges.has(node.id)) this.edges.set(node.id, []);
  }

  addEdge(edge: GraphEdge) {
    if (!this.nodes.has(edge.from)) this.addNode({ id: edge.from, label: edge.from, kind: "concept" });
    if (!this.nodes.has(edge.to)) this.addNode({ id: edge.to, label: edge.to, kind: "entity" });
    const neighbors = this.edges.get(edge.from) ?? [];
    if (!neighbors.some(existing => existing.to === edge.to && existing.relation === edge.relation)) neighbors.push(edge);
    this.edges.set(edge.from, neighbors);
  }

  neighbors(id: string, depth = 1) {
    const visited = new Set<string>([id]);
    let frontier = [id];
    for (let level = 0; level < depth; level += 1) {
      const next: string[] = [];
      for (const current of frontier) {
        for (const edge of this.edges.get(current) ?? []) {
          if (!visited.has(edge.to)) { visited.add(edge.to); next.push(edge.to); }
        }
      }
      frontier = next;
    }
    return Array.from(visited).map(nodeId => this.nodes.get(nodeId)).filter((node): node is GraphNode => Boolean(node));
  }

  snapshot() {
    return { nodes: Array.from(this.nodes.values()), edges: Array.from(this.edges.values()).flat() };
  }
}
