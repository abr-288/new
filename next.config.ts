import type { NextConfig } from "next";
import os from "node:os";

// Adresses IPv4 du poste sur le réseau local : autorise l'accès au serveur de développement
// depuis un autre appareil du même réseau (http://<ip-du-poste>:3000). Sans effet en production.
const lanHosts = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  // PGlite (base embarquée de développement) charge des fichiers WebAssembly : on le laisse hors du bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  allowedDevOrigins: lanHosts,
};

export default nextConfig;
