// Prisma's JsonValue (read) and InputJsonValue (write) types don't match,
// causing type errors when passing JSON field values from one record to another.
// This declaration module makes JSON operations more permissive.
import { Prisma } from "@prisma/client";

declare module "@prisma/client" {
  namespace Prisma {
    // Allow JsonValue to be used as InputJsonValue
    type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
  }
}
