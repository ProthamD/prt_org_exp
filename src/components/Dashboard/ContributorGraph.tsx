import { useEffect, useRef, useMemo } from 'react';
import { Network, DataSet } from 'vis-network/standalone/esm/vis-network.js';
import type { RepoData, Contributor } from '../../types';
import '../../styles/contributor-graph.css';

interface ContributorGraphProps {
  repos: RepoData[];
  contributors: Contributor[];
}

interface GraphNode {
  id: string;
  label: string;
  title: string;
  color: string;
  size: number;
  shape: 'dot' | 'box';
  font: { size: number };
  y?: number;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  title: string;
  width: number;
  color: string;
}

export default function ContributorGraph({ repos, contributors }: ContributorGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  // Calculate days since last activity
  const calculateActivityScore = (dateString: string): number => {
    const date = new Date(dateString);
    const daysSince = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 100 - daysSince * 2); // Higher score = more recent
  };

  // Build graph data
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    let edgeId = 0;

    // Add all repos as nodes
    repos.forEach((repo) => {
      const activityScore = calculateActivityScore(repo.pushed_at);
      const nodeSize = Math.max(20, Math.min(60, 20 + (repo.stargazers_count / 100)));
      const yPos = -activityScore; // More recent = higher on screen (negative y)

      nodes.push({
        id: `repo-${repo.name}`,
        label: repo.name,
        title: `
          <div class="tooltip">
            <div><strong>${repo.name}</strong></div>
            <div>Stars: ${repo.stargazers_count}</div>
            <div>Forks: ${repo.forks_count}</div>
            <div>Open Issues: ${repo.open_issues_count}</div>
            <div>Language: ${repo.language || 'N/A'}</div>
            <div>Last Push: ${new Date(repo.pushed_at).toLocaleDateString()}</div>
          </div>
        `,
        color: activityScore > 50 ? '#4CAF50' : activityScore > 25 ? '#FF9800' : '#F44336',
        size: nodeSize,
        shape: 'dot',
        font: { size: 12 },
        y: yPos,
      });
    });

    // Add contributors as nodes
    contributors.forEach((contributor) => {
      const contribCount = contributor.contributions || 0;
      const nodeSize = Math.max(15, Math.min(50, 15 + (contribCount / 20)));

      nodes.push({
        id: `contrib-${contributor.login}`,
        label: contributor.login,
        title: `
          <div class="tooltip">
            <div><strong>${contributor.login}</strong></div>
            <div>Contributions: ${contribCount}</div>
          </div>
        `,
        color: '#2196F3',
        size: nodeSize,
        shape: 'box',
        font: { size: 11 },
      });
    });

    // Add edges between contributors and repos
    contributors.forEach((contributor) => {
      if (contributor.repos && Array.isArray(contributor.repos)) {
        contributor.repos.forEach((repoName: string) => {
          const repo = repos.find((r) => r.name === repoName);
          if (repo) {
            const contributions = contributor.contributions || 0;
            const edgeWidth = Math.max(1, Math.min(10, 1 + (contributions / 50)));

            edges.push({
              id: `edge-${edgeId++}`,
              from: `contrib-${contributor.login}`,
              to: `repo-${repo.name}`,
              title: `${contributions} contributions`,
              width: edgeWidth,
              color: 'rgba(33, 150, 243, 0.3)',
            });
          }
        });
      }
    });

    return { nodes, edges };
  }, [repos, contributors]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create DataSets with proper typing
    const nodes = new DataSet<GraphNode, 'id'>(graphData.nodes);
    const edges = new DataSet<GraphEdge, 'id'>(graphData.edges);

    const data = { nodes, edges };
    const options = {
      physics: {
        enabled: true,
        stabilization: {
          iterations: 200,
        },
        forceAtlas2Based: {
          gravitationalConstant: -26,
          centralGravity: 0.005,
          springLength: 200,
          springConstant: 0.08,
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based' as const,
        timestep: 0.35,
      },
      layout: {
        randomSeed: 42,
      },
      nodes: {
        borderWidth: 2,
        borderWidthSelected: 3,
      },
      edges: {
        smooth: {
          type: 'continuous',
        },
      },
      interaction: {
        hover: true,
        navigationButtons: true,
        keyboard: true,
      },
    };

    networkRef.current = new Network(containerRef.current, data as never, options as never);

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData]);

  return (
    <div className="contributor-graph-container">
      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#4CAF50' }} />
          <span>Active Repository (&lt; 25 days)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#FF9800' }} />
          <span>Moderately Active (25-50 days)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#F44336' }} />
          <span>Stale Repository (&gt; 50 days)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#2196F3' }} />
          <span>Contributor</span>
        </div>
        <div className="legend-note">
          • Node size represents magnitude (stars for repos, contributions for contributors)
        </div>
        <div className="legend-note">
          • Edge thickness represents contribution count
        </div>
        <div className="legend-note">
          • Vertical position: more recent repos positioned at top
        </div>
      </div>
      <div ref={containerRef} className="graph-canvas" />
    </div>
  );
}
