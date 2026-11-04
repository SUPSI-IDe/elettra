import net from "node:net";

import { expect, test } from "@playwright/test";

import { resolveStagingTargets } from "../../test-support/staging-targets.mjs";


const targets = resolveStagingTargets();


function expectReachableDatabasePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host: targets.databaseHost,
      port: targets.databasePort,
    });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timed out connecting to the staging database on port 9004"));
    }, 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}


test("the required frontend, backend, and database staging chain is active", async ({
  request,
}) => {
  await expectReachableDatabasePort();

  const backendHealth = await request.get(`${targets.backendUrl}/health`);
  expect(backendHealth.status()).toBe(200);
  const backendHealthBody = await backendHealth.json();
  expect(backendHealthBody.services?.database?.status).toBe("healthy");

  const frontendHealth = await request.get(`${targets.frontendUrl}/health`);
  expect(frontendHealth.status()).toBe(200);

  const directVersion = await request.get(`${targets.backendUrl}/api/v1/version`);
  const proxiedVersion = await request.get(
    `${targets.frontendUrl}/api/v1/version`,
  );
  expect(directVersion.status()).toBe(200);
  expect(proxiedVersion.status()).toBe(200);
  expect(await proxiedVersion.json()).toEqual(await directVersion.json());

  const application = await request.get(`${targets.frontendUrl}/elettra/`);
  expect(application.status()).toBe(200);
});
