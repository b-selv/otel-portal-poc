// Next.js calls this before the server is ready.
// EDOT itself is preloaded by NODE_OPTIONS in the container command.
// Do not initialize a second OpenTelemetry SDK here.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Importing the API here is optional; this hook is also a useful place
    // for future Node.js-only startup checks.
    await import("@opentelemetry/api");
  }
}
