#!/usr/bin/env node
import assert from "node:assert/strict";
import { createDimWireCodec, createIndexSDK } from "../dist/index.js";

const schema = {
  axes: {
    role: { entries: ["admin", "viewer"] },
    action: { entries: ["read", "write"] },
    region: { entries: ["asia", "eu"], capacity: 4 },
  },
  prefixes: {
    permission: { dims: ["role", "action"] },
    regionalPermission: { dims: ["role", "action", "region"] },
  },
};

const typedSdk = createIndexSDK(schema);
const permissionAddress = typedSdk.encode("permission", {
  role: "admin",
  action: "write",
});
assert.deepEqual(typedSdk.decode("permission", permissionAddress), {
  role: "admin",
  action: "write",
});

const regionalAddress = typedSdk.encode("regionalPermission", {
  role: "viewer",
  action: "read",
  region: "eu",
});
assert.deepEqual(typedSdk.decode("regionalPermission", regionalAddress), {
  role: "viewer",
  action: "read",
  region: "eu",
});

const catalog = {
  id: "smoke",
  name: "Codec Smoke Catalog",
  axes: {
    role: {
      id: "role",
      name: "Role",
      versions: { v1: { entries: ["admin", "viewer"] } },
    },
    action: {
      id: "action",
      name: "Action",
      versions: { v1: { entries: ["read", "write"] } },
    },
  },
  prefixes: {
    permission: {
      id: "permission",
      name: "Permission",
      labels: ["role", "action"],
      dims: {
        role: { kind: "axis", axisId: "role" },
        action: { kind: "axis", axisId: "action" },
      },
      versions: [
        {
          version: "v1",
          axisVersions: { role: "v1", action: "v1" },
        },
      ],
    },
  },
};

const dimWire = createDimWireCodec(catalog);
const dims = dimWire.encodeDims("permission", {
  role: "viewer",
  action: "write",
});
assert.deepEqual(dims, { role: 2, action: 2 });
assert.deepEqual(dimWire.decodeDims("permission", dims), {
  role: "viewer",
  action: "write",
});
assert.equal(
  dimWire.dimsToAddress("permission", dimWire.addressToDims("permission", 2, "v1"), "v1"),
  2,
);

console.log("codec smoke passed");
