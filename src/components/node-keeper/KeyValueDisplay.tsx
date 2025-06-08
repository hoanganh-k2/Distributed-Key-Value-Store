import type { Node } from './types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database } from 'lucide-react';

interface KeyValueDisplayProps {
  nodes: Node[];
}

export default function KeyValueDisplay({ nodes }: KeyValueDisplayProps) {
  const allData = nodes.reduce((acc, node) => {
    if (node.status === 'Online') {
      Object.entries(node.data).forEach(([key, value]) => {
        if (!acc[key] || acc[key].value !== value) { // Show unique keys or if value differs (e.g. during inconsistency)
          acc[key] = { value, nodes: [node.id] };
        } else if (acc[key] && !acc[key].nodes.includes(node.id)) {
          acc[key].nodes.push(node.id);
        }
      });
    }
    return acc;
  }, {} as Record<string, { value: string; nodes: string[] }>);

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <Database className="mr-2 h-6 w-6 text-primary" /> Key-Value Store View
        </CardTitle>
        <CardDescription>A consolidated view of data across all online nodes. Values shown are from the first encountered online node.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%] font-semibold">Key</TableHead>
                <TableHead className="w-[40%] font-semibold">Value</TableHead>
                <TableHead className="w-[30%] font-semibold">Present on Nodes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.keys(allData).length > 0 ? (
                Object.entries(allData).map(([key, data]) => (
                  <TableRow key={key}>
                    <TableCell className="font-code">{key}</TableCell>
                    <TableCell className="font-code truncate max-w-xs">{data.value}</TableCell>
                    <TableCell className="font-code text-xs">{data.nodes.join(', ')}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No data stored or all nodes are offline.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
