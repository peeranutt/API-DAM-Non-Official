export const storageServers = [
  process.env.STORAGE_SERVER_1 || 'http://10.0.11.25:3002',
  process.env.STORAGE_SERVER_2 || 'http://10.0.11.26:3002',
];

let currentIndex = 0;

export function getNextStorageServer() {
  const server = storageServers[currentIndex];
  currentIndex = (currentIndex + 1) % storageServers.length;
  return server;
}

export function getAllStorageServers() {
  return storageServers;
}
