"use client";

import { useState, useEffect, useCallback } from 'react';
import AppHeader from '@/components/node-keeper/AppHeader';
import NodeDashboard from '@/components/node-keeper/NodeDashboard';
import ClientConsole from '@/components/node-keeper/ClientConsole';
import KeyValueDisplay from '@/components/node-keeper/KeyValueDisplay';
import type { Node } from '@/components/node-keeper/types';
import { useToast } from "@/hooks/use-toast";

const NUM_NODES = 3;
const REPLICATION_FACTOR = 2; // Store each piece of data on at least this many nodes

const initialNodesData: Node[] = Array.from({ length: NUM_NODES }, (_, i) => ({
  id: `Node ${i + 1}`,
  address: `192.168.1.10${i + 1}:5005${i + 1}`,
  status: 'Online',
  data: {},
  isLeader: i === 0, // First node is leader initially
  lastHeartbeat: Date.now(),
}));

// Simple hash function to determine which node "owns" a key primarily
const getPrimaryNodeIndexForKey = (key: string, totalNodes: number): number => {
  if (!key || totalNodes <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % totalNodes;
};

export default function NodeKeeperPage() {
  const [nodes, setNodes] = useState<Node[]>(initialNodesData);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = useCallback((message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 199)]);
  }, []);

  // Mock heartbeat, failure detection, and leader election
  useEffect(() => {
    const interval = setInterval(() => {
      let leaderExists = false;
      const updatedNodes = nodes.map(node => {
        if (node.status === 'Offline') return node;

        if (node.isLeader) leaderExists = true;

        // Simulate occasional missed heartbeat for non-leader nodes
        if (!node.isLeader && Math.random() < 0.02) { // 2% chance of failure simulation
          addLog(`Node ${node.id} missed heartbeat. Simulating failure.`);
          toast({ title: "Node Issue", description: `Node ${node.id} stopped responding.`, variant: "destructive" });
          return { ...node, status: 'Offline', lastHeartbeat: Date.now(), isLeader: false };
        }
        return { ...node, lastHeartbeat: Date.now() };
      });

      // Simple leader election: if no leader, first online node becomes leader
      if (!leaderExists && updatedNodes.some(n => n.status === 'Online')) {
        const firstOnlineNodeIndex = updatedNodes.findIndex(n => n.status === 'Online');
        if (firstOnlineNodeIndex !== -1) {
          updatedNodes[firstOnlineNodeIndex].isLeader = true;
          addLog(`Node ${updatedNodes[firstOnlineNodeIndex].id} elected as new leader.`);
          toast({ title: "Leader Election", description: `Node ${updatedNodes[firstOnlineNodeIndex].id} is now the leader.` });
        }
      }
      setNodes(updatedNodes);
    }, 5000); // Check heartbeats every 5 seconds

    return () => clearInterval(interval);
  }, [nodes, addLog, toast]);


  const handleOperation = useCallback((operation: 'PUT' | 'GET' | 'DELETE', key: string, value?: string, clientConnectedNodeId?: string) => {
    if (!key) {
      toast({ title: "Error", description: "Key cannot be empty.", variant: "destructive" });
      addLog("Operation failed: Key is empty.");
      return;
    }
    if (operation === 'PUT' && (typeof value === 'undefined' || value === '')) {
      toast({ title: "Error", description: "Value cannot be empty for PUT.", variant: "destructive" });
      addLog("PUT operation failed: Value is empty.");
      return;
    }

    const onlineNodes = nodes.filter(n => n.status === 'Online');
    if (onlineNodes.length === 0) {
      toast({ title: "Error", description: "All nodes are offline. Cannot perform operation.", variant: "destructive" });
      addLog("Operation failed: All nodes offline.");
      return;
    }
    
    const connectedNode = nodes.find(n => n.id === clientConnectedNodeId && n.status === 'Online') || onlineNodes.find(n => n.isLeader) || onlineNodes[0];
    addLog(`Client connected to ${connectedNode.id}. Request: ${operation} ${key} ${value ? `(value: ${value.substring(0,20)}${value.length > 20 ? '...' : ''})` : ''}`);

    const primaryNodeIndex = getPrimaryNodeIndexForKey(key, nodes.length);
    const primaryNode = nodes[primaryNodeIndex];

    if (connectedNode.id !== primaryNode.id && primaryNode.status === 'Online') {
      addLog(`Node ${connectedNode.id} routing request for key '${key}' to primary Node ${primaryNode.id}.`);
    } else if (primaryNode.status !== 'Online' && operation !== 'GET') {
      addLog(`Primary node ${primaryNode.id} for key '${key}' is offline. Operation may target replicas.`);
    }


    setNodes(prevNodes => {
      const newNodes = prevNodes.map(n => ({...n, data: {...n.data}})); // Deep copy for modification

      // Determine replication targets
      const potentialTargets = newNodes.filter(n => n.status === 'Online');
      if (potentialTargets.length === 0 && operation !== 'GET') {
        toast({ title: "Error", description: `No online nodes available for ${operation} on key '${key}'.`, variant: "destructive" });
        addLog(`${operation} for key '${key}' failed. No online nodes.`);
        return prevNodes;
      }

      const replicationNodes: Node[] = [];
      let startIndex = primaryNodeIndex;
      
      for (let i = 0; i < newNodes.length && replicationNodes.length < REPLICATION_FACTOR; i++) {
          const currentNodeIndex = (startIndex + i) % newNodes.length;
          if (newNodes[currentNodeIndex].status === 'Online') {
              replicationNodes.push(newNodes[currentNodeIndex]);
          }
      }
      
      if (replicationNodes.length === 0 && operation !== 'GET') {
         addLog(`Not enough online nodes to meet replication factor for ${operation} on key '${key}'.`);
         toast({ title: "Warning", description: `Could not fully replicate ${key}. Limited online nodes.`, variant: "default" });
         // If no nodes at all, this was caught earlier. This is for < REPLICATION_FACTOR but > 0
         if (potentialTargets.length > 0 && operation !== 'GET') replicationNodes.push(potentialTargets[0]); // Fallback to at least one if possible
         else if (operation !== 'GET') {
            toast({ title: "Error", description: `Failed to ${operation} key '${key}'. No online nodes.`, variant: "destructive" });
            return prevNodes;
         }
      }


      switch (operation) {
        case 'PUT':
          if (value !== undefined) {
            let putCount = 0;
            replicationNodes.forEach(nodeToUpdate => {
              nodeToUpdate.data[key] = value;
              addLog(`Key '${key}' PUT to Node ${nodeToUpdate.id}.`);
              putCount++;
            });
            if (putCount > 0) {
              toast({ title: "Success", description: `Key '${key}' set on ${putCount} node(s).` });
            } else {
               toast({ title: "Error", description: `Failed to PUT key '${key}'. No suitable node found.`, variant: "destructive" });
            }
          }
          break;
        case 'GET':
          let foundValue: string | undefined = undefined;
          let foundOnNode: string | undefined = undefined;

          // Try primary first, then others in replication group, then any online node
          const orderedNodesToQuery = [
            newNodes[primaryNodeIndex], 
            ...replicationNodes.filter(n => n.id !== newNodes[primaryNodeIndex].id),
            ...potentialTargets.filter(n => !replicationNodes.find(rn => rn.id === n.id) && n.id !== newNodes[primaryNodeIndex].id)
          ];
          
          for (const nodeToQuery of orderedNodesToQuery) {
            if (nodeToQuery && nodeToQuery.status === 'Online' && key in nodeToQuery.data) {
              foundValue = nodeToQuery.data[key];
              foundOnNode = nodeToQuery.id;
              break;
            }
          }

          if (typeof foundValue !== 'undefined' && foundOnNode) {
            addLog(`Key '${key}' GET from Node ${foundOnNode}. Value: ${foundValue}`);
            toast({ title: "Success", description: `Key '${key}' retrieved from ${foundOnNode}: ${foundValue.substring(0,50)}${foundValue.length > 50 ? '...' : ''}` });
          } else {
            addLog(`Key '${key}' NOT FOUND in any active node.`);
            toast({ title: "Not Found", description: `Key '${key}' not found.`, variant: "destructive" });
          }
          break;
        case 'DELETE':
          let deletedCount = 0;
          replicationNodes.forEach(nodeToUpdate => {
             if (key in nodeToUpdate.data) {
                delete nodeToUpdate.data[key];
                addLog(`Key '${key}' DELETED from Node ${nodeToUpdate.id}.`);
                deletedCount++;
             }
          });
          if (deletedCount > 0) {
            toast({ title: "Success", description: `Key '${key}' deleted from ${deletedCount} node(s).` });
          } else {
            addLog(`Key '${key}' NOT FOUND for deletion.`);
            toast({ title: "Not Found", description: `Key '${key}' not found for deletion.`, variant: "destructive" });
          }
          break;
      }
      return newNodes;
    });
  }, [nodes, addLog, toast]);

  const toggleNodeStatus = useCallback((nodeId: string) => {
    setNodes(prevNodes => {
      const newNodes = [...prevNodes];
      const nodeIndex = newNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return prevNodes;

      const node = newNodes[nodeIndex];
      const newStatus = node.status === 'Online' ? 'Offline' : 'Online';
      addLog(`Node ${node.id} status changed to ${newStatus}.`);
      toast({ title: "Node Status Update", description: `Node ${node.id} is now ${newStatus}.`});
      
      newNodes[nodeIndex] = { ...node, status: newStatus };

      if (newStatus === 'Offline' && node.isLeader) {
        newNodes[nodeIndex].isLeader = false;
        addLog(`Leader ${node.id} went offline. Triggering leader election.`);
        // Leader election will be handled by the useEffect hook in the next cycle
      }
      
      if (newStatus === 'Online') {
        newNodes[nodeIndex].lastHeartbeat = Date.now();
        addLog(`Node ${node.id} is back online. Simulating data recovery...`);
        // Simulate snapshot recovery: copy data for keys this node should own from other online nodes
        const onlineReplicas = newNodes.filter(n => n.status === 'Online' && n.id !== nodeId);
        if(onlineReplicas.length > 0) {
          for (let i = 0; i < newNodes.length; i++) { // Iterate over all possible keys by checking other nodes
            const tempKeyOwnerIndex = getPrimaryNodeIndexForKey(Object.keys(onlineReplicas[0].data)[i] || `key_for_node_${nodeIndex}`, newNodes.length); // Example key generation
            if(tempKeyOwnerIndex === nodeIndex) { // If this node should own this key (or be a replica for it)
              // Find the key on another node and copy it
              for(const replica of onlineReplicas) {
                Object.keys(replica.data).forEach(k => {
                   // A more robust check for key ownership/replication strategy would be needed here
                   if (getPrimaryNodeIndexForKey(k, newNodes.length) === nodeIndex || (getPrimaryNodeIndexForKey(k, newNodes.length) + 1) % newNodes.length === nodeIndex ) { // Simple check
                     if (!(k in newNodes[nodeIndex].data)) { // If not already present (e.g. from partial failure)
                        newNodes[nodeIndex].data[k] = replica.data[k];
                        addLog(`Recovered key '${k}' for Node ${node.id} from Node ${replica.id}.`);
                     }
                   }
                });
              }
            }
          }
        } else {
            addLog(`No online replicas to recover data for Node ${node.id}. It will start empty or with existing data.`);
        }
      }
      return newNodes;
    });
  }, [addLog, toast]);
  

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-accent selection:text-accent-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto p-4 md:p-8 space-y-8">
        <NodeDashboard nodes={nodes} onToggleStatus={toggleNodeStatus} />
        <ClientConsole nodes={nodes} onOperate={handleOperation} logs={logs} />
        <KeyValueDisplay nodes={nodes} />
      </main>
    </div>
  );
}
