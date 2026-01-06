export const storageServers = [
  process.env.STORAGE_SERVER_1 || 'http://10.0.11.25:5432',
  process.env.STORAGE_SERVER_2 || 'http://10.0.11.26:5432',
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
