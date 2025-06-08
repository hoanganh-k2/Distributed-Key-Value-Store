'use client';

import type { Node } from './types';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, UploadCloud, DownloadCloud, Trash2, Send } from 'lucide-react';

interface ClientConsoleProps {
  nodes: Node[];
  onOperate: (operation: 'PUT' | 'GET' | 'DELETE', key: string, value?: string, clientConnectedNodeId?: string) => void;
  logs: string[];
}

export default function ClientConsole({ nodes, onOperate, logs }: ClientConsoleProps) {
  const [operation, setOperation] = useState<'PUT' | 'GET' | 'DELETE'>('GET');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(nodes.find(n => n.status === 'Online')?.id || nodes[0]?.id);

  const onlineNodes = nodes.filter(n => n.status === 'Online');

  const handleSubmit = (op: 'PUT' | 'GET' | 'DELETE') => {
    onOperate(op, key, op === 'PUT' ? value : undefined, selectedNodeId);
    if (op !== 'PUT') { // Keep key for GET/DELETE for convenience, clear value
      setValue('');
    }
  };

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <Terminal className="mr-2 h-6 w-6 text-primary" /> Client Console
        </CardTitle>
        <CardDescription>Interact with the distributed key-value store.</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="client-node-select">Connect to Node</Label>
              <Select value={selectedNodeId} onValueChange={setSelectedNodeId} disabled={onlineNodes.length === 0}>
                <SelectTrigger id="client-node-select" className="w-full">
                  <SelectValue placeholder="Select a node to connect..." />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map(node => (
                    <SelectItem key={node.id} value={node.id} disabled={node.status !== 'Online'}>
                      {node.id} ({node.address}) - {node.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onlineNodes.length === 0 && <p className="text-xs text-destructive mt-1">No online nodes available to connect.</p>}
            </div>

            <div>
              <Label htmlFor="key-input">Key</Label>
              <Input id="key-input" placeholder="Enter key" value={key} onChange={(e) => setKey(e.target.value)} className="font-code" />
            </div>
            
            <div>
              <Label htmlFor="value-input">Value (for PUT)</Label>
              <Input id="value-input" placeholder="Enter value" value={value} onChange={(e) => setValue(e.target.value)} className="font-code" />
            </div>

            <div className="flex space-x-2">
              <Button onClick={() => handleSubmit('PUT')} className="flex-1 bg-primary hover:bg-primary/90" disabled={!key || !value || onlineNodes.length === 0}>
                <UploadCloud className="mr-2 h-4 w-4" /> PUT
              </Button>
              <Button onClick={() => handleSubmit('GET')} className="flex-1" variant="outline" disabled={!key || onlineNodes.length === 0}>
                <DownloadCloud className="mr-2 h-4 w-4" /> GET
              </Button>
              <Button onClick={() => handleSubmit('DELETE')} variant="destructive" className="flex-1" disabled={!key || onlineNodes.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" /> DELETE
              </Button>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="logs-output">Operation Logs</Label>
          <ScrollArea className="h-72 w-full rounded-md border p-3 bg-muted/30">
            <div id="logs-output" className="font-code text-xs space-y-1">
              {logs.length === 0 && <p className="text-muted-foreground">No operations yet...</p>}
              {logs.map((log, index) => (
                <p key={index}>{log}</p>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
