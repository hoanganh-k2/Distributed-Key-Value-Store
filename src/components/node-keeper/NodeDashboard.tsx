import type { Node } from './types';
import NodeStatusCard from './NodeStatusCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface NodeDashboardProps {
  nodes: Node[];
  onToggleStatus: (nodeId: string) => void;
}

export default function NodeDashboard({ nodes, onToggleStatus }: NodeDashboardProps) {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <Activity className="mr-2 h-6 w-6 text-primary" /> Node Status Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nodes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nodes.map(node => (
              <NodeStatusCard key={node.id} node={node} onToggleStatus={onToggleStatus} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No nodes to display.</p>
        )}
      </CardContent>
    </Card>
  );
}
