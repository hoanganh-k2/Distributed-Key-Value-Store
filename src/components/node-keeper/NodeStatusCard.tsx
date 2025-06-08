
import type { Node } from './types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Server, ServerCrash, Zap, Power, PowerOff } from 'lucide-react';
import { useState, useEffect } from 'react';

interface NodeStatusCardProps {
  node: Node;
  onToggleStatus: (nodeId: string) => void;
}

export default function NodeStatusCard({ node, onToggleStatus }: NodeStatusCardProps) {
  const [formattedHeartbeat, setFormattedHeartbeat] = useState<string | null>(null);

  useEffect(() => {
    // This ensures toLocaleTimeString is called only on the client side
    // after the initial hydration.
    setFormattedHeartbeat(new Date(node.lastHeartbeat).toLocaleTimeString());
  }, [node.lastHeartbeat]);

  const statusColor = node.status === 'Online' ? 'bg-green-500' : node.status === 'Offline' ? 'bg-red-500' : 'bg-yellow-500';
  const StatusIcon = node.status === 'Online' ? Server : ServerCrash;
  
  return (
    <Card className="shadow-lg w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline flex items-center text-xl">
              <StatusIcon className={`mr-2 h-6 w-6 ${node.status === 'Online' ? 'text-green-600' : 'text-red-600'}`} />
              {node.id}
              {node.isLeader && <Zap className="ml-2 h-5 w-5 text-yellow-500" fill="currentColor" />}
            </CardTitle>
            <CardDescription className="font-code text-sm">{node.address}</CardDescription>
          </div>
          <Badge variant={node.status === 'Online' ? 'default' : 'destructive'} className={`${statusColor} text-white`}>
            {node.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-1">
          <p>Keys stored: <span className="font-semibold font-code">{Object.keys(node.data).length}</span></p>
          <p>Last heartbeat: <span className="font-semibold">{formattedHeartbeat || 'Calculating...'}</span></p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={() => onToggleStatus(node.id)} 
          variant="outline"
          className="w-full"
        >
          {node.status === 'Online' ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
          {node.status === 'Online' ? 'Take Offline' : 'Bring Online'}
        </Button>
      </CardFooter>
    </Card>
  );
}
