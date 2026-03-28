import { useState, useMemo, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useContributors } from '../../hooks/useContributors';
import type { RepoData, Contributor } from '../../types';

interface Props {
  orgName: string;
  repos: RepoData[];
}

interface NodeData {
  id: string;
  name: string;
  group: 'repo' | 'contributor';
  val: number; // For node sizing
  color: string;
  data: RepoData | Contributor;
}

interface LinkData {
  source: string;
  target: string;
  value: number; // For link thickness
}

interface GraphData {
  nodes: NodeData[];
  links: LinkData[];
}

export default function NetworkTab({ orgName, repos }: Props) {
  const { contributors, loading, error, fromCache } = useContributors(orgName, repos);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo<GraphData>(() => {
    if (!contributors.length || !repos.length) return { nodes: [], links: [] };

    const nodes: NodeData[] = [];
    const links: LinkData[] = [];
    const repoSet = new Set<string>();

    // We only take the top contributors to avoid an overly dense graph
    const topContributors = contributors.slice(0, 50);

    // Build contributor nodes and links
    topContributors.forEach((c) => {
      const contrId = `user:${c.login}`;
      nodes.push({
        id: contrId,
        name: c.login,
        group: 'contributor',
        val: Math.max(5, Math.log10(c.contributions + 1) * 3),
        color: '#f08030', // Orange-ish for contributors
        data: c,
      });

      c.repos.forEach((repoName) => {
        repoSet.add(repoName);
        links.push({
          source: contrId,
          target: `repo:${repoName}`,
          value: Math.max(0.5, c.contributions / Math.max(1, c.repos.length) / 10),
        });
      });
    });

    // Build repo nodes for all repos that have links
    repos.forEach((r) => {
      if (repoSet.has(r.name)) {
        nodes.push({
          id: `repo:${r.name}`,
          name: r.name,
          group: 'repo',
          val: Math.max(4, Math.log10(r.stargazers_count + 1) * 2), // Size by stars
          color: '#388bfd', // Blue-ish for repos
          data: r,
        });
      }
    });

    return { nodes, links };
  }, [contributors, repos]);

  // Center the graph after load
  useEffect(() => {
    if (graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current?.zoomToFit(400, 20);
      }, 500);
    }
  }, [graphData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--fg-muted)', gap: 10 }}>
        <div className="spinner" />
        Loading network data…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, background: 'rgba(248,81,73,0.1)', borderRadius: 'var(--radius)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}>
        Failed to load network data: {error}
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48, color: 'var(--fg-muted)' }}>No network data available</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {fromCache && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--fg-muted)' }}>
          <span style={{
            background: 'rgba(56,139,253,0.1)',
            color: 'var(--accent)',
            border: '1px solid rgba(56,139,253,0.3)',
            borderRadius: 12,
            padding: '2px 10px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            Data cached locally
          </span>
        </div>
      )}
      
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border-default)', padding: '16px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--fg-default)' }}>
            Contributor & Repository Ecosystem
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
            Nodes interact physically. Draggable elements. Colors: 
            <span style={{ color: '#388bfd', fontWeight: 'bold', marginLeft: 6 }}>Repos</span> vs 
            <span style={{ color: '#f08030', fontWeight: 'bold', marginLeft: 6 }}>Contributors</span>
          </p>
        </div>
        
        <div ref={containerRef} style={{ width: '100%', height: '600px', backgroundColor: 'var(--bg-default)' }}>
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeRelSize={4}
            nodeColor={(node: any) => node.color}
            nodeVal={(node: any) => node.val}
            linkColor={() => 'rgba(128,139,158,0.3)'}
            linkWidth={(link: any) => Math.min(4, Math.max(1, link.value))}
            enableNodeDrag={true}
            enablePanInteraction={true}
            enableZoomInteraction={true}
            onNodeClick={(node: any) => {
              if (node.group === 'contributor') {
                window.open((node.data as Contributor).html_url, '_blank');
              } else if (node.group === 'repo') {
                window.open((node.data as RepoData).html_url, '_blank');
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
