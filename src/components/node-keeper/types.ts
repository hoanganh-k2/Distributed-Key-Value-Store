export interface Node {
  id: string;
  address: string;
  status: 'Online' | 'Offline' | 'Recovering' | 'Unreachable';
  data: Record<string, string>;
  isLeader?: boolean;
  lastHeartbeat: number;
}
