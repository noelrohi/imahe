import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { handle } from "hono/vercel";
import { cors } from "hono/cors";
import { APP_NAME } from "@/constants";
import { env } from "@/env";

export const runtime = "nodejs";

// Define the route for example endpoint
const exampleRoute = createRoute({
  method: "get",
  path: "/example",
  responses: {
    200: {
      description: "Returns hello world",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
  tags: ["Example"],
});

const app = new OpenAPIHono().basePath("/api");

app.use("/api/*", cors());

app.openapi(exampleRoute, (c) => {
  return c.json({ message: "hello world" });
});

// The OpenAPI documentation will be available at /api/doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: `${APP_NAME} API`,
    description: `API for ${APP_NAME}`,
  },
  servers: [
    {
      url: `${env.NEXT_PUBLIC_APP_URL}`,
      description: "Production environment",
    },
    {
      url: "http://localhost:3000",
      description: "Local environment",
    },
  ],
});

app.get("/reference", Scalar({ url: "/api/doc" }));

export const GET = handle(app);
export const POST = handle(app);
