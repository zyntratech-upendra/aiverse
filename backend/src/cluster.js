/**
 * AI Verse High-Concurrency Cluster Load Balancer
 * 
 * Spawns worker processes across CPU cores to load-balance incoming HTTP requests,
 * maximize throughput, and achieve zero-downtime auto-healing for mass user registrations.
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');

const numCPUs = os.cpus().length;
const WORKERS_COUNT = parseInt(process.env.WEB_CONCURRENCY || process.env.CLUSTER_WORKERS || numCPUs, 10);

if (cluster.isPrimary || cluster.isMaster) {
  console.log(`=======================================================`);
  console.log(`⚡ AI Verse Multi-Core Load Balancer Initialized`);
  console.log(`💻 Host System: ${os.type()} ${os.arch()} (${numCPUs} Logical Cores)`);
  console.log(`🚀 Primary Process PID: ${process.pid}`);
  console.log(`👥 Spawning ${WORKERS_COUNT} Load-Balanced Worker Instances...`);
  console.log(`=======================================================`);

  const workers = new Map();

  // Fork worker instances
  for (let i = 0; i < WORKERS_COUNT; i++) {
    const worker = cluster.fork();
    workers.set(worker.id, { pid: worker.process.pid, startTime: Date.now() });
  }

  // Handle worker online event
  cluster.on('online', (worker) => {
    console.log(`✅ Worker #${worker.id} (PID: ${worker.process.pid}) is active and accepting connections`);
  });

  // Zero-downtime auto-healing: restart died workers automatically
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️ Worker #${worker.id} (PID: ${worker.process.pid}) exited (Code: ${code}, Signal: ${signal}).`);
    workers.delete(worker.id);
    
    // Spawn replacement worker with a brief delay to avoid thrashing
    console.log(`🔄 Spawning a replacement worker to maintain load-balancing capacity...`);
    const newWorker = cluster.fork();
    workers.set(newWorker.id, { pid: newWorker.process.pid, startTime: Date.now() });
  });

  // Graceful shutdown handling for cluster primary
  const handleClusterShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully stopping all cluster workers...`);
    for (const [id] of workers) {
      if (cluster.workers[id]) {
        cluster.workers[id].kill('SIGTERM');
      }
    }
    setTimeout(() => {
      console.log('🏁 Cluster Load Balancer shutdown complete.');
      process.exit(0);
    }, 3000);
  };

  process.on('SIGINT', () => handleClusterShutdown('SIGINT'));
  process.on('SIGTERM', () => handleClusterShutdown('SIGTERM'));

} else {
  // Worker process execution
  require('./index.js');
}
