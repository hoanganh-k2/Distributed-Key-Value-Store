
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
      let nodeFailureToastParams: Parameters<typeof toast>[0] | null = null;
      let leaderElectionToastParams: Parameters<typeof toast>[0] | null = null;

      const updatedNodes = nodes.map(node => {
        if (node.status === 'Offline') return node;

        if (node.isLeader) leaderExists = true;

        if (!node.isLeader && Math.random() < 0.02) { // 2% chance of failure simulation
          addLog(`Node ${node.id} missed heartbeat. Simulating failure.`);
          nodeFailureToastParams = { title: "Node Issue", description: `Node ${node.id} stopped responding.`, variant: "destructive" };
          return { ...node, status: 'Offline', lastHeartbeat: Date.now(), isLeader: false };
        }
        return { ...node, lastHeartbeat: Date.now() };
      });

      if (!leaderExists && updatedNodes.some(n => n.status === 'Online')) {
        const firstOnlineNodeIndex = updatedNodes.findIndex(n => n.status === 'Online');
        if (firstOnlineNodeIndex !== -1) {
          updatedNodes[firstOnlineNodeIndex].isLeader = true;
          addLog(`Node ${updatedNodes[firstOnlineNodeIndex].id} elected as new leader.`);
          leaderElectionToastParams = { title: "Leader Election", description: `Node ${updatedNodes[firstOnlineNodeIndex].id} is now the leader.` };
        }
      }
      setNodes(updatedNodes);

      if (nodeFailureToastParams) {
        const params = nodeFailureToastParams;
        setTimeout(() => toast(params), 0);
      }
      if (leaderElectionToastParams) {
        const params = leaderElectionToastParams;
        setTimeout(() => toast(params), 0);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [nodes, addLog, toast]);


  const handleOperation = useCallback((operation: 'PUT' | 'GET' | 'DELETE', key: string, value?: string, clientConnectedNodeId?: string) => {
    if (!key) {
      setTimeout(() => toast({ title: "Error", description: "Key cannot be empty.", variant: "destructive" }), 0);
      addLog("Operation failed: Key is empty.");
      return;
    }
    if (operation === 'PUT' && (typeof value === 'undefined' || value === '')) {
      setTimeout(() => toast({ title: "Error", description: "Value cannot be empty for PUT.", variant: "destructive" }), 0);
      addLog("PUT operation failed: Value is empty.");
      return;
    }

    const currentOnlineNodes = nodes.filter(n => n.status === 'Online');
    if (currentOnlineNodes.length === 0) {
      setTimeout(() => toast({ title: "Error", description: "All nodes are offline. Cannot perform operation.", variant: "destructive" }), 0);
      addLog("Operation failed: All nodes offline.");
      return;
    }
    
    const connectedNode = nodes.find(n => n.id === clientConnectedNodeId && n.status === 'Online') || currentOnlineNodes.find(n => n.isLeader) || currentOnlineNodes[0];
    addLog(`Client connected to ${connectedNode.id}. Request: ${operation} ${key} ${value ? `(value: ${value.substring(0,20)}${value.length > 20 ? '...' : ''})` : ''}`);

    const primaryNodeIndex = getPrimaryNodeIndexForKey(key, nodes.length);
    const primaryNode = nodes[primaryNodeIndex];

    if (connectedNode.id !== primaryNode.id && primaryNode.status === 'Online') {
      addLog(`Node ${connectedNode.id} routing request for key '${key}' to primary Node ${primaryNode.id}.`);
    } else if (primaryNode.status !== 'Online' && operation !== 'GET') {
      addLog(`Primary node ${primaryNode.id} for key '${key}' is offline. Operation may target replicas.`);
    }

    let deferredToastParams: Parameters<typeof toast>[0] | null = null;

    setNodes(prevNodes => {
      const newNodes = prevNodes.map(n => ({...n, data: {...n.data}})); 

      const potentialTargets = newNodes.filter(n => n.status === 'Online');
      if (potentialTargets.length === 0 && operation !== 'GET') {
        deferredToastParams = { title: "Error", description: `No online nodes available for ${operation} on key '${key}'.`, variant: "destructive" };
        addLog(`${operation} for key '${key}' failed. No online nodes.`);
        return prevNodes;
      }

      const replicationNodes: Node[] = [];
      let startIndex = getPrimaryNodeIndexForKey(key, newNodes.length); // Use newNodes.length for current context
      
      for (let i = 0; i < newNodes.length && replicationNodes.length < REPLICATION_FACTOR; i++) {
          const currentNodeIndex = (startIndex + i) % newNodes.length;
          if (newNodes[currentNodeIndex].status === 'Online') {
              replicationNodes.push(newNodes[currentNodeIndex]);
          }
      }
      
      let replicationIssueNoted = false;
      if (replicationNodes.length === 0 && operation !== 'GET') {
         addLog(`Not enough online nodes to meet replication factor for ${operation} on key '${key}'.`);
         deferredToastParams = { title: "Warning", description: `Could not fully replicate ${key}. Limited online nodes.`, variant: "default" };
         replicationIssueNoted = true;
         if (potentialTargets.length > 0 && operation !== 'GET') replicationNodes.push(potentialTargets[0]);
         else {
            deferredToastParams = { title: "Error", description: `Failed to ${operation} key '${key}'. No online nodes.`, variant: "destructive" };
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
              if (!replicationIssueNoted) deferredToastParams = { title: "Success", description: `Key '${key}' set on ${putCount} node(s).` };
            } else {
               if (!replicationIssueNoted) deferredToastParams = { title: "Error", description: `Failed to PUT key '${key}'. No suitable node found.`, variant: "destructive" };
            }
          }
          break;
        case 'GET':
          let foundValue: string | undefined = undefined;
          let foundOnNode: string | undefined = undefined;

          const orderedNodesToQuery = [
            newNodes[getPrimaryNodeIndexForKey(key, newNodes.length)], 
            ...replicationNodes.filter(n => n.id !== newNodes[getPrimaryNodeIndexForKey(key, newNodes.length)].id),
            ...potentialTargets.filter(n => !replicationNodes.find(rn => rn.id === n.id) && n.id !== newNodes[getPrimaryNodeIndexForKey(key, newNodes.length)].id)
          ].filter(Boolean); // filter(Boolean) to remove undefined if primary node was offline and not in newNodes
          
          for (const nodeToQuery of orderedNodesToQuery) {
            if (nodeToQuery && nodeToQuery.status === 'Online' && key in nodeToQuery.data) {
              foundValue = nodeToQuery.data[key];
              foundOnNode = nodeToQuery.id;
              break;
            }
          }

          if (typeof foundValue !== 'undefined' && foundOnNode) {
            addLog(`Key '${key}' GET from Node ${foundOnNode}. Value: ${foundValue}`);
            const valSub = `${foundValue.substring(0,50)}${foundValue.length > 50 ? '...' : ''}`;
            deferredToastParams = { title: "Success", description: `Key '${key}' retrieved from ${foundOnNode}: ${valSub}` };
          } else {
            addLog(`Key '${key}' NOT FOUND in any active node.`);
            deferredToastParams = { title: "Not Found", description: `Key '${key}' not found.`, variant: "destructive" };
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
            if (!replicationIssueNoted) deferredToastParams = { title: "Success", description: `Key '${key}' deleted from ${deletedCount} node(s).` };
          } else {
            addLog(`Key '${key}' NOT FOUND for deletion.`);
            deferredToastParams = { title: "Not Found", description: `Key '${key}' not found for deletion.`, variant: "destructive" };
          }
          break;
      }
      return newNodes;
    });

    if (deferredToastParams) {
      const params = deferredToastParams;
      setTimeout(() => toast(params), 0);
    }
  }, [nodes, addLog, toast]);

  const toggleNodeStatus = useCallback((nodeId: string) => {
    let deferredToastParams: Parameters<typeof toast>[0] | null = null;

    setNodes(prevNodes => {
      const newNodes = [...prevNodes]; // Create a mutable copy
      const nodeIndex = newNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return prevNodes;

      const node = newNodes[nodeIndex];
      const newStatus = node.status === 'Online' ? 'Offline' : 'Online';
      addLog(`Node ${node.id} status changed to ${newStatus}.`);
      deferredToastParams = { title: "Node Status Update", description: `Node ${node.id} is now ${newStatus}.`};
      
      newNodes[nodeIndex] = { ...node, status: newStatus };

      if (newStatus === 'Offline' && node.isLeader) {
        newNodes[nodeIndex].isLeader = false;
        addLog(`Leader ${node.id} went offline. Triggering leader election.`);
      }
      
      if (newStatus === 'Online') {
        newNodes[nodeIndex].lastHeartbeat = Date.now();
        addLog(`Node ${node.id} is back online. Simulating data recovery...`);
        const onlineReplicas = newNodes.filter(n => n.status === 'Online' && n.id !== nodeId);
        if(onlineReplicas.length > 0) {
          const currentNodesLength = newNodes.length; // Use consistent length for hashing
          // Iterate over a representative set of keys, e.g., from one of the replicas.
          // A more robust system might have a global key list or specific recovery protocol.
          const sampleKeys = new Set<string>();
          onlineReplicas.forEach(r => Object.keys(r.data).forEach(k => sampleKeys.add(k)));

          sampleKeys.forEach(k => {
            const keyPrimaryNodeIndex = getPrimaryNodeIndexForKey(k, currentNodesLength);
            // Node recovers if it's primary or a designated replica (e.g., next one for simplicity)
            const isResponsibleForKey = keyPrimaryNodeIndex === nodeIndex || 
                                       (keyPrimaryNodeIndex + 1) % currentNodesLength === nodeIndex;

            if (isResponsibleForKey && !(k in newNodes[nodeIndex].data)) {
              for(const replica of onlineReplicas) {
                if (k in replica.data) {
                  newNodes[nodeIndex].data[k] = replica.data[k];
                  addLog(`Recovered key '${k}' for Node ${newNodes[nodeIndex].id} from Node ${replica.id}.`);
                  break; 
                }
              }
            }
          });
        } else {
            addLog(`No online replicas to recover data for Node ${newNodes[nodeIndex].id}. It will start empty or with existing data.`);
        }
      }
      return newNodes;
    });

    if (deferredToastParams) {
      const params = deferredToastParams;
      setTimeout(() => toast(params), 0);
    }
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

    